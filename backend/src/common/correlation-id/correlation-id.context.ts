import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  correlationId: string;
}

/**
 * ALS giữ Correlation ID trong suốt vòng đời request.
 * Dùng chung cho: middleware (GP1), outbox relay/worker (GP3 - worker chạy
 * ngoài request nên phải đọc correlation_id từ bản ghi outbox thay vì ALS).
 */
export const correlationStore = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationId(): string | undefined {
  return correlationStore.getStore()?.correlationId;
}
