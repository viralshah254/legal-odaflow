import { AICreditLedgerService } from './ai-credit-ledger.service';

describe('atomic credit wallet settlement', () => {
  const setup = (available = true) => {
    const tx = {
      tenant: {
        updateMany: jest.fn().mockResolvedValue({ count: available ? 1 : 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ aiCreditsRemaining: 6 }),
      },
      aICreditLedger: { create: jest.fn().mockResolvedValue({ id: 'debit' }) },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AICreditLedgerService(prisma as any, { publishToTenant: jest.fn() } as any);
    return { service, tx };
  };

  it('conditionally decrements the tenant wallet and records its debit in the transaction', async () => {
    const { service, tx } = setup();
    const result = await service.assertAndDebit({ tenantId: 'firm', userId: 'lawyer', taskType: 'TEST', credits: 4 });
    expect(tx.tenant.updateMany).toHaveBeenCalledWith({
      where: { id: 'firm', aiCreditsRemaining: { gte: 4 } },
      data: { aiCreditsRemaining: { decrement: 4 } },
    });
    expect(tx.aICreditLedger.create).toHaveBeenCalledTimes(1);
    expect(result.balanceAfter).toBe(6);
  });

  it('does not record a debit when a competing spender has exhausted the wallet', async () => {
    const { service, tx } = setup(false);
    await expect(service.assertAndDebit({ tenantId: 'firm', taskType: 'TEST', credits: 4 })).rejects.toThrow('Insufficient');
    expect(tx.aICreditLedger.create).not.toHaveBeenCalled();
  });

  it('rejects negative charges before touching the wallet', async () => {
    const { service, tx } = setup();
    await expect(service.assertAndDebit({ tenantId: 'firm', taskType: 'TEST', credits: -1 })).rejects.toThrow();
    expect(tx.tenant.updateMany).not.toHaveBeenCalled();
  });
});
