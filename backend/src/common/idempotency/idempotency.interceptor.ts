import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';
import { REDIS_CLIENT } from '../redis/redis.module';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

const KEY_FORMAT = /^[\w-]{1,128}$/;
const IN_PROGRESS_TTL_SECONDS = 30;
const COMPLETED_TTL_SECONDS = 24 * 60 * 60;

type IdempotencyRecord =
  | { status: 'IN_PROGRESS'; fingerprint: string }
  | {
      status: 'COMPLETED';
      fingerprint: string;
      statusCode: number;
      body: unknown;
    };

/**
 * GP2 – Idempotency Key (docs/archtecture_specific.md mục 2):
 * - Lần đầu: SET NX trạng thái IN_PROGRESS, chạy handler, lưu COMPLETED + response.
 * - Gửi lại: trả response đã lưu; đang xử lý -> 409; khác payload -> 422.
 * - Handler lỗi (kể cả 4xx nghiệp vụ): xóa key để người dùng sửa và thử lại.
 *
 * Fingerprint gồm cả method + URL để dùng lại key ở phiên khác cũng bị 422.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: string } }>();
    const response = http.getResponse<Response>();

    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'Bạn cần đăng nhập để thực hiện thao tác này',
      );
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];
    if (
      typeof idempotencyKey !== 'string' ||
      !KEY_FORMAT.test(idempotencyKey)
    ) {
      throw new BadRequestException(
        'Thiếu hoặc sai định dạng header Idempotency-Key',
      );
    }

    const redisKey = `idempotency:${userId}:${idempotencyKey}`;
    const fingerprint = this.fingerprint(request);
    const acquired = await this.redis.set(
      redisKey,
      JSON.stringify({
        status: 'IN_PROGRESS',
        fingerprint,
      } satisfies IdempotencyRecord),
      'EX',
      IN_PROGRESS_TTL_SECONDS,
      'NX',
    );

    if (!acquired) {
      return of(await this.replay(redisKey, fingerprint, response));
    }

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.saveCompleted(
          redisKey,
          fingerprint,
          response.statusCode,
          body,
        );
        return body;
      }),
      catchError((err: unknown) =>
        from(this.release(redisKey)).pipe(
          mergeMap(() => throwError(() => err)),
        ),
      ),
    );
  }

  private fingerprint(request: Request): string {
    return createHash('sha256')
      .update(
        `${request.method}:${request.originalUrl}:${JSON.stringify(request.body ?? null)}`,
      )
      .digest('hex');
  }

  private async replay(
    redisKey: string,
    fingerprint: string,
    response: Response,
  ) {
    const raw = await this.redis.get(redisKey);
    if (!raw) {
      // Key vừa hết hạn hoặc vừa bị xóa do lần trước lỗi, client chỉ cần gửi lại
      throw new ConflictException('Yêu cầu đang được xử lý, vui lòng thử lại');
    }

    const record = JSON.parse(raw) as IdempotencyRecord;
    if (record.fingerprint !== fingerprint) {
      throw new UnprocessableEntityException(
        'Idempotency-Key đã được dùng cho một yêu cầu có nội dung khác',
      );
    }
    if (record.status === 'IN_PROGRESS') {
      throw new ConflictException('Yêu cầu đang được xử lý, vui lòng chờ');
    }

    response.status(record.statusCode);
    response.setHeader('Idempotent-Replayed', 'true');
    return record.body;
  }

  // Giao dịch đã commit, lỗi Redis ở đây không được biến thành lỗi trả về client
  private async saveCompleted(
    redisKey: string,
    fingerprint: string,
    statusCode: number,
    body: unknown,
  ) {
    const record: IdempotencyRecord = {
      status: 'COMPLETED',
      fingerprint,
      statusCode,
      body,
    };
    try {
      await this.redis.set(
        redisKey,
        JSON.stringify(record),
        'EX',
        COMPLETED_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(
        `Không lưu được kết quả idempotency ${redisKey}: ${String(err)}`,
      );
    }
  }

  private async release(redisKey: string) {
    try {
      await this.redis.del(redisKey);
    } catch (err) {
      this.logger.error(
        `Không xóa được key idempotency ${redisKey}: ${String(err)}`,
      );
    }
  }
}
