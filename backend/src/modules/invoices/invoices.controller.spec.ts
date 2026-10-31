import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: {
    getUserInvoices: jest.Mock;
    payInvoice: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getUserInvoices: jest.fn(),
      payInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: service,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyInvoices', () => {
    it('calls invoicesService.getUserInvoices and returns success response', async () => {
      const mockInvoices: Partial<Invoice>[] = [
        {
          id: 'inv-1',
          winnerId: 'user-1',
          amount: 10_000_000,
          status: InvoiceStatus.PENDING,
        },
      ];

      service.getUserInvoices.mockResolvedValue(mockInvoices);

      const result = await controller.getMyInvoices('user-1');

      expect(service.getUserInvoices).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        status: 'success',
        data: mockInvoices,
      });
    });
  });

  describe('payInvoice', () => {
    it('calls invoicesService.payInvoice and returns success response', async () => {
      const mockPaidInvoice: Partial<Invoice> = {
        id: 'inv-1',
        winnerId: 'user-1',
        amount: 10_000_000,
        status: InvoiceStatus.PAID,
      };

      service.payInvoice.mockResolvedValue(mockPaidInvoice);

      const result = await controller.payInvoice('inv-1', 'user-1');

      expect(service.payInvoice).toHaveBeenCalledWith('inv-1', 'user-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Thanh toán hóa đơn thành công',
        data: mockPaidInvoice,
      });
    });
  });
});
