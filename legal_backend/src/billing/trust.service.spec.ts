import { BadRequestException } from '@nestjs/common';
import { TrustService } from './invoices.service';

describe('TrustService', () => {
  it('blocks approval that would make trust negative', async () => {
    const prisma = {
      trustLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'entry_1',
          accountId: 'acct_1',
          status: 'PENDING',
          amount: 150,
          description: 'Disbursement pending',
          account: {
            id: 'acct_1',
            tenantId: 'tenant_1',
            balance: 100,
          },
        }),
      },
      $transaction: jest.fn(),
    } as any;

    const service = new TrustService(prisma);

    await expect(
      service.approveEntry('tenant_1', 'entry_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
