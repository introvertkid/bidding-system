import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Auction } from '../../auctions/entities/auction.entity';
import { Bid } from '../../bids/entities/bid.entity';
import { User } from '../../users/entities/user.entity';
import { Offer } from './offer.entity';

export enum SettlementStatus {
  INVOICE_PENDING = 'INVOICE_PENDING',
  SETTLED = 'SETTLED',
  FALLBACK_RUNNER_UP = 'FALLBACK_RUNNER_UP',
  FAILED = 'FAILED',
}

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auction_id', unique: true })
  @Index()
  auctionId: string;

  @OneToOne(() => Auction, (auction) => auction.settlement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auction_id' })
  auction: Auction;

  @Column({ name: 'winner_id', nullable: true })
  winnerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winner_id' })
  winner?: User | null;

  @Column({ name: 'winning_bid_id', nullable: true })
  winningBidId?: string | null;

  @ManyToOne(() => Bid, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winning_bid_id' })
  winningBid?: Bid | null;

  @Column({ name: 'current_offer_id', nullable: true })
  currentOfferId?: string | null;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.INVOICE_PENDING,
  })
  status: SettlementStatus;

  @Column({ type: 'varchar', length: 64, default: 'INITIAL_INVOICE' })
  step: string;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @OneToMany(() => Offer, (offer) => offer.settlement)
  offers: Offer[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
