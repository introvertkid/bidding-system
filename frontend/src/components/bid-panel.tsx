
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

type BidPanelProps = {
  auctionId: string;
  sellerId: string;
  minNextBid: number;
};

type PendingBid = {
  auctionId: string;
  amount: number;
  key: string;
};

export default function BidPanel({
  auctionId,
  sellerId,
  minNextBid,
}: BidPanelProps) {
  const router = useRouter();
  const user = useSessionUser();

  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Lưu key để retry cùng một thao tác đặt giá.
  const pendingBidRef = useRef<PendingBid | null>(null);

  // Chặn double-submit ngay cả khi React chưa render lại.
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) return;

    const bid = Number(amount);
    let nextError = '';

    if (!amount.trim()) {
      nextError = 'Vui lòng nhập giá trả.';
    } else if (!Number.isFinite(bid) || bid <= 0) {
      nextError = 'Giá trả phải lớn hơn 0.';
    } else if (bid < minNextBid) {
      nextError = `Giá trả phải tối thiểu ${currency.format(minNextBid)}.`;
    }

    setError('');
    setSuccess('');

    if (nextError) {
      setError(nextError);
      inputRef.current?.focus();
      return;
    }

    // Nếu retry cùng phiên, cùng giá thì giữ nguyên key.
    // Nếu là thao tác mới thì sinh UUID mới.
    let pendingBid = pendingBidRef.current;

    if (
      !pendingBid ||
      pendingBid.auctionId !== auctionId ||
      pendingBid.amount !== bid
    ) {
      pendingBid = {
        auctionId,
        amount: bid,
        key: crypto.randomUUID(),
      };

      pendingBidRef.current = pendingBid;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await clientApi(`/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': pendingBid.key,
        },
        body: JSON.stringify({
          amount: pendingBid.amount,
        }),
      });

      // Thành công: thao tác đã hoàn tất.
      // Lần đặt giá tiếp theo phải có key mới.
      pendingBidRef.current = null;

      setAmount('');
      setError('');
      setSuccess(`Đặt giá ${currency.format(bid)} thành công.`);

      // Cập nhật dữ liệu server.
      router.refresh();
    } catch (err) {
      // Giữ lại pendingBidRef để có thể retry
      // cùng key và cùng payload sau lỗi mạng.
      setError(
        err instanceof Error
          ? err.message
          : 'Đặt giá thất bại. Vui lòng thử lại.',
      );

      inputRef.current?.focus();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (user === null) {
    return (
      <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">
        <Link
          href="/login"
          className="font-medium text-[#234e3c] underline underline-offset-4"
        >
          Đăng nhập
        </Link>{' '}
        để tham gia đặt giá.
      </p>
    );
  }

  if (user?.id === sellerId) {
    return (
      <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">
        Đây là phiên đấu giá của bạn.
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="mt-6 border-t border-[#182b25]/10 pt-5"
    >
      <label
        htmlFor="bid-amount"
        className="mb-2 block text-sm font-medium"
      >
        Giá trả của bạn
      </label>

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
          disabled={submitting}
          onChange={(event) => {
            const nextAmount = event.target.value;

            // Đổi giá là bắt đầu thao tác đặt giá khác.
            if (nextAmount !== amount) {
              pendingBidRef.current = null;
            }

            setAmount(nextAmount);
            setError('');
            setSuccess('');
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? 'bid-currency bid-hint bid-error'
              : 'bid-currency bid-hint'
          }
          className={`min-w-0 flex-1 rounded-md border bg-white px-4 py-2.5 text-base sm:text-sm ${
            error
              ? 'border-[#a34539]'
              : 'border-[#182b25]/20'
          }`}
        />

        <span
          id="bid-currency"
          className="text-sm text-[#64716a]"
        >
          VNĐ
        </span>
      </div>

      <p
        id="bid-hint"
        className="mt-2 text-xs text-[#64716a]"
      >
        Giá tối thiểu: {currency.format(minNextBid)}
      </p>

      {error && (
        <p
          id="bid-error"
          role="alert"
          className="mt-2 text-sm text-[#a34539]"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-2 text-sm text-[#234e3c]"
        >
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60"
      >
        {submitting ? 'Đang đặt giá…' : 'Đặt giá'}
      </button>
    </form>
  );
}
