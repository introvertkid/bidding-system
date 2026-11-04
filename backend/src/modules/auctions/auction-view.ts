import { maskName } from '../../common/utils/mask-name';
import { Auction, AuctionStatus } from './entities/auction.entity';

// Trạng thái hiển thị cho client (khớp với frontend)
export type AuctionViewStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

// Dữ liệu thô của phiên (GP4): lưu được vào cache, không chứa trường phụ thuộc thời gian
export type AuctionSnapshot = {
  id: string;
  status: AuctionStatus;
  title: string;
  description: string;
  imageUrl: string;
  sellerId: string;
  startTime: Date;
  endTime: Date;
  startingPrice: number;
  currentPrice: number;
  bidIncrement: number;
  highestBidderId?: string;
  highestBidderName?: string;
  bidCount: number;
  version: number;
};

// Chưa có cron job đổi trạng thái, nên phiên UPCOMING/ACTIVE được tính theo thời gian thực
export function getViewStatus(
  auction: Pick<Auction, 'status' | 'startTime' | 'endTime'>,
  now = new Date(),
): AuctionViewStatus {
  if (auction.status === AuctionStatus.DRAFT) return 'UPCOMING';
  if (auction.status !== AuctionStatus.UPCOMING && auction.status !== AuctionStatus.ACTIVE) {
    return 'ENDED';
  }
  if (now < auction.startTime) return 'UPCOMING';
  if (now < auction.endTime) return 'LIVE';
  return 'ENDED';
}

// Bước giá theo giá trị sản phẩm (docs/bidding_specs.md)
export function defaultBidIncrement(price: number): number {
  if (price < 100_000) return 5_000;
  if (price < 1_000_000) return 20_000;
  return 100_000;
}

export function getMinNextBid(
  auction: Pick<Auction, 'currentPrice' | 'bidIncrement' | 'startingPrice'> & {
    highestBidderId?: string;
  },
): number {
  return auction.highestBidderId
    ? Number(auction.currentPrice) + Number(auction.bidIncrement)
    : Number(auction.startingPrice);
}

export function toAuctionSnapshot(auction: Auction, bidCount: number): AuctionSnapshot {
  return {
    id: auction.id,
    status: auction.status,
    title: auction.product.title,
    description: auction.product.description ?? '',
    imageUrl: auction.product.images?.[0] ?? '',
    sellerId: auction.product.sellerId,
    startTime: auction.startTime,
    endTime: auction.endTime,
    startingPrice: Number(auction.startingPrice),
    currentPrice: Number(auction.currentPrice),
    bidIncrement: Number(auction.bidIncrement),
    highestBidderId: auction.highestBidderId ?? undefined,
    highestBidderName: auction.highestBidder ? maskName(auction.highestBidder.fullName) : undefined,
    bidCount,
    version: auction.version,
  };
}

export function toAuctionView(snapshot: AuctionSnapshot, now = new Date()) {
  const status = getViewStatus(snapshot, now);

  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    imageUrl: snapshot.imageUrl,
    sellerId: snapshot.sellerId,
    startingPrice: snapshot.startingPrice,
    currentBid: snapshot.highestBidderId ? snapshot.currentPrice : snapshot.startingPrice,
    bidIncrement: snapshot.bidIncrement,
    minNextBid: getMinNextBid(snapshot),
    bidCount: snapshot.bidCount,
    startTime: snapshot.startTime.toISOString(),
    endTime: snapshot.endTime.toISOString(),
    remainingMinutes:
      status === 'LIVE' ? Math.ceil((snapshot.endTime.getTime() - now.getTime()) / 60_000) : 0,
    status,
    winnerName: status === 'ENDED' ? snapshot.highestBidderName : undefined,
  };
}

export type AuctionView = ReturnType<typeof toAuctionView>;
