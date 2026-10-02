import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  ManyToOne,
  VersionColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Bid } from '../../bids/entities/bid.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { User } from '../../users/entities/user.entity';

export enum AuctionStatus {
  DRAFT = 'DRAFT',
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @OneToOne(() => Product, (product) => product.auction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.DRAFT,
  })
  status: AuctionStatus;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @Column({ name: 'starting_price', type: 'decimal', precision: 12, scale: 2 })
  startingPrice: number;

  @Column({ name: 'bid_increment', type: 'decimal', precision: 12, scale: 2 })
  bidIncrement: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  currentPrice: number;

  @Column({ name: 'highest_bidder_id', nullable: true })
  highestBidderId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'highest_bidder_id' })
  highestBidder: User;

  @VersionColumn()
  version: number;

  @OneToMany(() => Bid, (bid) => bid.auction)
  bids: Bid[];

  @OneToOne(() => Invoice, (invoice) => invoice.auction)
  invoice: Invoice;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
