import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DepositGuard } from './deposit.guard';
import { DepositsService } from './deposits.service';

describe('DepositGuard', () => {
  let guard: DepositGuard;
  let depositsService: { hasActiveDeposit: jest.Mock };

  beforeEach(() => {
    depositsService = {
      hasActiveDeposit: jest.fn(),
    };
    guard = new DepositGuard(depositsService as unknown as DepositsService);
  });

  const createMockContext = (userId?: string, auctionId?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
          params: { auctionId },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access if user has active HELD deposit', async () => {
    depositsService.hasActiveDeposit.mockResolvedValue(true);
    const context = createMockContext('user-1', 'auc-1');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(depositsService.hasActiveDeposit).toHaveBeenCalledWith('auc-1', 'user-1');
  });

  it('throws ForbiddenException if user has not deposited', async () => {
    depositsService.hasActiveDeposit.mockResolvedValue(false);
    const context = createMockContext('user-1', 'auc-1');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException if user or auctionId is missing', async () => {
    const context = createMockContext(undefined, 'auc-1');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
