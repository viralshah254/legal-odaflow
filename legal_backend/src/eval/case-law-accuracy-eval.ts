export type CaseLawVerificationStatus = 'verified' | 'failed' | 'unavailable';
export type CaseLawTreatmentStatus =
  | 'good_law'
  | 'adverse'
  | 'overruled'
  | 'unknown';
export type CaseLawCheckStatus = 'pass' | 'fail' | 'indeterminate';

export type CaseLawAccuracyBlocker =
  | 'UNREGISTERED_CITATION'
  | 'IDENTITY_NOT_VERIFIED'
  | 'SAME_NAME_COLLISION_UNRESOLVED'
  | 'MATERIAL_EVIDENCE_MISSING'
  | 'HOLDING_NOT_SUPPORTED'
  | 'METADATA_INCOMPLETE'
  | 'PINPOINT_MISSING'
  | 'PINPOINT_UNVERIFIED'
  | 'ADVERSE_TREATMENT'
  | 'UNKNOWN_TREATMENT'
  | 'VERIFICATION_FAILED'
  | 'VERIFICATION_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'SNAPSHOT_STALE'
  | 'CACHE_STALE';

export interface CaseLawAccuracyObservation {
  id: string;
  domain: string;
  citation: string;
  citationRegistered: boolean;
  identityStatus: CaseLawCheckStatus;
  /** Candidate identities sharing the selected authority's normalized case name. */
  sameNameCandidateIds?: string[];
  selectedIdentityId?: string | null;
  propositionMaterial: boolean;
  claimedHolding?: string | null;
  evidenceText?: string | null;
  title?: string | null;
  court?: string | null;
  decisionDate?: string | Date | null;
  pinpoint?: string | null;
  pinpointStatus?: CaseLawCheckStatus;
  treatmentStatus: CaseLawTreatmentStatus;
  verificationStatus: CaseLawVerificationStatus;
  configuredProviders?: string[];
  successfulProviders?: string[];
  snapshotCapturedAt?: string | Date | null;
  snapshotMaxAgeMs?: number;
  cacheCreatedAt?: string | Date | null;
  cacheMaxAgeMs?: number;
}

export interface CaseLawAccuracyAssessment {
  id: string;
  domain: string;
  releasable: boolean;
  blockers: CaseLawAccuracyBlocker[];
}

export interface CaseLawAccuracyHealth {
  samples: number;
  releasableRate: number;
  registeredCitationRate: number;
  materiallySupportedRate: number;
  verifiedPinpointRate: number;
  goodLawRate: number;
  verificationAvailableRate: number;
  providerHealthyRate: number;
  freshSnapshotRate: number;
  freshCacheRate: number;
  blockerFrequency: Partial<Record<CaseLawAccuracyBlocker, number>>;
  byDomain: Record<string, { samples: number; releasable: number }>;
}

