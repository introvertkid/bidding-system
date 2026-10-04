import Link from 'next/link';
import { auctionStatusLabels, type Auction } from '@/data/auctions';
import AuctionImage from './auction-image';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
});

export default function AuctionCard({ auction }: { auction: Auction }) {
  const isLive = auction.status === 'LIVE';
  const isUpcoming = auction.status === 'UPCOMING';

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-[#182b25]/15 bg-white">
      <div className="relative h-44 border-b border-[#182b25]/10 bg-[#f0f2ed]">
        <AuctionImage src={auction.image} alt={auction.title} sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 25vw" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className={`self-start rounded px-2 py-1 text-xs font-medium ${isLive ? 'bg-[#e9efdf] text-[#234e3c]' : 'bg-[#f0f2ed] text-[#64716a]'}`}>
          {auctionStatusLabels[auction.status]}
        </span>
        <h3 className="mt-3 text-base font-semibold leading-6">{auction.title}</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-[#64716a]">{isUpcoming ? 'Giá khởi điểm' : isLive ? 'Giá hiện tại' : 'Giá kết thúc'}</dt>
            <dd className="mt-1 text-lg font-semibold">{currency.format(isUpcoming ? auction.startingPrice : auction.currentBid)}</dd>
          </div>
          {isUpcoming ? (
            <div>
              <dt className="text-[#64716a]">Bắt đầu (giờ Việt Nam)</dt>
              <dd className="mt-1"><time dateTime={auction.startTime}>{dateTime.format(new Date(auction.startTime))}</time></dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64716a]">Số lượt trả giá</dt>
                <dd>{auction.bidCount}</dd>
              </div>
              {isLive && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-[#64716a]">Còn lại</dt>
                  <dd>{Math.floor(auction.remainingMinutes / 60)} giờ {auction.remainingMinutes % 60} phút</dd>
                </div>
              )}
            </>
          )}
        </dl>
        <Link prefetch={false} href={`/auctions/${auction.id}`} className="mt-auto pt-5">
          <span className="block rounded-md border border-[#234e3c]/30 px-3 py-2 text-center text-sm font-medium text-[#234e3c] hover:bg-[#f0f2ed]">Xem phiên đấu giá<span className="sr-only">: {auction.title}</span></span>
        </Link>
      </div>
    </article>
  );
}
