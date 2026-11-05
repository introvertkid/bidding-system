import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

@ApiTags('deposits')
@Controller('api/v1/auctions/:id/deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đặt cọc giả lập để tham gia phiên đấu giá' })
  async createDeposit(
    @Param('id', ParseUUIDPipe) auctionId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateDepositDto,
  ) {
    const deposit = await this.depositsService.deposit(
      auctionId,
      userId,
      dto?.amount,
    );
    return {
      status: 'success',
      message: 'Đặt cọc tham gia phiên đấu giá thành công',
      data: deposit,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra tiền cọc của tôi tại phiên này' })
  async getMyDeposit(
    @Param('id', ParseUUIDPipe) auctionId: string,
    @CurrentUserId() userId: string,
  ) {
    const deposit = await this.depositsService.getDeposit(auctionId, userId);
    return {
      status: 'success',
      data: deposit,
    };
  }
}
