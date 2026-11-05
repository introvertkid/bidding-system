import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { Auction, AuctionStatus } from '../auctions/entities/auction.entity';
import { AuctionGateway } from '../bids/auction.gateway';
import { Bid, BidStatus } from '../bids/entities/bid.entity';
import { DepositsService } from '../deposits/deposits.service';
import { Deposit, DepositStatus } from '../deposits/entities/deposit.entity';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { AccountStatus, User } from '../users/entities/user.entity';
import { Offer, OfferStatus } from './entities/offer.entity';
import { Settlement, SettlementStatus } from './entities/settlement.entity';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);
  private isClosingAuctions = false;
  private isProcessingOverdue = false;
  private isProcessingExpiredOffers = false;

  constructor(
    @InjectRepository(Settlement)
    private readonly settlementsRepository: Repository<Settlement>,
    @InjectRepository(Offer)
    private readonly offersRepository: Repository<Offer>,
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    private readonly depositsService: DepositsService,
    private readonly auctionGateway: AuctionGateway,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 1: Đóng phiên đấu giá khi hết thời gian (end_time < now)
   * Quét các phiên ACTIVE đã hết hạn:
   * - Có người thắng: ENDED + tạo Invoice + lưu Settlement + hoàn cọc người thua
   * - Không ai bid: FAILED + hoàn cọc (nếu có ai cọc mà không bid)
   */
  @Interval(5000)
  async closeExpiredAuctions(): Promise<void> {
    if (this.isClosingAuctions) return;
    this.isClosingAuctions = true;

    try {
      const now = new Date();
      const expiredAuctions = await this.auctionsRepository.find({
        where: {
          status: AuctionStatus.ACTIVE,
          endTime: LessThanOrEqual(now),
        },
        relations: { product: true },
      });

      if (!expiredAuctions.length) return;

      this.logger.log(
        `[Saga Settlement] Phát hiện ${expiredAuctions.length} phiên đã hết giờ cần chốt`,
      );

      for (const auction of expiredAuctions) {
        await this.settleExpiredAuction(auction);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Lỗi trong tiến trình closeExpiredAuctions: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isClosingAuctions = false;
    }
  }

  /**
   * Xử lý chốt 1 phiên đấu giá hết hạn
   */
  async settleExpiredAuction(auction: Auction): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const hasWinner = Boolean(auction.highestBidderId);

      if (hasWinner) {
        // 1. Chuyển trạng thái phiên sang ENDED
        await manager.update(
          Auction,
          { id: auction.id },
          { status: AuctionStatus.ENDED },
        );

        // Tìm bid chiến thắng
        const winningBid = await manager.findOne(Bid, {
          where: {
            auctionId: auction.id,
            bidderId: auction.highestBidderId,
            status: BidStatus.VALID,
          },
          order: { amount: 'DESC' },
        });

        // 2. Tạo hóa đơn cho người trúng đấu giá (thời hạn thanh toán 3 ngày)
        const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        let invoice = await manager.findOne(Invoice, {
          where: {
            auctionId: auction.id,
            winnerId: auction.highestBidderId,
            status: InvoiceStatus.PENDING,
          },
        });

        if (!invoice) {
          invoice = manager.create(Invoice, {
            auctionId: auction.id,
            winnerId: auction.highestBidderId,
            amount: auction.currentPrice,
            status: InvoiceStatus.PENDING,
            dueDate,
          });
          invoice = await manager.save(Invoice, invoice);
        }

        // 3. Khởi tạo bản ghi Saga Settlement
        let settlement = await manager.findOne(Settlement, {
          where: { auctionId: auction.id },
        });

        if (!settlement) {
          settlement = manager.create(Settlement, {
            auctionId: auction.id,
            winnerId: auction.highestBidderId,
            winningBidId: winningBid?.id ?? null,
            status: SettlementStatus.INVOICE_PENDING,
            step: 'INITIAL_INVOICE',
          });
        } else {
          settlement.winnerId = auction.highestBidderId;
          settlement.winningBidId = winningBid?.id ?? null;
          settlement.status = SettlementStatus.INVOICE_PENDING;
          settlement.step = 'INITIAL_INVOICE';
        }
        await manager.save(Settlement, settlement);

        // 4. Hoàn trả tiền cọc cho tất cả những người tham gia bị thua
        await manager
          .createQueryBuilder()
          .update(Deposit)
          .set({ status: DepositStatus.REFUNDED })
          .where('auction_id = :auctionId', { auctionId: auction.id })
          .andWhere('user_id != :winnerId', {
            winnerId: auction.highestBidderId,
          })
          .andWhere('status = :heldStatus', { heldStatus: DepositStatus.HELD })
          .execute();

        // 5. Phát thông báo realtime
        this.auctionGateway.emitAuctionEnded(auction.id, {
          auctionId: auction.id,
          status: 'ENDED',
          winnerId: auction.highestBidderId,
          finalPrice: Number(auction.currentPrice),
        });

        this.auctionGateway.emitInvoiceCreated(auction.highestBidderId, {
          invoiceId: invoice.id,
          auctionId: auction.id,
          amount: Number(invoice.amount),
          dueDate: invoice.dueDate.toISOString(),
        });

        this.logger.log(
          `Phiên ${auction.id} đã ENDED thành công, người thắng: ${auction.highestBidderId}, tạo hóa đơn: ${invoice.id}`,
        );
      } else {
        // Không ai tham gia bid -> FAILED
        await manager.update(
          Auction,
          { id: auction.id },
          { status: AuctionStatus.FAILED },
        );

        let settlement = await manager.findOne(Settlement, {
          where: { auctionId: auction.id },
        });

        if (!settlement) {
          settlement = manager.create(Settlement, {
            auctionId: auction.id,
            status: SettlementStatus.FAILED,
            step: 'COMPLETED',
            failureReason: 'NO_BIDS',
          });
        } else {
          settlement.status = SettlementStatus.FAILED;
          settlement.step = 'COMPLETED';
          settlement.failureReason = 'NO_BIDS';
        }
        await manager.save(Settlement, settlement);

        // Hoàn cọc nếu có ai đã cọc nhưng không bid
        await manager
          .createQueryBuilder()
          .update(Deposit)
          .set({ status: DepositStatus.REFUNDED })
          .where('auction_id = :auctionId', { auctionId: auction.id })
          .andWhere('status = :heldStatus', { heldStatus: DepositStatus.HELD })
          .execute();

        this.auctionGateway.emitAuctionEnded(auction.id, {
          auctionId: auction.id,
          status: 'FAILED',
        });

        this.logger.log(
          `Phiên ${auction.id} kết thúc FAILED do không có lượt đặt giá nào.`,
        );
      }
    });
  }

  /**
   * CRON 2: Xử lý quá hạn thanh toán (Saga Compensating Transaction)
   * Quét hóa đơn PENDING có due_date < now:
   * 1. Hủy hóa đơn (CANCELED)
   * 2. Tịch thu cọc người thắng (FORFEITED)
   * 3. Ghi nhận vi phạm người dùng (tùy chính sách: có thể cấm hoặc ghi log vi phạm)
   * 4. Tìm Á quân (Runner-up) hợp lệ gửi offer
   * 5. Nếu không còn ai -> Chuyển phiên sang FAILED
   */
  @Interval(5000)
  async handleOverdueInvoices(): Promise<void> {
    if (this.isProcessingOverdue) return;
    this.isProcessingOverdue = true;

    try {
      const now = new Date();
      const overdueInvoices = await this.invoicesRepository.find({
        where: {
          status: InvoiceStatus.PENDING,
          dueDate: LessThanOrEqual(now),
        },
        relations: { auction: { product: true } },
      });

      if (!overdueInvoices.length) return;

      this.logger.warn(
        `[Saga Settlement] Phát hiện ${overdueInvoices.length} hóa đơn quá hạn cần xử lý bù trừ`,
      );

      for (const invoice of overdueInvoices) {
        await this.handleSingleOverdueInvoice(invoice);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Lỗi trong tiến trình handleOverdueInvoices: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isProcessingOverdue = false;
    }
  }

  /**
   * Xử lý bù trừ cho 1 hóa đơn quá hạn
   */
  async handleSingleOverdueInvoice(invoice: Invoice): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 1. Hủy hóa đơn
      invoice.status = InvoiceStatus.CANCELED;
      await manager.save(Invoice, invoice);

      // 2. Tịch thu tiền cọc người thắng (phạt vi phạm)
      await manager.update(
        Deposit,
        {
          auctionId: invoice.auctionId,
          userId: invoice.winnerId,
          status: DepositStatus.HELD,
        },
        { status: DepositStatus.FORFEITED },
      );

      // 3. Ghi nhận vi phạm tài khoản người thắng
      const violator = await manager.findOne(User, {
        where: { id: invoice.winnerId },
      });
      if (violator) {
        this.logger.warn(
          `Ghi nhận vi phạm quá hạn thanh toán đối với user ${violator.email} (${violator.id}) tại phiên ${invoice.auctionId}`,
        );
        // Tùy chính sách hệ thống: giảm điểm uy tín
        const newScore = Math.max(0, Number(violator.ratingScore) - 1.0);
        await manager.update(
          User,
          { id: violator.id },
          { ratingScore: newScore },
        );
      }

      // 4. Tìm kiếm Á quân (Runner-up) kế tiếp
      await this.findAndInviteNextRunnerUp(
        manager,
        invoice.auctionId,
        invoice.auction?.product?.title,
      );
    });
  }

  /**
   * CRON 3: Xử lý quá hạn lời mời mua cho Runner-up
   */
  @Interval(5000)
  async handleExpiredOffers(): Promise<void> {
    if (this.isProcessingExpiredOffers) return;
    this.isProcessingExpiredOffers = true;

    try {
      const now = new Date();
      const expiredOffers = await this.offersRepository.find({
        where: {
          status: OfferStatus.PENDING,
          expiresAt: LessThanOrEqual(now),
        },
        relations: { auction: { product: true } },
      });

      if (!expiredOffers.length) return;

      this.logger.log(
        `[Saga Settlement] Phát hiện ${expiredOffers.length} lời mời mua bị quá hạn`,
      );

      for (const offer of expiredOffers) {
        await this.dataSource.transaction(async (manager) => {
          offer.status = OfferStatus.EXPIRED;
          await manager.save(Offer, offer);

          this.logger.log(
            `Lời mời ${offer.id} cho user ${offer.bidderId} đã hết hạn. Chuyển sang người tiếp theo.`,
          );
          await this.findAndInviteNextRunnerUp(
            manager,
            offer.auctionId,
            offer.auction?.product?.title,
          );
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Lỗi trong tiến trình handleExpiredOffers: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isProcessingExpiredOffers = false;
    }
  }

  /**
   * Tìm và mời người trả giá cao hợp lệ tiếp theo (Runner-up)
   */
  async findAndInviteNextRunnerUp(
    manager: EntityManager,
    auctionId: string,
    productTitle?: string,
  ): Promise<Offer | null> {
    let settlement = await manager.findOne(Settlement, {
      where: { auctionId },
    });
    if (!settlement) {
      settlement = manager.create(Settlement, {
        auctionId,
        status: SettlementStatus.FALLBACK_RUNNER_UP,
        step: 'RUNNER_UP_OFFER',
      });
      settlement = await manager.save(Settlement, settlement);
    }

    // Lấy danh sách các user đã từng bị phạt/từ chối/hết hạn offer trong phiên này
    const previousOffers = await manager.find(Offer, { where: { auctionId } });
    const excludedUserIds = new Set<string>();

    if (settlement.winnerId) {
      excludedUserIds.add(settlement.winnerId);
    }

    for (const off of previousOffers) {
      excludedUserIds.add(off.bidderId);
    }

    // Lấy tất cả lượt bid của phiên theo giá giảm dần
    const bids = await manager.find(Bid, {
      where: { auctionId },
      order: { amount: 'DESC', createdAt: 'ASC' },
      relations: { bidder: true },
    });

    // Lọc người trả giá cao kế tiếp hợp lệ
    let nextRunnerUpBid: Bid | null = null;
    for (const bid of bids) {
      if (!bid.bidderId) continue;
      if (excludedUserIds.has(bid.bidderId)) continue;
      if (bid.bidder?.accountStatus === AccountStatus.BANNED) continue;

      nextRunnerUpBid = bid;
      break;
    }

    if (nextRunnerUpBid) {
      // Tạo Offer cho runner-up (thời hạn phản hồi 24 giờ)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const offer = manager.create(Offer, {
        settlementId: settlement.id,
        auctionId,
        bidderId: nextRunnerUpBid.bidderId,
        bidId: nextRunnerUpBid.id,
        offeredPrice: nextRunnerUpBid.amount,
        status: OfferStatus.PENDING,
        expiresAt,
      });
      const savedOffer = await manager.save(Offer, offer);

      settlement.status = SettlementStatus.FALLBACK_RUNNER_UP;
      settlement.step = 'RUNNER_UP_OFFER';
      settlement.currentOfferId = savedOffer.id;
      await manager.save(Settlement, settlement);

      // Phát sự kiện realtime offer_received
      this.auctionGateway.emitOfferReceived(nextRunnerUpBid.bidderId, {
        offerId: savedOffer.id,
        auctionId,
        productName: productTitle,
        offeredPrice: Number(savedOffer.offeredPrice),
        expiresAt: savedOffer.expiresAt.toISOString(),
      });

      this.logger.log(
        `Đã gửi lời mời mua (Offer ${savedOffer.id}) cho runner-up ${nextRunnerUpBid.bidderId} với giá ${savedOffer.offeredPrice}`,
      );

      return savedOffer;
    } else {
      // Không còn ai khác để mời -> Chuyển phiên sang FAILED
      settlement.status = SettlementStatus.FAILED;
      settlement.step = 'COMPLETED';
      settlement.failureReason = 'NO_ELIGIBLE_RUNNER_UP';
      await manager.save(Settlement, settlement);

      await manager.update(
        Auction,
        { id: auctionId },
        { status: AuctionStatus.FAILED },
      );

      this.auctionGateway.emitAuctionEnded(auctionId, {
        auctionId,
        status: 'FAILED',
      });

      this.logger.warn(
        `Phiên ${auctionId} không còn runner-up nào hợp lệ -> chuyển FAILED`,
      );
      return null;
    }
  }

  /**
   * API: Lấy danh sách lời mời mua (runner-up) của tôi
   */
  async getUserOffers(userId: string): Promise<Offer[]> {
    return this.offersRepository.find({
      where: { bidderId: userId },
      relations: {
        auction: {
          product: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * API: Runner-up Chấp nhận lời mời mua
   */
  async acceptOffer(offerId: string, userId: string) {
    const offer = await this.offersRepository.findOne({
      where: { id: offerId },
      relations: { auction: true },
    });

    if (!offer) {
      throw new NotFoundException('Lời mời không tồn tại');
    }

    if (offer.bidderId !== userId) {
      throw new ForbiddenException('Bạn không phải là người nhận lời mời này');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(
        `Lời mời đã ở trạng thái ${offer.status}, không thể chấp nhận`,
      );
    }

    const now = new Date();
    if (offer.expiresAt < now) {
      await this.dataSource.transaction(async (manager) => {
        offer.status = OfferStatus.EXPIRED;
        await manager.save(Offer, offer);
        await this.findAndInviteNextRunnerUp(manager, offer.auctionId);
      });
      throw new BadRequestException('Lời mời mua này đã hết hạn');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Chuyển offer sang ACCEPTED
      offer.status = OfferStatus.ACCEPTED;
      await manager.save(Offer, offer);

      // 2. Cập nhật Auction: người dẫn đầu mới và giá mới
      await manager.update(
        Auction,
        { id: offer.auctionId },
        {
          highestBidderId: offer.bidderId,
          currentPrice: offer.offeredPrice,
        },
      );

      // 3. Cập nhật Settlement
      await manager.update(
        Settlement,
        { auctionId: offer.auctionId },
        {
          winnerId: offer.bidderId,
          winningBidId: offer.bidId,
          status: SettlementStatus.INVOICE_PENDING,
          step: 'RUNNER_UP_INVOICE',
        },
      );

      // 4. Tạo hóa đơn mới cho người chấp nhận (thời hạn 3 ngày)
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const invoice = manager.create(Invoice, {
        auctionId: offer.auctionId,
        winnerId: offer.bidderId,
        amount: offer.offeredPrice,
        status: InvoiceStatus.PENDING,
        dueDate,
      });
      const savedInvoice = await manager.save(Invoice, invoice);

      // 5. Thông báo realtime
      this.auctionGateway.emitInvoiceCreated(offer.bidderId, {
        invoiceId: savedInvoice.id,
        auctionId: offer.auctionId,
        amount: Number(savedInvoice.amount),
        dueDate: savedInvoice.dueDate.toISOString(),
      });

      this.logger.log(
        `User ${userId} đã chấp nhận offer ${offerId} tại auction ${offer.auctionId}, tạo invoice ${savedInvoice.id}`,
      );

      return {
        offer,
        invoice: savedInvoice,
      };
    });
  }

  /**
   * API: Runner-up Từ chối lời mời mua
   */
  async declineOffer(offerId: string, userId: string) {
    const offer = await this.offersRepository.findOne({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Lời mời không tồn tại');
    }

    if (offer.bidderId !== userId) {
      throw new ForbiddenException('Bạn không phải là người nhận lời mời này');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(
        `Lời mời đã ở trạng thái ${offer.status}, không thể từ chối`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      offer.status = OfferStatus.DECLINED;
      await manager.save(Offer, offer);

      this.logger.log(
        `User ${userId} đã từ chối offer ${offerId}. Chuyển sang runner-up kế tiếp.`,
      );

      // Tự động tìm và mời người kế tiếp
      const nextOffer = await this.findAndInviteNextRunnerUp(
        manager,
        offer.auctionId,
      );

      return {
        message: 'Đã từ chối lời mời mua thành công',
        hasNextRunnerUp: Boolean(nextOffer),
      };
    });
  }
}
