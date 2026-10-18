/**
 * Draft Complexity Classifier
 *
 * Classifies each draft request into a complexity tier using signals already
 * available *before* any LLM call: document kind, caseDetails length, and
 * optional procedural-router output.
 *
 * Tiers and their default model assignments:
 *   simple   → gpt-5.4-mini / DeepSeek economy (whole draft)
 *   standard → gpt-5.6-terra (whole draft)
 *   complex  → gpt-5.6-sol only for grounds/arguments; Terra for the rest
 *
 * "Higher accuracy" mode (modelMode = PREMIUM) always treats every kind as
 * complex, bypassing the complexity gate.
 */

import { Injectable } from '@nestjs/common';

export type DraftComplexity = 'simple' | 'standard' | 'complex';

export interface DraftComplexityInput {
  kind: string;
  caseDetails: string;
  authorityCount?: number;
  proceduralOverridden?: boolean;
  modelMode?: 'AUTO' | 'PREMIUM';
}

/**
 * Document kinds that are unambiguously simple: catalog forms, fill-in-the-blank
 * forms, pre-litigation notices, simple applications, and employment/HR documents.
 * These never need Sol-level capability.
 */
const SIMPLE_KIND_PATTERNS: RegExp[] = [
  /^india_form_catalog$/,
  /^india_form_/,
  /legal_notice|demand_letter|reply_to_notice|cease_and_desist|notice_reply/,
  /employment_contract|service_agreement|nda|non_disclosure|mou|memorandum_of_understanding/,
  /power_of_attorney|affidavit_general|vakalatnama/,
  /india_rent_agreement|india_leave_license|india_sale_deed|india_gift_deed/,
  /acknowledgement|undertaking|indemnity_simple/,
  /relinquishment_deed|partition_deed_simple/,
];

/**
 * Document kinds that always require complex (Sol) treatment for adversarial
 * sections regardless of case-detail length: bail applications, revision petitions,
 * constitutional writs, appeals, arbitration challenges, etc.
 */
const COMPLEX_KIND_PATTERNS: RegExp[] = [
  /bail_bnss|bail_crpc|anticipatory_bail/,
  /writ_petition|habeas_corpus|mandamus|certiorari|prohibition/,
  /slp_draft|slp_petition/,
  /criminal_revision|civil_revision|criminal_appeal|civil_appeal/,
  /maintenance_order_revision|maintenance_appeal/,
  /contempt_petition|contempt_application/,
  /divorce_petition|matrimonial_dispute/,
  /suit_specific_performance|application_temp_injunction|permanent_injunction/,
  /arbitration_petition_s9|award_challenge_s34/,
  /wrongful_termination_petition/,
  /india_consumer_complaint_ncdrc|india_consumer_complaint_scdrc/,
];

/** Minimum caseDetails character length to bump standard → complex. */
const COMPLEX_DETAIL_THRESHOLD = 1500;

/** Minimum authority count to keep as standard even for borderline kinds. */
const AUTHORITY_COUNT_SIMPLE_CAP = 2;

@Injectable()
export class DraftComplexityService {
  /**
   * Classify the draft request.
   *
   * @returns DraftComplexity — the tier for model routing and credit floor selection.
   */
  classify(input: DraftComplexityInput): DraftComplexity {
    // PREMIUM mode: always treat as complex (user explicitly requested higher accuracy)
    if (input.modelMode === 'PREMIUM') {
      return 'complex';
    }

    const kind = (input.kind ?? '').toLowerCase();
    const detailLength = (input.caseDetails ?? '').length;

    // Explicitly simple kinds → never upgrade to complex
    if (SIMPLE_KIND_PATTERNS.some((re) => re.test(kind))) {
      return 'simple';
    }

    // Explicitly complex kinds → always complex
    if (COMPLEX_KIND_PATTERNS.some((re) => re.test(kind))) {
      return 'complex';
    }

    // Procedural-router override (unresolved vehicle) → complex for safety
    if (input.proceduralOverridden) {
      return 'complex';
    }

    // Long, detailed case facts signal a contested matter → complex
    if (detailLength >= COMPLEX_DETAIL_THRESHOLD) {
      return 'complex';
    }

    // Very few authorities needed means simple retrieval path → standard is fine
    if (
      input.authorityCount !== undefined &&
      input.authorityCount <= AUTHORITY_COUNT_SIMPLE_CAP &&
      detailLength < 600
    ) {
      return 'simple';
    }

    return 'standard';
  }

  /**
   * Whether a given complexity tier should trigger deep-research ReAct.
   * Only complex drafts (or PREMIUM mode, which maps to complex) run the
   * ReAct loop.
   */
  requiresDeepResearch(complexity: DraftComplexity): boolean {
    return complexity === 'complex';
  }

  /**
   * Maximum ReAct steps for deep research, banded by complexity.
   * Reduces cost by limiting the number of expensive mid-tier LLM calls.
   *
   *  simple   → 0 (deep research skipped entirely)
   *  standard → 3 (targeted retrieval for key statutes only)
   *  complex  → 6 (fuller research; absolute cap is 10 in the agent)
   */
  maxDeepResearchSteps(complexity: DraftComplexity): number {
    switch (complexity) {
      case 'simple':
        return 0;
      case 'standard':
        return 3;
      case 'complex':
      default:
        return 6;
    }
  }

  /**
   * Map complexity → the floor credit cost band key.
   * Used by getDraftCreditFloor() in credit-costs.ts.
   */
  toCreditBand(complexity: DraftComplexity): 'SIMPLE_FORM' | 'STANDARD_DRAFT' | 'COMPLEX_LITIGATION' {
    switch (complexity) {
      case 'simple':
        return 'SIMPLE_FORM';
      case 'complex':
        return 'COMPLEX_LITIGATION';
      default:
        return 'STANDARD_DRAFT';
    }
  }
}
