import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * RedisModule dùng chung cho toàn hệ thống (GP2 Idempotency, GP4 Cache-Aside).
 * Đọc REDIS_HOST, REDIS_PORT từ biến môi trường.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          // Redis lỗi thì báo lỗi nhanh, không treo request hàng chục giây
          maxRetriesPerRequest: 2,
        });
        client.on('error', (err) => logger.error(`Lỗi kết nối Redis: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
