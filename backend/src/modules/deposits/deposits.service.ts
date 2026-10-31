import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { Deposit, DepositStatus } from './entities/deposit.entity';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    @InjectRepository(Deposit)
    private readonly depositsRepository: Repository<Deposit>,
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
  ) {}

  /**
   * Đặt cọc giả lập để tham gia phiên đấu giá
   */
  async deposit(auctionId: string, userId: string, customAmount?: number): Promise<Deposit> {
    const auction = await this.auctionsRepository.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Phiên đấu giá không tồn tại');
    }

    if (
      auction.status !== AuctionStatus.UPCOMING &&
      auction.status !== AuctionStatus.ACTIVE
    ) {
      throw new BadRequestException('Phiên đấu giá không ở trạng thái chấp nhận đặt cọc');
    }

    const existingDeposit = await this.depositsRepository.findOne({
      where: { auctionId, userId },
    });

    if (existingDeposit && existingDeposit.status === DepositStatus.HELD) {
      throw new ConflictException('Bạn đã đặt cọc cho phiên đấu giá này rồi');
    }

    // Tiền cọc: nếu không nhập thì mặc định là 10% giá khởi điểm (tối thiểu 50.000đ)
    const defaultDepositAmount = Math.max(
      Math.round(Number(auction.startingPrice) * 0.1),
      50_000,
    );
    const amount = customAmount && customAmount > 0 ? customAmount : defaultDepositAmount;

    if (existingDeposit) {
      existingDeposit.amount = amount;
      existingDeposit.status = DepositStatus.HELD;
      return this.depositsRepository.save(existingDeposit);
    }

    const deposit = this.depositsRepository.create({
      auctionId,
      userId,
      amount,
      status: DepositStatus.HELD,
    });

    return this.depositsRepository.save(deposit);
  }

  /**
   * Lấy thông tin tiền cọc của user tại phiên đấu giá
   */
  async getDeposit(auctionId: string, userId: string): Promise<Deposit | null> {
    return this.depositsRepository.findOne({
      where: { auctionId, userId },
    });
  }

  /**
   * Kiểm tra người dùng đã có tiền cọc hợp lệ (HELD) chưa
   */
  async hasActiveDeposit(auctionId: string, userId: string): Promise<boolean> {
    const deposit = await this.depositsRepository.findOne({
      where: { auctionId, userId, status: DepositStatus.HELD },
    });
    return Boolean(deposit);
  }

  /**
   * Hoàn cọc cho tất cả những người tham gia bị thua cuộc
   */
  async refundNonWinners(auctionId: string, winnerId?: string): Promise<number> {
    const query = this.depositsRepository
      .createQueryBuilder()
      .update(Deposit)
      .set({ status: DepositStatus.REFUNDED })
      .where('auction_id = :auctionId', { auctionId })
      .andWhere('status = :heldStatus', { heldStatus: DepositStatus.HELD });

    if (winnerId) {
      query.andWhere('user_id != :winnerId', { winnerId });
    }

    const result = await query.execute();
    this.logger.log(`Hoàn cọc thành công cho ${result.affected ?? 0} người thua tại phiên ${auctionId}`);
    return result.affected ?? 0;
  }

  /**
   * Tịch thu tiền cọc của người trúng đấu giá do vi phạm không thanh toán
   */
  async forfeitDeposit(auctionId: string, userId: string): Promise<boolean> {
    const result = await this.depositsRepository.update(
      { auctionId, userId, status: DepositStatus.HELD },
      { status: DepositStatus.FORFEITED },
    );
    const success = (result.affected ?? 0) > 0;
    if (success) {
      this.logger.warn(`Đã tịch thu tiền cọc của user ${userId} tại phiên ${auctionId}`);
    }
    return success;
  }

  /**
   * Hoàn cọc cho người thắng sau khi thanh toán hóa đơn đầy đủ
   */
  async refundWinner(auctionId: string, winnerId: string): Promise<boolean> {
    const result = await this.depositsRepository.update(
      { auctionId, userId: winnerId, status: DepositStatus.HELD },
      { status: DepositStatus.REFUNDED },
    );
    return (result.affected ?? 0) > 0;
  }
}
