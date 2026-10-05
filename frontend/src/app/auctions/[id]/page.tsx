import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import AuctionLiveView from '@/components/auction-live-view';
import { ApiError, serverApi } from '@/lib/api';
import type { Auction, BidHistoryItem } from '@/data/auctions';

export const metadata: Metadata = { title: 'Chi tiết phiên đấu giá | Bidwell' };

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [auction, history] = await Promise.all([
    serverApi<Auction>(`/auctions/${id}`),
    serverApi<BidHistoryItem[]>(`/auctions/${id}/bids`),
  ]).catch((error: unknown) => {
    // 400: id không phải UUID, 404: không tồn tại
    if (error instanceof ApiError && (error.status === 400 || error.status === 404)) notFound();
    throw error;
  });

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="auctions" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <Link href="/auctions" className="text-sm text-[#64716a] hover:text-[#234e3c] hover:underline">← Quay lại phiên đấu giá</Link>
        <AuctionLiveView auction={auction} history={history} />
      </main>
    </div>
  );
}
