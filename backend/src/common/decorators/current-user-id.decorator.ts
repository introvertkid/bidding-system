import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

// TODO: Khi có module Auth (JWT), chỉ lấy từ request.user và bỏ header x-user-id.
// Header x-user-id chỉ dùng tạm để test Bidding Engine khi chưa có đăng nhập.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('Bạn cần đăng nhập để thực hiện thao tác này');
    }
    return userId;
  },
);
