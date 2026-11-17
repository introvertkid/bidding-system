
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELED';

type Invoice = {
  id: string;
  auctionId: string;
  winnerId: string;
  amount: number | string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  auction?: {
    id: string;
    status: string;
    product?: {
      id: string;
      title: string;
      images?: string[];
    };
  };
};

type ApiResponse<T> = {
  status: string;
  message?: string;
  data: T;
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

const statusLabels: Record<InvoiceStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELED: 'Đã hủy',
};

const statusColors: Record<InvoiceStatus, string> = {
  PENDING: 'bg-[#fff3d6] text-[#8b651a]',
  PAID: 'bg-[#e9efdf] text-[#234e3c]',
  CANCELED: 'bg-[#f8e7e5] text-[#a34539]',
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Không xác định';
  }

  return dateTime.format(date);
}

export default function InvoicesView() {
  const user = useSessionUser();
  const userId = user?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Thời gian phục vụ hiển thị hạn thanh toán.
  // Khởi tạo null để tránh hydration mismatch.
  const [now, setNow] = useState<number | null>(null);

  const reload = useCallback(() => {
    setReloadCount(value => value + 1);
  }, []);

  // Cập nhật đồng hồ trong callback của timer.
  // Không gọi setState trực tiếp trong effect.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Lấy danh sách hóa đơn từ backend.
  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    async function loadInvoices() {
      setLoading(true);
      setError('');

      try {
        const response = await clientApi<ApiResponse<Invoice[]>>(
          '/me/invoices',
        );

        if (!cancelled) {
          setInvoices(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách hóa đơn.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvoices();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadCount]);

  // Thanh toán hóa đơn giả lập.
  async function handlePay(invoice: Invoice) {
    if (payingId !== null) return;

    const dueTime = new Date(invoice.dueDate).getTime();

    // Kiểm tra trạng thái và hạn thanh toán.
    if (
      invoice.status !== 'PENDING' ||
      now === null ||
      !Number.isFinite(dueTime) ||
      now > dueTime
    ) {
      setError('Hóa đơn không còn đủ điều kiện thanh toán.');
      return;
    }

    const confirmed = window.confirm(
      `Xác nhận thanh toán giả lập ${currency.format(
        Number(invoice.amount),
      )}?`,
    );

    if (!confirmed) return;

    setPayingId(invoice.id);
    setError('');
    setMessage('');

    try {
      const response = await clientApi<ApiResponse<Invoice>>(
        `/invoices/${invoice.id}/pay`,
        {
          method: 'POST',
        },
      );

      // Cập nhật hóa đơn vừa thanh toán.
      setInvoices(previous =>
        previous.map(item =>
          item.id === invoice.id
            ? { ...item, ...response.data }
            : item,
        ),
      );

      setMessage(
        response.message ?? 'Thanh toán hóa đơn thành công.',
      );

      // Đồng bộ lại dữ liệu từ backend.
      reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Thanh toán thất bại. Vui lòng thử lại.',
      );

      // Lấy lại trạng thái nếu kết quả request chưa rõ.
      reload();
    } finally {
      setPayingId(null);
    }
  }

  // Đang xác định trạng thái đăng nhập.
  if (user === undefined) {
    return (
      <p className="mt-6 text-sm text-[#64716a]">
        Đang kiểm tra đăng nhập...
      </p>
    );
  }

  // Người dùng chưa đăng nhập.
  if (user === null) {
    return (
      <div className="mt-6 rounded-md border border-[#182b25]/15 bg-white p-6">
        <p className="text-sm text-[#64716a]">
          Bạn cần đăng nhập để xem hóa đơn.
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
      {/* Thông báo thanh toán thành công */}
      {message && (
        <p
          role="status"
          className="rounded-md border border-[#b4c7b6] bg-[#e9efdf] p-4 text-sm text-[#234e3c]"
        >
          {message}
        </p>
      )}

      {/* Thông báo lỗi */}
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

      {/* Đang tải dữ liệu */}
      {loading ? (
        <p className="text-sm text-[#64716a]">
          Đang tải hóa đơn...
        </p>
      ) : invoices.length === 0 && !error ? (
        // Chưa có hóa đơn
        <div className="rounded-md border border-[#182b25]/15 bg-white p-8 text-center">
          <p className="font-semibold">
            Bạn chưa có hóa đơn nào.
          </p>

          <p className="mt-2 text-sm text-[#64716a]">
            Hóa đơn sẽ xuất hiện sau khi bạn thắng đấu giá.
          </p>

          <Link
            href="/auctions"
            className="mt-4 inline-block text-sm font-semibold text-[#234e3c] underline"
          >
            Xem các phiên đấu giá
          </Link>
        </div>
      ) : (
        // Danh sách hóa đơn
        <div className="space-y-4">
          {invoices.map(invoice => {
            const dueTime = new Date(
              invoice.dueDate,
            ).getTime();

            const validDueTime = Number.isFinite(dueTime);

            const expired =
              now !== null &&
              validDueTime &&
              now > dueTime;

            const canPay =
              invoice.status === 'PENDING' &&
              now !== null &&
              validDueTime &&
              !expired;

            const isPaying = payingId === invoice.id;

            return (
              <article
                key={invoice.id}
                className="rounded-md border border-[#182b25]/15 bg-white p-5 sm:p-6"
              >
                {/* Tiêu đề hóa đơn */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {invoice.auction?.product?.title ??
                        'Sản phẩm đấu giá'}
                    </h2>

                    <p className="mt-1 break-all text-xs text-[#64716a]">
                      Mã hóa đơn: {invoice.id}
                    </p>
                  </div>

                  <span
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      statusColors[invoice.status]
                    }`}
                  >
                    {statusLabels[invoice.status]}
                  </span>
                </div>

                {/* Chi tiết hóa đơn */}
                <div className="mt-5 grid gap-4 border-t border-[#182b25]/10 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-[#64716a]">
                      Số tiền thanh toán
                    </p>

                    <p className="mt-1 text-xl font-semibold tabular-nums text-[#234e3c]">
                      {currency.format(
                        Number(invoice.amount),
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-[#64716a]">
                      Hạn thanh toán
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-[#64716a]">
                      Ngày tạo hóa đơn
                    </p>

                    <p className="mt-1 text-sm">
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>

                  {invoice.paidAt && (
                    <div>
                      <p className="text-sm text-[#64716a]">
                        Ngày thanh toán
                      </p>

                      <p className="mt-1 text-sm">
                        {formatDate(invoice.paidAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Hóa đơn quá hạn */}
                {invoice.status === 'PENDING' && expired && (
                  <p className="mt-4 text-sm text-[#a34539]">
                    Hóa đơn đã quá hạn thanh toán.
                  </p>
                )}

                {/* Các nút thao tác */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/auctions/${invoice.auctionId}`}
                    className="rounded-md border border-[#182b25]/20 px-4 py-2.5 text-sm font-medium hover:bg-[#f0f2ed]"
                  >
                    Xem phiên đấu giá
                  </Link>

                  {canPay && (
                    <button
                      type="button"
                      onClick={() => void handlePay(invoice)}
                      disabled={payingId !== null}
                      className="rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60"
                    >
                      {isPaying
                        ? 'Đang thanh toán...'
                        : 'Thanh toán ngay'}
                    </button>
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
