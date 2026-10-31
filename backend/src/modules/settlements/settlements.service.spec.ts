import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { AuctionGateway } from '../bids/auction.gateway';
import { Bid, BidStatus } from '../bids/entities/bid.entity';
import { DepositsService } from '../deposits/deposits.service';
import { Deposit, DepositStatus } from '../deposits/entities/deposit.entity';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { AccountStatus, User } from '../users/entities/user.entity';
import { Offer, OfferStatus } from './entities/offer.entity';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let settlementsRepo: Partial<Record<keyof Repository<Settlement>, jest.Mock>>;
  let offersRepo: Partial<Record<keyof Repository<Offer>, jest.Mock>>;
  let auctionsRepo: Partial<Record<keyof Repository<Auction>, jest.Mock>>;
  let invoicesRepo: Partial<Record<keyof Repository<Invoice>, jest.Mock>>;
  let depositsService: Partial<Record<keyof DepositsService, jest.Mock>>;
  let auctionGateway: Partial<Record<keyof AuctionGateway, jest.Mock>>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    settlementsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    offersRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    auctionsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    invoicesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    depositsService = {
      refundNonWinners: jest.fn().mockResolvedValue(1),
      forfeitDeposit: jest.fn().mockResolvedValue(true),
      refundWinner: jest.fn().mockResolvedValue(true),
    };

    auctionGateway = {
      emitAuctionEnded: jest.fn(),
      emitOfferReceived: jest.fn(),
      emitInvoiceCreated: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementsRepo,
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: offersRepo,
        },
        {
          provide: getRepositoryToken(Auction),
          useValue: auctionsRepo,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoicesRepo,
        },
        {
          provide: DepositsService,
          useValue: depositsService,
        },
        {
          provide: AuctionGateway,
          useValue: auctionGateway,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SettlementsService>(SettlementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('settleExpiredAuction', () => {
    it('successfully ends auction with winner, generates Invoice and Settlement, refunds non-winners, and emits events', async () => {
      const mockAuction = {
        id: 'auc-1',
        highestBidderId: 'winner-1',
        currentPrice: 5_000_000,
        status: AuctionStatus.ACTIVE,
      } as Auction;

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Bid) {
            return Promise.resolve({ id: 'bid-win', amount: 5_000_000 });
          }
          if (entityClass === Invoice) return Promise.resolve(null);
          if (entityClass === Settlement) return Promise.resolve(null);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => data),
        save: jest.fn().mockImplementation((entityClass, data) => Promise.resolve({ id: 'saved-id', ...data })),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(mockManager.update).toHaveBeenCalledWith(Auction, { id: 'auc-1' }, { status: AuctionStatus.ENDED });
      expect(mockManager.create).toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({
          auctionId: 'auc-1',
          winnerId: 'winner-1',
          amount: 5_000_000,
          status: InvoiceStatus.PENDING,
        }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        Settlement,
        expect.objectContaining({
          auctionId: 'auc-1',
          winnerId: 'winner-1',
          status: SettlementStatus.INVOICE_PENDING,
          step: 'INITIAL_INVOICE',
        }),
      );
      expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith('auc-1', {
        auctionId: 'auc-1',
        status: 'ENDED',
        winnerId: 'winner-1',
        finalPrice: 5_000_000,
      });
      expect(auctionGateway.emitInvoiceCreated).toHaveBeenCalled();
    });

    it('marks auction FAILED and creates FAILED settlement if there were no bids', async () => {
      const mockAuction = {
        id: 'auc-no-bids',
        highestBidderId: null,
        currentPrice: 1_000_000,
        status: AuctionStatus.ACTIVE,
      } as unknown as Auction;

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((entityClass, data) => data),
        save: jest.fn().mockImplementation((entityClass, data) => Promise.resolve({ id: 'set-id', ...data })),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(mockManager.update).toHaveBeenCalledWith(Auction, { id: 'auc-no-bids' }, { status: AuctionStatus.FAILED });
      expect(mockManager.create).toHaveBeenCalledWith(
        Settlement,
        expect.objectContaining({
          auctionId: 'auc-no-bids',
          status: SettlementStatus.FAILED,
          failureReason: 'NO_BIDS',
        }),
      );
      expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith('auc-no-bids', {
        auctionId: 'auc-no-bids',
        status: 'FAILED',
      });
    });
  });

  describe('handleSingleOverdueInvoice', () => {
    it('cancels overdue invoice, forfeits winner deposit, records violation, and invites runner-up', async () => {
      const mockInvoice = {
        id: 'inv-overdue',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
        status: InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() - 1000),
        auction: { product: { title: 'MacBook' } },
      } as unknown as Invoice;

      const mockSettlement = {
        id: 'settle-1',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
        status: SettlementStatus.INVOICE_PENDING,
      };

      const mockRunnerUpBid = {
        id: 'bid-runner-up',
        auctionId: 'auc-1',
        bidderId: 'runner-up-1',
        amount: 4_500_000,
        bidder: { accountStatus: AccountStatus.ACTIVE },
      };

      const mockManager = {
        save: jest.fn().mockImplementation((entityClass, d) => Promise.resolve({ id: 'saved-id', ...d })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass, opts) => {
          if (entityClass === User) {
            return Promise.resolve({ id: 'winner-1', email: 'winner@test.com', ratingScore: 5.0 });
          }
          if (entityClass === Settlement) {
            return Promise.resolve(mockSettlement);
          }
          return Promise.resolve(null);
        }),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve([]);
          if (entityClass === Bid) return Promise.resolve([
            { id: 'bid-win', bidderId: 'winner-1', amount: 5_000_000 },
            mockRunnerUpBid,
          ]);
          return Promise.resolve([]);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => data),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.handleSingleOverdueInvoice(mockInvoice);

      // Check invoice canceled
      expect(mockInvoice.status).toBe(InvoiceStatus.CANCELED);
      // Check deposit forfeited
      expect(mockManager.update).toHaveBeenCalledWith(
        Deposit,
        { auctionId: 'auc-1', userId: 'winner-1', status: DepositStatus.HELD },
        { status: DepositStatus.FORFEITED },
      );
      // Check violation recorded
      expect(mockManager.update).toHaveBeenCalledWith(
        User,
        { id: 'winner-1' },
        { ratingScore: 4.0 },
      );
      // Check offer created for runner-up
      expect(mockManager.create).toHaveBeenCalledWith(
        Offer,
        expect.objectContaining({
          auctionId: 'auc-1',
          bidderId: 'runner-up-1',
          offeredPrice: 4_500_000,
          status: OfferStatus.PENDING,
        }),
      );
      expect(auctionGateway.emitOfferReceived).toHaveBeenCalledWith(
        'runner-up-1',
        expect.objectContaining({
          auctionId: 'auc-1',
          offeredPrice: 4_500_000,
        }),
      );
    });

    it('marks auction and settlement FAILED if no runner-up remains', async () => {
      const mockInvoice = {
        id: 'inv-overdue',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
        status: InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() - 1000),
      } as unknown as Invoice;

      const mockSettlement = {
        id: 'settle-1',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
        status: SettlementStatus.INVOICE_PENDING,
      };

      const mockManager = {
        save: jest.fn().mockImplementation((entityClass, d) => Promise.resolve(d)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === User) return Promise.resolve(null);
          if (entityClass === Settlement) return Promise.resolve(mockSettlement);
          return Promise.resolve(null);
        }),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve([]);
          if (entityClass === Bid) return Promise.resolve([
            { id: 'bid-win', bidderId: 'winner-1', amount: 5_000_000 },
          ]); // only winner's bid, no other bidders!
          return Promise.resolve([]);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => data),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.handleSingleOverdueInvoice(mockInvoice);

      expect(mockSettlement.status).toBe(SettlementStatus.FAILED);
      expect(mockManager.update).toHaveBeenCalledWith(Auction, { id: 'auc-1' }, { status: AuctionStatus.FAILED });
      expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith('auc-1', {
        auctionId: 'auc-1',
        status: 'FAILED',
      });
    });
  });

  describe('acceptOffer', () => {
    it('throws NotFoundException if offer does not exist', async () => {
      offersRepo.findOne!.mockResolvedValue(null);

      await expect(service.acceptOffer('off-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user is not recipient', async () => {
      offersRepo.findOne!.mockResolvedValue({
        id: 'off-1',
        bidderId: 'user-2',
      });

      await expect(service.acceptOffer('off-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if offer is not PENDING', async () => {
      offersRepo.findOne!.mockResolvedValue({
        id: 'off-1',
        bidderId: 'user-1',
        status: OfferStatus.DECLINED,
      });

      await expect(service.acceptOffer('off-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully accepts offer: marks ACCEPTED, updates auction, creates new invoice, and emits realtime', async () => {
      const mockOffer = {
        id: 'off-1',
        auctionId: 'auc-1',
        bidderId: 'user-1',
        bidId: 'bid-1',
        offeredPrice: 4_000_000,
        status: OfferStatus.PENDING,
        expiresAt: new Date(Date.now() + 10_000_000),
      };

      offersRepo.findOne!.mockResolvedValue(mockOffer);

      const mockManager = {
        save: jest.fn().mockImplementation((entityClass, d) => Promise.resolve({ id: 'inv-new', ...d })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockImplementation((entityClass, d) => d),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.acceptOffer('off-1', 'user-1');
      expect(result.offer.status).toBe(OfferStatus.ACCEPTED);
      expect(mockManager.update).toHaveBeenCalledWith(
        Auction,
        { id: 'auc-1' },
        { highestBidderId: 'user-1', currentPrice: 4_000_000 },
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({
          auctionId: 'auc-1',
          winnerId: 'user-1',
          amount: 4_000_000,
          status: InvoiceStatus.PENDING,
        }),
      );
      expect(auctionGateway.emitInvoiceCreated).toHaveBeenCalled();
    });
  });

  describe('declineOffer', () => {
    it('successfully marks offer DECLINED and triggers search for next runner-up', async () => {
      const mockOffer = {
        id: 'off-1',
        auctionId: 'auc-1',
        bidderId: 'user-1',
        status: OfferStatus.PENDING,
      };

      offersRepo.findOne!.mockResolvedValue(mockOffer);

      const mockManager = {
        save: jest.fn().mockImplementation((entityClass, d) => Promise.resolve(d)),
        findOne: jest.fn().mockResolvedValue({ id: 'set-1', auctionId: 'auc-1' }),
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockImplementation((entityClass, d) => d),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.declineOffer('off-1', 'user-1');
      expect(mockOffer.status).toBe(OfferStatus.DECLINED);
      expect(result.message).toContain('Đã từ chối lời mời mua thành công');
    });
  });
});
