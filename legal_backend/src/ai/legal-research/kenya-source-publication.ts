import type { PublicationState, VerificationFinding } from '@/ai/verification/verification-finding.types';

/** Source checking is distinct from Kenya's separately gated reliance certification. */
export function kenyaSourcePublication(input: {
  state: PublicationState;
  citations: unknown;
  findings: VerificationFinding[];
  rejectedCount: number;
  unsupportedCount: number;
}): PublicationState {
  if (['DRAFT_NOT_VERIFIED', 'VERIFICATION_UNAVAILABLE'].includes(input.state)) return input.state;
  const sourceChecked = Array.isArray(input.citations) && input.citations.length > 0 &&
    input.citations.every(c => c !== null && typeof c === 'object' && (c.sourceVerified === true || c.verified === true));
  const materialFailure = input.findings.some(f => ['HIGH', 'BLOCKER'].includes(f.severity) && f.state !== 'PASS' && f.state !== 'NOT_APPLICABLE');
  return sourceChecked && !materialFailure && input.rejectedCount === 0 && input.unsupportedCount === 0
    ? 'VERIFIED_WITH_LIMITATIONS' : 'DRAFT_NOT_VERIFIED';
}
