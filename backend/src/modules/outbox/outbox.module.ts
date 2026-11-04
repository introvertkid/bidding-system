import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BidsModule } from '../bids/bids.module';
import { AuctionEventsProcessor } from './auction-events.processor';
import { OutboxRelayService } from './outbox-relay.service';
import { AUCTION_EVENTS_QUEUE } from './outbox.constants';

const redisConnection = (configService: ConfigService) => ({
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
});

/**
 * GP3 – Transactional Outbox: relay đẩy outbox_events sang BullMQ, consumer broadcast Socket.io.
 * Worker chạy cùng process với AuctionGateway nên chưa cần @socket.io/redis-adapter;
 * tách worker ra process riêng thì phải thêm adapter.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnection(configService),
      }),
    }),
    BullModule.registerQueueAsync({
      name: AUCTION_EVENTS_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // Không xếp hàng lệnh khi mất Redis, nếu không relay sẽ treo giữa transaction
        connection: { ...redisConnection(configService), enableOfflineQueue: false },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 200 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    BidsModule,
  ],
  providers: [OutboxRelayService, AuctionEventsProcessor],
})
export class OutboxModule {}
