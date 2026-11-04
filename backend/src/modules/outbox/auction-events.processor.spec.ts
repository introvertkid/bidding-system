import { Job } from 'bullmq';
import { getCorrelationId } from '../../common/correlation-id/correlation-id.context';
import { AuctionGateway } from '../bids/auction.gateway';
import { AuctionEventsProcessor } from './auction-events.processor';
import { AuctionEventJob, BidPlacedPayload } from './outbox.constants';

describe('AuctionEventsProcessor', () => {
  let gateway: { emitAuctionUpdated: jest.Mock; emitOutbid: jest.Mock };
  let processor: AuctionEventsProcessor;

  const payload = (overrides: Partial<BidPlacedPayload> = {}) =>
    ({
      auctionId: 'a1',
      version: 2,
      highestBidderId: 'u2',
      productName: 'Đồng hồ',
      previousBidderId: 'u1',
      update: { auctionId: 'a1', currentPrice: 200 },
      ...overrides,
    }) as BidPlacedPayload;

  const job = (data: BidPlacedPayload) =>
    ({
      name: 'BID_PLACED',
      data: { correlationId: 'corr-1', payload: data },
    }) as Job<AuctionEventJob>;

  beforeEach(() => {
    gateway = { emitAuctionUpdated: jest.fn(), emitOutbid: jest.fn() };
    processor = new AuctionEventsProcessor(gateway as unknown as AuctionGateway);
  });

  it('broadcast auction_updated và báo người bị vượt giá', async () => {
    const data = payload();

    await processor.process(job(data));

    expect(gateway.emitAuctionUpdated).toHaveBeenCalledWith(data.update);
    expect(gateway.emitOutbid).toHaveBeenCalledWith('u1', {
      auctionId: 'a1',
      productName: 'Đồng hồ',
      currentPrice: 200,
    });
  });

  it('không báo outbid khi đây là lượt bid đầu tiên', async () => {
    await processor.process(job(payload({ previousBidderId: undefined })));

    expect(gateway.emitOutbid).not.toHaveBeenCalled();
  });

  it('khôi phục correlationId từ job', async () => {
    let seen: string | undefined;
    gateway.emitAuctionUpdated.mockImplementation(() => {
      seen = getCorrelationId();
    });

    await processor.process(job(payload()));

    expect(seen).toBe('corr-1');
  });
});
