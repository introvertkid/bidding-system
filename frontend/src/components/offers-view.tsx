
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED';

type Offer = {
  id: string;
  auctionId: string;
  bidderId: string;
  offeredPrice: number | string;
  status: OfferStatus;
  expiresAt: string;
  createdAt: string;
  auction?: {
    id: string;
    product?: {
      id: string;
      title: string;
    };
  };
};

type ApiResponse<T> = {
  status: string;
  message?: string;
  data: T;
};

type AcceptResult = {
  offer: {
    id: string;
    status: OfferStatus;
  };
  invoice?: {
    id: string;
  };
};

type DeclineResult = {
  message?: string;
  hasNextRunnerUp?: boolean;
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

const statusLabels: Record<OfferStatus, string> = {
  PENDING: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  DECLINED: 'Đã từ chối',
  EXPIRED: 'Hết hạn',
};

const statusColors: Record<OfferStatus, string> = {
  PENDING: 'bg-[#fff3d6] text-[#8b651a]',
  ACCEPTED: 'bg-[#e9efdf] text-[#234e3c]',
  DECLINED: 'bg-[#f0f2ed] text-[#64716a]',
  EXPIRED: 'bg-[#f8e7e5] text-[#a34539]',
};

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : dateTime.format(date);
}

export default function OffersView() {
  const user = useSessionUser();
  const userId = user?.id;

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  const reload = useCallback(() => {
    setReloadCount(value => value + 1);
  }, []);

  // Đồng hồ phục vụ hiển thị trạng thái hết hạn.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Tải lời mời của tài khoản đăng nhập.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadOffers() {
      setLoading(true);
      setError('');

      try {
        const response = await clientApi<ApiResponse<Offer[]>>(
          '/me/offers',
        );

        if (!cancelled) {
          setOffers(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách lời mời.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadCount]);

  // Chấp nhận hoặc từ chối lời mời.
  async function handleAction(
    offer: Offer,
    action: 'accept' | 'decline',
  ) {
    if (processingId !== null) return;

    const expiresAt = new Date(offer.expiresAt).getTime();

    if (
      offer.status !== 'PENDING' ||
      now === null ||
      !Number.isFinite(expiresAt) ||
      now >= expiresAt
    ) {
      setError('Lời mời không còn hiệu lực.');
      reload();
      return;
    }

    const actionLabel =
      action === 'accept' ? 'chấp nhận' : 'từ chối';

    const confirmed = window.confirm(
      `Bạn có chắc muốn ${actionLabel} lời mời mua ` +
      `với giá ${currency.format(Number(offer.offeredPrice))}?`,
    );

    if (!confirmed) return;

    setProcessingId(offer.id);
    setError('');
    setMessage('');

    try {
      if (action === 'accept') {
        const response = await clientApi<ApiResponse<AcceptResult>>(
          `/offers/${offer.id}/accept`,
          { method: 'POST' },
        );

        setMessage(
          response.message ??
          'Đã chấp nhận lời mời mua thành công.',
        );
      } else {
        const response = await clientApi<ApiResponse<DeclineResult>>(
          `/offers/${offer.id}/decline`,
          { method: 'POST' },
        );

        setMessage(
          response.message ??
          'Đã từ chối lời mời mua thành công.',
        );
      }

      // Luôn lấy lại trạng thái từ backend.
      reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể xử lý lời mời.',
      );

      // Đồng bộ lại khi request đã được xử lý
      // nhưng phản hồi có thể bị mất.
      reload();
    } finally {
      setProcessingId(null);
    }
  }

  if (user === undefined) {
    return (
      <p className="mt-6 text-sm text-[#64716a]">
        Đang kiểm tra đăng nhập...
      </p>
    );
  }

  if (user === null) {
    return (
      <div className="mt-6 rounded-md border border-[#182b25]/15 bg-white p-6">
        <p className="text-sm text-[#64716a]">
          Bạn cần đăng nhập để xem lời mời mua.
        </p>

        <Link
          href="/login"
          className="mt-3 inline-block text-sm font-semibold text-[#234e3c] underline"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {message && (
        <p
          role="status"
          className="rounded-md border border-[#b4c7b6] bg-[#e9efdf] p-4 text-sm text-[#234e3c]"
        >
          {message}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[#e8b9b3] bg-[#f8e7e5] p-4"
        >
          <p className="text-sm text-[#a34539]">
            {error}
          </p>

          <button
            type="button"
            onClick={reload}
            className="mt-2 text-sm font-medium underline"
          >
            Tải lại danh sách
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#64716a]">
          Đang tải lời mời...
        </p>
      ) : offers.length === 0 && !error ? (
        <div className="rounded-md border border-[#182b25]/15 bg-white p-8 text-center">
          <p className="font-semibold">
            Bạn chưa có lời mời mua nào.
          </p>

          <p className="mt-2 text-sm text-[#64716a]">
            Nếu người thắng đấu giá không thanh toán,
            hệ thống có thể gửi lời mời cho người trả
            giá cao tiếp theo.
          </p>

          <Link
            href="/auctions"
            className="mt-4 inline-block text-sm font-semibold text-[#234e3c] underline"
          >
            Khám phá phiên đấu giá
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map(offer => {
            const expiresAt = new Date(
              offer.expiresAt,
            ).getTime();

            const validExpiry = Number.isFinite(expiresAt);

            const expired =
              now !== null &&
              validExpiry &&
              now >= expiresAt;

            const displayStatus: OfferStatus =
              offer.status === 'PENDING' && expired
                ? 'EXPIRED'
                : offer.status;

            const canRespond =
              offer.status === 'PENDING' &&
              now !== null &&
              validExpiry &&
              !expired;

            const isProcessing =
              processingId === offer.id;

            return (
              <article
                key={offer.id}
                className="rounded-md border border-[#182b25]/15 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {offer.auction?.product?.title ??
                        'Sản phẩm đấu giá'}
                    </h2>

                    <p className="mt-1 break-all text-xs text-[#64716a]">
                      Mã lời mời: {offer.id}
                    </p>
                  </div>

                  <span
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      statusColors[displayStatus]
                    }`}
                  >
                    {statusLabels[displayStatus]}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 border-t border-[#182b25]/10 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-[#64716a]">
                      Giá đề nghị
                    </p>

                    <p className="mt-1 text-xl font-semibold tabular-nums text-[#234e3c]">
                      {currency.format(
                        Number(offer.offeredPrice),
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-[#64716a]">
                      Hạn phản hồi
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatDate(offer.expiresAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-[#64716a]">
                      Ngày nhận lời mời
                    </p>

                    <p className="mt-1 text-sm">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                </div>

                {displayStatus === 'EXPIRED' && (
                  <p className="mt-4 text-sm text-[#a34539]">
                    Lời mời đã hết thời hạn phản hồi.
                  </p>
                )}

                {offer.status === 'ACCEPTED' && (
                  <p className="mt-4 text-sm text-[#234e3c]">
                    Bạn đã chấp nhận lời mời. Hãy kiểm
                    tra hóa đơn để hoàn tất thanh toán.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/auctions/${offer.auctionId}`}
                    className="rounded-md border border-[#182b25]/20 px-4 py-2.5 text-sm font-medium hover:bg-[#f0f2ed]"
                  >
                    Xem phiên đấu giá
                  </Link>

                  {offer.status === 'ACCEPTED' && (
                    <Link
                      href="/invoices"
                      className="rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b]"
                    >
                      Xem hóa đơn
                    </Link>
                  )}

                  {canRespond && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void handleAction(offer, 'accept')
                        }
                        disabled={processingId !== null}
                        className="rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60"
                      >
                        {isProcessing
                          ? 'Đang xử lý...'
                          : 'Chấp nhận'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleAction(offer, 'decline')
                        }
                        disabled={processingId !== null}
                        className="rounded-md border border-[#a34539]/30 px-4 py-2.5 text-sm font-medium text-[#a34539] hover:bg-[#f8e7e5] disabled:opacity-60"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
