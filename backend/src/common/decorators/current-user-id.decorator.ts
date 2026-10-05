import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

// Lấy id user đã được JwtAuthGuard gắn vào request
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const userId = ctx.switchToHttp().getRequest().user?.id;
    if (!userId) {
      throw new UnauthorizedException('Bạn cần đăng nhập để thực hiện thao tác này');
    }
    return userId;
  },
);
