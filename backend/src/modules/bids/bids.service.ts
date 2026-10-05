import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { AccountStatus, User } from '../users/entities/user.entity';
import { Bid, BidStatus } from './entities/bid.entity';

// Luật chống bắn tỉa: bid trong 1 phút cuối sẽ reset đồng hồ về đúng 1 phút
const ANTI_SNIPER_WINDOW_MS = 60 * 1000;

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class BidsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Bid)
    private bidsRepository: Repository<Bid>,
  ) {}

  async placeBid(auctionId: string, bidderId: string, amount: number) {
    if (!UUID_FORMAT.test(bidderId)) {
      throw new UnauthorizedException('Người dùng không hợp lệ');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra trạng thái tài khoản
      const bidder = await manager.findOne(User, { where: { id: bidderId } });
      if (!bidder) {
        throw new UnauthorizedException('Người dùng không tồn tại');
      }
      if (bidder.accountStatus === AccountStatus.BANNED) {
        throw new ForbiddenException('Tài khoản của bạn đã bị khóa');
      }

      // 2. Kiểm tra phiên đấu giá có đang ACTIVE không
      const auction = await manager.findOne(Auction, {
        where: { id: auctionId },
        relations: { product: true },
      });
      if (!auction) {
        throw new NotFoundException(`Không tìm thấy phiên đấu giá với ID ${auctionId}`);
      }

      const now = new Date();
      if (
        auction.status !== AuctionStatus.ACTIVE ||
        now < auction.startTime ||
        now >= auction.endTime
      ) {
        throw new BadRequestException('Phiên đấu giá không trong thời gian diễn ra');
      }
      if (auction.product.sellerId === bidderId) {
        throw new ForbiddenException('Người bán không được đặt giá sản phẩm của mình');
      }
      if (auction.highestBidderId === bidderId) {
        throw new BadRequestException('Bạn đang là người trả giá cao nhất');
      }

      // 3. So sánh amount với giá tối thiểu (cột decimal được pg trả về dạng string)
      const currentPrice = Number(auction.currentPrice);
      const minAmount = auction.highestBidderId
        ? currentPrice + Number(auction.bidIncrement)
        : Number(auction.startingPrice);
      if (amount < minAmount) {
        throw new BadRequestException(`Giá đặt phải tối thiểu là ${minAmount}`);
      }

      // Anti-sniper: kéo dài thời gian nếu bid rơi vào phút cuối
      const endTime =
        auction.endTime.getTime() - now.getTime() < ANTI_SNIPER_WINDOW_MS
          ? new Date(now.getTime() + ANTI_SNIPER_WINDOW_MS)
          : auction.endTime;

      // 4. Optimistic Locking: chỉ cập nhật nếu version chưa bị người khác thay đổi
      const result = await manager
        .createQueryBuilder()
        .update(Auction)
        .set({
          currentPrice: amount,
          highestBidderId: bidderId,
          endTime,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: auctionId,
          version: auction.version,
        })
        .execute();

      // 5. Có người khác vừa bid nhanh hơn
      if (result.affected === 0) {
        throw new ConflictException(
          'Giá sản phẩm vừa bị người khác thay đổi. Vui lòng tải lại và thử lại!',
        );
      }

      // Lượt bid dẫn đầu trước đó bị vượt mặt
      await manager.update(
        Bid,
        { auctionId, status: BidStatus.VALID },
        { status: BidStatus.OUTBID },
      );

      const bid = await manager.save(
        manager.create(Bid, { auctionId, bidderId, amount, status: BidStatus.VALID }),
      );

      // TODO: Cập nhật current_price vào Redis và broadcast `auction_updated` qua WebSockets

      return {
        status: 'success',
        message: 'Placed bid successfully',
        data: {
          bidId: bid.id,
          amount: Number(bid.amount),
          endTime,
          createdAt: bid.createdAt,
        },
      };
    });
  }

  async findByAuction(auctionId: string) {
    const bids = await this.bidsRepository.find({
      where: { auctionId },
      relations: { bidder: true },
      order: { createdAt: 'DESC' },
    });

    return bids.map((bid) => ({
      id: bid.id,
      amount: Number(bid.amount),
      status: bid.status,
      bidderName: maskName(bid.bidder.fullName),
      createdAt: bid.createdAt,
    }));
  }
}

// "Nguyễn Văn An" -> "Nguyễn V** A*"
function maskName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return [first, ...rest.map((word) => word[0] + '*'.repeat(word.length - 1))].join(' ');
}
