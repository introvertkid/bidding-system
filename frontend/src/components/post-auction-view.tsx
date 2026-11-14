
import Link from 'next/link';
import InvoicesView from './invoices-view';
import OffersView from './offers-view';

type Tab = 'invoices' | 'offers';

type PostAuctionViewProps = {
  activeTab: Tab;
};

const tabs = [
  {
    id: 'invoices',
    label: 'Hóa đơn',
    description: 'Quản lý thanh toán',
    href: '/post-auction?tab=invoices',
  },
  {
    id: 'offers',
    label: 'Lời mời',
    description: 'Phản hồi lời mời mua',
    href: '/post-auction?tab=offers',
  },
] as const;

export default function PostAuctionView({
  activeTab,
}: PostAuctionViewProps) {
  return (
    <div>
      {/* Điều hướng giữa hai chức năng */}
      <nav
        aria-label="Chức năng hậu đấu giá"
        className="grid grid-cols-2 gap-3"
      >
        {tabs.map(tab => {
          const active = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg border px-4 py-4 transition-colors ${
                active
                  ? 'border-[#234e3c] bg-[#234e3c] text-white'
                  : 'border-[#182b25]/15 bg-white text-[#182b25] hover:border-[#234e3c]/40 hover:bg-[#f0f2ed]'
              }`}
            >
              <span className="block text-sm font-semibold sm:text-base">
                {tab.label}
              </span>

              <span
                className={`mt-1 block text-xs ${
                  active ? 'text-white/80' : 'text-[#64716a]'
                }`}
              >
                {tab.description}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Hiển thị nội dung của tab được chọn */}
      <div
        role="region"
        aria-label={
          activeTab === 'invoices'
            ? 'Danh sách hóa đơn'
            : 'Danh sách lời mời'
        }
        className="mt-2"
      >
        {activeTab === 'invoices' ? (
          <InvoicesView />
        ) : (
          <OffersView />
        )}
      </div>
    </div>
  );
}
