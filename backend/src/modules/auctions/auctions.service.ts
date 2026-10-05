import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Bid } from '../bids/entities/bid.entity';
import { Product } from '../products/entities/product.entity';
import { defaultBidIncrement, getViewStatus, toAuctionView } from './auction-view';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { Auction, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Auction)
    private auctionsRepository: Repository<Auction>,
  ) {}

  // Tạo sản phẩm + phiên đấu giá trong 1 transaction
  async create(sellerId: string, dto: CreateAuctionDto, imageUrl?: string) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
    if (dto.endTime <= new Date()) {
      throw new BadRequestException('Thời gian kết thúc phải ở tương lai');
    }

    const auctionId = await this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(Product, {
          sellerId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          images: imageUrl ? [imageUrl] : [],
        }),
      );
      const auction = await manager.save(
        manager.create(Auction, {
          productId: product.id,
          status: AuctionStatus.UPCOMING,
          startTime: dto.startTime,
          endTime: dto.endTime,
          startingPrice: dto.startingPrice,
          currentPrice: dto.startingPrice,
          bidIncrement: dto.bidIncrement ?? defaultBidIncrement(dto.startingPrice),
        }),
      );
      return auction.id;
    });

    return this.findOne(auctionId);
  }

  async findAll() {
    const auctions = await this.baseQuery().orderBy('auction.startTime', 'ASC').getMany();
    return this.toViews(auctions);
  }

  async findOne(id: string) {
    const auction = await this.baseQuery().where('auction.id = :id', { id }).getOne();
    if (!auction) {
      throw new NotFoundException(`Không tìm thấy phiên đấu giá với ID ${id}`);
    }
    const [view] = await this.toViews([auction]);
    return view;
  }

  // Lịch sử của user: các phiên đã tham gia đặt giá và các phiên đã tạo
  async findHistory(userId: string) {
    const now = new Date();
    const userBids = await this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .select('bid.auctionId', 'auctionId')
      .addSelect('MAX(bid.amount)', 'userBid')
      .where('bid.bidderId = :userId', { userId })
      .groupBy('bid.auctionId')
      .getRawMany<{ auctionId: string; userBid: string }>();

    const participatedIds = userBids.map((bid) => bid.auctionId);
    const auctions = await this.baseQuery()
      .where('product.sellerId = :userId', { userId })
      .orWhere(participatedIds.length ? 'auction.id IN (:...participatedIds)' : 'FALSE', {
        participatedIds,
      })
      .orderBy('auction.startTime', 'DESC')
      .getMany();

    const participated = userBids.flatMap(({ auctionId, userBid }) => {
      const auction = auctions.find((item) => item.id === auctionId);
      if (!auction) return [];
      const isLeading = auction.highestBidderId === userId;
      const ended = getViewStatus(auction, now) === 'ENDED';
      return [
        {
          auctionId,
          userBid: Number(userBid),
          result: ended ? (isLeading ? 'WON' : 'LOST') : isLeading ? 'LEADING' : 'OUTBID',
        },
      ];
    });

    return {
      auctions: await this.toViews(auctions, now),
      participated,
      createdAuctionIds: auctions
        .filter((auction) => auction.product.sellerId === userId)
        .map((auction) => auction.id),
    };
  }

  async update(id: string, updateData: Partial<Auction>): Promise<Auction> {
    const auction = await this.auctionsRepository.findOneBy({ id });
    if (!auction) {
      throw new NotFoundException(`Không tìm thấy phiên đấu giá với ID ${id}`);
    }
    const updated = this.auctionsRepository.merge(auction, updateData);
    return this.auctionsRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const auction = await this.auctionsRepository.findOneBy({ id });
    if (!auction) {
      throw new NotFoundException(`Không tìm thấy phiên đấu giá với ID ${id}`);
    }
    await this.auctionsRepository.remove(auction);
  }

  private baseQuery() {
    return this.auctionsRepository
      .createQueryBuilder('auction')
      .innerJoinAndSelect('auction.product', 'product')
      .leftJoinAndSelect('auction.highestBidder', 'highestBidder');
  }

  // Đếm số lượt bid của các phiên bằng 1 query GROUP BY
  private async toViews(auctions: Auction[], now = new Date()) {
    const ids = auctions.map((auction) => auction.id);
    const counts = ids.length
      ? await this.dataSource
          .getRepository(Bid)
          .createQueryBuilder('bid')
          .select('bid.auctionId', 'auctionId')
          .addSelect('COUNT(*)', 'count')
          .where('bid.auctionId IN (:...ids)', { ids })
          .groupBy('bid.auctionId')
          .getRawMany<{ auctionId: string; count: string }>()
      : [];
    const countById = new Map(counts.map((row) => [row.auctionId, Number(row.count)]));

    return auctions.map((auction) =>
      toAuctionView(Object.assign(auction, { bidCount: countById.get(auction.id) ?? 0 }), now),
    );
  }
}
