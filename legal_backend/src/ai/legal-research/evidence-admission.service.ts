import type {
  AuthoritativeStatus,
  PassageClassification,
  RetrievedAuthority,
  UserAuthorityStatus,
} from '@/legal-search/legal-retrieval.types';
import {
  SourceIntegrityService,
  type IntegrityState,
} from './source-integrity.service';

export type EvidenceUse = 'LEGAL_RULE' | 'QUOTATION' | 'PROCEDURAL_HISTORY' | 'MATTER_FACT';

export interface EvidenceAdmissionDecision {
  admitted: boolean;
  state: IntegrityState;
  reasons: string[];
  permittedUses: EvidenceUse[];
}

export interface EvidenceAdmissionInput {
  authority: Partial<
    Omit<
      Pick<
    RetrievedAuthority,
    | 'sourceProvenance'
    | 'userAuthorityStatus'
    | 'sourcePassages'
    | 'fullText'
    | 'summary'
    | 'authorityType'
    | 'sourceTier'
      >,
      'sourceTier'
    > & { sourceTier?: string }
  >;
  intendedUse?: EvidenceUse;
  passageClassification?: PassageClassification;
}

/**
 * Strict admission API. It is additive to legacy retrieval: existing callers
 * are unaffected until they opt into admission, but this API never treats
 * absent or indeterminate integrity metadata as admitted.
 */
export class EvidenceAdmissionService {
  constructor(private readonly integrity = new SourceIntegrityService()) {}

  admit(input: EvidenceAdmissionInput): EvidenceAdmissionDecision {
    const integrity = this.integrity.assess(input.authority.sourceProvenance);
    const reasons = [...integrity.reasons];
    const userStatus =
      input.authority.userAuthorityStatus ??
      input.authority.sourceProvenance?.userAuthorityStatus;
    const authoritativeStatus = input.authority.sourceProvenance?.authoritativeStatus;
    const classification =
      input.passageClassification ?? input.authority.sourcePassages?.[0]?.classification;
    const authorityType = input.authority.authorityType?.toLowerCase() ?? '';
    const effectiveClassification =
      classification ??
      (/(?:statute|act|code)/.test(authorityType)
        ? 'STATUTORY_TEXT'
        : /(?:regulation|rule)/.test(authorityType)
          ? 'REGULATORY_TEXT'
          : undefined);
    const permittedUses =
      input.authority.sourceTier === 'firm' && userStatus !== 'LEGAL_AUTHORITY'
        ? (['MATTER_FACT'] as EvidenceUse[])
        : this.permittedUses(userStatus, authoritativeStatus, effectiveClassification);

    if (!this.hasEvidenceText(input.authority)) reasons.push('Evidence text is empty.');
    if (input.intendedUse && !permittedUses.includes(input.intendedUse)) {
      reasons.push(`Evidence is not admissible for ${input.intendedUse}.`);
    }
    if (
      input.intendedUse === 'LEGAL_RULE' &&
      /(?:case|judgment|decision)/.test(authorityType) &&
      effectiveClassification !== 'HOLDING' &&
      effectiveClassification !== 'RATIO'
    ) {
      reasons.push('Case passage is not classified as a holding or ratio.');
    }

    const admitted = integrity.state === 'PASS' && reasons.length === 0;
    return {
      admitted,
      state: admitted ? 'PASS' : integrity.state === 'FAIL' || reasons.some((r) => r.includes('not admissible') || r.includes('empty')) ? 'FAIL' : 'INDETERMINATE',
      reasons,
      permittedUses,
    };
  }

  private hasEvidenceText(authority: EvidenceAdmissionInput['authority']): boolean {
    return Boolean(
      authority.sourcePassages?.some((passage) => passage.text.trim()) ||
        authority.fullText?.trim() ||
        authority.summary?.trim(),
    );
  }

  private permittedUses(
    userStatus: UserAuthorityStatus | undefined,
    authoritativeStatus: AuthoritativeStatus | undefined,
    classification: PassageClassification | undefined,
  ): EvidenceUse[] {
    if (userStatus === 'NOT_AUTHORITY' || userStatus === 'UNVERIFIED') return [];
    if (userStatus === 'FACTUAL_MATERIAL_ONLY') return ['MATTER_FACT'];
    if (classification === 'PARTY_SUBMISSION' || classification === 'FACT') {
      return ['MATTER_FACT', 'PROCEDURAL_HISTORY'];
    }
    if (classification === 'PROCEDURAL_HISTORY') return ['PROCEDURAL_HISTORY'];
    if (classification === 'HEADNOTE' || classification === 'COMMENTARY') {
      return ['QUOTATION'];
    }
    if (authoritativeStatus === 'SECONDARY') return ['QUOTATION'];
    return ['LEGAL_RULE', 'QUOTATION', 'PROCEDURAL_HISTORY', 'MATTER_FACT'];
  }
}
