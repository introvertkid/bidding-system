import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { correlationStore } from './correlation-id.context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * GP1 – Correlation ID:
 * Đọc X-Correlation-ID từ request (client/frontend tự sinh khi retry) hoặc
 * tạo UUID mới, trả lại trong response header và lưu vào AsyncLocalStorage
 * để logger (pino mixin) gắn correlationId vào mọi dòng log của request.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof incoming === 'string' && incoming.trim() !== ''
        ? incoming.trim()
        : randomUUID();

    res.setHeader('X-Correlation-ID', correlationId);
    correlationStore.run({ correlationId }, () => next());
  }
}
