import { maskName } from '../../common/utils/mask-name';
import { Auction, AuctionStatus } from './entities/auction.entity';

// Trạng thái hiển thị cho client (khớp với frontend)
export type AuctionViewStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

// Chưa có cron job đổi trạng thái, nên phiên UPCOMING/ACTIVE được tính theo thời gian thực
export function getViewStatus(auction: Auction, now = new Date()): AuctionViewStatus {
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

export function getMinNextBid(auction: Auction): number {
  return auction.highestBidderId
    ? Number(auction.currentPrice) + Number(auction.bidIncrement)
    : Number(auction.startingPrice);
}

export function toAuctionView(auction: Auction & { bidCount?: number }, now = new Date()) {
  const status = getViewStatus(auction, now);
  const hasBids = Boolean(auction.highestBidderId);

  return {
    id: auction.id,
    title: auction.product.title,
    description: auction.product.description ?? '',
    imageUrl: auction.product.images?.[0] ?? '',
    sellerId: auction.product.sellerId,
    startingPrice: Number(auction.startingPrice),
    currentBid: hasBids ? Number(auction.currentPrice) : Number(auction.startingPrice),
    bidIncrement: Number(auction.bidIncrement),
    minNextBid: getMinNextBid(auction),
    bidCount: auction.bidCount ?? 0,
    startTime: auction.startTime.toISOString(),
    endTime: auction.endTime.toISOString(),
    remainingMinutes:
      status === 'LIVE' ? Math.ceil((auction.endTime.getTime() - now.getTime()) / 60_000) : 0,
    status,
    winnerName:
      status === 'ENDED' && auction.highestBidder
        ? maskName(auction.highestBidder.fullName)
        : undefined,
  };
}

export type AuctionView = ReturnType<typeof toAuctionView>;
