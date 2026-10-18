import { ALL_DOCUMENT_KINDS } from '../../../config/templates/document-kinds';
import { DRAFT_KIND_PLAYBOOKS } from './draft-kind-playbook.registry';
import {
  KIND_ALIASES,
  type DraftArchetype,
  type DraftCitationPolicy,
  type DraftKindPlaybook,
  type PreferredCourtTier,
} from './draft-kind-playbook.types';

const REGISTERED_KINDS = new Set<string>(ALL_DOCUMENT_KINDS);

const NON_FILING_PATTERN =
  /agreement|contract|deed|letter|notice|resolution|minutes|checklist|policy|plan|undertaking|statement|schedule|cover|certificate|request|opinion|memo|brief|will|power_of_attorney|poa|form|declaration|handbook|term_sheet|note|report_instruction|disclosure_list/i;
const FILING_PATTERN =
  /plaint|suit|petition|appeal|revision|complaint|application|injunction|affidavit|claim|objection|reply|grounds|review|contempt|caveat|probate|administrative_review|judicial_review|particulars_of_claim|defence$/i;
const FACT_LED_FILING_PATTERN =
  /affidavit|declaration|bond|vakalatnama|memo_appearance|list_of_documents|financial_disclosure|surety|statement_of_truth|form_[a-z]|computation/i;
const RESEARCH_PATTERN = /research|opinion|advice|strategy|skeleton_argument|brief/i;

function inferArchetype(kind: string): DraftArchetype {
  if (/bail/i.test(kind)) return /anticipatory/i.test(kind) ? 'anticipatory_bail' : 'criminal_bail';
  if (/writ|judicial_review/i.test(kind)) return 'writ_hc';
  if (/slp|special_leave/i.test(kind)) return 'slp';
  if (/consumer/i.test(kind)) return 'consumer_complaint';
  if (/maintenance/i.test(kind)) return 'maintenance';
  if (/appeal/i.test(kind)) return 'appeal';
  if (/revision|review/i.test(kind)) return 'revision';
  if (/notice|demand_letter|cease_desist/i.test(kind)) return 'legal_notice';
  if (RESEARCH_PATTERN.test(kind)) return 'research_memo';
  if (/plaint|suit|claim|injunction/i.test(kind)) return 'civil_plaint';
  return 'generic_filing';
}

function inferFilingGrade(kind: string): boolean {
  if (NON_FILING_PATTERN.test(kind) && !FILING_PATTERN.test(kind)) return false;
  return FILING_PATTERN.test(kind);
}

function inferCitationPolicy(kind: string, filingGrade: boolean): DraftCitationPolicy {
  if (RESEARCH_PATTERN.test(kind)) return 'case_law_required';
  if (!filingGrade) return 'none';
  if (FACT_LED_FILING_PATTERN.test(kind)) return 'statutes_only';
  return 'case_law_when_material';
}

function inferRequiredTopics(kind: string): string[] {
  const ignored = new Set([
    'india',
    'general',
    'draft',
    'application',
    'petition',
    'complaint',
    'agreement',
    'legal',
    'court',
  ]);
  return [...new Set(kind.split('_').filter((token) => token.length > 2 && !ignored.has(token)))].slice(
    0,
    8,
  );
}

function inferRequiredSections(kind: string, filingGrade: boolean): string[] {
  if (RESEARCH_PATTERN.test(kind)) {
    return ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'];
  }
  if (filingGrade) return ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'];
  if (/agreement|contract|deed/i.test(kind)) {
    return ['PARTIES', 'BACKGROUND', 'TERMS', 'GOVERNING LAW', 'EXECUTION'];
  }
  return ['BACKGROUND', 'DETAILS', 'ACTION'];
}

function inferPartyLabel(kind: string): string {
  if (/plaint|suit|claim/i.test(kind)) return 'Plaintiff';
  if (/complaint/i.test(kind)) return 'Complainant';
  if (/appeal/i.test(kind)) return 'Appellant';
  if (/petition|application|revision|review/i.test(kind)) return 'Applicant';
  return 'Party';
}

function inferTier(kind: string): PreferredCourtTier {
  if (/supreme|_sc|slp|curative/i.test(kind)) return 'supreme';
  if (/high_court|_hc|writ|appeal|revision|review/i.test(kind)) return 'high';
  return 'any';
}

