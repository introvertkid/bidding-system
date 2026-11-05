import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { OutboxEvent, OutboxStatus } from './entities/outbox-event.entity';
import { AUCTION_EVENTS_QUEUE, AuctionEventJob } from './outbox.constants';

const POLL_INTERVAL_MS = 200;
const BATCH_SIZE = 100;
const MAX_RETRIES = 5;

/**
 * GP3 – Outbox Relay: quét outbox_events PENDING đẩy sang BullMQ.
 * jobId = outbox.id nên nếu commit lỗi sau khi đã đẩy job, lần quét sau không sinh job trùng.
 * Khi kết nối của queue chưa sẵn sàng thì bỏ qua lượt quét, để sự cố không ăn hết số lần retry.
 * Phải kiểm tra đúng kết nối của queue: nó reconnect chậm hơn REDIS_CLIENT nhiều giây.
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isRelaying = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(AUCTION_EVENTS_QUEUE)
    private readonly queue: Queue<AuctionEventJob>,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async relayPendingEvents(): Promise<void> {
    if (this.isRelaying) return;
    this.isRelaying = true;

    try {
      const client = await this.queue.getBackend().client;
      if (client.status !== 'ready') return;

      await this.dataSource.transaction(async (manager) => {
        const events = await manager
          .createQueryBuilder(OutboxEvent, 'event')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('event.status = :status', { status: OutboxStatus.PENDING })
          .orderBy('event.createdAt', 'ASC')
          .limit(BATCH_SIZE)
          .getMany();

        for (const event of events) {
          await this.publish(event);
        }
        if (events.length) {
          await manager.save(OutboxEvent, events);
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Lỗi khi quét outbox: ${error.message}`, error.stack);
    } finally {
      this.isRelaying = false;
    }
  }

  private async publish(event: OutboxEvent): Promise<void> {
    try {
      await this.queue.add(
        event.eventType,
        {
          correlationId: event.correlationId,
          payload: event.payload as AuctionEventJob['payload'],
        },
        { jobId: event.id },
      );
      event.status = OutboxStatus.PUBLISHED;
      event.processedAt = new Date();
    } catch (err) {
      event.retryCount += 1;
      if (event.retryCount >= MAX_RETRIES) {
        event.status = OutboxStatus.FAILED;
        event.processedAt = new Date();
      }
      this.logger.warn(
        `Không đẩy được outbox ${event.id} (lần ${event.retryCount}): ${String(err)}`,
      );
    }
  }
}