function normalized(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasFullDate(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (!value?.trim()) return false;
  return /^\d{4}-\d{2}-\d{2}(?:t.*)?$/i.test(value.trim()) ||
    /^\d{1,2}\s+[a-z]+\s+\d{4}$/i.test(value.trim());
}

function isFresh(
  timestamp: string | Date | null | undefined,
  maxAgeMs: number | undefined,
  nowMs: number,
): boolean {
  if (maxAgeMs === undefined) return true;
  if (!timestamp || maxAgeMs < 0) return false;
  const capturedMs =
    timestamp instanceof Date ? timestamp.getTime() : Date.parse(timestamp);
  return Number.isFinite(capturedMs) && capturedMs <= nowMs && nowMs - capturedMs <= maxAgeMs;
}

function hasUnresolvedSameNameCollision(
  observation: CaseLawAccuracyObservation,
): boolean {
  const candidates = new Set(observation.sameNameCandidateIds ?? []);
  if (candidates.size <= 1) return false;
  return (
    !observation.selectedIdentityId ||
    !candidates.has(observation.selectedIdentityId)
  );
}

/**
 * Fail-closed deterministic release policy for case-law output.
 *
 * This helper deliberately has no connector dependencies, so provider outages,
 * stale data, and verifier failures can be exercised in release tests without
 * mocking or changing retrieval implementations.
 */
export function assessCaseLawAccuracy(
  observation: CaseLawAccuracyObservation,
  now: Date = new Date(),
): CaseLawAccuracyAssessment {
  const blockers = new Set<CaseLawAccuracyBlocker>();
  const evidence = normalized(observation.evidenceText);
  const holding = normalized(observation.claimedHolding);

  if (!observation.citationRegistered) blockers.add('UNREGISTERED_CITATION');
  if (observation.identityStatus !== 'pass') blockers.add('IDENTITY_NOT_VERIFIED');
  if (hasUnresolvedSameNameCollision(observation)) {
    blockers.add('SAME_NAME_COLLISION_UNRESOLVED');
  }
  if (observation.propositionMaterial && !evidence) {
    blockers.add('MATERIAL_EVIDENCE_MISSING');
  }
  if (observation.propositionMaterial && holding && (!evidence || !evidence.includes(holding))) {
    blockers.add('HOLDING_NOT_SUPPORTED');
  }
  if (
    !observation.title?.trim() ||
    !observation.court?.trim() ||
    !hasFullDate(observation.decisionDate) ||
    !observation.citation.trim()
  ) {
    blockers.add('METADATA_INCOMPLETE');
  }
  if (!observation.pinpoint?.trim()) blockers.add('PINPOINT_MISSING');
  else if (observation.pinpointStatus !== 'pass') blockers.add('PINPOINT_UNVERIFIED');

  if (
    observation.treatmentStatus === 'adverse' ||
    observation.treatmentStatus === 'overruled'
  ) {
    blockers.add('ADVERSE_TREATMENT');
  } else if (observation.treatmentStatus === 'unknown') {
    blockers.add('UNKNOWN_TREATMENT');
  }

  if (observation.verificationStatus === 'failed') {
    blockers.add('VERIFICATION_FAILED');
  } else if (observation.verificationStatus === 'unavailable') {
    blockers.add('VERIFICATION_UNAVAILABLE');
  }

  const configuredProviders = observation.configuredProviders ?? [];
  const successfulProviders = new Set(observation.successfulProviders ?? []);
  if (
    configuredProviders.length === 0 ||
    !configuredProviders.some((provider) => successfulProviders.has(provider))
  ) {
    blockers.add('PROVIDER_UNAVAILABLE');
  }

  const nowMs = now.getTime();
  if (
    !isFresh(
      observation.snapshotCapturedAt,
      observation.snapshotMaxAgeMs,
      nowMs,
    )
  ) {
    blockers.add('SNAPSHOT_STALE');
  }
  if (!isFresh(observation.cacheCreatedAt, observation.cacheMaxAgeMs, nowMs)) {
    blockers.add('CACHE_STALE');
  }

  return {
    id: observation.id,
    domain: observation.domain,
    releasable: blockers.size === 0,
    blockers: [...blockers],
  };
}

function rate(values: boolean[]): number {
  if (values.length === 0) return 0;
  return Number(
    (values.filter(Boolean).length / values.length).toFixed(4),
  );
}

export function computeCaseLawAccuracyHealth(
  observations: CaseLawAccuracyObservation[],
  now: Date = new Date(),
): CaseLawAccuracyHealth {
  const assessments = observations.map((observation) =>
    assessCaseLawAccuracy(observation, now),
  );
  const blockerFrequency: CaseLawAccuracyHealth['blockerFrequency'] = {};
  const byDomain: CaseLawAccuracyHealth['byDomain'] = {};

  for (const assessment of assessments) {
    for (const blocker of assessment.blockers) {
      blockerFrequency[blocker] = (blockerFrequency[blocker] ?? 0) + 1;
    }
    const domain = byDomain[assessment.domain] ?? { samples: 0, releasable: 0 };
    domain.samples += 1;
    if (assessment.releasable) domain.releasable += 1;
    byDomain[assessment.domain] = domain;
  }

  return {
    samples: observations.length,
    releasableRate: rate(assessments.map((assessment) => assessment.releasable)),
    registeredCitationRate: rate(
      observations.map((observation) => observation.citationRegistered),
    ),
    materiallySupportedRate: rate(
      observations.map(
        (observation) =>
          !observation.propositionMaterial ||
          (Boolean(normalized(observation.evidenceText)) &&
            (!normalized(observation.claimedHolding) ||
              normalized(observation.evidenceText).includes(
                normalized(observation.claimedHolding),
              ))),
      ),
    ),
    verifiedPinpointRate: rate(
      observations.map(
        (observation) =>
          Boolean(observation.pinpoint?.trim()) &&
          observation.pinpointStatus === 'pass',
      ),
    ),
    goodLawRate: rate(
      observations.map(
        (observation) => observation.treatmentStatus === 'good_law',
      ),
    ),
    verificationAvailableRate: rate(
      observations.map(
        (observation) => observation.verificationStatus !== 'unavailable',
      ),
    ),
    providerHealthyRate: rate(
      observations.map((observation) => {
        const successful = new Set(observation.successfulProviders ?? []);
        return (
          (observation.configuredProviders?.length ?? 0) > 0 &&
          (observation.configuredProviders ?? []).some((provider) =>
            successful.has(provider),
          )
        );
      }),
    ),
    freshSnapshotRate: rate(
      observations.map((observation) =>
        isFresh(
          observation.snapshotCapturedAt,
          observation.snapshotMaxAgeMs,
          now.getTime(),
        ),
      ),
    ),
    freshCacheRate: rate(
      observations.map((observation) =>
        isFresh(
          observation.cacheCreatedAt,
          observation.cacheMaxAgeMs,
          now.getTime(),
        ),
      ),
    ),
    blockerFrequency,
    byDomain,
  };
}
