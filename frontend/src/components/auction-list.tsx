'use client';

import { useState } from 'react';
import { auctionStatusLabels, type Auction, type AuctionStatus } from '@/data/auctions';
import AuctionCard from './auction-card';

type StatusFilter = 'ALL' | AuctionStatus;
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'LIVE', label: auctionStatusLabels.LIVE },
  { value: 'UPCOMING', label: auctionStatusLabels.UPCOMING },
  { value: 'ENDED', label: auctionStatusLabels.ENDED },
];

export default function AuctionList({ auctions }: { auctions: Auction[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const searchTerm = query.trim().toLocaleLowerCase('vi-VN');
  const filtered = auctions.filter(auction =>
    (status === 'ALL' || auction.status === status) &&
    auction.title.toLocaleLowerCase('vi-VN').includes(searchTerm)
  );

  return (
    <div>
      <label className="block max-w-xl">
        <span className="sr-only">Tìm kiếm phiên đấu giá</span>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Tìm kiếm phiên đấu giá..."
          className="w-full rounded-md border border-[#182b25]/20 bg-white px-4 py-2.5 text-sm"
        />
      </label>
      <div role="group" aria-label="Trạng thái phiên đấu giá" className="my-5 flex flex-wrap gap-2">
        {statusFilters.map(filter => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${status === filter.value ? 'border-[#234e3c] bg-[#234e3c] text-white' : 'border-[#182b25]/20 bg-white hover:bg-[#f0f2ed]'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map(auction => <AuctionCard key={auction.id} auction={auction} conciseAction />)}
          </div>
        ) : (
          <p className="rounded-md border border-[#182b25]/15 bg-white p-6 text-sm text-[#64716a]">Không tìm thấy phiên đấu giá.</p>
        )}
      </div>
    </div>
  );
}
