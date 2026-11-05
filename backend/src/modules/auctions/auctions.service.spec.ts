import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuctionCacheService } from '../cache/auction-cache.service';
import { AuctionSnapshot } from './auction-view';
import { AuctionsService } from './auctions.service';
import { Auction, AuctionStatus } from './entities/auction.entity';

describe('AuctionsService.findOne (Cache-Aside)', () => {
  let auctionCache: { get: jest.Mock; save: jest.Mock };
  let getOne: jest.Mock;
  let service: AuctionsService;

  const hour = 60 * 60 * 1000;

  const snapshot = (
    overrides: Partial<AuctionSnapshot> = {},
  ): AuctionSnapshot => ({
    id: 'a1',
    status: AuctionStatus.ACTIVE,
    title: 'Đồng hồ',
    description: '',
    imageUrl: '',
    sellerId: 'seller',
    startTime: new Date(Date.now() - hour),
    endTime: new Date(Date.now() + hour),
    startingPrice: 100,
    currentPrice: 150,
    bidIncrement: 10,
    highestBidderId: 'u1',
    highestBidderName: 'Trần A*',
    bidCount: 3,
    version: 7,
    ...overrides,
  });

  beforeEach(() => {
    auctionCache = { get: jest.fn().mockResolvedValue(null), save: jest.fn() };
    getOne = jest.fn();
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };
    const countQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ auctionId: 'a1', count: '2' }]),
    };
    service = new AuctionsService(
      {
        getRepository: () => ({ createQueryBuilder: () => countQuery }),
      } as unknown as DataSource,
      {
        createQueryBuilder: () => queryBuilder,
      } as unknown as Repository<Auction>,
      auctionCache as unknown as AuctionCacheService,
    );
  });

  it('cache hit: không query DB, tính minNextBid lúc đọc', async () => {
    auctionCache.get.mockResolvedValue(snapshot());

    const view = await service.findOne('a1');

    expect(getOne).not.toHaveBeenCalled();
    expect(view).toMatchObject({
      currentBid: 150,
      minNextBid: 160,
      status: 'LIVE',
    });
  });

  it('cache hit: phiên đã qua endTime hiển thị ENDED dù cache còn ACTIVE', async () => {
    auctionCache.get.mockResolvedValue(
      snapshot({ endTime: new Date(Date.now() - 1000) }),
    );

    const view = await service.findOne('a1');

    expect(view).toMatchObject({
      status: 'ENDED',
      remainingMinutes: 0,
      winnerName: 'Trần A*',
    });
  });

  it('cache miss: đọc DB rồi nạp lại cache', async () => {
    getOne.mockResolvedValue({
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      startTime: new Date(Date.now() - hour),
      endTime: new Date(Date.now() + hour),
      startingPrice: '100',
      currentPrice: '100',
      bidIncrement: '10',
      version: 1,
      product: { title: 'Đồng hồ', sellerId: 'seller', images: [] },
    });

    const view = await service.findOne('a1');

    expect(view).toMatchObject({
      currentBid: 100,
      minNextBid: 100,
      bidCount: 2,
    });
    expect(auctionCache.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        version: 1,
        startingPrice: 100,
        bidCount: 2,
      }),
    );
  });

  it('không có phiên thì 404 và không nạp cache', async () => {
    getOne.mockResolvedValue(null);

    await expect(service.findOne('a1')).rejects.toThrow(NotFoundException);
    expect(auctionCache.save).not.toHaveBeenCalled();
  });
});
