import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from './correlation-id.middleware';
import { correlationStore, getCorrelationId } from './correlation-id.context';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function runWith(headers: Record<string, string | undefined>) {
    const responseHeaders: Record<string, string> = {};
    const res = {
      setHeader: (key: string, value: string) => {
        responseHeaders[key] = value;
      },
    };
    const result = {
      nextCalled: false,
      storeIdInsideNext: undefined as string | undefined,
      storeIdAfterNext: undefined as string | undefined,
    };
    middleware.use(
      { headers } as never,
      res as never,
      () => {
        result.nextCalled = true;
        result.storeIdInsideNext = getCorrelationId();
      },
    );
    result.storeIdAfterNext = getCorrelationId();
    return { responseHeaders, ...result };
  }

  it('dùng lại X-Correlation-ID từ client khi có', () => {
    const { responseHeaders, nextCalled, storeIdInsideNext } = runWith({
      [CORRELATION_ID_HEADER]: 'client-id-123',
    });

    expect(responseHeaders['X-Correlation-ID']).toBe('client-id-123');
    expect(nextCalled).toBe(true);
    expect(storeIdInsideNext).toBe('client-id-123');
  });

  it('tạo UUID mới khi không có header', () => {
    const { responseHeaders, storeIdInsideNext } = runWith({});

    expect(responseHeaders['X-Correlation-ID']).toMatch(UUID_V4);
    expect(storeIdInsideNext).toBe(responseHeaders['X-Correlation-ID']);
  });

  it('tạo UUID mới khi header rỗng', () => {
    const { responseHeaders, storeIdInsideNext } = runWith({
      [CORRELATION_ID_HEADER]: '   ',
    });

    expect(responseHeaders['X-Correlation-ID']).toMatch(UUID_V4);
    expect(storeIdInsideNext).toBe(responseHeaders['X-Correlation-ID']);
  });

  it('ALS không rò rỉ ra ngoài scope của request', () => {
    correlationStore.run({ correlationId: 'outer' }, () => {
      const { storeIdInsideNext, storeIdAfterNext } = runWith({});

      expect(storeIdInsideNext).not.toBe('outer');
      expect(storeIdInsideNext).toMatch(UUID_V4);
      // Sau khi next() trả về, context của request con đã đóng
      expect(storeIdAfterNext).toBe('outer');
    });
  });
});
