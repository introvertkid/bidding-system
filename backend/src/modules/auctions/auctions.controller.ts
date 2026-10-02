import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Auction } from './entities/auction.entity';

@Controller('api/v1/auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  create(@Body() createAuctionDto: Partial<Auction>) {
    return this.auctionsService.create(createAuctionDto);
  }

  @Get()
  findAll() {
    return this.auctionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuctionDto: Partial<Auction>) {
    return this.auctionsService.update(id, updateAuctionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.auctionsService.remove(id);
  }
}
