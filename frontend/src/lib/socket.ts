import { io, type Socket } from 'socket.io-client';
import { CHANGE_EVENT, getToken } from './session';

export type AuctionUpdatedEvent = {
  auctionId: string;
  currentPrice: number;
  minNextBid: number;
  highestBidderName: string;
  totalBids: number;
  endTime: string;
  bid: { id: string; bidderName: string; amount: number; status: 'VALID' | 'OUTBID' | 'WINNING'; createdAt: string };
};

export type OutbidAlertEvent = { auctionId: string; productName: string; currentPrice: number };

let socket: Socket | null = null;

// WebSocket nối thẳng tới backend (cùng host với NEXT_PUBLIC_API_URL)
function socketUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin;
  } catch {
    return 'http://localhost:3000';
  }
}

// Dùng chung 1 kết nối cho cả trang; gửi kèm token để nhận thông báo riêng (bị vượt giá)
export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl(), {
      transports: ['websocket'],
      auth: callback => callback({ token: getToken() }),
    });
    // Đăng nhập/đăng xuất thì kết nối lại để server biết user mới
    window.addEventListener(CHANGE_EVENT, () => {
      socket?.disconnect().connect();
    });
  }
  return socket;
}
