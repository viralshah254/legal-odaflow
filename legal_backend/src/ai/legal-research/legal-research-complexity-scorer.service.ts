import { Injectable } from '@nestjs/common';
import type { LegalResearchClassification } from './legal-research-classifier.service';
import type { ResearchComplexity } from './legal-research-model-router.service';
import type { AuthorityConflict } from './authority-conflict-detector.service';

// ── Complexity signals ────────────────────────────────────────────────────────
// Query length is deliberately absent — it is used only for token-budget estimation.
export interface ComplexitySignals {
  distinctLegalIssues: number;
  statuteFamilies: number;
  jurisdictions: number;
  requiresCurrentLawCheck: boolean;
  conflictingPropositionsDetected: boolean;
  negativeTreatmentFound: boolean;
  proceduralAndSubstantiveIssuesCombined: boolean;
  constitutionalIssue: boolean;
  appellateIssue: boolean;
  crossStatuteMappingRequired: boolean;
  suppliedDocumentCount: number;
  matterContextTokens: number;
}

export interface EvidenceCoverageInput {
  issues: Array<{
    issueId: string;
    primaryLawCovered: boolean;
    bindingAuthorityCovered: boolean;
    proceduralLawCovered: boolean;
    currentTreatmentCovered: boolean;
    jurisdictionCovered: boolean;
    applicationSupportCovered: boolean;
  }>;
  overallScore: number;
}

export interface PreScoreInput {
  query: string;
  classification: LegalResearchClassification | null;
  jurisdictions: string[];
  matterContextTokens: number;
  suppliedDocumentCount?: number;
}

export interface PostScoreInput {
  preliminary: { score: number; complexity: ResearchComplexity };
  authorities: Array<{ sourceTier?: string; citation?: string | null }>;
  evidenceCoverage?: EvidenceCoverageInput;
  conflictingAuthorities?: AuthorityConflict[];
  negativeTreatmentFound?: boolean;
}

export interface ComplexityResult {
  score: number;
  complexity: ResearchComplexity;
  signals: Partial<ComplexitySignals>;
  hardOverrideApplied: boolean;
}

/**
 * Two-stage complexity scorer.
 *
 * preScore  — before retrieval: controls retrieval breadth, connector usage, timeout budget.
 * postScore — after retrieval: controls synthesis model, reasoning level, verification strength.
 *
 * Hard overrides always win over the numeric score.
 */
@Injectable()
export class LegalResearchComplexityScorer {
  /**
   * Pre-retrieval score: uses query classification and context size.
   * Determines how broadly to search, not which model to use.
   */
  preScore(input: PreScoreInput): ComplexityResult {
    let score = 0;
    const signals: Partial<ComplexitySignals> = {};

    const classification = input.classification;

    // Distinct legal issues (from classification)
    const distinctIssues = this.countDistinctIssues(input.query, classification);
    signals.distinctLegalIssues = distinctIssues;
    if (distinctIssues >= 3) score += 20;
    else if (distinctIssues >= 2) score += 10;

    // Multi-jurisdiction
    const jurisdictionCount = input.jurisdictions.length;
    signals.jurisdictions = jurisdictionCount;
    if (jurisdictionCount > 2) score += 25;
    else if (jurisdictionCount === 2) score += 15;

    // Current law check needed
    const requiresCurrent = classification?.requiresCurrentLawCheck ?? false;
    signals.requiresCurrentLawCheck = requiresCurrent;
    if (requiresCurrent) score += 10;

    // Constitutional issue
    const isConstitutional =
      classification?.legalDomain === 'CONSTITUTIONAL' ||
      /\b(article\s+\d+|fundamental right|constitutional validity|writ|habeas|certiorari|mandamus|ultra vires)\b/i.test(input.query);
    signals.constitutionalIssue = isConstitutional;
    if (isConstitutional) score += 20;

    // Appellate issue
    const isAppellate =
      classification?.courtLevel === 'SUPREME' ||
      /\b(appeal|appellate|high court|supreme court|bench|division bench)\b/i.test(input.query);
    signals.appellateIssue = isAppellate;
    if (isAppellate) score += 10;

    // Procedural AND substantive issues combined
    const procedural = /\b(procedure|limitation|notice|summons|service|execution|stay|injunction)\b/i.test(input.query);
    const substantive = /\b(liability|obligation|right|claim|damages|compensation|relief)\b/i.test(input.query);
    signals.proceduralAndSubstantiveIssuesCombined = procedural && substantive;
    if (procedural && substantive) score += 10;

    // Cross-statute mapping
    const statuteFamilies = this.countStatuteFamilies(input.query);
    signals.statuteFamilies = statuteFamilies;
    signals.crossStatuteMappingRequired = statuteFamilies >= 2;
    if (statuteFamilies >= 3) score += 20;
    else if (statuteFamilies >= 2) score += 10;

    // Matter context size (proxy for complexity depth)
    signals.matterContextTokens = input.matterContextTokens;
    if (input.matterContextTokens > 8000) score += 5;

    // Supplied documents
    signals.suppliedDocumentCount = input.suppliedDocumentCount ?? 0;
    if ((input.suppliedDocumentCount ?? 0) >= 3) score += 5;

    return this.applyThresholdsAndOverrides(score, signals, {
      jurisdictions: input.jurisdictions,
      constitutionalIssue: isConstitutional,
      evidencePack: null,
    });
  }

