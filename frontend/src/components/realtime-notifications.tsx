
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSessionUser } from '@/lib/use-session-user';
import {
  getSocket,
  type AuctionEndedEvent,
  type OfferReceivedEvent,
  type InvoiceCreatedEvent,
} from '@/lib/socket';

type Notification = {
  id: string;
  title: string;
  message: string;
  href: string;
  read: boolean;
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const receivedIds = useRef(new Set<string>());

  useEffect(() => {
    const socket = getSocket();

    function addNotification(notification: Notification) {
      // Tránh hiển thị lại cùng sự kiện trong phiên hiện tại.
      if (receivedIds.current.has(notification.id)) return;

      receivedIds.current.add(notification.id);

      setNotifications(previous =>
        [notification, ...previous].slice(0, 30),
      );
    }

    function onAuctionEnded(event: AuctionEndedEvent) {
      addNotification({
        id: `auction-ended:${event.auctionId}`,
        title: 'Phiên đấu giá đã kết thúc',
        message:
          event.status === 'FAILED'
            ? 'Phiên đấu giá kết thúc nhưng không có kết quả thành công.'
            : 'Phiên đấu giá đã kết thúc. Xem kết quả ngay.',
        href: `/auctions/${event.auctionId}`,
        read: false,
      });
    }

    function onOfferReceived(event: OfferReceivedEvent) {
      addNotification({
        id: `offer:${event.offerId}`,
        title: 'Bạn nhận được lời mời mua',
        message: `${event.productName ?? 'Sản phẩm đấu giá'}: ` +
          `giá đề nghị ${currency.format(Number(event.offeredPrice))}.`,
        href: '/post-auction?tab=offers',
        read: false,
      });
    }

    function onInvoiceCreated(event: InvoiceCreatedEvent) {
      addNotification({
        id: `invoice:${event.invoiceId}`,
        title: 'Bạn có hóa đơn mới',
        message:
          `Số tiền thanh toán: ${currency.format(Number(event.amount))}.`,
        href: '/post-auction?tab=invoices',
        read: false,
      });
    }

    socket.on('auction_ended', onAuctionEnded);
    socket.on('offer_received', onOfferReceived);
    socket.on('invoice_created', onInvoiceCreated);

    return () => {
      socket.off('auction_ended', onAuctionEnded);
      socket.off('offer_received', onOfferReceived);
      socket.off('invoice_created', onInvoiceCreated);
    };
  }, []);

  const unreadCount = notifications.filter(item => !item.read).length;

  function markAsRead(id: string) {
    setNotifications(previous =>
      previous.map(item =>
        item.id === id ? { ...item, read: true } : item,
      ),
    );

    setOpen(false);
  }

  function markAllAsRead() {
    setNotifications(previous =>
      previous.map(item => ({ ...item, read: true })),
    );
  }

  return (
    <div
      className="relative"
      data-notification-user={userId}
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={
          unreadCount
            ? `Thông báo, ${unreadCount} chưa đọc`
            : 'Thông báo'
        }
        aria-expanded={open}
        aria-controls="bidwell-notification-list"
        className="relative rounded-md border border-[#182b25]/15 bg-white p-2.5 text-[#234e3c] hover:bg-[#f0f2ed]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a34539] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="bidwell-notification-list"
          className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[#182b25]/15 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#182b25]/10 px-4 py-3">
            <h2 className="text-sm font-semibold">
              Thông báo
            </h2>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-[#234e3c] hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#64716a]">
              Chưa có thông báo mới.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => markAsRead(notification.id)}
                  className={`block border-b border-[#182b25]/10 px-4 py-3 last:border-b-0 hover:bg-[#f0f2ed] ${
                    notification.read
                      ? 'bg-white'
                      : 'bg-[#f3f7ee]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#234e3c]"
                        aria-label="Chưa đọc"
                      />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#182b25]">
                        {notification.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#64716a]">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RealtimeNotifications() {
  const user = useSessionUser();

  // Chưa đăng nhập thì không hiển thị chuông.
  if (!user) return null;

  // Khi đổi tài khoản, remount chuông để xóa
  // thông báo cũ của tài khoản trước.
  return <NotificationBell key={user.id} userId={user.id} />;
}
