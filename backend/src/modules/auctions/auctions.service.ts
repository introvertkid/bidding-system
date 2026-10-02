import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private auctionsRepository: Repository<Auction>,
  ) {}

  async create(createData: Partial<Auction>): Promise<Auction> {
    const newAuction = this.auctionsRepository.create(createData);
    return this.auctionsRepository.save(newAuction);
  }

  async findAll(): Promise<Auction[]> {
    // Tạm thời lấy danh sách cùng với thông tin product
    return this.auctionsRepository.find({
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Auction> {
    const auction = await this.auctionsRepository.findOne({
      where: { id },
      relations: { product: true, highestBidder: true },
    });
    
    if (!auction) {
      throw new NotFoundException(`Không tìm thấy phiên đấu giá với ID ${id}`);
    }
    return auction;
  }

  async update(id: string, updateData: Partial<Auction>): Promise<Auction> {
    const auction = await this.findOne(id);
    const updated = this.auctionsRepository.merge(auction, updateData);
    return this.auctionsRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const auction = await this.findOne(id);
    await this.auctionsRepository.remove(auction);
  }
}
