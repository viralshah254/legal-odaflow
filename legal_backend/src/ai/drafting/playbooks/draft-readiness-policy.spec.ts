import { ALL_DOCUMENT_KINDS } from '@/config/templates/document-kinds';
import { getAuthorityRequirement } from '../draft-authority-requirements';
import { AuthorityRetrievalPlannerService } from '../platform/authority-retrieval-planner.service';
import { DraftPlaybookRegistryService } from '../platform/draft-playbook-registry.service';
import { DraftKindPlaybookService } from './draft-kind-playbook.service';
import {
  resolveDraftReadinessPolicy,
  validateDraftReadinessPolicies,
} from './draft-readiness-policy';

describe('universal drafting readiness policy', () => {
  it('resolves a valid policy and platform playbook for every catalog kind', () => {
    const legacy = new DraftKindPlaybookService();
    const platform = new DraftPlaybookRegistryService(legacy);

    expect(validateDraftReadinessPolicies()).toEqual([]);
    for (const kind of ALL_DOCUMENT_KINDS) {
      const policy = resolveDraftReadinessPolicy(kind);
      expect(policy.kind).toBeTruthy();
      expect(policy.requiredSections.length).toBeGreaterThan(0);
      expect(platform.tryGetPlaybook(kind)?.documentKind).toBeTruthy();
    }
  });

  it('uses the recovery playbook for all Order XXXVII aliases', () => {
    for (const kind of [
      'india_suit_recovery_cpc_37',
      'summary_suit_recovery',
      'money_recovery_suit',
      'india_civil_suit_money_recovery',
    ]) {
      const policy = resolveDraftReadinessPolicy(kind);
      const requirement = getAuthorityRequirement(kind);
      expect(policy.kind).toBe('india_suit_recovery_cpc_37');
      expect(policy.filingGrade).toBe(true);
      expect(policy.citationPolicy).toBe('case_law_required');
      expect(requirement.minVerifiedCases).toBe(2);
      expect(requirement.escalateOnShortfall).toBe(true);
    }
  });

  it('does not pad transactional documents with mandatory case law', () => {
    const agreement = resolveDraftReadinessPolicy('service_agreement');
    expect(agreement.filingGrade).toBe(false);
    expect(agreement.minVerifiedCaseAuthorities).toBe(0);
    expect(agreement.citationPolicy).toBe('none');
  });

  it('builds proposition-specific recovery retrieval without excluding recovery cases', () => {
    const plan = new AuthorityRetrievalPlannerService().buildPlan({
      documentKind: 'summary_suit_recovery',
      jurisdiction: 'IN',
      rawFacts: 'Unpaid invoices under a written contract; summary suit under Order XXXVII.',
    });
    expect(plan.legalIssues).toContain('order_37_maintainability');
    expect(plan.legalIssues).toContain('limitation');
    expect(plan.permittedStatutes).toContain('Commercial Courts Act');
    expect(plan.excludedDomains).not.toContain('banking_recovery');
  });
});
