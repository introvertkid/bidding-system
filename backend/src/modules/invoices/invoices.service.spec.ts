import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DepositsService } from '../deposits/deposits.service';
import {
  Settlement,
  SettlementStatus,
} from '../settlements/entities/settlement.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoicesRepository: Partial<Record<keyof Repository<Invoice>, jest.Mock>>;
  let depositsService: { refundWinner: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    invoicesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    depositsService = {
      refundWinner: jest.fn().mockResolvedValue(true),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoicesRepository,
        },
        {
          provide: DepositsService,
          useValue: depositsService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserInvoices', () => {
    it('returns invoices for the user', async () => {
      const mockInvoices = [{ id: 'inv-1', winnerId: 'user-1' }];
      invoicesRepository.find!.mockResolvedValue(mockInvoices);

      const result = await service.getUserInvoices('user-1');
      expect(result).toEqual(mockInvoices);
      expect(invoicesRepository.find).toHaveBeenCalledWith({
        where: { winnerId: 'user-1' },
        relations: { auction: { product: true } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getInvoiceById', () => {
    it('throws NotFoundException if invoice not found', async () => {
      invoicesRepository.findOne!.mockResolvedValue(null);

      await expect(service.getInvoiceById('inv-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user is not the winner', async () => {
      invoicesRepository.findOne!.mockResolvedValue({
        id: 'inv-1',
        winnerId: 'other-user',
      });

      await expect(service.getInvoiceById('inv-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns invoice if user is the winner', async () => {
      const mockInvoice = {
        id: 'inv-1',
        winnerId: 'user-1',
        amount: 5_000_000,
      };
      invoicesRepository.findOne!.mockResolvedValue(mockInvoice);

      const result = await service.getInvoiceById('inv-1', 'user-1');
      expect(result).toEqual(mockInvoice);
      expect(invoicesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        relations: { auction: { product: true } },
      });
    });
  });

  describe('payInvoice', () => {
    it('throws NotFoundException if invoice not found', async () => {
      invoicesRepository.findOne!.mockResolvedValue(null);

      await expect(service.payInvoice('inv-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user is not winner', async () => {
      invoicesRepository.findOne!.mockResolvedValue({
        id: 'inv-1',
        winnerId: 'user-2',
      });

      await expect(service.payInvoice('inv-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if invoice is already PAID', async () => {
      invoicesRepository.findOne!.mockResolvedValue({
        id: 'inv-1',
        winnerId: 'user-1',
        status: InvoiceStatus.PAID,
      });

      await expect(service.payInvoice('inv-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if invoice is CANCELED', async () => {
      invoicesRepository.findOne!.mockResolvedValue({
        id: 'inv-1',
        winnerId: 'user-1',
        status: InvoiceStatus.CANCELED,
      });

      await expect(service.payInvoice('inv-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if invoice is overdue', async () => {
      invoicesRepository.findOne!.mockResolvedValue({
        id: 'inv-1',
        winnerId: 'user-1',
        status: InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() - 10_000), // in the past
      });

      await expect(service.payInvoice('inv-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully processes payment, marks invoice PAID, updates Settlement to SETTLED and refunds winner deposit', async () => {
      const mockInvoice = {
        id: 'inv-1',
        auctionId: 'auc-1',
        winnerId: 'user-1',
        status: InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      invoicesRepository.findOne!.mockResolvedValue(mockInvoice);

      const mockManager = {
        save: jest
          .fn()
          .mockImplementation((entityClass, inv) => Promise.resolve(inv)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.payInvoice('inv-1', 'user-1');
      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(mockManager.update).toHaveBeenCalledWith(
        Settlement,
        { auctionId: 'auc-1' },
        { status: SettlementStatus.SETTLED, step: 'COMPLETED' },
      );
      expect(depositsService.refundWinner).toHaveBeenCalledWith(
        'auc-1',
        'user-1',
      );
    });
  });
});
