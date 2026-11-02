import { Module } from '@nestjs/common';

/**
 * Module rỗng (commit khung) — sẽ chứa Transactional Outbox + relay worker ở GP3.
 */
@Module({})
export class OutboxModule {}
