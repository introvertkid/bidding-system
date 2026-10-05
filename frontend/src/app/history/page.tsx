import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import HistoryView from '@/components/history-view';

export const metadata: Metadata = { title: 'Lịch sử đấu giá | Bidwell' };

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="history" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Lịch sử đấu giá</h1>
        <HistoryView />
      </main>
    </div>
  );
}
