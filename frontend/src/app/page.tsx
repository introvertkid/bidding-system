import Link from 'next/link';
import SiteHeader from '@/components/site-header';
import AuctionBrowser from '@/components/auction-browser';
import { serverApi } from '@/lib/api';
import type { Auction } from '@/data/auctions';

export default async function Home() {
  const auctions = await serverApi<Auction[]>('/auctions');
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="home" />
      <main className="mx-auto max-w-7xl px-6 lg:px-10">
        <section aria-labelledby="hero-title" className="border-b border-[#182b25]/10 py-8 sm:py-10">
          <h1 id="hero-title" className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            Đấu giá trực tuyến minh bạch thời gian thực
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#64716a] sm:text-base">
            Khám phá các phiên đấu giá đang diễn ra và tham gia đấu giá trực tiếp
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium">
            <Link prefetch={false} href="#auctions" className="rounded-md bg-[#234e3c] px-4 py-2.5 text-white hover:bg-[#163b2b]">Khám phá phiên đấu giá</Link>
            <Link prefetch={false} href="/login" className="rounded-md border border-[#182b25]/20 bg-white px-4 py-2.5 hover:bg-[#f0f2ed]">Đăng nhập</Link>
          </div>
        </section>
        <AuctionBrowser auctions={auctions} />
      </main>
      <footer className="border-t border-[#182b25]/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-6 py-5 text-xs text-[#64716a] lg:px-10">
          <p>Bidwell · Hệ thống đấu giá trực tuyến</p>
        </div>
      </footer>
    </div>
  );
}
