
import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import OffersView from '@/components/offers-view';

export const metadata: Metadata = {
  title: 'Lời mời mua sản phẩm | Bidwell',
};

export default function OffersPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="offers" />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Lời mời mua sản phẩm
        </h1>

        <p className="mt-2 text-sm text-[#64716a]">
          Quản lý các lời mời mua dành cho người trả giá
          cao tiếp theo khi người thắng trước không hoàn
          tất thanh toán.
        </p>

        <OffersView />
      </main>
    </div>
  );
}
