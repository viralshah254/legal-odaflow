/**
 * Golden-set accuracy metrics for filing-grade draft evaluation.
 * Launch thresholds from Universal Draft Accuracy plan.
 */

export interface GoldenSetMetrics {
  partyAccuracy: number;
  dateAccuracy: number;
  amountAccuracy: number;
  knownFactCoverage: number;
  disputedFactQualificationRate: number;
  sectionAccuracy: number;
  forumAccuracy: number;
  prayerAlignment: number;
  citationPrecision: number;
  adverseFactCoverage: number;
  unsupportedClaimRate: number;
  blockerEscapeRate: number;
  provenanceManifestRate: number;
  redBlockerExportBlockRate: number;
  latencyMsP50?: number;
  regenerationSuccessRate?: number;
}

export const LAUNCH_THRESHOLDS: Partial<GoldenSetMetrics> = {
  /** Zero critical party/date/amount corruption → accuracy 1.0 */
  partyAccuracy: 1,
  dateAccuracy: 1,
  amountAccuracy: 1,
  /** Zero wrong-document-kind / wrong-section / known-critical-blank / unsupported-conclusive escapes */
  blockerEscapeRate: 0,
  unsupportedClaimRate: 0,
  provenanceManifestRate: 1,
  redBlockerExportBlockRate: 1,
};

export function meetsLaunchThresholds(m: GoldenSetMetrics): boolean {
  return (
    m.partyAccuracy >= (LAUNCH_THRESHOLDS.partyAccuracy ?? 1) &&
    m.dateAccuracy >= (LAUNCH_THRESHOLDS.dateAccuracy ?? 1) &&
    m.amountAccuracy >= (LAUNCH_THRESHOLDS.amountAccuracy ?? 1) &&
    m.blockerEscapeRate <= (LAUNCH_THRESHOLDS.blockerEscapeRate ?? 0) &&
    m.unsupportedClaimRate <= (LAUNCH_THRESHOLDS.unsupportedClaimRate ?? 0) &&
    m.provenanceManifestRate >= (LAUNCH_THRESHOLDS.provenanceManifestRate ?? 1) &&
    m.redBlockerExportBlockRate >= (LAUNCH_THRESHOLDS.redBlockerExportBlockRate ?? 1)
  );
}
