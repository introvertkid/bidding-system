'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSocket, type OutbidAlertEvent } from '@/lib/socket';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

// Thông báo khi người dùng đang dẫn đầu bị người khác trả giá cao hơn (event outbid_alert)
export default function OutbidAlerts() {
  const [alerts, setAlerts] = useState<(OutbidAlertEvent & { key: number })[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onOutbid = (event: OutbidAlertEvent) => {
      const key = Date.now();
      setAlerts(previous => [...previous, { ...event, key }]);
      setTimeout(() => setAlerts(previous => previous.filter(alert => alert.key !== key)), 8000);
    };
    socket.on('outbid_alert', onOutbid);
    return () => {
      socket.off('outbid_alert', onOutbid);
    };
  }, []);

  if (!alerts.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3">
      {alerts.map(alert => (
        <div key={alert.key} role="alert" className="rounded-md border border-[#a34539]/30 bg-white p-4 text-sm shadow-lg">
          <p className="font-semibold text-[#a34539]">Bạn đã bị vượt giá</p>
          <p className="mt-1 text-[#64716a]">
            {alert.productName}: giá mới {currency.format(alert.currentPrice)}
          </p>
          <Link href={`/auctions/${alert.auctionId}`} className="mt-2 inline-block font-medium text-[#234e3c] underline underline-offset-4">
            Đặt giá lại
          </Link>
        </div>
      ))}
    </div>
  );
}
