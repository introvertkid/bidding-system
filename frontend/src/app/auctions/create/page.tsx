import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import CreateAuctionForm from '@/components/create-auction-form';

export const metadata: Metadata = { title: 'Tạo phiên đấu giá | Bidwell' };

export default function CreateAuctionPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="auctions" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-[1080px]">
          <h1 id="create-auction-title" className="mb-6 text-2xl font-semibold tracking-tight">Tạo phiên đấu giá</h1>
          <CreateAuctionForm />
        </div>
      </main>
    </div>
  );
}
