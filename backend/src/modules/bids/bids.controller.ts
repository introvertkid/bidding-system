import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';

@ApiTags('bids')
@Controller('api/v1/auctions/:auctionId/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  @ApiHeader({ name: 'x-user-id', description: 'ID người đặt giá (tạm thời, thay bằng JWT sau)' })
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