  /**
   * Post-retrieval score: refines the preliminary score with evidence quality signals.
   * Determines synthesis model, reasoning effort, and verification strength.
   */
  postScore(input: PostScoreInput): ComplexityResult {
    let score = input.preliminary.score;
    const signals: Partial<ComplexitySignals> = {};

    // Conflicting authorities detected from evidence (not from classifier)
    const hasConflicts = (input.conflictingAuthorities ?? []).some((c) => c.unresolved);
    signals.conflictingPropositionsDetected = hasConflicts;
    if (hasConflicts) score += 25;

    // Negative treatment found
    signals.negativeTreatmentFound = input.negativeTreatmentFound ?? false;
    if (input.negativeTreatmentFound) score += 15;

    // Evidence coverage gaps increase complexity
    if (input.evidenceCoverage) {
      const criticalGaps = input.evidenceCoverage.issues.filter(
        (i) => !i.primaryLawCovered || !i.bindingAuthorityCovered,
      ).length;
      if (criticalGaps >= 2) score += 15;
      else if (criticalGaps === 1) score += 7;
    }

    const unresolvedConflict = hasConflicts;
    const controllingRuleUnresolved =
      (input.conflictingAuthorities ?? []).some(
        (c) => c.unresolved && c.conflictType === 'DIRECT_HOLDING',
      );

    return this.applyThresholdsAndOverrides(score, signals, {
      jurisdictions: [],
      constitutionalIssue: false,
      evidencePack: {
        hasNegativeTreatment: input.negativeTreatmentFound ?? false,
        unresolvedConflict,
        controllingRuleUnresolved,
      },
    });
  }

  private applyThresholdsAndOverrides(
    score: number,
    signals: Partial<ComplexitySignals>,
    context: {
      jurisdictions: string[];
      constitutionalIssue: boolean;
      evidencePack: {
        hasNegativeTreatment: boolean;
        unresolvedConflict: boolean;
        controllingRuleUnresolved: boolean;
      } | null;
    },
  ): ComplexityResult {
    // Tier thresholds: 0–19 QUICK, 20–54 STANDARD, 55–79 COMPLEX, 80+ ULTRA candidate
    let complexity: ResearchComplexity =
      score >= 80
        ? 'ULTRA'
        : score >= 55
          ? 'COMPLEX'
          : score >= 20
            ? 'STANDARD'
            : 'QUICK';

    let hardOverrideApplied = false;

    // Force QUICK: exact section lookup with no interpretive question
    const isExactLookup =
      /^(what is|define|text of|section \d+|article \d+)/i.test('') &&
      signals.constitutionalIssue === false &&
      signals.conflictingPropositionsDetected !== true;
    if (isExactLookup && score < 20) {
      complexity = 'QUICK';
      hardOverrideApplied = true;
    }

    // Force at least COMPLEX
    const forceComplex =
      context.evidencePack?.unresolvedConflict ||
      context.jurisdictions.length > 2 ||
      context.constitutionalIssue ||
      (context.evidencePack?.hasNegativeTreatment &&
        context.evidencePack?.controllingRuleUnresolved);

    if (forceComplex && (complexity === 'QUICK' || complexity === 'STANDARD')) {
      complexity = 'COMPLEX';
      hardOverrideApplied = true;
    }

    return { score, complexity, signals, hardOverrideApplied };
  }

  private countDistinctIssues(
    query: string,
    classification: LegalResearchClassification | null,
  ): number {
    // Heuristic: count conjunctions and question markers as issue separators
    const conjunctionMatches = query.match(/\b(and|also|additionally|further|whether|as well as)\b/gi) ?? [];
    const questionMatches = query.match(/\?/g) ?? [];
    return Math.min(1 + conjunctionMatches.length + questionMatches.length, 5);
  }

  private countStatuteFamilies(query: string): number {
    const families = [
      /\b(BNSS|CrPC|IPC|BNS|BSA|Evidence Act|Indian Evidence)\b/i,
      /\b(CPC|Order|Rule|civil procedure)\b/i,
      /\b(Companies Act|SEBI|FEMA|RBI)\b/i,
      /\b(Income Tax|GST|VAT|customs|excise)\b/i,
      /\b(Transfer of Property|TPA|Registration Act)\b/i,
      /\b(Motor Vehicles Act|MVA)\b/i,
      /\b(Negotiable Instruments Act|NI Act|cheque)\b/i,
      /\b(Constitution|Article \d+|fundamental)\b/i,
      /\b(IBC|NCLT|insolvency)\b/i,
      /\b(Arbitration|Conciliation)\b/i,
    ];
    return families.filter((re) => re.test(query)).length;
  }
}
