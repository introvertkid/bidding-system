'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

type BidPanelProps = { auctionId: string; sellerId: string; minNextBid: number };

export default function BidPanel({ auctionId, sellerId, minNextBid }: BidPanelProps) {
  const router = useRouter();
  const user = useSessionUser();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bid = Number(amount);
    let nextError = '';
    if (!amount.trim()) nextError = 'Vui lòng nhập giá trả.';
    else if (!Number.isFinite(bid) || bid <= 0) nextError = 'Giá trả phải lớn hơn 0.';
    else if (bid < minNextBid) nextError = `Giá trả phải tối thiểu ${currency.format(minNextBid)}.`;
    setError(nextError);
    setSuccess('');
    if (nextError) {
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await clientApi(`/auctions/${auctionId}/bids`, { method: 'POST', body: JSON.stringify({ amount: bid }) });
      setAmount('');
      setSuccess(`Đặt giá ${currency.format(bid)} thành công.`);
      // Tải lại dữ liệu server (giá hiện tại, lịch sử trả giá)
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt giá thất bại.');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  if (user === null) {
    return (
      <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">
        <Link href="/login" className="font-medium text-[#234e3c] underline underline-offset-4">Đăng nhập</Link> để tham gia đặt giá.
      </p>
    );
  }
  if (user?.id === sellerId) {
    return <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">Đây là phiên đấu giá của bạn.</p>;
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6 border-t border-[#182b25]/10 pt-5">
      <label htmlFor="bid-amount" className="mb-2 block text-sm font-medium">Giá trả của bạn</label>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id="bid-amount"
          name="amount"
          type="number"
          step="any"
          required
          min={minNextBid}
          placeholder={String(minNextBid)}
          value={amount}
          onChange={event => { setAmount(event.target.value); setError(''); setSuccess(''); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'bid-currency bid-hint bid-error' : 'bid-currency bid-hint'}
          className={`min-w-0 flex-1 rounded-md border bg-white px-4 py-2.5 text-base sm:text-sm ${error ? 'border-[#a34539]' : 'border-[#182b25]/20'}`}
        />
        <span id="bid-currency" className="text-sm text-[#64716a]">VNĐ</span>
      </div>
      <p id="bid-hint" className="mt-2 text-xs text-[#64716a]">Giá tối thiểu: {currency.format(minNextBid)}</p>
      {error && <p id="bid-error" role="alert" className="mt-2 text-sm text-[#a34539]">{error}</p>}
      {success && <p role="status" className="mt-2 text-sm text-[#234e3c]">{success}</p>}
      <button type="submit" disabled={submitting} className="mt-4 w-full rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60">
        {submitting ? 'Đang đặt giá…' : 'Đặt giá'}
      </button>
    </form>
  );
}
