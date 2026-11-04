import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { correlationStore } from '../../common/correlation-id/correlation-id.context';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { OutboxEvent } from '../outbox/entities/outbox-event.entity';
import { BID_PLACED_EVENT } from '../outbox/outbox.constants';
import { AccountStatus } from '../users/entities/user.entity';
import { BidsService } from './bids.service';
import { Bid } from './entities/bid.entity';

describe('BidsService.placeBid', () => {
  let manager: Record<string, jest.Mock>;
  let queryBuilder: Record<string, jest.Mock>;
  let service: BidsService;

  const auction = () => ({
    id: 'a1',
    status: AuctionStatus.ACTIVE,
    startTime: new Date(Date.now() - 60 * 60 * 1000),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    startingPrice: '100',
    currentPrice: '100',
    bidIncrement: '10',
    highestBidderId: 'u1',
    version: 4,
    product: { title: 'Đồng hồ', sellerId: 'seller' },
  });

  beforeEach(() => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === Auction
          ? auction()
          : { id: 'u2', fullName: 'Trần An', accountStatus: AccountStatus.ACTIVE },
      ),
      createQueryBuilder: jest.fn(() => queryBuilder),
      update: jest.fn(),
      create: jest.fn((_entity: unknown, data: object) => data),
      save: jest.fn(async (data: object) => ({
        id: 'bid-1',
        createdAt: new Date('2026-11-04T00:00:00.000Z'),
        ...data,
      })),
      countBy: jest.fn().mockResolvedValue(3),
    };
    const dataSource = {
      transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) => work(manager)),
    };
    service = new BidsService(dataSource as unknown as DataSource, {} as Repository<Bid>);
  });

  const outboxWrites = () => manager.create.mock.calls.filter(([entity]) => entity === OutboxEvent);

  it('ghi outbox BID_PLACED trong transaction, kèm correlationId và version mới', async () => {
    await correlationStore.run({ correlationId: 'corr-1' }, () =>
      service.placeBid('a1', 'u2', 110),
    );

    expect(outboxWrites()).toHaveLength(1);
    expect(outboxWrites()[0][1]).toMatchObject({
      correlationId: 'corr-1',
      aggregateType: 'AUCTION',
      aggregateId: 'a1',
      eventType: BID_PLACED_EVENT,
      payload: {
        version: 5,
        previousBidderId: 'u1',
        update: { currentPrice: 110, minNextBid: 120, totalBids: 3 },
      },
    });
  });

  it('thua optimistic lock thì không ghi outbox', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 0 });

    await expect(service.placeBid('a1', 'u2', 110)).rejects.toThrow(ConflictException);

    expect(outboxWrites()).toHaveLength(0);
  });
});
