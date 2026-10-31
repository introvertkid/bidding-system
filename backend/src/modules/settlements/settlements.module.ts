import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from '../auctions/entities/auction.entity';
import { BidsModule } from '../bids/bids.module';
import { Bid } from '../bids/entities/bid.entity';
import { DepositsModule } from '../deposits/deposits.module';
import { Deposit } from '../deposits/entities/deposit.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { Offer } from './entities/offer.entity';
import { Settlement } from './entities/settlement.entity';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Settlement,
      Offer,
      Auction,
      Invoice,
      Deposit,
      Bid,
      User,
    ]),
    DepositsModule,
    BidsModule,
  ],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
