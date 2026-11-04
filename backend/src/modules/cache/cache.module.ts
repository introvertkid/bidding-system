import { Module } from '@nestjs/common';
import { AuctionCacheService } from './auction-cache.service';

@Module({
  providers: [AuctionCacheService],
  exports: [AuctionCacheService],
})
export class CacheModule {}
