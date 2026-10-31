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
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@Controller('api/v1')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('me/invoices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn của tôi' })
  async getMyInvoices(@CurrentUserId() userId: string) {
    const invoices = await this.invoicesService.getUserInvoices(userId);
    return {
      status: 'success',
      data: invoices,
    };
  }

  @Post('invoices/:id/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thanh toán hóa đơn giả lập' })
  async payInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    const invoice = await this.invoicesService.payInvoice(id, userId);
    return {
      status: 'success',
      message: 'Thanh toán hóa đơn thành công',
      data: invoice,
    };
  }
}
