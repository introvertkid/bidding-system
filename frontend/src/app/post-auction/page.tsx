
import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import PostAuctionView from '@/components/post-auction-view';

export const metadata: Metadata = {
  title: 'Quản lý hậu đấu giá | Bidwell',
  description: 'Quản lý hóa đơn và lời mời mua sau đấu giá.',
};

type PostAuctionPageProps = {
  searchParams: Promise<{
    tab?: string | string[];
  }>;
};

export default async function PostAuctionPage({
  searchParams,
}: PostAuctionPageProps) {
  const params = await searchParams;

  const activeTab =
    params.tab === 'offers' ? 'offers' : 'invoices';

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="post-auction" />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Quản lý hậu đấu giá
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#64716a]">
            Theo dõi hóa đơn thanh toán và các lời mời mua
            sản phẩm sau khi phiên đấu giá kết thúc.
          </p>
        </div>

        <PostAuctionView activeTab={activeTab} />
      </main>
    </div>
  );
}
