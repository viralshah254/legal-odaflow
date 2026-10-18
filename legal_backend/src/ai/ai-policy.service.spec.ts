import { AiPolicyService } from './ai-policy.service';

describe('AiPolicyService.checkBudgetBeforeTask', () => {
  it('skips default USD per-task cap when charge mode is token_based (credits gate spend)', async () => {
    const configService = {
      get: (key: string, fallback?: string) => {
        if (key === 'AI_CHARGE_MODE') return 'token_based';
        if (key === 'AI_DEFAULT_MAX_TASK_COST_USD') return '0.25';
        return fallback;
      },
    };
    const prisma = { aIBudgetPolicy: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AiPolicyService(configService as never, prisma as never);

    const result = await service.checkBudgetBeforeTask('t1', 'u1', 0.2825);
    expect(result.allowed).toBe(true);
  });

  it('enforces USD per-task cap in flat charge mode', async () => {
    const configService = {
      get: (key: string, fallback?: string) => {
        if (key === 'AI_CHARGE_MODE') return 'flat';
        if (key === 'AI_DEFAULT_MAX_TASK_COST_USD') return '0.25';
        return fallback;
      },
    };
    const prisma = { aIBudgetPolicy: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AiPolicyService(configService as never, prisma as never);

    const result = await service.checkBudgetBeforeTask('t1', 'u1', 0.2825);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/exceeds max per-task budget/);
  });

  it('ignores tenant maxCostPerTaskUsd in token_based mode (credits gate spend)', async () => {
    const configService = {
      get: (key: string, fallback?: string) => {
        if (key === 'AI_CHARGE_MODE') return 'token_based';
        return fallback;
      },
    };
    const prisma = {
      aIBudgetPolicy: {
        findFirst: jest.fn().mockResolvedValue({ maxCostPerTaskUsd: 0.1 }),
      },
    };
    const service = new AiPolicyService(configService as never, prisma as never);

    const result = await service.checkBudgetBeforeTask('t1', 'u1', 0.2825);
    expect(result.allowed).toBe(true);
    expect(prisma.aIBudgetPolicy.findFirst).not.toHaveBeenCalled();
  });

  it('honors tenant maxCostPerTaskUsd in flat charge mode', async () => {
    const configService = {
      get: (key: string, fallback?: string) => {
        if (key === 'AI_CHARGE_MODE') return 'flat';
        if (key === 'AI_DEFAULT_MAX_TASK_COST_USD') return '2';
        return fallback;
      },
    };
    const prisma = {
      aIBudgetPolicy: {
        findFirst: jest.fn().mockResolvedValue({ maxCostPerTaskUsd: 0.1 }),
      },
    };
    const service = new AiPolicyService(configService as never, prisma as never);

    const result = await service.checkBudgetBeforeTask('t1', 'u1', 0.2825);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/tenant budget policy/);
  });
});
