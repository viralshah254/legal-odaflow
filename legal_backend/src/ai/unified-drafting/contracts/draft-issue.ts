import { createHash } from 'crypto';

export type DraftIssueCategory =
  | 'citation'
  | 'statute'
  | 'procedure'
  | 'fact'
  | 'logic'
  | 'structure'
  | 'format'
  | 'unsupported_proposition'
  | 'missing_input'
  | 'placeholder';

export type DraftIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DraftIssue {
  id: string;
  category: DraftIssueCategory;
  severity: DraftIssueSeverity;
  sectionId?: string;
  paragraphId?: string;
  message: string;
  suggestedCorrection?: string;
  sourceId?: string;
  repairableAutomatically: boolean;
  /** Service that produced this issue, e.g. 'CitationValidator' */
  validator: string;
  /**
   * Stable fingerprint so the same logical issue is never double-counted
   * after a targeted repair that only affected a different section.
   *
   * fingerprint = SHA-256(category + normalizedSectionId + normalizedMessage + sourceId)
   */
  fingerprint: string;
}

export function buildIssueFingerprint(
  category: DraftIssueCategory,
  sectionId: string | undefined,
  message: string,
  sourceId: string | undefined,
): string {
  const normalized = [
    category,
    (sectionId ?? '').toLowerCase().replace(/\s+/g, '_'),
    message.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120),
    sourceId ?? '',
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export interface DraftVerificationReport {
  jobId: string;
  verifiedAt: string;
  issues: DraftIssue[];
  certificationStatus: 'certified' | 'certified_with_warnings' | 'not_certified';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  repairableCount: number;
}

export function buildVerificationReport(
  jobId: string,
  issues: DraftIssue[],
): DraftVerificationReport {
  const deduped = deduplicateIssues(issues);
  const critical = deduped.filter((i) => i.severity === 'critical').length;
  const high = deduped.filter((i) => i.severity === 'high').length;
  const medium = deduped.filter((i) => i.severity === 'medium').length;
  const low = deduped.filter((i) => i.severity === 'low').length;

  let certificationStatus: DraftVerificationReport['certificationStatus'];
  if (critical > 0) {
    certificationStatus = 'not_certified';
  } else if (high > 0) {
    certificationStatus = 'not_certified';
  } else if (medium > 0 || low > 0) {
    certificationStatus = 'certified_with_warnings';
  } else {
    certificationStatus = 'certified';
  }

  return {
    jobId,
    verifiedAt: new Date().toISOString(),
    issues: deduped,
    certificationStatus,
    criticalCount: critical,
    highCount: high,
    mediumCount: medium,
    lowCount: low,
    repairableCount: deduped.filter((i) => i.repairableAutomatically).length,
  };
}

/** Remove issues with duplicate fingerprints — keep the highest severity instance. */
export function deduplicateIssues(issues: DraftIssue[]): DraftIssue[] {
  const severityOrder: DraftIssueSeverity[] = ['critical', 'high', 'medium', 'low'];
  const map = new Map<string, DraftIssue>();
  for (const issue of issues) {
    const existing = map.get(issue.fingerprint);
    if (!existing) {
      map.set(issue.fingerprint, issue);
    } else {
      if (severityOrder.indexOf(issue.severity) < severityOrder.indexOf(existing.severity)) {
        map.set(issue.fingerprint, issue);
      }
    }
  }
  return [...map.values()];
}
