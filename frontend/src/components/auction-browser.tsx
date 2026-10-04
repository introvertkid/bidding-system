'use client';

import Link from 'next/link';

import { useState } from 'react';
import { auctionStatusLabels, type Auction, type AuctionStatus } from '@/data/auctions';
import AuctionCard from './auction-card';

const sectionStatuses: AuctionStatus[] = ['LIVE', 'UPCOMING'];

export default function AuctionBrowser({ auctions }: { auctions: Auction[] }) {
  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLocaleLowerCase('vi-VN');
  const filtered = auctions.filter(auction => auction.title.toLocaleLowerCase('vi-VN').includes(searchTerm));

  return (
    <div id="auctions" className="scroll-mt-6 py-8">
      <label className="block max-w-xl">
        <span className="mb-2 block text-sm font-medium">Tìm kiếm phiên đấu giá</span>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Tìm kiếm phiên đấu giá..."
          className="w-full rounded-md border border-[#182b25]/20 bg-white px-4 py-2.5 text-sm"
        />
      </label>
      <p role="status" className="mt-3 text-xs text-[#64716a]">
        {filtered.filter(auction => sectionStatuses.includes(auction.status)).length} phiên đấu giá{searchTerm ? ' phù hợp' : ''}
      </p>
      <div className="mt-7 space-y-10">
        {sectionStatuses.map(status => {
          const sessions = filtered.filter(auction => auction.status === status).slice(0, 4);
          const headingId = status === 'LIVE' ? 'live-auctions-title' : 'upcoming-auctions-title';
          return (
            <section key={status} aria-labelledby={headingId}>
              <h2 id={headingId} className="mb-4 text-xl font-semibold">{auctionStatusLabels[status]}</h2>
              {sessions.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {sessions.map(auction => <AuctionCard key={auction.id} auction={auction} />)}
                </div>
              ) : (
                <div className="rounded-md border border-[#182b25]/15 bg-white p-6 text-sm text-[#64716a]">
                  Không tìm thấy phiên đấu giá {status === 'LIVE' ? 'đang diễn ra' : 'sắp diễn ra'}. Thử từ khóa khác.
                </div>
              )}
              <div className="mt-4">
                <Link prefetch={false} href="/auctions" className="inline-block rounded-md border border-[#182b25]/20 bg-white px-4 py-2 text-sm font-medium hover:bg-[#f0f2ed]">
                  Xem tất cả phiên đấu giá
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