function withPolicyDefaults(playbook: DraftKindPlaybook): DraftKindPlaybook {
  const citationPolicy =
    playbook.citationPolicy ??
    (playbook.minVerifiedCaseAuthorities > 0
      ? 'case_law_required'
      : playbook.proceduralVehicles.length > 0
        ? 'statutes_only'
        : playbook.filingGrade
          ? 'case_law_when_material'
          : 'none');

  return {
    ...playbook,
    jurisdiction: playbook.jurisdiction ?? (playbook.kind.startsWith('india_') ? 'IN' : 'GLOBAL'),
    citationPolicy,
    requiredAuthorityTopics:
      playbook.requiredAuthorityTopics ??
      [...new Set([...playbook.requiredGroundTypes, ...playbook.proceduralVehicles])],
    preferredCourtTier: playbook.preferredCourtTier ?? inferTier(playbook.kind),
    escalateAuthorityShortfall:
      playbook.escalateAuthorityShortfall ??
      (citationPolicy === 'case_law_required' && playbook.minVerifiedCaseAuthorities > 0),
    permittedStatutes: playbook.permittedStatutes ?? playbook.proceduralVehicles,
    excludedAuthorityDomains: playbook.excludedAuthorityDomains ?? [],
  };
}

function synthesizePlaybook(kind: string): DraftKindPlaybook {
  const filingGrade = inferFilingGrade(kind);
  const citationPolicy = inferCitationPolicy(kind, filingGrade);
  const minVerifiedCaseAuthorities =
    citationPolicy === 'case_law_required' ? 2 : citationPolicy === 'case_law_when_material' ? 0 : 0;

  return withPolicyDefaults({
    kind,
    archetype: inferArchetype(kind),
    jurisdiction: kind.startsWith('india_') ? 'IN' : 'GLOBAL',
    filingGrade,
    partyLabel: inferPartyLabel(kind),
    requiredSections: inferRequiredSections(kind, filingGrade),
    minCitationsPerGround: citationPolicy === 'case_law_required' ? 1 : 0,
    minVerifiedCaseAuthorities,
    requiredGroundTypes: inferRequiredTopics(kind),
    proceduralVehicles: [],
    factCoverageThreshold: filingGrade ? 0.8 : 0.6,
    citationPolicy,
    requiredAuthorityTopics: inferRequiredTopics(kind),
    preferredCourtTier: inferTier(kind),
    escalateAuthorityShortfall: citationPolicy === 'case_law_required',
  });
}

/**
 * The single policy resolver used by drafting, retrieval, verification, and release gates.
 * Every catalog kind receives an explicit policy; specialized playbooks override synthesis.
 */
export function resolveDraftReadinessPolicy(kind: string): DraftKindPlaybook {
  const normalized = (kind ?? '').trim() || 'generic_filing';
  const aliased = KIND_ALIASES[normalized] ?? normalized;
  const configured =
    DRAFT_KIND_PLAYBOOKS.find((playbook) => playbook.kind === normalized) ??
    DRAFT_KIND_PLAYBOOKS.find((playbook) => playbook.kind === aliased);
  if (configured) return withPolicyDefaults(configured);
  return synthesizePlaybook(REGISTERED_KINDS.has(normalized) ? normalized : aliased);
}

export function validateDraftReadinessPolicies(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const playbook of DRAFT_KIND_PLAYBOOKS) {
    if (seen.has(playbook.kind)) errors.push(`Duplicate playbook kind: ${playbook.kind}`);
    seen.add(playbook.kind);
  }

  for (const kind of ALL_DOCUMENT_KINDS) {
    const policy = resolveDraftReadinessPolicy(kind);
    if (!policy.requiredSections.length) errors.push(`${kind}: no required sections`);
    if (policy.factCoverageThreshold <= 0 || policy.factCoverageThreshold > 1) {
      errors.push(`${kind}: invalid fact coverage threshold`);
    }
    if (
      policy.citationPolicy === 'none' &&
      (policy.minVerifiedCaseAuthorities > 0 || policy.minCitationsPerGround > 0)
    ) {
      errors.push(`${kind}: citation-free policy has mandatory case-law counts`);
    }
    if (
      policy.citationPolicy === 'case_law_required' &&
      policy.minVerifiedCaseAuthorities < 1
    ) {
      errors.push(`${kind}: case-law-required policy has no verified-case minimum`);
    }
  }

  return errors;
}
