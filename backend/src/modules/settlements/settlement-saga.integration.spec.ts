import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { AuctionGateway } from '../bids/auction.gateway';
import { Bid, BidStatus } from '../bids/entities/bid.entity';
import { DepositsService } from '../deposits/deposits.service';
import { Deposit, DepositStatus } from '../deposits/entities/deposit.entity';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { AccountStatus, User } from '../users/entities/user.entity';
import { Offer, OfferStatus } from './entities/offer.entity';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { SettlementsService } from './settlements.service';

/**
 * End-to-End Saga Flow Integration Test:
 * Kiểm thử toàn bộ vòng đời hậu đấu giá đa bước (Long-running Post-Auction Saga):
 * 1. Chốt phiên thành công (Auction ENDED, Winner Invoice PENDING, Non-winners refunded)
 * 2. Người thắng bùng hàng quá hạn (Winner Invoice CANCELED, Deposit FORFEITED)
 * 3. Bù trừ và mời Á quân 1 (Runner-up 1 Offer PENDING)
 * 4. Á quân 1 từ chối (Offer 1 DECLINED -> Tự động chuyển mời Á quân 2)
 * 5. Á quân 2 chấp nhận (Offer 2 ACCEPTED -> Auction cập nhật giá mới & người thắng mới, Invoice mới)
 * 6. Á quân 2 thanh toán thành công (Invoice PAID, Saga SETTLED, hoàn cọc Á quân 2)
 */
