
import Link from 'next/link';
import AuthNav from './auth-nav';

type SiteHeaderProps = {
  currentPage:
    | 'home'
    | 'login'
    | 'register'
    | 'auctions'
    | 'history'
    | 'invoices'
    | 'offers'
    | 'post-auction';
};

const navLinks = [
  {
    href: '/',
    label: 'Trang chủ',
    page: 'home',
  },
  {
    href: '/auctions',
    label: 'Phiên đấu giá',
    page: 'auctions',
  },
  {
    href: '/history',
    label: 'Lịch sử đấu giá',
    page: 'history',
  },
  {
    href: '/post-auction',
    label: 'Quản lý sau đấu giá',
    page: 'post-auction',
  },
] as const;

export default function SiteHeader({
  currentPage,
}: SiteHeaderProps) {
  const isPostAuction =
    currentPage === 'post-auction' ||
    currentPage === 'invoices' ||
    currentPage === 'offers';

  return (
    <header className="relative z-30 border-b border-[#182b25]/15 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-4 lg:px-10">
        <Link
          href="/"
          prefetch={false}
          className="text-xl font-semibold"
          aria-label="Bidwell — Trang chủ"
        >
          Bidwell
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="flex flex-wrap items-center gap-5 text-sm"
        >
          {navLinks.map(item => {
            const active =
              item.page === 'post-auction'
                ? isPostAuction
                : currentPage === item.page;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`transition-colors ${
                  active
                    ? 'font-semibold text-[#234e3c]'
                    : 'text-[#182b25] hover:text-[#234e3c] hover:underline'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <AuthNav
          hideLinks={
            currentPage === 'login' ||
            currentPage === 'register'
          }
        />
      </div>
    </header>
  );
}
