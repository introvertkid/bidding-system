import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DepositsService } from '../deposits/deposits.service';
import {
  Settlement,
  SettlementStatus,
} from '../settlements/entities/settlement.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    private readonly depositsService: DepositsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lấy danh sách hóa đơn của tôi
   */
  async getUserInvoices(userId: string): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { winnerId: userId },
      relations: {
        auction: {
          product: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Chi tiết hóa đơn
   */
  async getInvoiceById(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: {
        auction: {
          product: true,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Hóa đơn không tồn tại');
    }

    if (invoice.winnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem hóa đơn này');
    }

    return invoice;
  }

  /**
   * Thanh toán giả lập hóa đơn
   */
  async payInvoice(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: { auction: true },
    });

    if (!invoice) {
      throw new NotFoundException('Hóa đơn không tồn tại');
    }

    if (invoice.winnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thanh toán hóa đơn này');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Hóa đơn này đã được thanh toán trước đó');
    }

    if (invoice.status === InvoiceStatus.CANCELED) {
      throw new BadRequestException(
        'Hóa đơn này đã bị hủy do quá hạn thanh toán',
      );
    }

    const now = new Date();
    if (invoice.dueDate < now) {
      throw new BadRequestException(
        'Hóa đơn đã quá hạn thanh toán (due date expired)',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = now;
      const updatedInvoice = await manager.save(Invoice, invoice);

      // Cập nhật trạng thái Settlement sang SETTLED
      await manager.update(
        Settlement,
        { auctionId: invoice.auctionId },
        {
          status: SettlementStatus.SETTLED,
          step: 'COMPLETED',
        },
      );

      // Hoàn lại tiền cọc cho người thắng vì đã thanh toán đầy đủ
      await this.depositsService.refundWinner(invoice.auctionId, userId);

      this.logger.log(
        `Thanh toán hóa đơn ${invoice.id} thành công cho auction ${invoice.auctionId} bởi user ${userId}`,
      );

      return updatedInvoice;
    });
  }
}
