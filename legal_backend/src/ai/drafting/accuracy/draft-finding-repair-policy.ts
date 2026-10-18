import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import type { DraftFindingRepairPolicy, DraftFindingResolutionType } from './draft-repair.types';

type PolicyInput = Partial<Omit<DraftFindingRepairPolicy, 'code'>> & {
  resolutionType: DraftFindingResolutionType;
};

function policy(
  code: string,
  resolutionType: DraftFindingResolutionType,
  overrides: Partial<Omit<DraftFindingRepairPolicy, 'code' | 'resolutionType'>> = {},
): DraftFindingRepairPolicy {
  return {
    code,
    resolutionType,
    maxAttempts: overrides.maxAttempts ?? (resolutionType === 'automatic' ? 2 : 1),
    requiresCaseRecord: overrides.requiresCaseRecord ?? true,
    requiresPlaybook: overrides.requiresPlaybook ?? false,
    requiresCourtProfile: overrides.requiresCourtProfile ?? false,
    requiresVerifiedStatute: overrides.requiresVerifiedStatute ?? false,
    requiresVerifiedAuthority: overrides.requiresVerifiedAuthority ?? false,
    requiresUserConfirmationWhenAmbiguous:
      overrides.requiresUserConfirmationWhenAmbiguous ??
      resolutionType === 'user_confirmation_required',
    preferDeterministic: overrides.preferDeterministic ?? resolutionType === 'automatic',
  };
}

const AUTOMATIC: PolicyInput = {
  resolutionType: 'automatic',
  preferDeterministic: true,
  maxAttempts: 2,
};

const RETRIEVAL: PolicyInput = {
  resolutionType: 'retrieval_required',
  preferDeterministic: false,
  maxAttempts: 2,
};

const CONFIRM: PolicyInput = {
  resolutionType: 'user_confirmation_required',
  preferDeterministic: false,
  maxAttempts: 1,
  requiresUserConfirmationWhenAmbiguous: true,
};

const ADVOCATE: PolicyInput = {
  resolutionType: 'manual_legal_review_required',
  preferDeterministic: false,
  maxAttempts: 1,
};

