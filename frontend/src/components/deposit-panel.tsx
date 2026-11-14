
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import BidPanel from './bid-panel';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

type DepositStatus = 'HELD' | 'REFUNDED' | 'FORFEITED';

type Deposit = {
  id: string;
  auctionId: string;
  userId: string;
  amount: number | string;
  status: DepositStatus;
};

type DepositResponse = {
  status: string;
  message?: string;
  data: Deposit | null;
};

type DepositPanelProps = {
  auctionId: string;
  sellerId: string;
  startingPrice: number;
  minNextBid: number;
  isLive: boolean;
};

export default function DepositPanel({
  auctionId,
  sellerId,
  startingPrice,
  minNextBid,
  isLive,
}: DepositPanelProps) {
  const user = useSessionUser();

  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const estimatedAmount = Math.max(
    Math.round(Number(startingPrice) * 0.1),
    50000,
  );

  // Kiểm tra trạng thái đặt cọc của người dùng.
  useEffect(() => {
    if (!user?.id || user.id === sellerId) return;

    let cancelled = false;

    async function loadDeposit() {
      try {
        const response = await clientApi<DepositResponse>(
          `/auctions/${auctionId}/deposits/me`,
        );

        if (!cancelled) {
          setDeposit(response.data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể kiểm tra trạng thái đặt cọc.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDeposit();

    return () => {
      cancelled = true;
    };
  }, [auctionId, sellerId, user?.id, retryCount]);

  async function handleDeposit() {
    if (submitting || loading) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await clientApi<DepositResponse>(
        `/auctions/${auctionId}/deposits`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      setDeposit(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đặt cọc thất bại. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Chờ xác định trạng thái đăng nhập.
  if (user === undefined) {
    return (
      <p className="mt-6 text-sm text-[#64716a]">
        Đang kiểm tra tài khoản...
      </p>
    );
  }

  if (user === null) {
    return (
      <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm">
        <Link
          href="/login"
          className="font-medium text-[#234e3c] underline"
        >
          Đăng nhập
        </Link>{' '}
        để đặt cọc và tham gia đấu giá.
      </p>
    );
  }

  if (user.id === sellerId) {
    return (
      <p className="mt-6 border-t border-[#182b25]/10 pt-5 text-sm text-[#64716a]">
        Đây là phiên đấu giá của bạn.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="mt-6 text-sm text-[#64716a]">
        Đang kiểm tra tiền cọc...
      </p>
    );
  }

  if (error && !deposit) {
    return (
      <div className="mt-6 border-t border-[#182b25]/10 pt-5">
        <p role="alert" className="text-sm text-[#a34539]">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError('');
            setLoading(true);
            setRetryCount(value => value + 1);
          }}
          className="mt-3 text-sm font-medium text-[#234e3c] underline"
        >
          Thử kiểm tra lại
        </button>
      </div>
    );
  }

  const hasDeposit = deposit?.status === 'HELD';

  return (
    <div className="mt-6 border-t border-[#182b25]/10 pt-5">
      <h3 className="text-sm font-semibold">
        Tiền cọc tham gia đấu giá
      </h3>

      {hasDeposit ? (
        <div className="mt-3 rounded-md border border-[#b4c7b6] bg-[#e9efdf] p-4">
          <p className="text-sm font-semibold text-[#234e3c]">
            ✓ Đã đặt cọc thành công
          </p>
          <p className="mt-2 text-sm text-[#234e3c]">
            Số tiền: {currency.format(Number(deposit.amount))}
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-[#64716a]">
            Bạn cần đặt cọc trước khi tham gia trả giá.
          </p>

          {deposit?.status === 'REFUNDED' && (
            <p className="mt-2 text-sm text-[#64716a]">
              Khoản cọc trước đã được hoàn trả.
            </p>
          )}

          {deposit?.status === 'FORFEITED' && (
            <p className="mt-2 text-sm text-[#a34539]">
              Khoản cọc trước đã bị tịch thu.
            </p>
          )}

          <p className="mt-3 text-sm">
            Tiền cọc dự kiến:
            <strong className="ml-2 text-[#234e3c]">
              {currency.format(estimatedAmount)}
            </strong>
          </p>

          <button
            type="button"
            onClick={handleDeposit}
            disabled={submitting}
            className="mt-4 w-full rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý...' : 'Đặt cọc ngay'}
          </button>

          <p className="mt-2 text-xs text-[#64716a]">
            Thanh toán giả lập, không trừ tiền thật.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[#a34539]">
          {error}
        </p>
      )}

      {hasDeposit && isLive && (
        <BidPanel
          auctionId={auctionId}
          sellerId={sellerId}
          minNextBid={minNextBid}
        />
      )}

      {hasDeposit && !isLive && (
        <p className="mt-4 text-sm text-[#64716a]">
          Bạn đã đủ điều kiện tham gia khi phiên bắt đầu.
        </p>
      )}
    </div>
  );
}
