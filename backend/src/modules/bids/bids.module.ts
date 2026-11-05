import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositsModule } from '../deposits/deposits.module';
import { AuctionGateway } from './auction.gateway';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { Bid } from './entities/bid.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bid]), DepositsModule],
  controllers: [BidsController],
  providers: [BidsService, AuctionGateway],
  exports: [AuctionGateway, BidsService],
})
export class BidsModule {}
