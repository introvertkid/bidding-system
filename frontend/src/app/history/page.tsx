import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import AuctionHistory, { type ParticipatedAuction } from '@/components/auction-history';
import { auctions } from '@/data/auctions';

export const metadata: Metadata = { title: 'Lịch sử đấu giá | Bidwell' };

// UI examples only, not a real user identity or authenticated session.
const participatedAuctions: ParticipatedAuction[] = [
  { auctionId: 'macbook', userBid: 18300000, result: 'OUTBID' },
  { auctionId: 'camera', userBid: 22500000, result: 'LEADING' },
  { auctionId: 'watch-ended', userBid: 7200000, result: 'WON' },
];
const createdAuctionIds = ['painting', 'bag'];

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="history" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Lịch sử đấu giá</h1>
        <AuctionHistory auctions={auctions} participatedAuctions={participatedAuctions} createdAuctionIds={createdAuctionIds} />
      </main>
    </div>
  );
}
