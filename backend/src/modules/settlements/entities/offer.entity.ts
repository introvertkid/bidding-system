import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Auction } from '../../auctions/entities/auction.entity';
import { Bid } from '../../bids/entities/bid.entity';
import { User } from '../../users/entities/user.entity';
import { Settlement } from './settlement.entity';

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

@Entity('offers')
@Index(['auctionId', 'bidderId'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_id' })
  settlementId: string;

  @ManyToOne(() => Settlement, (settlement) => settlement.offers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'settlement_id' })
  settlement: Settlement;

  @Column({ name: 'auction_id' })
  auctionId: string;

  @ManyToOne(() => Auction, (auction) => auction.offers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'auction_id' })
  auction: Auction;

  @Column({ name: 'bidder_id' })
  bidderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bidder_id' })
  bidder: User;

  @Column({ name: 'bid_id', nullable: true })
  bidId?: string;

  @ManyToOne(() => Bid, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bid_id' })
  bid?: Bid;

  @Column({ name: 'offered_price', type: 'decimal', precision: 12, scale: 2 })
  offeredPrice: number;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
