import { AuctionUpdatedEvent } from '../bids/auction.gateway';

export const AUCTION_EVENTS_QUEUE = 'auction-events';
export const BID_PLACED_EVENT = 'BID_PLACED';

export type BidPlacedPayload = {
  auctionId: string;
  version: number;
  highestBidderId: string;
  productName: string;
  previousBidderId?: string;
  update: AuctionUpdatedEvent;
};

export type AuctionEventJob = {
  correlationId: string;
  payload: BidPlacedPayload;
};
