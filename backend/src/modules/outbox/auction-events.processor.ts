import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { correlationStore } from '../../common/correlation-id/correlation-id.context';
import { AuctionGateway } from '../bids/auction.gateway';
import { AUCTION_EVENTS_QUEUE, AuctionEventJob, BidPlacedPayload } from './outbox.constants';

/**
 * Consumer của queue auction-events. Worker chạy ngoài request nên phải khôi phục
 * correlationId từ job, log ở đây mới nối được với log của API.
 */
@Processor(AUCTION_EVENTS_QUEUE)
export class AuctionEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(AuctionEventsProcessor.name);

  constructor(private readonly auctionGateway: AuctionGateway) {
    super();
  }

  async process(job: Job<AuctionEventJob>): Promise<void> {
    const { correlationId, payload } = job.data;
    await correlationStore.run({ correlationId }, async () => {
      this.logger.log(`Xử lý ${job.name} của phiên ${payload.auctionId}`);
      await this.handleBidPlaced(payload);
    });
  }

  private async handleBidPlaced(payload: BidPlacedPayload) {
    this.auctionGateway.emitAuctionUpdated(payload.update);
    if (payload.previousBidderId && payload.previousBidderId !== payload.highestBidderId) {
      this.auctionGateway.emitOutbid(payload.previousBidderId, {
        auctionId: payload.auctionId,
        productName: payload.productName,
        currentPrice: payload.update.currentPrice,
      });
    }
  }
}
