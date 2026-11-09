import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AICreditLedgerService } from '../../src/ai-credits/ai-credit-ledger.service';

const localDb = process.env.RUN_LOCAL_DB_TESTS === 'true' ? describe : describe.skip;
localDb('Real PostgreSQL credit wallet concurrency', () => {
  let prisma: PrismaClient;
  let ledger: AICreditLedgerService;
  const tenantId = `local-credit-test-${randomUUID()}`;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/umbrella_execution')) {
      throw new Error('This suite is restricted to an isolated local umbrella_execution database');
    }
    prisma = new PrismaClient();
    ledger = new AICreditLedgerService(prisma as any, { publishToTenant: () => undefined } as any);
    await prisma.tenant.create({ data: { id: tenantId, name: 'LOCAL TEST ONLY', primaryCountry: 'KE', defaultCurrency: 'KES' } });
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.$disconnect();
    }
  });

  it('permits only funded competing debits and keeps the wallet and ledger consistent', async () => {
    await ledger.credit({ tenantId, credits: 10, taskType: 'LOCAL_TEST_GRANT' });
    const settled = await Promise.allSettled(Array.from({ length: 20 }, () => ledger.assertAndDebit({ tenantId, credits: 1, taskType: 'LOCAL_TEST_SPEND' })));
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(10);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })).aiCreditsRemaining).toBe(0);
    expect(await ledger.getLedgerBalance({ tenantId })).toBe(0);
    expect(await prisma.aICreditLedger.count({ where: { tenantId, eventType: 'DEBIT' } })).toBe(10);
  }, 30_000);

  it('rolls back the wallet mutation if the ledger write fails', async () => {
    await ledger.credit({ tenantId, credits: 2, taskType: 'LOCAL_TEST_GRANT' });
    await expect(ledger.assertAndDebit({ tenantId, userId: 'missing-user-fk', credits: 1, taskType: 'LOCAL_TEST_ROLLBACK' })).rejects.toThrow();
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })).aiCreditsRemaining).toBe(2);
    expect(await ledger.getLedgerBalance({ tenantId })).toBe(2);
  });
});
