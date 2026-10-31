import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.service';

export type AuctionUpdatedEvent = {
  auctionId: string;
  currentPrice: number;
  minNextBid: number;
  highestBidderName: string;
  totalBids: number;
  endTime: string;
  bid: { id: string; bidderName: string; amount: number; status: string; createdAt: string };
};

export type OutbidAlertEvent = {
  auctionId: string;
  productName: string;
  currentPrice: number;
};

export type AuctionEndedEvent = {
  auctionId: string;
  status: string; // 'ENDED' | 'FAILED'
  winnerId?: string;
  finalPrice?: number;
};

export type OfferReceivedEvent = {
  offerId: string;
  auctionId: string;
  productName?: string;
  offeredPrice: number;
  expiresAt: string;
};

export type InvoiceCreatedEvent = {
  invoiceId: string;
  auctionId: string;
  amount: number;
  dueDate: string;
};

const auctionRoom = (auctionId: string) => `auction:${auctionId}`;
const userRoom = (userId: string) => `user:${userId}`;

// Realtime theo docs/bidding_specs.md & docs/work_split.md:
// join_auction -> auction_updated, outbid_alert, auction_ended, offer_received, invoice_created
@WebSocketGateway({ cors: { origin: true } })
export class AuctionGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  // Client gửi token lúc kết nối (auth.token) để nhận thông báo riêng; không có token vẫn xem giá được
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await client.join(userRoom(payload.sub));
    } catch {
      // Token hết hạn: vẫn cho kết nối như khách
    }
  }

  @SubscribeMessage('join_auction')
  async joinAuction(@ConnectedSocket() client: Socket, @MessageBody() body: { auctionId?: string }) {
    if (body?.auctionId) await client.join(auctionRoom(body.auctionId));
  }

  @SubscribeMessage('leave_auction')
  async leaveAuction(@ConnectedSocket() client: Socket, @MessageBody() body: { auctionId?: string }) {
    if (body?.auctionId) await client.leave(auctionRoom(body.auctionId));
  }

  emitAuctionUpdated(event: AuctionUpdatedEvent) {
    this.server?.to(auctionRoom(event.auctionId)).emit('auction_updated', event);
  }

  emitOutbid(userId: string, event: OutbidAlertEvent) {
    this.server?.to(userRoom(userId)).emit('outbid_alert', event);
  }

  emitAuctionEnded(auctionId: string, event: AuctionEndedEvent) {
    this.server?.to(auctionRoom(auctionId)).emit('auction_ended', event);
  }

  emitOfferReceived(userId: string, event: OfferReceivedEvent) {
    this.server?.to(userRoom(userId)).emit('offer_received', event);
  }

  emitInvoiceCreated(userId: string, event: InvoiceCreatedEvent) {
    this.server?.to(userRoom(userId)).emit('invoice_created', event);
  }
}
