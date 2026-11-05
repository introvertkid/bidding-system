import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepositGuard } from '../deposits/deposit.guard';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';

@ApiTags('bids')
@Controller('api/v1/auctions/:auctionId/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, DepositGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID sinh cho mỗi lần bấm đặt giá, dùng lại khi retry',
  })
  placeBid(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @CurrentUserId() bidderId: string,
    @Body() createBidDto: CreateBidDto,
  ) {
    return this.bidsService.placeBid(auctionId, bidderId, createBidDto.amount);
  }

  @Get()
  findByAuction(@Param('auctionId', ParseUUIDPipe) auctionId: string) {
    return this.bidsService.findByAuction(auctionId);
  }
}
