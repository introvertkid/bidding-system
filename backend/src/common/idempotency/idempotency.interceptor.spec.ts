import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let store: Map<string, string>;
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };
  let interceptor: IdempotencyInterceptor;
  let response: { statusCode: number; status: jest.Mock; setHeader: jest.Mock };

  const KEY = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const REDIS_KEY = `idempotency:user-1:${KEY}`;

  beforeEach(() => {
    store = new Map();
    redis = {
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        if (args.includes('NX') && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
    response = { statusCode: 201, status: jest.fn(), setHeader: jest.fn() };
    interceptor = new IdempotencyInterceptor(redis as unknown as Redis);
  });

  const createContext = (
    body: unknown = { amount: 100 },
    headers: Record<string, string> = { 'idempotency-key': KEY },
    originalUrl = '/api/v1/auctions/a1/bids',
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl,
          headers,
          body,
          user: { id: 'user-1' },
        }),
        getResponse: () => response,
      }),
    }) as unknown as ExecutionContext;

  const handlerReturning = (value: unknown) => ({
    handle: jest.fn(() => of(value)),
  });

  const run = async (context: ExecutionContext, handler: CallHandler) =>
    firstValueFrom(await interceptor.intercept(context, handler));

  it('từ chối 400 khi thiếu header', async () => {
    await expect(
      run(createContext({}, {}), handlerReturning('x')),
    ).rejects.toThrow(BadRequestException);
  });

  it('lần đầu chạy handler và lưu COMPLETED với TTL 24h', async () => {
    const handler = handlerReturning({ bidId: 'b1' });

    await expect(run(createContext(), handler)).resolves.toEqual({
      bidId: 'b1',
    });

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(REDIS_KEY) as string)).toMatchObject({
      status: 'COMPLETED',
      statusCode: 201,
      body: { bidId: 'b1' },
    });
    expect(redis.set).toHaveBeenLastCalledWith(
      REDIS_KEY,
      expect.any(String),
      'EX',
      86400,
    );
  });

  it('gửi lại trả response cũ, không chạy handler lần 2', async () => {
    await run(createContext(), handlerReturning({ bidId: 'b1' }));
    const second = handlerReturning({ bidId: 'b2' });

    await expect(run(createContext(), second)).resolves.toEqual({
      bidId: 'b1',
    });

    expect(second.handle).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Idempotent-Replayed',
      'true',
    );
  });

  it('trả 409 khi request đầu còn đang xử lý', async () => {
    await interceptor.intercept(createContext(), handlerReturning('x'));
    const second = handlerReturning('y');

    await expect(run(createContext(), second)).rejects.toThrow(
      ConflictException,
    );
    expect(second.handle).not.toHaveBeenCalled();
  });

  it('trả 422 khi cùng key khác payload', async () => {
    await run(createContext({ amount: 100 }), handlerReturning('x'));

    await expect(
      run(createContext({ amount: 200 }), handlerReturning('y')),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('trả 422 khi cùng key dùng cho phiên khác', async () => {
    await run(createContext(), handlerReturning('x'));

    await expect(
      run(
        createContext({ amount: 100 }, undefined, '/api/v1/auctions/a2/bids'),
        handlerReturning('y'),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('handler lỗi thì xóa key để thử lại được', async () => {
    const error = new BadRequestException('Giá quá thấp');
    const failing: CallHandler = { handle: () => throwError(() => error) };

    await expect(run(createContext(), failing)).rejects.toBe(error);
    expect(store.has(REDIS_KEY)).toBe(false);

    await expect(run(createContext(), handlerReturning('ok'))).resolves.toBe(
      'ok',
    );
  });

  it('không lưu được COMPLETED thì vẫn trả kết quả thành công', async () => {
    const handler = handlerReturning({ bidId: 'b1' });
    redis.set
      .mockResolvedValueOnce('OK')
      .mockRejectedValueOnce(new Error('redis down'));

    await expect(run(createContext(), handler)).resolves.toEqual({
      bidId: 'b1',
    });
    expect(redis.del).not.toHaveBeenCalled();
  });
});
