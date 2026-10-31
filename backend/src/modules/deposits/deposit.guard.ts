import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DepositsService } from './deposits.service';

/**
 * DepositGuard:
 * Chặn người dùng chưa đặt cọc tham gia đặt giá (POST /api/v1/auctions/:auctionId/bids)
 */
@Injectable()
export class DepositGuard implements CanActivate {
  constructor(private readonly depositsService: DepositsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      params?: { auctionId?: string; id?: string };
    }>();
    const userId = request.user?.id;
    const auctionId = request.params?.auctionId || request.params?.id;

    if (!userId || !auctionId) {
      throw new ForbiddenException(
        'Không xác định được người dùng hoặc phiên đấu giá',
      );
    }

    const hasDeposit = await this.depositsService.hasActiveDeposit(
      auctionId,
      userId,
    );
    if (!hasDeposit) {
      throw new ForbiddenException(
        'Bạn phải đặt cọc để tham gia đấu giá phiên này',
      );
    }

    return true;
  }
}
