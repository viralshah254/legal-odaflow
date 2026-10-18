import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import type { DraftPlaybook, PlanningMode } from '../contracts/draft-playbook';
import type { IssuePlan } from '../contracts/issue-plan';
import type { DraftTypeAdapter } from '../contracts/draft-type-adapter';

/**
 * Generalized issue planning — delegates to adapter; enforces FactDisposition gate.
 */
@Injectable()
export class IssuePlanService {
  buildIssuePlan(
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
    adapter: DraftTypeAdapter,
  ): IssuePlan {
    // Ensure critical facts without materiality get a default for disposition gate
    for (const fact of caseRecord.facts) {
      if (!fact.materiality && fact.status === 'defence_version') {
        fact.materiality = 'critical';
      }
    }

    const plan = adapter.buildIssuePlan(caseRecord, playbook);
    caseRecord.factDispositions = plan.dispositions;

    if (plan.planningMode !== playbook.planningMode) {
      plan.planningMode = playbook.planningMode;
    }

    return plan;
  }

  assertModeSupported(mode: PlanningMode, playbook: DraftPlaybook): boolean {
    return playbook.planningMode === mode;
  }
}
