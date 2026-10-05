import Link from 'next/link';
import AuthNav from './auth-nav';

type SiteHeaderProps = { currentPage: 'home' | 'login' | 'register' | 'auctions' | 'history' };

export default function SiteHeader({ currentPage }: SiteHeaderProps) {
  const isAuthenticatedPage = currentPage === 'auctions' || currentPage === 'history';
  return (
      <header className="border-b border-[#182b25]/15 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-4 lg:px-10">
          <Link prefetch={false} href="/" className="text-xl font-semibold" aria-label="Bidwell — Trang chủ">Bidwell</Link>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-5 text-sm">
            <Link prefetch={false} href="/" aria-current={currentPage === 'home' ? 'page' : undefined} className={currentPage === 'home' ? 'font-semibold text-[#234e3c]' : 'hover:underline'}>Trang chủ</Link>
            <Link prefetch={false} href="/auctions" aria-current={currentPage === 'auctions' ? 'page' : undefined} className={currentPage === 'auctions' ? 'font-semibold text-[#234e3c]' : 'hover:underline'}>Phiên đấu giá</Link>
            <Link prefetch={false} href="/history" aria-current={currentPage === 'history' ? 'page' : undefined} className={currentPage === 'history' ? 'font-semibold text-[#234e3c]' : 'hover:underline'}>{isAuthenticatedPage ? 'Lịch sử' : 'Lịch sử đấu giá'}</Link>
          </nav>
          <AuthNav hideLinks={currentPage === 'login' || currentPage === 'register'} />
        </div>
      </header>
  );
}
