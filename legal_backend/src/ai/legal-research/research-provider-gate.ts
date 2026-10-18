import type { ConnectorSearchStatus } from '@/legal-sources/connectors/connector-outcome.types';

/** Statuses that mean live case-law search cannot succeed this run. */
export const CASE_LAW_PROVIDER_FAILURE_STATUSES = new Set<string>([
  'not_configured',
  'timeout',
  'rate_limited',
  'unauthorized',
  'circuit_open',
  'error',
]);

export function isCaseLawProviderFailureStatus(
  status?: string | null,
): status is ConnectorSearchStatus {
  return CASE_LAW_PROVIDER_FAILURE_STATUSES.has(status ?? '');
}

const IK_PROVIDER_RE = /india-kanoon|india-live|india-kanoon-targeted/i;
const TAVILY_PROVIDER_RE = /tavily/i;

const FAILURE_PRIORITY: ConnectorSearchStatus[] = [
  'unauthorized',
  'circuit_open',
  'rate_limited',
  'timeout',
  'error',
  'not_configured',
];

/**
 * Infer a single case-law search status from connector diagnostics (earliest hard failure wins).
 */
export function inferCaseLawStatusFromDiagnostics(
  diagnostics: Array<{ provider?: string; status?: string }> | undefined | null,
): ConnectorSearchStatus | undefined {
  const ik = (diagnostics ?? []).filter((d) => IK_PROVIDER_RE.test(d.provider ?? ''));
  if (ik.length === 0) return undefined;
  for (const status of FAILURE_PRIORITY) {
    if (ik.some((d) => d.status === status)) return status;
  }
  if (ik.some((d) => d.status === 'searched')) return 'searched';
  if (ik.some((d) => d.status === 'no_hits')) return 'no_hits';
  const last = ik[ik.length - 1]?.status;
  return last as ConnectorSearchStatus | undefined;
}

export function isTavilyFailedInDiagnostics(
  diagnostics: Array<{ provider?: string; status?: string }> | undefined | null,
): boolean {
  return (diagnostics ?? []).some(
    (d) =>
      TAVILY_PROVIDER_RE.test(d.provider ?? '') &&
      (d.status === 'error' ||
        d.status === 'circuit_open' ||
        d.status === 'unauthorized' ||
        d.status === 'rate_limited'),
  );
}

/** True when further case-gap retrieval cannot succeed. */
export function shouldSkipCaseLawCoverageRetries(input: {
  caseLawSearchStatus?: string | null;
  indiaKanoonCircuitOpen?: boolean;
}): boolean {
  if (input.indiaKanoonCircuitOpen) return true;
  return isCaseLawProviderFailureStatus(input.caseLawSearchStatus);
}
