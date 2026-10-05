import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { defaultBidIncrement } from '../modules/auctions/auction-view';
import { Auction, AuctionStatus } from '../modules/auctions/entities/auction.entity';
import { Bid, BidStatus } from '../modules/bids/entities/bid.entity';
import { Product } from '../modules/products/entities/product.entity';
import { User } from '../modules/users/entities/user.entity';

const DEMO_PASSWORD = '123456';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type SeedAuction = {
  title: string;
  description: string;
  image: string;
  seller: 'shop' | 'an';
  startingPrice: number;
  // Mốc thời gian tính từ lúc seed
  startIn: number;
  endIn: number;
  // Lượt đặt giá theo thứ tự tăng dần
  bids?: ['an' | 'binh' | 'chau', number][];
};

const AUCTIONS: SeedAuction[] = [
  { title: 'MacBook Air M2 16GB / 512GB', description: 'MacBook Air M2 đã qua sử dụng, hoạt động ổn định. Ngoại hình còn tốt, kèm bộ sạc.', image: 'macbook', seller: 'shop', startingPrice: 15_000_000, startIn: -2 * HOUR, endIn: 135 * MINUTE, bids: [['an', 15_000_000], ['binh', 18_300_000], ['chau', 18_500_000]] },
  { title: 'Máy ảnh Fujifilm X-T30 II kèm ống kính', description: 'Máy ảnh Fujifilm X-T30 II kèm ống kính. Các chức năng hoạt động bình thường, có dấu sử dụng nhẹ.', image: 'camera', seller: 'shop', startingPrice: 18_000_000, startIn: -HOUR, endIn: 270 * MINUTE, bids: [['binh', 22_000_000], ['an', 22_500_000]] },
  { title: 'Đồng hồ Seiko 5 tự động cổ điển', description: 'Đồng hồ Seiko 5 máy cơ tự động, dây kim loại. Mặt kính còn tốt, máy hoạt động ổn định.', image: 'watch', seller: 'shop', startingPrice: 3_000_000, startIn: -90 * MINUTE, endIn: 105 * MINUTE, bids: [['chau', 4_100_000], ['binh', 4_200_000]] },
  { title: 'Túi xách da thật thủ công', description: 'Túi xách da thật làm thủ công, màu nâu. Đường may chắc chắn, có dấu sử dụng nhẹ.', image: 'bag', seller: 'an', startingPrice: 1_200_000, startIn: -30 * MINUTE, endIn: 370 * MINUTE, bids: [['chau', 1_800_000], ['binh', 1_850_000]] },
  { title: 'Tranh sơn dầu phong cảnh Hội An', description: 'Tranh sơn dầu phong cảnh Hội An vẽ tay, kèm khung gỗ. Bề mặt tranh và khung còn tốt.', image: 'painting', seller: 'an', startingPrice: 4_500_000, startIn: DAY, endIn: DAY + 6 * HOUR },
  { title: 'Bình gốm Bát Tràng vẽ tay', description: 'Bình gốm Bát Tràng trang trí vẽ tay. Bình nguyên vẹn, không nứt hoặc sứt miệng.', image: 'vase', seller: 'shop', startingPrice: 600_000, startIn: DAY + 5 * HOUR, endIn: 2 * DAY },
  { title: 'Loa Marshall Acton III', description: 'Loa Marshall Acton III đã qua sử dụng. Kết nối Bluetooth và các nút điều khiển hoạt động tốt.', image: 'speaker', seller: 'shop', startingPrice: 4_200_000, startIn: 2 * DAY, endIn: 3 * DAY },
  { title: 'Tai nghe Sony WH-1000XM5', description: 'Tai nghe Sony WH-1000XM5, kèm hộp đựng và cáp sạc. Chống ồn và kết nối hoạt động bình thường.', image: 'headphones', seller: 'shop', startingPrice: 3_500_000, startIn: 2 * DAY + 5 * HOUR, endIn: 3 * DAY },
  { title: 'Đồng hồ Seiko Presage', description: 'Đồng hồ Seiko Presage máy cơ, dây da. Đã qua sử dụng, máy hoạt động ổn định.', image: 'watch', seller: 'shop', startingPrice: 5_000_000, startIn: -3 * DAY, endIn: -3 * DAY + 3 * HOUR, bids: [['binh', 7_000_000], ['an', 7_200_000]] },
  { title: 'Máy ảnh Fujifilm X-T20', description: 'Máy ảnh Fujifilm X-T20 đã qua sử dụng. Thân máy còn tốt, các chức năng hoạt động bình thường.', image: 'camera', seller: 'shop', startingPrice: 10_000_000, startIn: -2 * DAY, endIn: -2 * DAY + 3 * HOUR, bids: [['an', 13_200_000], ['chau', 13_500_000]] },
];

// Tạo dữ liệu demo khi database chưa có phiên đấu giá nào (tắt bằng SEED_DEMO_DATA=false)
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.configService.get('SEED_DEMO_DATA') === 'false') return;
    if ((await this.dataSource.getRepository(Auction).count()) > 0) return;

    await this.dataSource.transaction((manager) => this.seed(manager));
    this.logger.log(`Đã tạo dữ liệu demo. Tài khoản: an@bidwell.test / ${DEMO_PASSWORD}`);
  }

  private async seed(manager: EntityManager) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const users = {
      shop: await this.upsertUser(manager, 'shop@bidwell.test', 'Bidwell Shop', passwordHash),
      an: await this.upsertUser(manager, 'an@bidwell.test', 'Nguyễn Văn An', passwordHash),
      binh: await this.upsertUser(manager, 'binh@bidwell.test', 'Trần Thị Bình', passwordHash),
      chau: await this.upsertUser(manager, 'chau@bidwell.test', 'Lê Minh Châu', passwordHash),
    };

    const now = Date.now();
    for (const item of AUCTIONS) {
      const product = await manager.save(
        manager.create(Product, {
          sellerId: users[item.seller].id,
          title: item.title,
          description: item.description,
          images: [`/images/auctions/${item.image}.jpg`],
        }),
      );

      const bids = item.bids ?? [];
      const lastBid = bids[bids.length - 1];
      const endTime = new Date(now + item.endIn);
      const auction = await manager.save(
        manager.create(Auction, {
          productId: product.id,
          status: endTime.getTime() < now ? AuctionStatus.ENDED : AuctionStatus.UPCOMING,
          startTime: new Date(now + item.startIn),
          endTime,
          startingPrice: item.startingPrice,
          bidIncrement: defaultBidIncrement(item.startingPrice),
          currentPrice: lastBid ? lastBid[1] : item.startingPrice,
          highestBidderId: lastBid ? users[lastBid[0]].id : undefined,
        }),
      );

      for (const [index, [bidder, amount]] of bids.entries()) {
        const isLast = index === bids.length - 1;
        await manager.save(
          manager.create(Bid, {
            auctionId: auction.id,
            bidderId: users[bidder].id,
            amount,
            status: isLast ? BidStatus.VALID : BidStatus.OUTBID,
            // Rải thời gian đặt giá trong khoảng phiên đã diễn ra
            createdAt: new Date(now + item.startIn + (index + 1) * 10 * MINUTE),
          }),
        );
      }
    }
  }

  private async upsertUser(manager: EntityManager, email: string, fullName: string, passwordHash: string) {
    const existing = await manager.findOneBy(User, { email });
    return existing ?? manager.save(manager.create(User, { email, fullName, passwordHash }));
  }
}
