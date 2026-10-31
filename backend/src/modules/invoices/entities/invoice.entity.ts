import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Auction } from '../../auctions/entities/auction.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auction_id' })
  auctionId: string;

  @ManyToOne(() => Auction, (auction) => auction.invoices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'auction_id' })
  auction: Auction;

  @Column({ name: 'winner_id' })
  winnerId: string;

  @ManyToOne(() => User, (user) => user.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'winner_id' })
  winner: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Column({ name: 'due_date', type: 'timestamp' })
  dueDate: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
