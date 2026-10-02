import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Auction } from '../../auctions/entities/auction.entity';
import { User } from '../../users/entities/user.entity';

export enum BidStatus {
  VALID = 'VALID',
  OUTBID = 'OUTBID',
  WINNING = 'WINNING',
}

@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auction_id' })
  auctionId: string;

  @ManyToOne(() => Auction, (auction) => auction.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auction_id' })
  auction: Auction;

  @Column({ name: 'bidder_id' })
  bidderId: string;

  @ManyToOne(() => User, (user) => user.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bidder_id' })
  bidder: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: BidStatus,
    default: BidStatus.VALID,
  })
  status: BidStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
