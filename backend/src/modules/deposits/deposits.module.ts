import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from '../auctions/entities/auction.entity';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositGuard } from './deposit.guard';
import { Deposit } from './entities/deposit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deposit, Auction])],
  controllers: [DepositsController],
  providers: [DepositsService, DepositGuard],
  exports: [DepositsService, DepositGuard],
})
export class DepositsModule {}
