import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { User } from './modules/users/entities/user.entity';
import { Category } from './modules/products/entities/category.entity';
import { Product } from './modules/products/entities/product.entity';
import { Auction } from './modules/auctions/entities/auction.entity';
import { Bid } from './modules/bids/entities/bid.entity';
import { Invoice } from './modules/invoices/entities/invoice.entity';

// Modules
import { AuctionsModule } from './modules/auctions/auctions.module';
import { ProductsModule } from './modules/products/products.module';
import { BidsModule } from './modules/bids/bids.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeedService } from './database/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // Đọc từ thư mục gốc
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [User, Category, Product, Auction, Bid, Invoice],
        synchronize: true, // WARNING: Only for development. Set to false in production and use migrations!
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AuctionsModule,
    ProductsModule,
    BidsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
