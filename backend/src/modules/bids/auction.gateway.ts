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

const auctionRoom = (auctionId: string) => `auction:${auctionId}`;
const userRoom = (userId: string) => `user:${userId}`;

// Realtime theo docs/bidding_specs.md: join_auction -> auction_updated, outbid_alert (riêng người bị vượt)
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
    this.server.to(auctionRoom(event.auctionId)).emit('auction_updated', event);
  }

  emitOutbid(userId: string, event: OutbidAlertEvent) {
    this.server.to(userRoom(userId)).emit('outbid_alert', event);
  }
}
