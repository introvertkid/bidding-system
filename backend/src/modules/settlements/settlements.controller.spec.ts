import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Offer, OfferStatus } from './entities/offer.entity';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

describe('SettlementsController', () => {
  let controller: SettlementsController;
  let service: {
    getUserOffers: jest.Mock;
    acceptOffer: jest.Mock;
    declineOffer: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getUserOffers: jest.fn(),
      acceptOffer: jest.fn(),
      declineOffer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementsController],
      providers: [
        {
          provide: SettlementsService,
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

    controller = module.get<SettlementsController>(SettlementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyOffers', () => {
    it('calls settlementsService.getUserOffers and returns user offers', async () => {
      const mockOffers: Partial<Offer>[] = [
        {
          id: 'off-1',
          bidderId: 'user-1',
          offeredPrice: 8_000_000,
          status: OfferStatus.PENDING,
        },
      ];

      service.getUserOffers.mockResolvedValue(mockOffers);

      const result = await controller.getMyOffers('user-1');

      expect(service.getUserOffers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        status: 'success',
        data: mockOffers,
      });
    });
  });

  describe('acceptOffer', () => {
    it('calls settlementsService.acceptOffer and returns success response', async () => {
      const mockResult = {
        offer: { id: 'off-1', status: OfferStatus.ACCEPTED },
        invoice: { id: 'inv-1', amount: 8_000_000 },
      };

      service.acceptOffer.mockResolvedValue(mockResult);

      const result = await controller.acceptOffer('off-1', 'user-1');

      expect(service.acceptOffer).toHaveBeenCalledWith('off-1', 'user-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Đã chấp nhận lời mời mua sản phẩm thành công',
        data: mockResult,
      });
    });
  });

  describe('declineOffer', () => {
    it('calls settlementsService.declineOffer and returns success response', async () => {
      const mockResult = {
        message: 'Đã từ chối lời mời mua thành công',
        hasNextRunnerUp: true,
      };

      service.declineOffer.mockResolvedValue(mockResult);

      const result = await controller.declineOffer('off-1', 'user-1');

      expect(service.declineOffer).toHaveBeenCalledWith('off-1', 'user-1');
      expect(result).toEqual({
        status: 'success',
        message: mockResult.message,
        data: mockResult,
      });
    });
  });
});
