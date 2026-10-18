import { Injectable } from '@nestjs/common';
import { DRAFT_KIND_PLAYBOOKS } from './draft-kind-playbook.registry';
import {
  resolveDraftReadinessPolicy,
  validateDraftReadinessPolicies,
} from './draft-readiness-policy';
import { KIND_ALIASES, type DraftKindPlaybook } from './draft-kind-playbook.types';

@Injectable()
export class DraftKindPlaybookService {
  constructor() {
    const errors = validateDraftReadinessPolicies();
    if (errors.length > 0) {
      throw new Error(`Invalid drafting readiness policy:\n${errors.join('\n')}`);
    }
  }

  resolve(kind: string): DraftKindPlaybook {
    return resolveDraftReadinessPolicy(kind);
  }

  isFilingGrade(kind: string): boolean {
    return this.resolve(kind).filingGrade;
  }

  /** Taxonomy key for planning engines (aliases BNSS-specific kinds). */
  taxonomyKey(kind: string): string {
    return KIND_ALIASES[kind] ?? kind;
  }

  list(): DraftKindPlaybook[] {
    return DRAFT_KIND_PLAYBOOKS;
  }
}
