import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/site-header';
import AuctionList from '@/components/auction-list';
import { auctions } from '@/data/auctions';

export const metadata: Metadata = { title: 'Phiên đấu giá | Bidwell' };

export default function AuctionsPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="auctions" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Phiên đấu giá</h1>
          <Link prefetch={false} href="/auctions/create" className="rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b]">+ Tạo phiên</Link>
        </div>
        <AuctionList auctions={auctions} />
      </main>
    </div>
  );
}