describe('Post-Auction Saga Workflow Integration Test', () => {
  let settlementsService: SettlementsService;
  let invoicesService: InvoicesService;
  let auctionGateway: Partial<Record<keyof AuctionGateway, jest.Mock>>;

  // In-Memory state store simulating the relational database across steps
  const db = {
    auctions: new Map<string, Auction>(),
    users: new Map<string, User>(),
    bids: new Map<string, Bid>(),
    deposits: new Map<string, Deposit>(),
    invoices: new Map<string, Invoice>(),
    settlements: new Map<string, Settlement>(),
    offers: new Map<string, Offer>(),
  };

  beforeEach(async () => {
    // Reset state
    db.auctions.clear();
    db.users.clear();
    db.bids.clear();
    db.deposits.clear();
    db.invoices.clear();
    db.settlements.clear();
    db.offers.clear();

    auctionGateway = {
      emitAuctionEnded: jest.fn(),
      emitOfferReceived: jest.fn(),
      emitInvoiceCreated: jest.fn(),
    };

    // Mock DataSource Transaction Manager wired to in-memory store
    const mockEntityManager = {
      findOne: jest.fn().mockImplementation((entityClass, options) => {
        const where = options?.where || {};
        if (entityClass === Auction)
          return Promise.resolve(db.auctions.get(where.id) || null);
        if (entityClass === User)
          return Promise.resolve(db.users.get(where.id) || null);
        if (entityClass === Settlement)
          return Promise.resolve(
            Array.from(db.settlements.values()).find(
              (s) => s.auctionId === where.auctionId,
            ) || null,
          );
        if (entityClass === Invoice)
          return Promise.resolve(
            Array.from(db.invoices.values()).find(
              (i) =>
                i.id === where.id ||
                (i.auctionId === where.auctionId &&
                  i.winnerId === where.winnerId),
            ) || null,
          );
        if (entityClass === Offer)
          return Promise.resolve(db.offers.get(where.id) || null);
        if (entityClass === Bid)
          return Promise.resolve(
            Array.from(db.bids.values()).find(
              (b) =>
                b.auctionId === where.auctionId &&
                b.bidderId === where.bidderId,
            ) || null,
          );
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation((entityClass, options) => {
        const where = options?.where || {};
        if (entityClass === Bid) {
          const matching = Array.from(db.bids.values())
            .filter((b) => b.auctionId === where.auctionId)
            .sort((a, b) => b.amount - a.amount);
          return Promise.resolve(matching);
        }
        if (entityClass === Offer) {
          return Promise.resolve(
            Array.from(db.offers.values()).filter(
              (o) => o.auctionId === where.auctionId,
            ),
          );
        }
        return Promise.resolve([]);
      }),
      create: jest.fn().mockImplementation((entityClass, data) => ({
        id: `gen-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      })),
      save: jest.fn().mockImplementation((entityClass, entity) => {
        if (
          entityClass === Invoice ||
          (entity.amount !== undefined && entity.dueDate !== undefined)
        ) {
          db.invoices.set(entity.id, entity);
        } else if (
          entityClass === Settlement ||
          (entity.auctionId !== undefined && entity.step !== undefined)
        ) {
          db.settlements.set(entity.id, entity);
        } else if (entityClass === Offer || entity.offeredPrice !== undefined) {
          db.offers.set(entity.id, entity);
        } else if (entityClass === Deposit) {
          db.deposits.set(entity.id, entity);
        } else if (entityClass === Auction) {
          db.auctions.set(entity.id, entity);
        }
        return Promise.resolve(entity);
      }),
      update: jest.fn().mockImplementation((entityClass, criteria, partial) => {
        if (entityClass === Auction) {
          const auc = db.auctions.get(criteria.id);
          if (auc) Object.assign(auc, partial);
        } else if (entityClass === Settlement) {
          const set = Array.from(db.settlements.values()).find(
            (s) => s.auctionId === criteria.auctionId,
          );
          if (set) Object.assign(set, partial);
        } else if (entityClass === User) {
          const u = db.users.get(criteria.id);
          if (u) Object.assign(u, partial);
        } else if (entityClass === Deposit) {
          Array.from(db.deposits.values()).forEach((d) => {
            if (
              d.auctionId === criteria.auctionId &&
              d.userId === criteria.userId &&
              d.status === criteria.status
            ) {
              Object.assign(d, partial);
            }
          });
        }
        return Promise.resolve({ affected: 1 });
      }),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        let auctionId = '';
        let winnerId: string | undefined;
        let heldStatus: string | undefined;
        let newStatus: DepositStatus;

        const qb: any = {
          update: jest.fn().mockImplementation(() => qb),
          set: jest.fn().mockImplementation((val: any) => {
            newStatus = val.status;
            return qb;
          }),
          where: jest.fn().mockImplementation((clause: string, params: any) => {
            if (params?.auctionId) auctionId = params.auctionId;
            return qb;
          }),
          andWhere: jest
            .fn()
            .mockImplementation((clause: string, params: any) => {
              if (params?.winnerId) winnerId = params.winnerId;
              if (params?.heldStatus) heldStatus = params.heldStatus;
              return qb;
            }),
          execute: jest.fn().mockImplementation(() => {
            let count = 0;
            Array.from(db.deposits.values()).forEach((d) => {
              if (
                d.auctionId === auctionId &&
                (!winnerId || d.userId !== winnerId) &&
                (!heldStatus || d.status === heldStatus)
              ) {
                d.status = newStatus;
                count++;
              }
            });
            return Promise.resolve({ affected: count });
          }),
        };
        return qb;
      }),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    };

    const mockDepositsRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const d = Array.from(db.deposits.values()).find(
          (dep) =>
            dep.auctionId === where.auctionId &&
            dep.userId === where.userId &&
            (!where.status || dep.status === where.status),
        );
        return Promise.resolve(d || null);
      }),
      update: jest.fn().mockImplementation((criteria, partial) => {
        let count = 0;
        Array.from(db.deposits.values()).forEach((d) => {
          if (
            d.auctionId === criteria.auctionId &&
            d.userId === criteria.userId &&
            (!criteria.status || d.status === criteria.status)
          ) {
            Object.assign(d, partial);
            count++;
          }
        });
        return Promise.resolve({ affected: count });
      }),
      createQueryBuilder: mockEntityManager.createQueryBuilder,
      create: mockEntityManager.create,
      save: mockEntityManager.save,
    };

    const mockInvoicesRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const inv = db.invoices.get(where.id);
        return Promise.resolve(inv || null);
      }),
      find: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const list = Array.from(db.invoices.values()).filter(
          (i) => !where.winnerId || i.winnerId === where.winnerId,
        );
        return Promise.resolve(list);
      }),
      create: mockEntityManager.create,
      save: mockEntityManager.save,
    };

    const mockOffersRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const off = db.offers.get(where.id);
        return Promise.resolve(off || null);
      }),
      find: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const list = Array.from(db.offers.values()).filter(
          (o) => !where.bidderId || o.bidderId === where.bidderId,
        );
        return Promise.resolve(list);
      }),
      create: mockEntityManager.create,
      save: mockEntityManager.save,
    };

    const mockAuctionsRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        return Promise.resolve(db.auctions.get(where.id) || null);
      }),
      find: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(Array.from(db.auctions.values())),
        ),
      update: mockEntityManager.update,
    };

    const mockSettlementsRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        const where = opts?.where || {};
        const set = Array.from(db.settlements.values()).find(
          (s) => s.auctionId === where.auctionId,
        );
        return Promise.resolve(set || null);
      }),
      create: mockEntityManager.create,
      save: mockEntityManager.save,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        InvoicesService,
        DepositsService,
        {
          provide: getRepositoryToken(Settlement),
          useValue: mockSettlementsRepo,
        },
        { provide: getRepositoryToken(Offer), useValue: mockOffersRepo },
        { provide: getRepositoryToken(Auction), useValue: mockAuctionsRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoicesRepo },
        { provide: getRepositoryToken(Deposit), useValue: mockDepositsRepo },
        { provide: AuctionGateway, useValue: auctionGateway },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    settlementsService = module.get<SettlementsService>(SettlementsService);
    invoicesService = module.get<InvoicesService>(InvoicesService);
  });

  it('executes the full Saga lifecycle: Close -> Default -> Decline 1 -> Accept 2 -> Pay -> Settle', async () => {
    // 0. KHỞI TẠO DỮ LIỆU ĐẦU VÀO
    const auctionId = 'auction-macbook-m3';
    const userA = {
      id: 'user-a',
      email: 'winner@test.com',
      ratingScore: 5.0,
      accountStatus: AccountStatus.ACTIVE,
    } as User;
    const userB = {
      id: 'user-b',
      email: 'runner1@test.com',
      ratingScore: 5.0,
      accountStatus: AccountStatus.ACTIVE,
    } as User;
    const userC = {
      id: 'user-c',
      email: 'runner2@test.com',
      ratingScore: 5.0,
      accountStatus: AccountStatus.ACTIVE,
    } as User;
    db.users.set(userA.id, userA);
    db.users.set(userB.id, userB);
    db.users.set(userC.id, userC);

    const auction = {
      id: auctionId,
      status: AuctionStatus.ACTIVE,
      currentPrice: 25_000_000,
      highestBidderId: userA.id,
      endTime: new Date(Date.now() - 1000), // đã hết giờ
    } as Auction;
    db.auctions.set(auctionId, auction);

    // Cả 3 người đều đã cọc HELD
    db.deposits.set('dep-a', {
      id: 'dep-a',
      auctionId,
      userId: userA.id,
      amount: 2_000_000,
      status: DepositStatus.HELD,
    } as Deposit);
    db.deposits.set('dep-b', {
      id: 'dep-b',
      auctionId,
      userId: userB.id,
      amount: 2_000_000,
      status: DepositStatus.HELD,
    } as Deposit);
    db.deposits.set('dep-c', {
      id: 'dep-c',
      auctionId,
      userId: userC.id,
      amount: 2_000_000,
      status: DepositStatus.HELD,
    } as Deposit);

    // Danh sách 3 lượt đặt giá (User A cao nhất, sau đó B, sau đó C)
    db.bids.set('bid-a', {
      id: 'bid-a',
      auctionId,
      bidderId: userA.id,
      amount: 25_000_000,
      status: BidStatus.VALID,
      bidder: userA,
    } as Bid);
    db.bids.set('bid-b', {
      id: 'bid-b',
      auctionId,
      bidderId: userB.id,
      amount: 23_000_000,
      status: BidStatus.OUTBID,
      bidder: userB,
    } as Bid);
    db.bids.set('bid-c', {
      id: 'bid-c',
      auctionId,
      bidderId: userC.id,
      amount: 21_000_000,
      status: BidStatus.OUTBID,
      bidder: userC,
    } as Bid);

    // BƯỚC 1: HẾT GIỜ ĐẤU GIÁ (CRON CLOSE AUCTION)
    await settlementsService.settleExpiredAuction(auction);

    expect(auction.status).toBe(AuctionStatus.ENDED);
    const invoiceA = Array.from(db.invoices.values()).find(
      (i) => i.auctionId === auctionId,
    );
    expect(invoiceA).toBeDefined();
    expect(invoiceA!.winnerId).toBe(userA.id);
    expect(invoiceA!.amount).toBe(25_000_000);
    expect(invoiceA!.status).toBe(InvoiceStatus.PENDING);

    // Cọc của người thắng A vẫn bị HELD
    expect(db.deposits.get('dep-a')!.status).toBe(DepositStatus.HELD);
    // Cọc của người thua B và C tự động REFUNDED
    expect(db.deposits.get('dep-b')!.status).toBe(DepositStatus.REFUNDED);
    expect(db.deposits.get('dep-c')!.status).toBe(DepositStatus.REFUNDED);

    const settlement = Array.from(db.settlements.values()).find(
      (s) => s.auctionId === auctionId,
    );
    expect(settlement).toBeDefined();
    expect(settlement!.status).toBe(SettlementStatus.INVOICE_PENDING);
    expect(settlement!.step).toBe('INITIAL_INVOICE');
    expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith(
      auctionId,
      expect.objectContaining({ status: 'ENDED' }),
    );

    // BƯỚC 2: NGƯỜI THẮNG A QUÁ HẠN THANH TOÁN (OVERDUE COMPENSATING TRANSACTION)
    invoiceA!.dueDate = new Date(Date.now() - 1000); // hết hạn 3 ngày
    await settlementsService.handleSingleOverdueInvoice(invoiceA!);

    // Hóa đơn A bị hủy, cọc A bị tịch thu phạt
    expect(invoiceA!.status).toBe(InvoiceStatus.CANCELED);
    expect(db.deposits.get('dep-a')!.status).toBe(DepositStatus.FORFEITED);
    expect(userA.ratingScore).toBe(4.0); // vi phạm bị trừ điểm

    // Saga chuyển sang FALLBACK_RUNNER_UP và tạo Offer cho User B
    expect(settlement!.status).toBe(SettlementStatus.FALLBACK_RUNNER_UP);
    expect(settlement!.step).toBe('RUNNER_UP_OFFER');

    const offerB = Array.from(db.offers.values()).find(
      (o) => o.bidderId === userB.id,
    );
    expect(offerB).toBeDefined();
    expect(offerB!.offeredPrice).toBe(23_000_000);
    expect(offerB!.status).toBe(OfferStatus.PENDING);
    expect(auctionGateway.emitOfferReceived).toHaveBeenCalledWith(
      userB.id,
      expect.objectContaining({ offeredPrice: 23_000_000 }),
    );

    // BƯỚC 3: Á QUÂN 1 (USER B) TỪ CHỐI LỜI MỜI MUA
    await settlementsService.declineOffer(offerB!.id, userB.id);
    expect(offerB!.status).toBe(OfferStatus.DECLINED);

    // Saga tự động tìm và mời tiếp Á quân 2 (User C)
    const offerC = Array.from(db.offers.values()).find(
      (o) => o.bidderId === userC.id,
    );
    expect(offerC).toBeDefined();
    expect(offerC!.offeredPrice).toBe(21_000_000);
    expect(offerC!.status).toBe(OfferStatus.PENDING);
    expect(auctionGateway.emitOfferReceived).toHaveBeenCalledWith(
      userC.id,
      expect.objectContaining({ offeredPrice: 21_000_000 }),
    );

    // BƯỚC 4: Á QUÂN 2 (USER C) CHẤP NHẬN LỜI MỜI MUA
    const acceptResult = await settlementsService.acceptOffer(
      offerC!.id,
      userC.id,
    );
    expect(offerC!.status).toBe(OfferStatus.ACCEPTED);
    expect(auction.highestBidderId).toBe(userC.id);
    expect(auction.currentPrice).toBe(21_000_000);

    const invoiceC = acceptResult.invoice;
    expect(invoiceC).toBeDefined();
    expect(invoiceC.winnerId).toBe(userC.id);
    expect(invoiceC.amount).toBe(21_000_000);
    expect(invoiceC.status).toBe(InvoiceStatus.PENDING);
    expect(settlement!.status).toBe(SettlementStatus.INVOICE_PENDING);
    expect(settlement!.step).toBe('RUNNER_UP_INVOICE');

    // BƯỚC 5: Á QUÂN 2 (USER C) THANH TOÁN HÓA ĐƠN
    db.deposits.set('dep-c', {
      id: 'dep-c',
      auctionId,
      userId: userC.id,
      amount: 2_000_000,
      status: DepositStatus.HELD,
    } as Deposit);
    const paidInvoice = await invoicesService.payInvoice(invoiceC.id, userC.id);

    expect(paidInvoice.status).toBe(InvoiceStatus.PAID);
    expect(settlement!.status).toBe(SettlementStatus.SETTLED);
    expect(settlement!.step).toBe('COMPLETED');
    expect(db.deposits.get('dep-c')!.status).toBe(DepositStatus.REFUNDED);

    // SAGA HOÀN TẤT THÀNH CÔNG RỰC RỠ!
  });
});
