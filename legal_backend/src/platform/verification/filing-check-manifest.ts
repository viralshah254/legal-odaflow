export type FilingCheckState = 'PASS' | 'FAIL' | 'NOT_RUN' | 'INDETERMINATE';

export type FilingManifestComponent =
  | 'cause_title'
  | 'parties'
  | 'facts'
  | 'legal_grounds'
  | 'prayer'
  | 'verification'
  | 'formatting'
  | 'citations';

export interface FilingCheckDefinition {
  checkId: string;
  component: FilingManifestComponent;
  label: string;
}

/** Default India filing-grade manifest — extend per court profile later. */
export const DEFAULT_FILING_CHECK_MANIFEST: FilingCheckDefinition[] = [
  { checkId: 'manifest:cause_title', component: 'cause_title', label: 'Cause title' },
  { checkId: 'manifest:parties', component: 'parties', label: 'Parties' },
  { checkId: 'manifest:facts', component: 'facts', label: 'Facts' },
  { checkId: 'manifest:legal_grounds', component: 'legal_grounds', label: 'Legal grounds' },
  { checkId: 'manifest:prayer', component: 'prayer', label: 'Prayer' },
  { checkId: 'manifest:verification', component: 'verification', label: 'Verification' },
  { checkId: 'manifest:formatting', component: 'formatting', label: 'Formatting' },
  { checkId: 'manifest:citations', component: 'citations', label: 'Citations' },
];

const STATE_RANK: Record<FilingCheckState, number> = {
  NOT_RUN: 0,
  INDETERMINATE: 1,
  PASS: 2,
  FAIL: 3,
};

/** Monotonic merge: FAIL beats all; never downgrade a failure with a later PASS. */
export function mergeCheckState(current: FilingCheckState, next: FilingCheckState): FilingCheckState {
  return STATE_RANK[next] > STATE_RANK[current] ? next : current;
}

export function manifestCheckId(component: FilingManifestComponent): string {
  return `manifest:${component}`;
}
