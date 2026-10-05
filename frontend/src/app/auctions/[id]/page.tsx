import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import AuctionImage from '@/components/auction-image';
import BidPanel from '@/components/bid-panel';
import { auctions, auctionStatusLabels } from '@/data/auctions';

export const metadata: Metadata = { title: 'Chi tiết phiên đấu giá | Bidwell' };

type BidHistoryItem = {
  id: string;
  bidderName: string;
  amount: number;
  time: string;
};

// Static illustrative rows only; a short sample, not the complete bid count.
const bidHistory: Record<string, BidHistoryItem[]> = {
  macbook: [
    { id: 'macbook-2', bidderName: 'user01', amount: 18500000, time: '2026-10-04T10:32:00+07:00' },
    { id: 'macbook-1', bidderName: 'user02', amount: 18300000, time: '2026-10-04T10:30:00+07:00' },
  ],
  camera: [
    { id: 'camera-2', bidderName: 'user03', amount: 22500000, time: '2026-10-04T10:35:00+07:00' },
    { id: 'camera-1', bidderName: 'user04', amount: 22000000, time: '2026-10-04T10:31:00+07:00' },
  ],
  watch: [
    { id: 'watch-2', bidderName: 'user05', amount: 4200000, time: '2026-10-04T10:28:00+07:00' },
    { id: 'watch-1', bidderName: 'user06', amount: 4100000, time: '2026-10-04T10:25:00+07:00' },
  ],
  bag: [
    { id: 'bag-2', bidderName: 'user07', amount: 1850000, time: '2026-10-04T10:40:00+07:00' },
    { id: 'bag-1', bidderName: 'user08', amount: 1800000, time: '2026-10-04T10:36:00+07:00' },
  ],
  'watch-ended': [
    { id: 'watch-ended-2', bidderName: 'user09', amount: 7200000, time: '2026-10-02T11:58:00+07:00' },
    { id: 'watch-ended-1', bidderName: 'user10', amount: 7000000, time: '2026-10-02T11:55:00+07:00' },
  ],
  'camera-ended': [
    { id: 'camera-ended-2', bidderName: 'user11', amount: 13500000, time: '2026-10-03T11:58:00+07:00' },
    { id: 'camera-ended-1', bidderName: 'user12', amount: 13200000, time: '2026-10-03T11:54:00+07:00' },
  ],
};

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
});

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = auctions.find(item => item.id === id);
  if (!auction) notFound();

  const isLive = auction.status === 'LIVE';
  const isUpcoming = auction.status === 'UPCOMING';
  const history = isUpcoming ? [] : bidHistory[auction.id] ?? [];
  const remainingTime = `${String(Math.floor(auction.remainingMinutes / 60)).padStart(2, '0')}:${String(auction.remainingMinutes % 60).padStart(2, '0')}:00`;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="auctions" />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <Link href="/auctions" className="text-sm text-[#64716a] hover:text-[#234e3c] hover:underline">← Quay lại phiên đấu giá</Link>
        <div className="my-5 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{auction.title}</h1>
          <span className={`rounded px-2 py-1 text-xs font-medium ${isLive ? 'bg-[#e9efdf] text-[#234e3c]' : 'bg-[#f0f2ed] text-[#64716a]'}`}>{auctionStatusLabels[auction.status]}</span>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-label="Thông tin sản phẩm" className="min-w-0 overflow-hidden rounded-md border border-[#182b25]/15 bg-white">
            <div className="relative h-72 border-b border-[#182b25]/10 bg-[#f0f2ed] sm:h-96">
              <AuctionImage src={auction.imageUrl} alt={auction.title} sizes="(max-width: 1023px) 100vw, 60vw" />
            </div>
            <div className="p-5">
              <h2 className="text-base font-semibold">Mô tả sản phẩm</h2>
              <p className="mt-3 text-sm leading-6 text-[#64716a]">{auction.description}</p>
            </div>
          </section>
          <section aria-labelledby="auction-information-title" className="min-w-0 rounded-md border border-[#182b25]/15 bg-white p-5 sm:p-6">
            <h2 id="auction-information-title" className="text-lg font-semibold">Thông tin phiên đấu giá</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[#64716a]">{isUpcoming ? 'Giá khởi điểm' : isLive ? 'Giá hiện tại' : 'Giá kết thúc'}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#234e3c]">{currency.format(isUpcoming ? auction.startingPrice : auction.currentBid)}</dd>
              </div>
              {!isUpcoming && <div><dt className="sr-only">Số lượt trả giá</dt><dd>{auction.bidCount} lượt trả giá</dd></div>}
              <div>
                <dt className="text-[#64716a]">Bắt đầu</dt>
                <dd className="mt-1"><time dateTime={auction.startTime}>{dateTime.format(new Date(auction.startTime))}</time></dd>
              </div>
              {isLive && <div><dt className="text-[#64716a]">Còn lại</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{remainingTime}</dd></div>}
            </dl>
            {isLive ? <BidPanel key={auction.id} currentBid={auction.currentBid} /> : isUpcoming ? (
              <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">Phiên đấu giá chưa bắt đầu</p>
            ) : (
              <div className="mt-6 border-t border-[#182b25]/10 pt-5">
                <h3 className="text-sm font-semibold">Kết quả đấu giá</h3>
                <dl className="mt-3 text-sm">
                  <dt className="text-[#64716a]">Người thắng</dt>
                  <dd className="mt-1 font-medium">{auction.winnerName ?? 'Chưa có thông tin'}</dd>
                </dl>
              </div>
            )}
          </section>
        </div>
        <section aria-labelledby="bid-history-title" className="mt-6 overflow-hidden rounded-md border border-[#182b25]/15 bg-white">
          <h2 id="bid-history-title" className="border-b border-[#182b25]/10 px-5 py-4 text-lg font-semibold">Lịch sử trả giá</h2>
          {history.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafaf8] text-[#64716a]">
                  <tr><th scope="col" className="px-5 py-3 font-medium">Người trả</th><th scope="col" className="px-5 py-3 font-medium">Giá trả</th><th scope="col" className="px-5 py-3 font-medium">Thời gian</th></tr>
                </thead>
                <tbody>
                  {history.map(bid => <tr key={bid.id} className="border-t border-[#182b25]/10"><td className="px-5 py-3">{bid.bidderName}</td><td className="whitespace-nowrap px-5 py-3 tabular-nums">{currency.format(bid.amount)}</td><td className="whitespace-nowrap px-5 py-3"><time dateTime={bid.time}>{dateTime.format(new Date(bid.time))}</time></td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="p-5 text-sm text-[#64716a]">Chưa có lượt trả giá.</p>}
        </section>
      </main>
    </div>
  );
}
