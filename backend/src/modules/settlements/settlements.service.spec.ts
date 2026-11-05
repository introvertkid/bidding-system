import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { AuctionGateway } from '../bids/auction.gateway';
import { Bid } from '../bids/entities/bid.entity';
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

  describe('closeExpiredAuctions', () => {
    it('returns early if already running', async () => {
      (service as any).isClosingAuctions = true;
      await service.closeExpiredAuctions();
      expect(auctionsRepo.find).not.toHaveBeenCalled();
      (service as any).isClosingAuctions = false;
    });

    it('does nothing if no expired auctions found', async () => {
      auctionsRepo.find!.mockResolvedValue([]);
      await service.closeExpiredAuctions();
      expect(auctionsRepo.find).toHaveBeenCalled();
    });

    it('settles all found expired auctions', async () => {
      const mockAuctions = [
        { id: 'auc-1', status: AuctionStatus.ACTIVE },
      ] as Auction[];
      auctionsRepo.find!.mockResolvedValue(mockAuctions);
      const settleSpy = jest
        .spyOn(service, 'settleExpiredAuction')
        .mockResolvedValue(undefined);

      await service.closeExpiredAuctions();
      expect(settleSpy).toHaveBeenCalledWith(mockAuctions[0]);
    });

    it('catches and logs error without throwing', async () => {
      auctionsRepo.find!.mockRejectedValue(new Error('DB Failure'));
      await expect(service.closeExpiredAuctions()).resolves.not.toThrow();
    });
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
        save: jest
          .fn()
          .mockImplementation((entityClass, data) =>
            Promise.resolve({ id: 'saved-id', ...data }),
          ),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(mockManager.update).toHaveBeenCalledWith(
        Auction,
        { id: 'auc-1' },
        { status: AuctionStatus.ENDED },
      );
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

    it('updates existing settlement if already present in database', async () => {
      const mockAuction = {
        id: 'auc-1',
        highestBidderId: 'winner-1',
        currentPrice: 5_000_000,
        status: AuctionStatus.ACTIVE,
      } as Auction;

      const existingSettlement = {
        id: 'settle-old',
        auctionId: 'auc-1',
        status: SettlementStatus.INVOICE_PENDING,
      };

      const existingInvoice = {
        id: 'inv-existing',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
        amount: 5_000_000,
        dueDate: new Date(),
        status: InvoiceStatus.PENDING,
      };

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Bid) return Promise.resolve(null);
          if (entityClass === Invoice) return Promise.resolve(existingInvoice);
          if (entityClass === Settlement)
            return Promise.resolve(existingSettlement);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => data),
        save: jest
          .fn()
          .mockImplementation((entityClass, data) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(existingSettlement.winnerId).toBe('winner-1');
      expect(existingSettlement.status).toBe(SettlementStatus.INVOICE_PENDING);
      expect(mockManager.save).toHaveBeenCalledWith(
        Settlement,
        existingSettlement,
      );
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
        save: jest
          .fn()
          .mockImplementation((entityClass, data) =>
            Promise.resolve({ id: 'set-id', ...data }),
          ),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(mockManager.update).toHaveBeenCalledWith(
        Auction,
        { id: 'auc-no-bids' },
        { status: AuctionStatus.FAILED },
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        Settlement,
        expect.objectContaining({
          auctionId: 'auc-no-bids',
          status: SettlementStatus.FAILED,
          failureReason: 'NO_BIDS',
        }),
      );
      expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith(
        'auc-no-bids',
        {
          auctionId: 'auc-no-bids',
          status: 'FAILED',
        },
      );
    });

    it('updates existing settlement to FAILED if auction had no bids and settlement existed', async () => {
      const mockAuction = {
        id: 'auc-no-bids',
        highestBidderId: null,
        status: AuctionStatus.ACTIVE,
      } as unknown as Auction;

      const existingSettlement = {
        id: 'set-1',
        auctionId: 'auc-no-bids',
        status: SettlementStatus.INVOICE_PENDING,
      };

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue(existingSettlement),
        save: jest
          .fn()
          .mockImplementation((entityClass, d) => Promise.resolve(d)),
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.settleExpiredAuction(mockAuction);

      expect(existingSettlement.status).toBe(SettlementStatus.FAILED);
      expect(existingSettlement.failureReason).toBe('NO_BIDS');
    });
  });

  describe('handleOverdueInvoices', () => {
    it('returns early if already processing', async () => {
      (service as any).isProcessingOverdue = true;
      await service.handleOverdueInvoices();
      expect(invoicesRepo.find).not.toHaveBeenCalled();
      (service as any).isProcessingOverdue = false;
    });

    it('does nothing if no overdue invoices exist', async () => {
      invoicesRepo.find!.mockResolvedValue([]);
      await service.handleOverdueInvoices();
      expect(invoicesRepo.find).toHaveBeenCalled();
    });

    it('processes each overdue invoice', async () => {
      const mockInvoices = [
        { id: 'inv-1', status: InvoiceStatus.PENDING },
      ] as Invoice[];
      invoicesRepo.find!.mockResolvedValue(mockInvoices);
      const handleSpy = jest
        .spyOn(service, 'handleSingleOverdueInvoice')
        .mockResolvedValue(undefined);

      await service.handleOverdueInvoices();
      expect(handleSpy).toHaveBeenCalledWith(mockInvoices[0]);
    });

    it('catches and logs error without crashing', async () => {
      invoicesRepo.find!.mockRejectedValue(new Error('Database error'));
      await expect(service.handleOverdueInvoices()).resolves.not.toThrow();
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
        save: jest
          .fn()
          .mockImplementation((entityClass, d) =>
            Promise.resolve({ id: 'saved-id', ...d }),
          ),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === User) {
            return Promise.resolve({
              id: 'winner-1',
              email: 'winner@test.com',
              ratingScore: 5.0,
            });
          }
          if (entityClass === Settlement) {
            return Promise.resolve(mockSettlement);
          }
          return Promise.resolve(null);
        }),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve([]);
          if (entityClass === Bid)
            return Promise.resolve([
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
        save: jest
          .fn()
          .mockImplementation((entityClass, d) => Promise.resolve(d)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === User) return Promise.resolve(null);
          if (entityClass === Settlement)
            return Promise.resolve(mockSettlement);
          return Promise.resolve(null);
        }),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve([]);
          if (entityClass === Bid)
            return Promise.resolve([
              { id: 'bid-win', bidderId: 'winner-1', amount: 5_000_000 },
            ]); // only winner's bid, no other bidders!
          return Promise.resolve([]);
        }),
        create: jest.fn().mockImplementation((entityClass, data) => data),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.handleSingleOverdueInvoice(mockInvoice);

      expect(mockSettlement.status).toBe(SettlementStatus.FAILED);
      expect(mockManager.update).toHaveBeenCalledWith(
        Auction,
        { id: 'auc-1' },
        { status: AuctionStatus.FAILED },
      );
      expect(auctionGateway.emitAuctionEnded).toHaveBeenCalledWith('auc-1', {
        auctionId: 'auc-1',
        status: 'FAILED',
      });
    });
  });

  describe('handleExpiredOffers', () => {
    it('returns early if already processing', async () => {
      (service as any).isProcessingExpiredOffers = true;
      await service.handleExpiredOffers();
      expect(offersRepo.find).not.toHaveBeenCalled();
      (service as any).isProcessingExpiredOffers = false;
    });

    it('does nothing if no expired offers found', async () => {
      offersRepo.find!.mockResolvedValue([]);
      await service.handleExpiredOffers();
      expect(offersRepo.find).toHaveBeenCalled();
    });

    it('marks expired offer as EXPIRED and finds next runner-up', async () => {
      const mockExpiredOffer = {
        id: 'off-expired',
        auctionId: 'auc-1',
        bidderId: 'runner-up-1',
        status: OfferStatus.PENDING,
        auction: { product: { title: 'Camera' } },
      } as Offer;

      offersRepo.find!.mockResolvedValue([mockExpiredOffer]);

      const mockManager = {
        save: jest.fn().mockResolvedValue(mockExpiredOffer),
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'set-1', auctionId: 'auc-1' }),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((entityClass, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.handleExpiredOffers();

      expect(mockExpiredOffer.status).toBe(OfferStatus.EXPIRED);
      expect(mockManager.save).toHaveBeenCalledWith(Offer, mockExpiredOffer);
    });

    it('catches and logs error without crashing', async () => {
      offersRepo.find!.mockRejectedValue(new Error('Offers query error'));
      await expect(service.handleExpiredOffers()).resolves.not.toThrow();
    });
  });

  describe('findAndInviteNextRunnerUp edge cases', () => {
    it('creates settlement if it did not exist before inviting runner-up', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null), // no settlement
        create: jest.fn().mockImplementation((entityClass, d) => d),
        save: jest
          .fn()
          .mockImplementation((entityClass, d) =>
            Promise.resolve({ id: 'new-set-id', ...d }),
          ),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve([]);
          if (entityClass === Bid)
            return Promise.resolve([
              {
                id: 'bid-1',
                bidderId: 'runner-up-1',
                amount: 3_000_000,
                bidder: { accountStatus: AccountStatus.ACTIVE },
              },
            ]);
          return Promise.resolve([]);
        }),
      } as any;

      const offer = await service.findAndInviteNextRunnerUp(
        mockManager,
        'auc-1',
        'Product Title',
      );
      expect(offer).toBeDefined();
      expect(offer!.bidderId).toBe('runner-up-1');
    });

    it('excludes bidders with previous offers and skips BANNED bidders', async () => {
      const mockSettlement = {
        id: 'set-1',
        auctionId: 'auc-1',
        winnerId: 'winner-1',
      };
      const previousOffers = [{ bidderId: 'prev-declined-runner' }];

      const bids = [
        { id: 'b-win', bidderId: 'winner-1', amount: 10_000_000 },
        {
          id: 'b-declined',
          bidderId: 'prev-declined-runner',
          amount: 9_000_000,
        },
        {
          id: 'b-banned',
          bidderId: 'banned-runner',
          amount: 8_000_000,
          bidder: { accountStatus: AccountStatus.BANNED },
        },
        {
          id: 'b-valid',
          bidderId: 'valid-runner-3',
          amount: 7_000_000,
          bidder: { accountStatus: AccountStatus.ACTIVE },
        },
      ];

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockSettlement),
        find: jest.fn().mockImplementation((entityClass) => {
          if (entityClass === Offer) return Promise.resolve(previousOffers);
          if (entityClass === Bid) return Promise.resolve(bids);
          return Promise.resolve([]);
        }),
        create: jest.fn().mockImplementation((entityClass, d) => d),
        save: jest
          .fn()
          .mockImplementation((entityClass, d) =>
            Promise.resolve({ id: 'off-valid', ...d }),
          ),
      } as any;

      const offer = await service.findAndInviteNextRunnerUp(
        mockManager,
        'auc-1',
        'Product',
      );
      expect(offer).toBeDefined();
      expect(offer!.bidderId).toBe('valid-runner-3');
      expect(offer!.offeredPrice).toBe(7_000_000);
    });
  });

  describe('getUserOffers', () => {
    it('returns user offers with relations', async () => {
      const mockOffers = [{ id: 'off-1', bidderId: 'user-1' }];
      offersRepo.find!.mockResolvedValue(mockOffers);

      const result = await service.getUserOffers('user-1');
      expect(result).toEqual(mockOffers);
      expect(offersRepo.find).toHaveBeenCalledWith({
        where: { bidderId: 'user-1' },
        relations: { auction: { product: true } },
        order: { createdAt: 'DESC' },
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

    it('throws BadRequestException and triggers next runner-up if offer already expired at time of accept', async () => {
      const mockExpiredOffer = {
        id: 'off-1',
        auctionId: 'auc-1',
        bidderId: 'user-1',
        status: OfferStatus.PENDING,
        expiresAt: new Date(Date.now() - 10_000), // in the past
      };
      offersRepo.findOne!.mockResolvedValue(mockExpiredOffer);

      const mockManager = {
        save: jest.fn().mockResolvedValue(mockExpiredOffer),
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'set-1', auctionId: 'auc-1' }),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((entityClass, d) => d),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await expect(service.acceptOffer('off-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockExpiredOffer.status).toBe(OfferStatus.EXPIRED);
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
        save: jest
          .fn()
          .mockImplementation((entityClass, d) =>
            Promise.resolve({ id: 'inv-new', ...d }),
          ),
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
    it('throws NotFoundException if offer does not exist', async () => {
      offersRepo.findOne!.mockResolvedValue(null);
      await expect(service.declineOffer('off-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user is not the recipient', async () => {
      offersRepo.findOne!.mockResolvedValue({
        id: 'off-1',
        bidderId: 'other-user',
      });
      await expect(service.declineOffer('off-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if offer is not PENDING', async () => {
      offersRepo.findOne!.mockResolvedValue({
        id: 'off-1',
        bidderId: 'user-1',
        status: OfferStatus.ACCEPTED,
      });
      await expect(service.declineOffer('off-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully marks offer DECLINED and triggers search for next runner-up', async () => {
      const mockOffer = {
        id: 'off-1',
        auctionId: 'auc-1',
        bidderId: 'user-1',
        status: OfferStatus.PENDING,
      };

      offersRepo.findOne!.mockResolvedValue(mockOffer);

      const mockManager = {
        save: jest
          .fn()
          .mockImplementation((entityClass, d) => Promise.resolve(d)),
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'set-1', auctionId: 'auc-1' }),
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
