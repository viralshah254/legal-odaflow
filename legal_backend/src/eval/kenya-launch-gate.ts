export type KenyaRolloutStage =
  | 'SHADOW_INGESTION'
  | 'INTERNAL_RETRIEVAL'
  | 'ADVOCATE_EVALUATION'
  | 'VERIFIED_BETA'
  | 'DRAFTING_BETA'
  | 'GENERAL_AVAILABILITY';

export interface KenyaLaunchMetrics {
  corpusCoverage: number;
  freshnessSla: number;
  retrievalRecall: number;
  citationEntailment: number;
  lawInForceAccuracy: number;
  prospectiveAuthorityLeakage: number;
  sourceHealth: number;
  reviewBacklog: number;
  advocateApprovedBenchmarks: number;
}

const STAGE_THRESHOLDS: Record<
  KenyaRolloutStage,
  Partial<KenyaLaunchMetrics>
> = {
  SHADOW_INGESTION: { sourceHealth: 0.9, prospectiveAuthorityLeakage: 0 },
  INTERNAL_RETRIEVAL: {
    corpusCoverage: 0.8,
    freshnessSla: 0.9,
    sourceHealth: 0.95,
    prospectiveAuthorityLeakage: 0,
  },
  ADVOCATE_EVALUATION: {
    retrievalRecall: 0.8,
    citationEntailment: 0.95,
    lawInForceAccuracy: 0.95,
    prospectiveAuthorityLeakage: 0,
  },
  VERIFIED_BETA: {
    corpusCoverage: 0.9,
    freshnessSla: 0.95,
    retrievalRecall: 0.85,
    citationEntailment: 0.98,
    lawInForceAccuracy: 0.98,
    prospectiveAuthorityLeakage: 0,
    sourceHealth: 0.98,
    advocateApprovedBenchmarks: 0.8,
  },
  DRAFTING_BETA: {
    citationEntailment: 0.98,
    lawInForceAccuracy: 0.99,
    prospectiveAuthorityLeakage: 0,
    advocateApprovedBenchmarks: 0.9,
  },
  GENERAL_AVAILABILITY: {
    corpusCoverage: 0.95,
    freshnessSla: 0.98,
    retrievalRecall: 0.9,
    citationEntailment: 0.99,
    lawInForceAccuracy: 0.995,
    prospectiveAuthorityLeakage: 0,
    sourceHealth: 0.99,
    reviewBacklog: 100,
    advocateApprovedBenchmarks: 1,
  },
};

export function evaluateKenyaLaunchGate(
  stage: KenyaRolloutStage,
  metrics: KenyaLaunchMetrics,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const [metric, threshold] of Object.entries(STAGE_THRESHOLDS[stage]) as Array<
    [keyof KenyaLaunchMetrics, number]
  >) {
    const actual = metrics[metric];
    const isMaximum =
      metric === 'prospectiveAuthorityLeakage' || metric === 'reviewBacklog';
    if (isMaximum ? actual > threshold : actual < threshold) {
      failures.push(
        `${metric} ${actual} ${isMaximum ? 'exceeds maximum' : 'is below minimum'} ${threshold}`,
      );
    }
  }
  return { passed: failures.length === 0, failures };
}
