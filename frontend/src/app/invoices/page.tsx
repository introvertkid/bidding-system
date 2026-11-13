
import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import InvoicesView from '@/components/invoices-view';

export const metadata: Metadata = {
  title: 'Hóa đơn của tôi | Bidwell',
};

export default function InvoicesPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="invoices" />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hóa đơn của tôi
        </h1>

        <p className="mt-2 text-sm text-[#64716a]">
          Theo dõi và thanh toán các sản phẩm bạn đã thắng đấu giá.
        </p>

        <InvoicesView />
      </main>
    </div>
  );
}
