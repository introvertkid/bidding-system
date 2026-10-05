'use client';

import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import { auctionStatusLabels, type Auction } from '@/data/auctions';
import AuctionImage from './auction-image';

type ParticipationResult = 'LEADING' | 'OUTBID' | 'WON' | 'LOST';
export type ParticipatedAuction = {
  auctionId: string;
  userBid: number;
  result: ParticipationResult;
};
type HistoryTab = 'participated' | 'created';
type AuctionHistoryProps = {
  auctions: Auction[];
  participatedAuctions: ParticipatedAuction[];
  createdAuctionIds: string[];
};

const resultLabels: Record<ParticipationResult, string> = {
  LEADING: 'Đang dẫn đầu',
  OUTBID: 'Đã bị vượt',
  WON: 'Thắng',
  LOST: 'Không thắng',
};
const tabs: { id: HistoryTab; label: string }[] = [
  { id: 'participated', label: 'Phiên đã tham gia' },
  { id: 'created', label: 'Phiên đã tạo' },
];
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
});

export default function AuctionHistory({ auctions, participatedAuctions, createdAuctionIds }: AuctionHistoryProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('participated');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const participated = participatedAuctions.flatMap(participation => {
    const auction = auctions.find(item => item.id === participation.auctionId);
    return auction && auction.status !== 'UPCOMING' ? [{ auction, participation }] : [];
  });
  const created = createdAuctionIds.flatMap(id => {
    const auction = auctions.find(item => item.id === id);
    return auction ? [{ auction, participation: undefined }] : [];
  });
  const items = activeTab === 'participated' ? participated : created;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Lịch sử đấu giá" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => { tabRefs.current[index] = element; }}
            id={`history-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls="history-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${activeTab === tab.id ? 'border-[#234e3c] bg-[#234e3c] text-white' : 'border-[#182b25]/20 bg-white hover:bg-[#f0f2ed]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${activeTab}`} tabIndex={0}>
        {items.length ? (
          <ul className="space-y-3">
            {items.map(({ auction, participation }) => {
              const isUpcoming = auction.status === 'UPCOMING';
              const isEnded = auction.status === 'ENDED';
              return (
                <li key={auction.id}>
                  <article className="flex flex-col gap-4 rounded-md border border-[#182b25]/15 bg-white p-4 sm:flex-row sm:items-center">
                    <div className="relative h-40 shrink-0 overflow-hidden rounded border border-[#182b25]/10 bg-[#f0f2ed] sm:h-28 sm:w-36">
                      <AuctionImage src={auction.imageUrl} alt={auction.title} sizes="(max-width: 639px) 100vw, 144px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{auction.title}</h2>
                        <span className={`rounded px-2 py-1 text-xs font-medium ${auction.status === 'LIVE' ? 'bg-[#e9efdf] text-[#234e3c]' : 'bg-[#f0f2ed] text-[#64716a]'}`}>{auctionStatusLabels[auction.status]}</span>
                      </div>
                      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-[#64716a]">{isUpcoming ? 'Giá khởi điểm' : isEnded ? 'Giá kết thúc' : 'Giá hiện tại'}</dt>
                          <dd className="mt-1 font-semibold tabular-nums">{currency.format(isUpcoming ? auction.startingPrice : auction.currentBid)}</dd>
                        </div>
                        {participation ? (
                          <div>
                            <dt className="text-xs text-[#64716a]">Giá của bạn</dt>
                            <dd className="mt-1 font-medium tabular-nums">{currency.format(participation.userBid)}</dd>
                          </div>
                        ) : isUpcoming ? (
                          <div>
                            <dt className="text-xs text-[#64716a]">Bắt đầu</dt>
                            <dd className="mt-1"><time dateTime={auction.startTime}>{dateTime.format(new Date(auction.startTime))}</time></dd>
                          </div>
                        ) : (
                          <div>
                            <dt className="sr-only">Số lượt trả giá</dt>
                            <dd className="mt-1 text-[#64716a]">{auction.bidCount} lượt trả giá</dd>
                          </div>
                        )}
                      </dl>
                      {participation && <p className={`mt-2 text-sm font-medium ${participation.result === 'LEADING' || participation.result === 'WON' ? 'text-[#234e3c]' : 'text-[#64716a]'}`}>{resultLabels[participation.result]}</p>}
                    </div>
                    <Link href={`/auctions/${auction.id}`} className="self-start rounded-md border border-[#234e3c]/30 px-4 py-2 text-sm font-medium text-[#234e3c] hover:bg-[#f0f2ed] sm:self-center">
                      {isEnded ? 'Xem kết quả' : 'Xem phiên'}<span className="sr-only">: {auction.title}</span>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md border border-[#182b25]/15 bg-white p-6 text-sm text-[#64716a]">
            {activeTab === 'participated' ? 'Bạn chưa tham gia phiên đấu giá nào.' : 'Bạn chưa tạo phiên đấu giá nào.'}
          </p>
        )}
      </div>
    </div>
  );
}
