/** Generalized issue planning across PlanningModes */

import type { FactDisposition, FactDispositionKind } from './case-record';
import type { PlanningMode } from './draft-playbook';

export interface IssuePlanItem {
  id: string;
  label: string;
  mode: PlanningMode;
  required: boolean;
  supportingFactIds: string[];
  supportingAuthorityHints?: string[];
  playbookIssueId?: string;
  notes?: string;
}

export interface PleadingResponse {
  pleadingParagraph: string;
  response:
    | 'admitted'
    | 'denied'
    | 'not_admitted'
    | 'partly_admitted'
    | 'matter_of_record'
    | 'no_knowledge';
  supportingFactIds: string[];
  explanation?: string;
}

export interface IssuePlan {
  id: string;
  caseRecordId: string;
  caseRecordVersion: number;
  playbookId: string;
  playbookVersion: string;
  planningMode: PlanningMode;
  items: IssuePlanItem[];
  dispositions: FactDisposition[];
  pleadingResponses?: PleadingResponse[];
  blocked: boolean;
  blockReasons: string[];
  createdAt: string;
}

export function dispositionBlocksGeneration(
  dispositions: FactDisposition[],
  criticalFactIds: string[],
): string[] {
  const reasons: string[] = [];
  const byFact = new Map(dispositions.map((d) => [d.factId, d]));
  for (const factId of criticalFactIds) {
    const d = byFact.get(factId);
    if (!d) {
      reasons.push(`Critical fact ${factId} has no disposition`);
      continue;
    }
    if (d.disposition === 'requires_clarification') {
      reasons.push(`Critical fact ${factId} requires clarification: ${d.reason}`);
    }
    if (d.disposition === 'omit_as_legally_irrelevant' && !d.reason?.trim()) {
      reasons.push(`Critical fact ${factId} omitted without legal reason`);
    }
  }
  return reasons;
}

export type { FactDisposition, FactDispositionKind };
