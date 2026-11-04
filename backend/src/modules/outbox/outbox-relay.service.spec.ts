import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { OutboxEvent, OutboxStatus } from './entities/outbox-event.entity';
import { OutboxRelayService } from './outbox-relay.service';

describe('OutboxRelayService', () => {
  let queue: { add: jest.Mock };
  let redis: { status: string };
  let queryBuilder: Record<string, jest.Mock>;
  let manager: { createQueryBuilder: jest.Mock; save: jest.Mock };
  let service: OutboxRelayService;

  const pendingEvent = (overrides: Partial<OutboxEvent> = {}) =>
    ({
      id: 'event-1',
      correlationId: 'corr-1',
      eventType: 'BID_PLACED',
      payload: { auctionId: 'a1' },
      status: OutboxStatus.PENDING,
      retryCount: 0,
      ...overrides,
    }) as OutboxEvent;

  beforeEach(() => {
    queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    manager = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(),
    };
    queue = {
      add: jest.fn().mockResolvedValue({}),
    };
    redis = { status: 'ready' };
    const dataSource = {
      transaction: jest.fn((work: (m: typeof manager) => Promise<void>) =>
        work(manager),
      ),
    };
    service = new OutboxRelayService(
      dataSource as unknown as DataSource,
      queue as unknown as Queue,
      redis as unknown as Redis,
    );
  });

  it('khóa bằng SKIP LOCKED và đẩy job với jobId = outbox.id', async () => {
    const event = pendingEvent();
    queryBuilder.getMany.mockResolvedValue([event]);

    await service.relayPendingEvents();

    expect(queryBuilder.setOnLocked).toHaveBeenCalledWith('skip_locked');
    expect(queue.add).toHaveBeenCalledWith(
      'BID_PLACED',
      { correlationId: 'corr-1', payload: { auctionId: 'a1' } },
      { jobId: 'event-1' },
    );
    expect(event.status).toBe(OutboxStatus.PUBLISHED);
    expect(event.processedAt).toBeInstanceOf(Date);
    expect(manager.save).toHaveBeenCalledWith(OutboxEvent, [event]);
  });

  it('đẩy lỗi thì giữ PENDING và tăng retry_count', async () => {
    const event = pendingEvent();
    queryBuilder.getMany.mockResolvedValue([event]);
    queue.add.mockRejectedValue(new Error('boom'));

    await service.relayPendingEvents();

    expect(event.status).toBe(OutboxStatus.PENDING);
    expect(event.retryCount).toBe(1);
  });

  it('hết số lần retry thì chuyển FAILED', async () => {
    const event = pendingEvent({ retryCount: 4 });
    queryBuilder.getMany.mockResolvedValue([event]);
    queue.add.mockRejectedValue(new Error('boom'));

    await service.relayPendingEvents();

    expect(event.status).toBe(OutboxStatus.FAILED);
  });

  it('Redis mất kết nối thì bỏ qua lượt quét, không tốn retry', async () => {
    redis.status = 'reconnecting';

    await service.relayPendingEvents();

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('không chồng lượt quét khi lượt trước chưa xong', async () => {
    let finish: (events: OutboxEvent[]) => void = () => undefined;
    queryBuilder.getMany.mockReturnValue(
      new Promise<OutboxEvent[]>((resolve) => {
        finish = resolve;
      }),
    );

    const first = service.relayPendingEvents();
    await new Promise((resolve) => setImmediate(resolve));
    await service.relayPendingEvents();
    finish([]);
    await first;

    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});
