import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { AuctionSnapshot } from '../auctions/auction-view';
import { AuctionStatus } from '../auctions/entities/auction.entity';
import { BidPlacedPayload } from '../outbox/outbox.constants';

const CACHE_TTL_SECONDS = 300;

const auctionKey = (auctionId: string) => `cache:auction:${auctionId}`;

// Nạp cả bản ghi: bản đọc từ DB có thể cũ hơn bản đang có trong cache
const SAVE_SNAPSHOT_SCRIPT = `
local current = redis.call('HGET', KEYS[1], 'version')
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('HSET', KEYS[1], unpack(ARGV, 3))
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

// Chỉ cập nhật khi key còn tồn tại, tránh tạo hash thiếu trường (title, startTime...)
const APPLY_BID_SCRIPT = `
local current = redis.call('HGET', KEYS[1], 'version')
if not current or tonumber(ARGV[1]) <= tonumber(current) then
  return 0
end
redis.call('HSET', KEYS[1], unpack(ARGV, 2))
return 1
`;

/**
 * GP4 – Cache-Aside: lưu dữ liệu thô của phiên vào Redis Hash.
 * Các trường phụ thuộc thời gian (status hiển thị, remainingMinutes...) tính lúc đọc.
 * Cache hỏng không được làm hỏng luồng chính, nên mọi lỗi Redis chỉ ghi log và rơi về DB.
 */
@Injectable()
export class AuctionCacheService {
  private readonly logger = new Logger(AuctionCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(auctionId: string): Promise<AuctionSnapshot | null> {
    try {
      const hash = await this.redis.hgetall(auctionKey(auctionId));
      return Object.keys(hash).length ? this.fromHash(hash) : null;
    } catch (err) {
      this.logger.warn(
        `Không đọc được cache phiên ${auctionId}: ${String(err)}`,
      );
      return null;
    }
  }

  async save(snapshot: AuctionSnapshot): Promise<void> {
    try {
      await this.redis.eval(
        SAVE_SNAPSHOT_SCRIPT,
        1,
        auctionKey(snapshot.id),
        snapshot.version,
        CACHE_TTL_SECONDS,
        ...Object.entries(this.toHash(snapshot)).flat(),
      );
    } catch (err) {
      this.logger.warn(
        `Không ghi được cache phiên ${snapshot.id}: ${String(err)}`,
      );
    }
  }

  async applyBidPlaced({
    auctionId,
    version,
    highestBidderId,
    update,
  }: BidPlacedPayload) {
    try {
      await this.redis.eval(
        APPLY_BID_SCRIPT,
        1,
        auctionKey(auctionId),
        version,
        ...Object.entries({
          version: String(version),
          currentPrice: String(update.currentPrice),
          highestBidderId,
          highestBidderName: update.highestBidderName,
          bidCount: String(update.totalBids),
          endTime: update.endTime,
        }).flat(),
      );
    } catch (err) {
      this.logger.warn(
        `Không cập nhật được cache phiên ${auctionId}: ${String(err)}`,
      );
    }
  }

  async invalidate(auctionId: string): Promise<void> {
    try {
      await this.redis.del(auctionKey(auctionId));
    } catch (err) {
      this.logger.warn(
        `Không xóa được cache phiên ${auctionId}: ${String(err)}`,
      );
    }
  }

  private toHash(snapshot: AuctionSnapshot): Record<string, string> {
    return {
      id: snapshot.id,
      status: snapshot.status,
      title: snapshot.title,
      description: snapshot.description,
      imageUrl: snapshot.imageUrl,
      sellerId: snapshot.sellerId,
      startTime: snapshot.startTime.toISOString(),
      endTime: snapshot.endTime.toISOString(),
      startingPrice: String(snapshot.startingPrice),
      currentPrice: String(snapshot.currentPrice),
      bidIncrement: String(snapshot.bidIncrement),
      highestBidderId: snapshot.highestBidderId ?? '',
      highestBidderName: snapshot.highestBidderName ?? '',
      bidCount: String(snapshot.bidCount),
      version: String(snapshot.version),
    };
  }

  private fromHash(hash: Record<string, string>): AuctionSnapshot {
    return {
      id: hash.id,
      status: hash.status as AuctionStatus,
      title: hash.title,
      description: hash.description,
      imageUrl: hash.imageUrl,
      sellerId: hash.sellerId,
      startTime: new Date(hash.startTime),
      endTime: new Date(hash.endTime),
      startingPrice: Number(hash.startingPrice),
      currentPrice: Number(hash.currentPrice),
      bidIncrement: Number(hash.bidIncrement),
      highestBidderId: hash.highestBidderId || undefined,
      highestBidderName: hash.highestBidderName || undefined,
      bidCount: Number(hash.bidCount),
      version: Number(hash.version),
    };
  }
}
