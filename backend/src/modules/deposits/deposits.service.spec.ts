import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { DepositsService } from './deposits.service';
import { Deposit, DepositStatus } from './entities/deposit.entity';

describe('DepositsService', () => {
  let service: DepositsService;
  let depositsRepository: Partial<Record<keyof Repository<Deposit>, jest.Mock>>;
  let auctionsRepository: Partial<Record<keyof Repository<Auction>, jest.Mock>>;

  beforeEach(async () => {
    depositsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    auctionsRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositsService,
        {
          provide: getRepositoryToken(Deposit),
          useValue: depositsRepository,
        },
        {
          provide: getRepositoryToken(Auction),
          useValue: auctionsRepository,
        },
      ],
    }).compile();

    service = module.get<DepositsService>(DepositsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deposit', () => {
    it('throws NotFoundException if auction does not exist', async () => {
      auctionsRepository.findOne!.mockResolvedValue(null);

      await expect(service.deposit('auc-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if auction is not UPCOMING or ACTIVE', async () => {
      auctionsRepository.findOne!.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ENDED,
      });

      await expect(service.deposit('auc-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException if user already has an active HELD deposit', async () => {
      auctionsRepository.findOne!.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ACTIVE,
        startingPrice: 1_000_000,
      });
      depositsRepository.findOne!.mockResolvedValue({
        id: 'dep-1',
        auctionId: 'auc-1',
        userId: 'user-1',
        status: DepositStatus.HELD,
      });

      await expect(service.deposit('auc-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates and saves new deposit with 10% default amount', async () => {
      auctionsRepository.findOne!.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ACTIVE,
        startingPrice: 10_000_000,
      });
      depositsRepository.findOne!.mockResolvedValue(null);
      depositsRepository.create!.mockImplementation((dto) => dto);
      depositsRepository.save!.mockImplementation(async (d) => ({ id: 'dep-new', ...d }));

      const result = await service.deposit('auc-1', 'user-1');
      expect(result.amount).toBe(1_000_000);
      expect(result.status).toBe(DepositStatus.HELD);
      expect(depositsRepository.save).toHaveBeenCalled();
    });

    it('ensures minimum deposit is 50,000 even when 10% of starting price is lower', async () => {
      auctionsRepository.findOne!.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ACTIVE,
        startingPrice: 100_000, // 10% = 10,000 < 50,000 min
      });
      depositsRepository.findOne!.mockResolvedValue(null);
      depositsRepository.create!.mockImplementation((dto) => dto);
      depositsRepository.save!.mockImplementation(async (d) => ({ id: 'dep-new', ...d }));

      const result = await service.deposit('auc-1', 'user-1');
      expect(result.amount).toBe(50_000);
    });

    it('updates previous refunded deposit to HELD with new amount', async () => {
      auctionsRepository.findOne!.mockResolvedValue({
        id: 'auc-1',
        status: AuctionStatus.ACTIVE,
        startingPrice: 2_000_000,
      });
      const existing = {
        id: 'dep-old',
        auctionId: 'auc-1',
        userId: 'user-1',
        amount: 200_000,
        status: DepositStatus.REFUNDED,
      };
      depositsRepository.findOne!.mockResolvedValue(existing);
      depositsRepository.save!.mockImplementation(async (d) => d);

      const result = await service.deposit('auc-1', 'user-1', 500_000);
      expect(result.amount).toBe(500_000);
      expect(result.status).toBe(DepositStatus.HELD);
    });
  });

  describe('getDeposit', () => {
    it('returns deposit for auction and user', async () => {
      const mockDeposit = { id: 'dep-1', auctionId: 'auc-1', userId: 'user-1', status: DepositStatus.HELD };
      depositsRepository.findOne!.mockResolvedValue(mockDeposit);

      const result = await service.getDeposit('auc-1', 'user-1');
      expect(result).toEqual(mockDeposit);
      expect(depositsRepository.findOne).toHaveBeenCalledWith({ where: { auctionId: 'auc-1', userId: 'user-1' } });
    });
  });

  describe('hasActiveDeposit', () => {
    it('returns true if HELD deposit exists', async () => {
      depositsRepository.findOne!.mockResolvedValue({ id: 'dep-1', status: DepositStatus.HELD });
      const res = await service.hasActiveDeposit('auc-1', 'user-1');
      expect(res).toBe(true);
    });

    it('returns false if no HELD deposit exists', async () => {
      depositsRepository.findOne!.mockResolvedValue(null);
      const res = await service.hasActiveDeposit('auc-1', 'user-1');
      expect(res).toBe(false);
    });
  });

  describe('refundNonWinners', () => {
    it('updates non-winners deposits to REFUNDED with winnerId', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      depositsRepository.createQueryBuilder!.mockReturnValue(qb);

      const affected = await service.refundNonWinners('auc-1', 'winner-1');
      expect(affected).toBe(3);
      expect(qb.andWhere).toHaveBeenCalledWith('user_id != :winnerId', { winnerId: 'winner-1' });
    });

    it('refunds all deposits when no winnerId is provided (e.g. failed auction)', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      depositsRepository.createQueryBuilder!.mockReturnValue(qb);

      const affected = await service.refundNonWinners('auc-1');
      expect(affected).toBe(2);
      expect(qb.where).toHaveBeenCalledWith('auction_id = :auctionId', { auctionId: 'auc-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('status = :heldStatus', { heldStatus: DepositStatus.HELD });
    });
  });

  describe('forfeitDeposit', () => {
    it('updates deposit status to FORFEITED and returns true', async () => {
      depositsRepository.update!.mockResolvedValue({ affected: 1 });
      const res = await service.forfeitDeposit('auc-1', 'winner-1');
      expect(res).toBe(true);
      expect(depositsRepository.update).toHaveBeenCalledWith(
        { auctionId: 'auc-1', userId: 'winner-1', status: DepositStatus.HELD },
        { status: DepositStatus.FORFEITED },
      );
    });

    it('returns false if no deposit was updated', async () => {
      depositsRepository.update!.mockResolvedValue({ affected: 0 });
      const res = await service.forfeitDeposit('auc-1', 'winner-1');
      expect(res).toBe(false);
    });
  });

  describe('refundWinner', () => {
    it('updates winner deposit status to REFUNDED after payment and returns true', async () => {
      depositsRepository.update!.mockResolvedValue({ affected: 1 });
      const res = await service.refundWinner('auc-1', 'winner-1');
      expect(res).toBe(true);
      expect(depositsRepository.update).toHaveBeenCalledWith(
        { auctionId: 'auc-1', userId: 'winner-1', status: DepositStatus.HELD },
        { status: DepositStatus.REFUNDED },
      );
    });

    it('returns false if no deposit was updated', async () => {
      depositsRepository.update!.mockResolvedValue({ affected: 0 });
      const res = await service.refundWinner('auc-1', 'winner-1');
      expect(res).toBe(false);
    });
  });
});
