import { TrainingConsentGateService } from './training-consent-gate.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    trainingConsent: { findMany: jest.fn().mockResolvedValue([]) },
    countryCompliancePolicy: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as never;
}

describe('TrainingConsentGateService', () => {
  it('only returns tenants with an un-withdrawn grant for the requested purpose', async () => {
    const prisma = makePrisma({
      trainingConsent: {
        findMany: jest.fn().mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }]),
      },
    });
    const gate = new TrainingConsentGateService(prisma);

    await expect(gate.consentedTenantIds('fineTuning')).resolves.toEqual(['t1', 't2']);
    expect((prisma as never as { trainingConsent: { findMany: jest.Mock } }).trainingConsent
      .findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consentStatus: 'GRANTED',
          withdrawnAt: null,
          canUseForFineTuning: true,
        }),
      }),
    );
  });

  it('excludes countries whose policy forbids training opt-in', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({
      trainingConsent: { findMany },
      countryCompliancePolicy: {
        findMany: jest.fn().mockResolvedValue([{ countryCode: 'de' }]),
      },
    });
    const gate = new TrainingConsentGateService(prisma);

    await gate.consentedTenantIds('promptImprove');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jurisdictionCountryCode: { notIn: ['DE'] },
        }),
      }),
    );
  });

  it('fails closed when the consent table cannot be read', async () => {
    const prisma = makePrisma({
      trainingConsent: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    });
    const gate = new TrainingConsentGateService(prisma);

    await expect(gate.consentedTenantIds('promptImprove')).resolves.toEqual([]);
    await expect(gate.isTenantConsented('t1', 'promptImprove')).resolves.toBe(false);
  });

  it('does not cache a failed lookup as a real answer', async () => {
    const findMany = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([{ tenantId: 't1' }]);
    const gate = new TrainingConsentGateService(makePrisma({ trainingConsent: { findMany } }));

    await expect(gate.consentedTenantIds('evaluation')).resolves.toEqual([]);
    await expect(gate.consentedTenantIds('evaluation')).resolves.toEqual(['t1']);
  });
});
