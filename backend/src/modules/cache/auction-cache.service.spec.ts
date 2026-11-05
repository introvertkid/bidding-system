import { Redis } from 'ioredis';
import { AuctionSnapshot } from '../auctions/auction-view';
import { AuctionStatus } from '../auctions/entities/auction.entity';
import { BidPlacedPayload } from '../outbox/outbox.constants';
import { AuctionCacheService } from './auction-cache.service';

describe('AuctionCacheService', () => {
  let redis: { hgetall: jest.Mock; eval: jest.Mock; del: jest.Mock };
  let service: AuctionCacheService;

  const snapshot: AuctionSnapshot = {
    id: 'a1',
    status: AuctionStatus.ACTIVE,
    title: 'Đồng hồ',
    description: '',
    imageUrl: '',
    sellerId: 'seller',
    startTime: new Date('2026-11-01T00:00:00.000Z'),
    endTime: new Date('2026-11-02T00:00:00.000Z'),
    startingPrice: 100,
    currentPrice: 150,
    bidIncrement: 10,
    highestBidderId: 'u1',
    highestBidderName: 'Trần A*',
    bidCount: 3,
    version: 7,
  };

  beforeEach(() => {
    redis = {
      hgetall: jest.fn().mockResolvedValue({}),
      eval: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new AuctionCacheService(redis as unknown as Redis);
  });

  // Lấy các cặp field/value đã truyền cho script
  const hashFromEval = (firstFieldIndex: number) => {
    const fields = redis.eval.mock.calls[0].slice(firstFieldIndex) as string[];
    return Object.fromEntries(
      fields.flatMap((value, index) =>
        index % 2 ? [] : [[value, fields[index + 1]]],
      ),
    ) as Record<string, string>;
  };

  it('cache miss trả null', async () => {
    await expect(service.get('a1')).resolves.toBeNull();
    expect(redis.hgetall).toHaveBeenCalledWith('cache:auction:a1');
  });

  it('ghi rồi đọc lại được đúng snapshot', async () => {
    await service.save(snapshot);
    redis.hgetall.mockResolvedValue(hashFromEval(5));

    await expect(service.get('a1')).resolves.toEqual(snapshot);
  });

  it('nạp cache kèm version và TTL 300s', async () => {
    await service.save(snapshot);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'cache:auction:a1',
      7,
      300,
      ...Object.entries(hashFromEval(5)).flat(),
    );
  });

  it('phiên chưa có người bid đọc lại không có highestBidderId', async () => {
    await service.save({
      ...snapshot,
      highestBidderId: undefined,
      highestBidderName: undefined,
    });
    redis.hgetall.mockResolvedValue(hashFromEval(5));

    const cached = await service.get('a1');

    expect(cached?.highestBidderId).toBeUndefined();
    expect(cached?.highestBidderName).toBeUndefined();
  });

  it('applyBidPlaced gửi cả endTime vì anti-sniper có thể gia hạn', async () => {
    await service.applyBidPlaced({
      auctionId: 'a1',
      version: 8,
      highestBidderId: 'u2',
      update: {
        currentPrice: 160,
        highestBidderName: 'Lê B*',
        totalBids: 4,
        endTime: '2026-11-02T00:01:00.000Z',
      },
    } as BidPlacedPayload);

    expect(redis.eval.mock.calls[0][3]).toBe(8);
    expect(hashFromEval(4)).toEqual({
      version: '8',
      currentPrice: '160',
      highestBidderId: 'u2',
      highestBidderName: 'Lê B*',
      bidCount: '4',
      endTime: '2026-11-02T00:01:00.000Z',
    });
  });

  it('Redis lỗi thì get trả null, các lệnh ghi không ném lỗi', async () => {
    redis.hgetall.mockRejectedValue(new Error('down'));
    redis.eval.mockRejectedValue(new Error('down'));
    redis.del.mockRejectedValue(new Error('down'));

    await expect(service.get('a1')).resolves.toBeNull();
    await expect(service.save(snapshot)).resolves.toBeUndefined();
    await expect(service.invalidate('a1')).resolves.toBeUndefined();
  });
});
