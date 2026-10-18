import {
  assessCaseLawAccuracy,
  computeCaseLawAccuracyHealth,
  type CaseLawAccuracyObservation,
} from './case-law-accuracy-eval';

describe('case-law accuracy eval release policy', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');

  function healthy(
    overrides: Partial<CaseLawAccuracyObservation> = {},
  ): CaseLawAccuracyObservation {
    return {
      id: 'in-consumer-1',
      domain: 'IN_CONSUMER',
      citation: '(1995) 6 SCC 651',
      citationRegistered: true,
      identityStatus: 'pass',
      propositionMaterial: true,
      claimedHolding: 'medical services are covered by consumer law',
      evidenceText:
        'The Court held that medical services are covered by consumer law.',
      title: 'Indian Medical Association v. V.P. Shantha',
      court: 'Supreme Court of India',
      decisionDate: '1995-11-13',
      pinpoint: '¶ 55',
      pinpointStatus: 'pass',
      treatmentStatus: 'good_law',
      verificationStatus: 'verified',
      configuredProviders: ['escr', 'licensed'],
      successfulProviders: ['escr'],
      snapshotCapturedAt: '2026-07-26T10:00:00.000Z',
      snapshotMaxAgeMs: 24 * 60 * 60 * 1000,
      cacheCreatedAt: '2026-07-26T11:00:00.000Z',
      cacheMaxAgeMs: 6 * 60 * 60 * 1000,
      ...overrides,
    };
  }

  it('releases only a registered, supported, current and fully verified case', () => {
    expect(assessCaseLawAccuracy(healthy(), now)).toEqual({
      id: 'in-consumer-1',
      domain: 'IN_CONSUMER',
      releasable: true,
      blockers: [],
    });
  });

  it.each([
    {
      name: 'invented Indian case',
      patch: {
        citation: '(2099) 99 SCC 99999',
        citationRegistered: false,
        identityStatus: 'fail' as const,
      },
      blockers: ['UNREGISTERED_CITATION', 'IDENTITY_NOT_VERIFIED'],
    },
    {
      name: 'wrong US section and holding',
      patch: {
        id: 'us-employment-wrong-section',
        domain: 'US_EMPLOYMENT',
        citation: '42 U.S.C. § 1983',
        claimedHolding: 'Title VII applies to employers with one employee',
        evidenceText: 'Title VII generally applies at the statutory employee threshold.',
      },
      blockers: ['HOLDING_NOT_SUPPORTED'],
    },
    {
      name: 'synthetic UK pinpoint',
      patch: {
        id: 'uk-contract-pinpoint',
        domain: 'UK_CONTRACT',
        pinpoint: '[9999]',
        pinpointStatus: 'fail' as const,
      },
      blockers: ['PINPOINT_UNVERIFIED'],
    },
    {
      name: 'same-name collision without identity selection',
      patch: {
        id: 'in-property-collision',
        domain: 'IN_PROPERTY',
        sameNameCandidateIds: ['sc-2012-suraj-lamp', 'dlhc-2011-suraj-lamp'],
        selectedIdentityId: null,
      },
      blockers: ['SAME_NAME_COLLISION_UNRESOLVED'],
    },
  ])('blocks $name', ({ patch, blockers }) => {
    const result = assessCaseLawAccuracy(healthy(patch), now);
    expect(result.releasable).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining(blockers));
  });

  it.each(['adverse', 'overruled'] as const)(
    'blocks %s treatment as adverse authority',
    (treatmentStatus) => {
      expect(
        assessCaseLawAccuracy(healthy({ treatmentStatus }), now).blockers,
      ).toContain('ADVERSE_TREATMENT');
    },
  );

  it('fails closed for unknown treatment and unavailable verification', () => {
    const result = assessCaseLawAccuracy(
      healthy({
        treatmentStatus: 'unknown',
        verificationStatus: 'unavailable',
      }),
      now,
    );

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'UNKNOWN_TREATMENT',
        'VERIFICATION_UNAVAILABLE',
      ]),
    );
  });

  it('distinguishes verifier failure from missing providers', () => {
    const verifierFailure = assessCaseLawAccuracy(
      healthy({ verificationStatus: 'failed' }),
      now,
    );
    const providerFailure = assessCaseLawAccuracy(
      healthy({ configuredProviders: ['escr'], successfulProviders: [] }),
      now,
    );

    expect(verifierFailure.blockers).toContain('VERIFICATION_FAILED');
    expect(providerFailure.blockers).toContain('PROVIDER_UNAVAILABLE');
  });

  it('blocks missing material evidence, metadata and pinpoints', () => {
    const result = assessCaseLawAccuracy(
      healthy({
        evidenceText: null,
        court: null,
        decisionDate: null,
        pinpoint: null,
      }),
      now,
    );

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'MATERIAL_EVIDENCE_MISSING',
        'HOLDING_NOT_SUPPORTED',
        'METADATA_INCOMPLETE',
        'PINPOINT_MISSING',
      ]),
    );
  });

  it('blocks stale snapshots and caches, including future-dated cache entries', () => {
    const stale = assessCaseLawAccuracy(
      healthy({
        snapshotCapturedAt: '2026-07-20T12:00:00.000Z',
        cacheCreatedAt: '2026-07-27T12:00:00.000Z',
      }),
      now,
    );

    expect(stale.blockers).toEqual(
      expect.arrayContaining(['SNAPSHOT_STALE', 'CACHE_STALE']),
    );
  });

  it('resolves same-name candidates only with an explicit candidate identity', () => {
    const result = assessCaseLawAccuracy(
      healthy({
        sameNameCandidateIds: ['case-a', 'case-b'],
        selectedIdentityId: 'case-b',
      }),
      now,
    );
    expect(result.blockers).not.toContain('SAME_NAME_COLLISION_UNRESOLVED');
  });

  it('publishes practical health rates and blocker frequencies by domain', () => {
    const observations = [
      healthy(),
      healthy({
        id: 'us-invented',
        domain: 'US_CONSTITUTIONAL',
        citationRegistered: false,
        identityStatus: 'fail',
        verificationStatus: 'unavailable',
        configuredProviders: [],
        successfulProviders: [],
      }),
      healthy({
        id: 'ke-stale',
        domain: 'KE_COMMERCIAL',
        snapshotCapturedAt: '2026-07-01T00:00:00.000Z',
        cacheCreatedAt: '2026-07-01T00:00:00.000Z',
      }),
    ];

    const health = computeCaseLawAccuracyHealth(observations, now);

    expect(health.samples).toBe(3);
    expect(health.releasableRate).toBe(0.3333);
    expect(health.registeredCitationRate).toBe(0.6667);
    expect(health.verificationAvailableRate).toBe(0.6667);
    expect(health.providerHealthyRate).toBe(0.6667);
    expect(health.freshSnapshotRate).toBe(0.6667);
    expect(health.freshCacheRate).toBe(0.6667);
    expect(health.blockerFrequency.UNREGISTERED_CITATION).toBe(1);
    expect(health.blockerFrequency.SNAPSHOT_STALE).toBe(1);
    expect(health.byDomain).toEqual({
      IN_CONSUMER: { samples: 1, releasable: 1 },
      US_CONSTITUTIONAL: { samples: 1, releasable: 0 },
      KE_COMMERCIAL: { samples: 1, releasable: 0 },
    });
  });

  it('returns explicit zero rates for an empty monitoring window', () => {
    expect(computeCaseLawAccuracyHealth([], now)).toMatchObject({
      samples: 0,
      releasableRate: 0,
      registeredCitationRate: 0,
      verificationAvailableRate: 0,
    });
  });
});
