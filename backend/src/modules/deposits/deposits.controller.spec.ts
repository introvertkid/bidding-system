import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { Deposit, DepositStatus } from './entities/deposit.entity';

describe('DepositsController', () => {
  let controller: DepositsController;
  let service: {
    deposit: jest.Mock;
    getDeposit: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      deposit: jest.fn(),
      getDeposit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepositsController],
      providers: [
        {
          provide: DepositsService,
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

    controller = module.get<DepositsController>(DepositsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDeposit', () => {
    it('calls depositsService.deposit and returns formatted success response', async () => {
      const mockDeposit: Partial<Deposit> = {
        id: 'dep-1',
        auctionId: 'auc-1',
        userId: 'user-1',
        amount: 500_000,
        status: DepositStatus.HELD,
      };

      service.deposit.mockResolvedValue(mockDeposit);

      const result = await controller.createDeposit('auc-1', 'user-1', { amount: 500_000 });

      expect(service.deposit).toHaveBeenCalledWith('auc-1', 'user-1', 500_000);
      expect(result).toEqual({
        status: 'success',
        message: 'Đặt cọc tham gia phiên đấu giá thành công',
        data: mockDeposit,
      });
    });
  });

  describe('getMyDeposit', () => {
    it('calls depositsService.getDeposit and returns deposit data', async () => {
      const mockDeposit: Partial<Deposit> = {
        id: 'dep-1',
        auctionId: 'auc-1',
        userId: 'user-1',
        status: DepositStatus.HELD,
      };

      service.getDeposit.mockResolvedValue(mockDeposit);

      const result = await controller.getMyDeposit('auc-1', 'user-1');

      expect(service.getDeposit).toHaveBeenCalledWith('auc-1', 'user-1');
      expect(result).toEqual({
        status: 'success',
        data: mockDeposit,
      });
    });
  });
});
