export type AuctionStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

export const auctionStatusLabels: Record<AuctionStatus, string> = {
  UPCOMING: 'Sắp diễn ra',
  LIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
};

export type Auction = {
  id: string;
  title: string;
  image: string;
  startingPrice: number;
  currentBid: number;
  bidCount: number;
  startTime: string;
  // Fixed illustrative duration in minutes; not a live countdown.
  remainingMinutes: number;
  status: AuctionStatus;
};

// Mock sessions and VND prices. Statuses and durations are fixed for this preview.
export const auctions: Auction[] = [
  { id: 'macbook', title: 'MacBook Air M2 16GB / 512GB', image: '/images/auctions/macbook.jpg', startingPrice: 15000000, currentBid: 18500000, bidCount: 18, startTime: '2026-10-04T08:00:00+07:00', remainingMinutes: 135, status: 'LIVE' },
  { id: 'camera', title: 'Máy ảnh Fujifilm X-T30 II kèm ống kính', image: '/images/auctions/camera.jpg', startingPrice: 18000000, currentBid: 22500000, bidCount: 12, startTime: '2026-10-04T09:00:00+07:00', remainingMinutes: 270, status: 'LIVE' },
  { id: 'watch', title: 'Đồng hồ Seiko 5 tự động cổ điển', image: '/images/auctions/watch.jpg', startingPrice: 3000000, currentBid: 4200000, bidCount: 24, startTime: '2026-10-04T08:30:00+07:00', remainingMinutes: 105, status: 'LIVE' },
  { id: 'bag', title: 'Túi xách da thật thủ công', image: '/images/auctions/bag.jpg', startingPrice: 1200000, currentBid: 1850000, bidCount: 8, startTime: '2026-10-04T10:00:00+07:00', remainingMinutes: 370, status: 'LIVE' },
  { id: 'painting', title: 'Tranh sơn dầu phong cảnh Hội An', image: '/images/auctions/painting.jpg', startingPrice: 4500000, currentBid: 4500000, bidCount: 0, startTime: '2026-10-05T09:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'vase', title: 'Bình gốm Bát Tràng vẽ tay', image: '/images/auctions/vase.jpg', startingPrice: 600000, currentBid: 600000, bidCount: 0, startTime: '2026-10-05T14:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'speaker', title: 'Loa Marshall Acton III', image: '/images/auctions/speaker.jpg', startingPrice: 4200000, currentBid: 4200000, bidCount: 0, startTime: '2026-10-06T09:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'headphones', title: 'Tai nghe Sony WH-1000XM5', image: '/images/auctions/headphones.jpg', startingPrice: 3500000, currentBid: 3500000, bidCount: 0, startTime: '2026-10-06T14:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
];
