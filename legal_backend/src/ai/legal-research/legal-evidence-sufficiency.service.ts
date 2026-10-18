import { Injectable } from '@nestjs/common';
import type { EvidenceGap } from './gap-query-builder.service';
import type {
  LegalResearchIntent,
} from './legal-research-classifier.service';
import type { LegalIssueDecomposition } from '@/legal-search/legal-retrieval.types';
import type { ResearchTaskKind } from './research-planning.types';

// ── Issue coverage types ─────────────────────────────────────────────────────

export interface IssueCoverage {
  issueId: string;
  issue: string;
  primaryLawCovered: boolean;
  bindingAuthorityCovered: boolean;
  proceduralLawCovered: boolean;
  currentTreatmentCovered: boolean;
  jurisdictionCovered: boolean;
  applicationSupportCovered: boolean;
  adverseAuthorityCovered: boolean;
  fullTextCovered: boolean;
  supportingEvidenceIds: string[];
}

export interface LegalEvidenceCoverage {
  issues: IssueCoverage[];
  overallScore: number;
  criticalGaps: EvidenceGap[];
}

export interface SufficiencyResult {
  passed: boolean;
  score: number;
  coverage: LegalEvidenceCoverage;
  criticalGaps: EvidenceGap[];
}

export interface EvaluateSufficiencyInput {
  query: string;
  authorities: Array<{
    id: string;
    title: string;
    citation?: string | null;
    sourceTier?: string;
    sourceName?: string;
    summary?: string | null;
    fullText?: string | null;
    treatmentStatus?: string | null;
    courtTierRank?: number | null;
  }>;
  researchIntent?: LegalResearchIntent;
  taskKind?: ResearchTaskKind;
  issueDecomposition?: LegalIssueDecomposition[];
  jurisdiction?: string;
  /** Minimum score (0–100) for each issue to be considered sufficient. Defaults to 60. */
  threshold?: number;
}

/**
 * Evaluates evidence sufficiency by issue coverage rather than authority count.
 *
 * Three irrelevant secondary authorities are NOT sufficient.
 * One exact statute provision + one binding judgment may be sufficient.
 *
 * The minimum score across all identified issues is used — one uncovered issue fails the pack.
 */
@Injectable()
export class LegalEvidenceSufficiencyService {
  private static readonly DEFAULT_THRESHOLD = 60;

  evaluate(input: EvaluateSufficiencyInput): SufficiencyResult {
    const threshold = input.threshold ?? LegalEvidenceSufficiencyService.DEFAULT_THRESHOLD;
    const issues = this.extractIssues(input.query, input.issueDecomposition);
    const coverage = this.computeCoverage(issues, input.authorities);
    const score = computeSufficiencyScore(coverage);
    const criticalGaps = this.identifyGaps(coverage, input);

    return {
      passed:
        score >= threshold &&
        !criticalGaps.some(
          (gap) =>
            gap.missingDimension === 'COMPLETENESS' &&
            input.jurisdiction?.trim().toUpperCase() === 'KE',
        ),
      score,
      coverage,
      criticalGaps,
    };
  }

  private extractIssues(
    query: string,
    decomposition?: LegalIssueDecomposition[],
  ): Array<{ issueId: string; issue: string }> {
    const planned = (decomposition ?? [])
      .flatMap(({ issue, subIssues }) => [issue, ...(subIssues ?? [])])
      .map((issue) => issue.trim())
      .filter((issue) => issue.length > 3);
    const derived = query
      .split(/[;?\n]+/)
      .map((issue) => issue.trim())
      .filter((issue) => issue.length >= 12);
    const issueTexts = [...new Set(planned.length > 0 ? planned : derived)];
    const issues = (issueTexts.length > 0 ? issueTexts : [query])
      .slice(0, 6)
      .map((issue, index) => ({
        issueId: `ISSUE_${String(index + 1).padStart(3, '0')}`,
        issue: issue.slice(0, 180),
      }));

    // Detect if there's a procedural sub-issue
    if (
      /\b(procedure|notice|limitation|service|filing|jurisdiction)\b/i.test(query) &&
      !issues.some(({ issue }) => /procedure|notice|limitation|service|filing|jurisdiction/i.test(issue))
    ) {
      issues.push({ issueId: 'ISSUE_PROC', issue: 'Procedural requirements' });
    }

    return issues;
  }

