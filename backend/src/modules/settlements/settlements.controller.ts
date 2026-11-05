import {
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
import { SettlementsService } from './settlements.service';

@ApiTags('settlements')
@Controller('api/v1')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('me/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lời mời mua (runner-up) của tôi' })
  async getMyOffers(@CurrentUserId() userId: string) {
    const offers = await this.settlementsService.getUserOffers(userId);
    return {
      status: 'success',
      data: offers,
    };
  }

  @Post('offers/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận lời mời mua sản phẩm (runner-up)' })
  async acceptOffer(
    @Param('id', ParseUUIDPipe) offerId: string,
    @CurrentUserId() userId: string,
  ) {
    const result = await this.settlementsService.acceptOffer(offerId, userId);
    return {
      status: 'success',
      message: 'Đã chấp nhận lời mời mua sản phẩm thành công',
      data: result,
    };
  }

  @Post('offers/:id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Từ chối lời mời mua sản phẩm (runner-up)' })
  async declineOffer(
    @Param('id', ParseUUIDPipe) offerId: string,
    @CurrentUserId() userId: string,
  ) {
    const result = await this.settlementsService.declineOffer(offerId, userId);
    return {
      status: 'success',
      message: result.message,
      data: result,
    };
  }
}
