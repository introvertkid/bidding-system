'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import AuctionImage from './auction-image';
import BidPanel from './bid-panel';
import { auctionStatusLabels, type Auction, type AuctionStatus, type BidHistoryItem } from '@/data/auctions';
import { getSocket, type AuctionUpdatedEvent } from '@/lib/socket';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
});

// Đồng hồ dùng chung, tick mỗi giây. Trên server trả null để tránh lệch giờ khi hydrate
let nowListeners: (() => void)[] = [];
let nowTimer: ReturnType<typeof setInterval> | undefined;
let nowValue = Date.now();
function subscribeNow(listener: () => void) {
  nowListeners.push(listener);
  if (!nowTimer) {
    nowTimer = setInterval(() => {
      nowValue = Date.now();
      nowListeners.forEach(notify => notify());
    }, 1000);
  }
  return () => {
    nowListeners = nowListeners.filter(item => item !== listener);
    if (!nowListeners.length) {
      clearInterval(nowTimer);
      nowTimer = undefined;
    }
  };
}
const useNow = () => useSyncExternalStore(subscribeNow, () => nowValue, () => null);

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

type LiveState = Pick<AuctionUpdatedEvent, 'currentPrice' | 'minNextBid' | 'totalBids' | 'endTime'> & { bids: BidHistoryItem[] };

export default function AuctionLiveView({ auction, history }: { auction: Auction; history: BidHistoryItem[] }) {
  const router = useRouter();
  const now = useNow();
  // Cập nhật nhận qua WebSocket, đè lên dữ liệu server khi mới hơn (nhiều lượt bid hơn)
  const [live, setLive] = useState<LiveState | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('join_auction', { auctionId: auction.id });
    const onUpdated = (event: AuctionUpdatedEvent) => {
      if (event.auctionId !== auction.id) return;
      setLive(previous => ({
        currentPrice: event.currentPrice,
        minNextBid: event.minNextBid,
        totalBids: event.totalBids,
        endTime: event.endTime,
        bids: [event.bid, ...(previous?.bids ?? []).filter(bid => bid.id !== event.bid.id)],
      }));
      setFlash(true);
    };
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('auction_updated', onUpdated);
    return () => {
      socket.emit('leave_auction', { auctionId: auction.id });
      socket.off('connect', join);
      socket.off('auction_updated', onUpdated);
    };
  }, [auction.id]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(timer);
  }, [flash]);

  const useLive = live !== null && live.totalBids >= auction.bidCount;
  const currentBid = useLive ? live.currentPrice : auction.currentBid;
  const minNextBid = useLive ? live.minNextBid : auction.minNextBid;
  const bidCount = useLive ? live.totalBids : auction.bidCount;
  const endTime = useLive ? live.endTime : auction.endTime;
  const bids = [...(live?.bids ?? []), ...history].filter(
    (bid, index, all) => all.findIndex(item => item.id === bid.id) === index,
  );

  // Trạng thái tính lại theo đồng hồ: hết giờ thì khóa đặt giá ngay
  let status: AuctionStatus = auction.status;
  if (now !== null) {
    if (status === 'UPCOMING' && now >= new Date(auction.startTime).getTime()) status = 'LIVE';
    if (status === 'LIVE' && now >= new Date(endTime).getTime()) status = 'ENDED';
  }
  const statusChanged = status !== auction.status;

  // Đổi trạng thái (bắt đầu / kết thúc) thì tải lại dữ liệu server để có người thắng, giá chốt
  useEffect(() => {
    if (statusChanged) router.refresh();
  }, [statusChanged, router]);

  const isLive = status === 'LIVE';
  const isUpcoming = status === 'UPCOMING';
  const remaining = now === null ? '--:--:--' : formatDuration(new Date(endTime).getTime() - now);
  const startsIn = now === null ? '--:--:--' : formatDuration(new Date(auction.startTime).getTime() - now);

  return (
    <>
      <div className="my-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{auction.title}</h1>
        <span className={`rounded px-2 py-1 text-xs font-medium ${isLive ? 'bg-[#e9efdf] text-[#234e3c]' : 'bg-[#f0f2ed] text-[#64716a]'}`}>{auctionStatusLabels[status]}</span>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#64716a]">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#688447]" />
            Cập nhật trực tiếp
          </span>
        )}
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
              <dd aria-live="polite" className={`mt-1 inline-block rounded text-2xl font-semibold tabular-nums text-[#234e3c] transition-colors duration-700 ${flash ? 'bg-[#e9efdf]' : 'bg-transparent'}`}>
                {currency.format(isUpcoming ? auction.startingPrice : currentBid)}
              </dd>
            </div>
            {!isUpcoming && <div><dt className="sr-only">Số lượt trả giá</dt><dd>{bidCount} lượt trả giá</dd></div>}
            <div>
              <dt className="text-[#64716a]">Bắt đầu</dt>
              <dd className="mt-1"><time dateTime={auction.startTime}>{dateTime.format(new Date(auction.startTime))}</time></dd>
            </div>
            {isLive && <div><dt className="text-[#64716a]">Còn lại</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{remaining}</dd></div>}
            {isUpcoming && <div><dt className="text-[#64716a]">Bắt đầu sau</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{startsIn}</dd></div>}
          </dl>
          {isLive ? <BidPanel key={auction.id} auctionId={auction.id} sellerId={auction.sellerId} minNextBid={minNextBid} /> : isUpcoming ? (
            <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">Phiên đấu giá chưa bắt đầu</p>
          ) : (
            <div className="mt-6 border-t border-[#182b25]/10 pt-5">
              <h3 className="text-sm font-semibold">Kết quả đấu giá</h3>
              <dl className="mt-3 text-sm">
                <dt className="text-[#64716a]">Người thắng</dt>
                <dd className="mt-1 font-medium">{auction.winnerName ?? (statusChanged ? 'Đang cập nhật…' : 'Không có người đặt giá')}</dd>
              </dl>
            </div>
          )}
        </section>
      </div>
      <section aria-labelledby="bid-history-title" className="mt-6 overflow-hidden rounded-md border border-[#182b25]/15 bg-white">
        <h2 id="bid-history-title" className="border-b border-[#182b25]/10 px-5 py-4 text-lg font-semibold">Lịch sử trả giá</h2>
        {bids.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fafaf8] text-[#64716a]">
                <tr><th scope="col" className="px-5 py-3 font-medium">Người trả</th><th scope="col" className="px-5 py-3 font-medium">Giá trả</th><th scope="col" className="px-5 py-3 font-medium">Thời gian</th></tr>
              </thead>
              <tbody>
                {bids.map(bid => <tr key={bid.id} className="border-t border-[#182b25]/10"><td className="px-5 py-3">{bid.bidderName}</td><td className="whitespace-nowrap px-5 py-3 tabular-nums">{currency.format(bid.amount)}</td><td className="whitespace-nowrap px-5 py-3"><time dateTime={bid.createdAt}>{dateTime.format(new Date(bid.createdAt))}</time></td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="p-5 text-sm text-[#64716a]">Chưa có lượt trả giá.</p>}
      </section>
    </>
  );
}
