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
  startTime: string;
  // Fixed illustrative duration in minutes; not a live countdown.
  remainingMinutes: number;
  status: AuctionStatus;
  winnerName?: string;
};

// Mock sessions and VND prices. Statuses and durations are fixed for this preview.
export const auctions: Auction[] = [
  { id: 'macbook', description: "MacBook Air M2 đã qua sử dụng, hoạt động ổn định. Ngoại hình còn tốt, kèm bộ sạc.", title: 'MacBook Air M2 16GB / 512GB', imageUrl: '/images/auctions/macbook.jpg', startingPrice: 15000000, currentBid: 18500000, bidCount: 18, startTime: '2026-10-04T08:00:00+07:00', remainingMinutes: 135, status: 'LIVE' },
  { id: 'camera', description: "Máy ảnh Fujifilm X-T30 II kèm ống kính. Các chức năng hoạt động bình thường, có dấu sử dụng nhẹ.", title: 'Máy ảnh Fujifilm X-T30 II kèm ống kính', imageUrl: '/images/auctions/camera.jpg', startingPrice: 18000000, currentBid: 22500000, bidCount: 12, startTime: '2026-10-04T09:00:00+07:00', remainingMinutes: 270, status: 'LIVE' },
  { id: 'watch', description: "Đồng hồ Seiko 5 máy cơ tự động, dây kim loại. Mặt kính còn tốt, máy hoạt động ổn định.", title: 'Đồng hồ Seiko 5 tự động cổ điển', imageUrl: '/images/auctions/watch.jpg', startingPrice: 3000000, currentBid: 4200000, bidCount: 24, startTime: '2026-10-04T08:30:00+07:00', remainingMinutes: 105, status: 'LIVE' },
  { id: 'bag', description: "Túi xách da thật làm thủ công, màu nâu. Đường may chắc chắn, có dấu sử dụng nhẹ.", title: 'Túi xách da thật thủ công', imageUrl: '/images/auctions/bag.jpg', startingPrice: 1200000, currentBid: 1850000, bidCount: 8, startTime: '2026-10-04T10:00:00+07:00', remainingMinutes: 370, status: 'LIVE' },
  { id: 'painting', description: "Tranh sơn dầu phong cảnh Hội An vẽ tay, kèm khung gỗ. Bề mặt tranh và khung còn tốt.", title: 'Tranh sơn dầu phong cảnh Hội An', imageUrl: '/images/auctions/painting.jpg', startingPrice: 4500000, currentBid: 4500000, bidCount: 0, startTime: '2026-10-05T09:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'vase', description: "Bình gốm Bát Tràng trang trí vẽ tay. Bình nguyên vẹn, không nứt hoặc sứt miệng.", title: 'Bình gốm Bát Tràng vẽ tay', imageUrl: '/images/auctions/vase.jpg', startingPrice: 600000, currentBid: 600000, bidCount: 0, startTime: '2026-10-05T14:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'speaker', description: "Loa Marshall Acton III đã qua sử dụng. Kết nối Bluetooth và các nút điều khiển hoạt động tốt.", title: 'Loa Marshall Acton III', imageUrl: '/images/auctions/speaker.jpg', startingPrice: 4200000, currentBid: 4200000, bidCount: 0, startTime: '2026-10-06T09:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'headphones', description: "Tai nghe Sony WH-1000XM5, kèm hộp đựng và cáp sạc. Chống ồn và kết nối hoạt động bình thường.", title: 'Tai nghe Sony WH-1000XM5', imageUrl: '/images/auctions/headphones.jpg', startingPrice: 3500000, currentBid: 3500000, bidCount: 0, startTime: '2026-10-06T14:00:00+07:00', remainingMinutes: 0, status: 'UPCOMING' },
  { id: 'watch-ended', description: "Đồng hồ Seiko Presage máy cơ, dây da. Đã qua sử dụng, máy hoạt động ổn định.", title: 'Đồng hồ Seiko Presage', imageUrl: '/images/auctions/watch.jpg', startingPrice: 5000000, currentBid: 7200000, bidCount: 16, startTime: '2026-10-02T09:00:00+07:00', remainingMinutes: 0, status: 'ENDED', winnerName: 'user09' },
  { id: 'camera-ended', description: "Máy ảnh Fujifilm X-T20 đã qua sử dụng. Thân máy còn tốt, các chức năng hoạt động bình thường.", title: 'Máy ảnh Fujifilm X-T20', imageUrl: '/images/auctions/camera.jpg', startingPrice: 10000000, currentBid: 13500000, bidCount: 21, startTime: '2026-10-03T09:00:00+07:00', remainingMinutes: 0, status: 'ENDED', winnerName: 'user11' },
];