const ENTRIES: DraftFindingRepairPolicy[] = [
  policy('WRONG_DOCUMENT_KIND', 'retrieval_required', {
    requiresPlaybook: true,
    preferDeterministic: true,
    maxAttempts: 2,
  }),
  policy('DOCUMENT_KIND_UNRESOLVED', 'user_confirmation_required', {
    requiresPlaybook: true,
    requiresUserConfirmationWhenAmbiguous: true,
  }),
  policy('DOCUMENT_PLAYBOOK_REQUIRED', 'retrieval_required', {
    requiresPlaybook: true,
    preferDeterministic: true,
  }),

  policy(ACCURACY_BLOCKER_CODES.PARTY_NAME_CORRUPTED, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.MATERIAL_PARTY_OMITTED, 'automatic', {
    ...AUTOMATIC,
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.PARTY_ROLE_INCONSISTENT, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.PARTY_NUMBERING_INCONSISTENT, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY, 'automatic', AUTOMATIC),

  policy(ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.UNSUPPORTED_MATERIAL_FACT, 'automatic', {
    preferDeterministic: true,
    maxAttempts: 2,
  }),
  policy(ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.DATE_CORRUPTION, 'automatic', {
    ...AUTOMATIC,
    requiresUserConfirmationWhenAmbiguous: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.AMOUNT_CORRUPTION, 'automatic', {
    ...AUTOMATIC,
    requiresUserConfirmationWhenAmbiguous: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.PROCEDURE_CORRUPTION, 'retrieval_required', RETRIEVAL),
  policy(ACCURACY_BLOCKER_CODES.FACTUAL_EVENT_SUBSTITUTION, 'automatic', {
    preferDeterministic: false,
    maxAttempts: 2,
  }),
  policy(ACCURACY_BLOCKER_CODES.EXPERT_OPINION_STATED_AS_FACT, 'automatic', {
    preferDeterministic: true,
  }),

  policy(ACCURACY_BLOCKER_CODES.WRONG_SECTION, 'retrieval_required', {
    ...RETRIEVAL,
    requiresVerifiedStatute: true,
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.WRONG_SUBSECTION, 'retrieval_required', {
    ...RETRIEVAL,
    requiresVerifiedStatute: true,
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.STALE_STATUTE, 'retrieval_required', {
    ...RETRIEVAL,
    requiresVerifiedStatute: true,
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.STATUTE_NOT_RELEVANT, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.STATUTE_MISCLASSIFIED_AS_CASE, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.UNVERIFIED_STATUTORY_PROPOSITION, 'retrieval_required', {
    requiresVerifiedStatute: true,
    preferDeterministic: true,
  }),

  policy(ACCURACY_BLOCKER_CODES.WRONG_FORUM, 'retrieval_required', {
    requiresCourtProfile: true,
    requiresPlaybook: true,
    preferDeterministic: false,
    maxAttempts: 2,
  }),
  policy(ACCURACY_BLOCKER_CODES.PECUNIARY_BASIS_UNSUPPORTED, 'user_confirmation_required', CONFIRM),
  policy(ACCURACY_BLOCKER_CODES.TERRITORIAL_BASIS_UNSUPPORTED, 'user_confirmation_required', CONFIRM),
  policy(ACCURACY_BLOCKER_CODES.SUBJECT_MATTER_JURISDICTION_WRONG, 'retrieval_required', {
    requiresCourtProfile: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.STATE_RULE_CONFIRMATION_REQUIRED, 'user_confirmation_required', CONFIRM),

  policy(ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION, 'retrieval_required', {
    requiresPlaybook: true,
    preferDeterministic: false,
    maxAttempts: 2,
  }),
  policy(ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY, 'retrieval_required', {
    requiresPlaybook: true,
    preferDeterministic: false,
    maxAttempts: 2,
  }),
  policy(ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_COMPANION_DOCUMENT, 'manual_legal_review_required', ADVOCATE),
  policy(ACCURACY_BLOCKER_CODES.MISSING_VERIFICATION, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.MISSING_AFFIDAVIT, 'manual_legal_review_required', ADVOCATE),
  policy(ACCURACY_BLOCKER_CODES.MISSING_ANNEXURE_LIST, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.MISSING_VALUATION_OR_COURT_FEE_PLEADING, 'automatic', {
    preferDeterministic: false,
  }),

  policy(ACCURACY_BLOCKER_CODES.LIMITATION_NOT_ANALYSED, 'automatic', {
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.LIMITATION_DATE_MISMATCH, 'automatic', {
    preferDeterministic: true,
    requiresUserConfirmationWhenAmbiguous: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.CAUSE_OF_ACTION_DATE_MISMATCH, 'automatic', {
    preferDeterministic: true,
    requiresUserConfirmationWhenAmbiguous: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.DELAY_REQUIRES_CONDONATION, 'manual_legal_review_required', ADVOCATE),
  policy(ACCURACY_BLOCKER_CODES.UNSUPPORTED_CONTINUING_CAUSE, 'manual_legal_review_required', ADVOCATE),

  policy(ACCURACY_BLOCKER_CODES.VALUATION_BASIS_WRONG, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.COURT_FEE_BASIS_WRONG, 'user_confirmation_required', CONFIRM),
  policy(ACCURACY_BLOCKER_CODES.ANNEXURE_REFERENCE_MISSING, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.ANNEXURE_METADATA_MISMATCH, 'automatic', AUTOMATIC),
  policy(ACCURACY_BLOCKER_CODES.DOCUMENT_STATUS_MISSTATED, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.ELECTRONIC_RECORD_FOUNDATION_MISSING, 'automatic', {
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.DISPUTED_DOCUMENT_NOT_QUALIFIED, 'automatic', {
    preferDeterministic: true,
  }),

  policy(ACCURACY_BLOCKER_CODES.RELIEF_TEST_NOT_PLEADED, 'automatic', {
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.RELIEF_FACTUAL_FOUNDATION_MISSING, 'automatic', {
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.INTERIM_RELIEF_URGENCY_MISSING, 'automatic', {
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.PRAYER_EXCEEDS_LEGAL_TEST, 'automatic', {
    preferDeterministic: false,
    maxAttempts: 2,
  }),

  policy(ACCURACY_BLOCKER_CODES.MATERIAL_ADVERSE_FACT_OMITTED, 'automatic', {
    preferDeterministic: false,
  }),
  policy(ACCURACY_BLOCKER_CODES.MATERIAL_ADVERSE_AUTHORITY_OMITTED, 'retrieval_required', {
    requiresVerifiedAuthority: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.MISLEADING_SELECTIVE_PLEADING, 'manual_legal_review_required', ADVOCATE),

  policy(ACCURACY_BLOCKER_CODES.COURT_PROFILE_NOT_FOUND, 'retrieval_required', {
    requiresCourtProfile: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.COURT_PROFILE_STALE, 'retrieval_required', {
    requiresCourtProfile: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.LOCAL_FORMAT_NONCOMPLIANT, 'manual_legal_review_required', ADVOCATE),

  policy(ACCURACY_BLOCKER_CODES.CITATION_WITHOUT_PROPOSITION, 'retrieval_required', {
    requiresVerifiedAuthority: true,
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.QUOTATION_MISMATCH, 'retrieval_required', {
    requiresVerifiedAuthority: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.PASSAGE_NOT_VERIFIED, 'retrieval_required', {
    requiresVerifiedAuthority: true,
    preferDeterministic: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.AUTHORITY_HIERARCHY_MISSTATED, 'retrieval_required', {
    requiresVerifiedAuthority: true,
  }),
  policy(ACCURACY_BLOCKER_CODES.GOOD_LAW_NOT_VERIFIED, 'retrieval_required', {
    requiresVerifiedAuthority: true,
  }),
  policy('VERIFICATION_OVERBROAD', 'automatic', {
    preferDeterministic: true,
  }),
];

const BY_CODE = new Map(ENTRIES.map((e) => [e.code, e]));

const DEFAULT_POLICY: DraftFindingRepairPolicy = policy(
  'UNKNOWN',
  'manual_legal_review_required',
  { ...ADVOCATE, requiresCaseRecord: false },
);

export function getFindingRepairPolicy(code: string): DraftFindingRepairPolicy {
  return BY_CODE.get(code) ?? { ...DEFAULT_POLICY, code };
}

export function listFindingRepairPolicies(): DraftFindingRepairPolicy[] {
  return [...ENTRIES];
}

export function isAutomaticallyRepairable(code: string): boolean {
  const p = getFindingRepairPolicy(code);
  return (
    p.resolutionType === 'automatic' ||
    p.resolutionType === 'retrieval_required'
  );
}

export function classifyFindingsForRepair(codes: string[]): {
  automatic: string[];
  retrievalRequired: string[];
  userConfirmation: string[];
  advocateReview: string[];
  nonRepairable: string[];
} {
  const automatic: string[] = [];
  const retrievalRequired: string[] = [];
  const userConfirmation: string[] = [];
  const advocateReview: string[] = [];
  const nonRepairable: string[] = [];
  for (const code of codes) {
    const p = getFindingRepairPolicy(code);
    switch (p.resolutionType) {
      case 'automatic':
        automatic.push(code);
        break;
      case 'retrieval_required':
        retrievalRequired.push(code);
        break;
      case 'user_confirmation_required':
        userConfirmation.push(code);
        break;
      case 'manual_legal_review_required':
        advocateReview.push(code);
        break;
      case 'non_repairable':
        nonRepairable.push(code);
        break;
      default:
        nonRepairable.push(code);
    }
  }
  return { automatic, retrievalRequired, userConfirmation, advocateReview, nonRepairable };
}
