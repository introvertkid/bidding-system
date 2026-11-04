import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getCorrelationId } from './common/correlation-id/correlation-id.context';

// Entities
import { User } from './modules/users/entities/user.entity';
import { Category } from './modules/products/entities/category.entity';
import { Product } from './modules/products/entities/product.entity';
import { Auction } from './modules/auctions/entities/auction.entity';
import { Bid } from './modules/bids/entities/bid.entity';
import { Invoice } from './modules/invoices/entities/invoice.entity';
import { Deposit } from './modules/deposits/entities/deposit.entity';
import { Settlement } from './modules/settlements/entities/settlement.entity';
import { Offer } from './modules/settlements/entities/offer.entity';
import { OutboxEvent } from './modules/outbox/entities/outbox-event.entity';

// Modules
import { AuctionsModule } from './modules/auctions/auctions.module';
import { ProductsModule } from './modules/products/products.module';
import { BidsModule } from './modules/bids/bids.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { CacheModule } from './modules/cache/cache.module';
import { RedisModule } from './common/redis/redis.module';
import { SeedService } from './database/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // Đọc từ thư mục gốc
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('LOG_LEVEL', 'info'),
          redact: {
            paths: ['req.headers.authorization'],
            censor: '[REDACTED]',
          },
          autoLogging: {
            ignore: (req) => Boolean(req.url?.startsWith('/api/docs')),
          },
          // GP1: gắn correlationId (từ ALS của middleware) vào mọi dòng log JSON
          mixin: () => {
            const correlationId = getCorrelationId();
            return correlationId ? { correlationId } : {};
          },
        },
      }),
    }),
    RedisModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          User,
          Category,
          Product,
          Auction,
          Bid,
          Invoice,
          Deposit,
          Settlement,
          Offer,
          OutboxEvent,
        ],
        synchronize: true, // WARNING: Only for development. Set to false in production and use migrations!
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AuctionsModule,
    ProductsModule,
    BidsModule,
    DepositsModule,
    InvoicesModule,
    SettlementsModule,
    OutboxModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
