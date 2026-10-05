export type AuctionStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

export const auctionStatusLabels: Record<AuctionStatus, string> = {
  UPCOMING: 'Sắp diễn ra',
  LIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
};

export type Auction = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
  currentBid: number;
  bidCount: number;
  bidIncrement: number;
  // Giá tối thiểu cho lượt đặt tiếp theo (backend tính sẵn)
  minNextBid: number;
  sellerId: string;
  startTime: string;
  endTime: string;
  remainingMinutes: number;
  status: AuctionStatus;
  winnerName?: string;
};

export type BidHistoryItem = {
  id: string;
  bidderName: string;
  amount: number;
  status: 'VALID' | 'OUTBID' | 'WINNING';
  createdAt: string;
};
