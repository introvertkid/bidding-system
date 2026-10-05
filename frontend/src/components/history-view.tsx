'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuctionHistory, { type ParticipatedAuction } from './auction-history';
import type { Auction } from '@/data/auctions';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

type HistoryResponse = {
  auctions: Auction[];
  participated: ParticipatedAuction[];
  createdAuctionIds: string[];
};

export default function HistoryView() {
  const user = useSessionUser();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState('');

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    clientApi<HistoryResponse>('/auctions/me/history')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Không tải được lịch sử.'));
  }, [userId]);

  if (user === undefined) return null;
  if (user === null) {
    return (
      <p className="rounded-md border border-[#182b25]/15 bg-white p-6 text-sm text-[#64716a]">
        <Link href="/login" className="font-medium text-[#234e3c] underline underline-offset-4">Đăng nhập</Link> để xem lịch sử đấu giá của bạn.
      </p>
    );
  }
  if (error) return <p role="alert" className="text-sm text-[#a34539]">{error}</p>;
  if (!data) return <p className="text-sm text-[#64716a]">Đang tải…</p>;

  return <AuctionHistory auctions={data.auctions} participatedAuctions={data.participated} createdAuctionIds={data.createdAuctionIds} />;
}
