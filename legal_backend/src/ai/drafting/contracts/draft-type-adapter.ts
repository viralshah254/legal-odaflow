/** DraftTypeAdapter — document-vertical interface */

import type { CaseRecord } from './case-record';
import type { DraftPlaybook } from './draft-playbook';
import type { IssuePlan } from './issue-plan';
import type { StructuredDraft } from './structured-draft';
import type { GateFinding, ValidationResult } from './release-gate';

export interface DraftTypeAdapter {
  documentKind: string;
  /** Additional kinds this adapter handles (aliases). */
  aliases?: string[];

  validateIntake(
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): ValidationResult;

  buildIssuePlan(
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): IssuePlan;

  validateDraft(
    draft: StructuredDraft,
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): GateFinding[];

  validatePrayer(
    draft: StructuredDraft,
    caseRecord: CaseRecord,
  ): GateFinding[];

  validateVerification(draft: StructuredDraft): GateFinding[];
}