  private computeCoverage(
    issues: Array<{ issueId: string; issue: string }>,
    authorities: EvaluateSufficiencyInput['authorities'],
  ): LegalEvidenceCoverage {
    const primaryAuthorities = authorities.filter(
      (a) => a.sourceTier === 'primary' || a.sourceTier === 'seed',
    );
    const caseAuthorities = authorities.filter((a) => a.sourceTier === 'case_law');
    const webAuthorities = authorities.filter((a) => a.sourceTier === 'web');

    const issueCoverages: IssueCoverage[] = issues.map((issue) => {
      const relevantPrimary = primaryAuthorities.filter((a) =>
        this.isRelevant(a, issue.issue),
      );
      const relevantCase = caseAuthorities.filter((a) =>
        this.isRelevant(a, issue.issue),
      );
      const supportingIds = [...relevantPrimary, ...relevantCase].map((a) => a.id);
      const relevantAuthorities = [...relevantPrimary, ...relevantCase];

      return {
        issueId: issue.issueId,
        issue: issue.issue,
        primaryLawCovered: relevantPrimary.length > 0,
        bindingAuthorityCovered: relevantCase.length > 0,
        proceduralLawCovered:
          relevantPrimary.some((a) => /procedure|notice|limitation/i.test(a.title)) ||
          relevantCase.some((a) => /procedure|notice|limitation/i.test(a.title ?? '')),
        currentTreatmentCovered:
          relevantCase.some(
            (a) =>
              Boolean(a.treatmentStatus) ||
              /\b(overruled|followed|affirmed|distinguished|good law|current)\b/i.test(
                `${a.summary ?? ''} ${a.fullText ?? ''}`,
              ),
          ),
        jurisdictionCovered: relevantPrimary.length > 0 || relevantCase.length > 0,
        applicationSupportCovered: webAuthorities.length > 0 || relevantCase.length > 0,
        adverseAuthorityCovered: relevantCase.some(
          (a) =>
            /overruled|distinguished|doubted|contrary|adverse|not followed/i.test(
              `${a.treatmentStatus ?? ''} ${a.summary ?? ''} ${a.fullText ?? ''}`,
            ),
        ),
        fullTextCovered:
          relevantAuthorities.length > 0 &&
          relevantAuthorities.every((authority) => (authority.fullText?.trim().length ?? 0) >= 80),
        supportingEvidenceIds: supportingIds,
      };
    });

    const overallScore = computeSufficiencyScore({ issues: issueCoverages });

    return {
      issues: issueCoverages,
      overallScore,
      criticalGaps: [],
    };
  }

  private identifyGaps(
    coverage: LegalEvidenceCoverage,
    input: EvaluateSufficiencyInput,
  ): EvidenceGap[] {
    const gaps: EvidenceGap[] = [];
    const policyKind = input.taskKind ?? input.researchIntent ?? 'GENERAL_RESEARCH';
    const needsPrimary = ['STATUTORY_INTERPRETATION', 'PROCEDURE', 'CURRENT_LAW', 'GENERAL_RESEARCH']
      .includes(policyKind);
    const needsBinding = ['CASE_SURVEY', 'CASE_COMPARISON', 'ADVERSE_AUTHORITY', 'CURRENT_LAW', 'GENERAL_RESEARCH']
      .includes(policyKind);
    const needsCurrentTreatment =
      policyKind === 'CURRENT_LAW' ||
      policyKind === 'ADVERSE_AUTHORITY' ||
      /\b(current|latest|good law|overruled|repealed|superseded)\b/i.test(input.query);
    const needsProcedure =
      policyKind === 'PROCEDURE' ||
      /\b(procedure|notice|limitation|filing|forum|jurisdiction)\b/i.test(input.query);
    for (const issue of coverage.issues) {
      if (needsPrimary && !issue.primaryLawCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'PRIMARY_LAW',
        });
      }
      if (needsBinding && !issue.bindingAuthorityCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'BINDING_AUTHORITY',
        });
      }
      if (needsCurrentTreatment && !issue.currentTreatmentCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'CURRENT_TREATMENT',
        });
      }
      if (needsProcedure && !issue.proceduralLawCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'PROCEDURAL_LAW',
        });
      }
      if (!issue.jurisdictionCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'JURISDICTION',
        });
      }
      if (!issue.applicationSupportCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'APPLICATION_SUPPORT',
        });
      }
      if (
        input.jurisdiction?.trim().toUpperCase() === 'KE' &&
        issue.supportingEvidenceIds.length > 0 &&
        !issue.fullTextCovered
      ) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'COMPLETENESS',
          suggestedSearchTerms: [
            `${issue.issue} site:new.kenyalaw.org full judgment`,
            `${issue.issue} Kenya Law statute full text`,
          ],
        });
      }
      if (input.researchIntent === 'ADVERSE_AUTHORITY' && !issue.adverseAuthorityCovered) {
        gaps.push({
          issueId: issue.issueId,
          issue: issue.issue,
          missingDimension: 'ADVERSE_AUTHORITY',
        });
      }
    }
    return gaps;
  }

  private isRelevant(
    authority: { title: string; summary?: string | null; fullText?: string | null },
    issueText: string,
  ): boolean {
    const stopWords = new Set([
      'what', 'where', 'which', 'similar', 'cases', 'case', 'indian', 'india',
      'legal', 'research', 'outcomes', 'outcome', 'facts', 'involving', 'about',
    ]);
    const keywords = [...new Set(issueText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .map((w) => w.replace(/(?:ments?|ships?|ions?|ings?|ed|es|s)$/i, ''))
      .filter((w) => w.length > 3))]
      .slice(0, 8);
    const searchText = `${authority.title} ${authority.summary ?? ''} ${authority.fullText ?? ''}`.toLowerCase();
    if (keywords.length === 0) return false;
    const matches = keywords.filter((keyword) => searchText.includes(keyword)).length;
    return matches >= Math.min(2, keywords.length);
  }
}

/**
 * Scores an issue coverage object.
 * Each dimension is weighted; minimum across all issues is the overall score.
 * An uncovered critical dimension in any single issue fails the entire pack.
 */
export function computeSufficiencyScore(coverage: Pick<LegalEvidenceCoverage, 'issues'>): number {
  if (coverage.issues.length === 0) return 0;

  const issueScores = coverage.issues.map((issue) => {
    let score = 0;
    if (issue.primaryLawCovered)         score += 25;
    if (issue.bindingAuthorityCovered)   score += 25;
    if (issue.currentTreatmentCovered)   score += 15;
    if (issue.jurisdictionCovered)       score += 15;
    if (issue.proceduralLawCovered)      score += 10;
    if (issue.applicationSupportCovered) score += 10;
    return score;
  });

  return Math.min(...issueScores);
}
