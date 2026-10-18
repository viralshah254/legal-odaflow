import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DRAFT_MODEL_ALIASES } from '@/ai/unified-drafting/contracts/model-aliases';
import type { DraftCaseBrief } from './draft-case-brief.types';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';

export interface PleadingAmendment {
  originalText: string;
  suggestedText: string;
  reason: string;
  autoApplicable: boolean;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'timeline' | 'fact' | 'citation' | 'language' | 'label';
}

export interface PleadingReviewResult {
  amendments: PleadingAmendment[];
  missingGrounds: string[];
  timelineIssues: string[];
  citationGaps: string[];
  languageIssues: string[];
  reviewModel: string;
}

export interface PleadingReviewInput {
  draft: string;
  brief: DraftCaseBrief;
  findings: VerificationFinding[];
  verifiedAuthoritiesBlock: string;
  filingGrade: boolean;
  /** Prefer Sol for filing-grade lawyer_ready review. */
  usePremiumReviewer?: boolean;
}

@Injectable()
export class DraftPleadingReviewService {
  private readonly logger = new Logger(DraftPleadingReviewService.name);

  constructor(private readonly llm: LlmCompletionService) {}

  /**
   * Deterministic review first; optionally enrich with LLM for filing-grade.
   */
  async review(input: PleadingReviewInput): Promise<PleadingReviewResult> {
    const amendments: PleadingAmendment[] = [];
    const missingGrounds: string[] = [];
    const timelineIssues: string[] = [];
    const citationGaps: string[] = [];
    const languageIssues: string[] = [];

    for (const f of input.findings) {
      if (f.checkId.startsWith('procedural_timeline:')) {
        timelineIssues.push(f.explanation);
        amendments.push(...this.deterministicFixes(input.draft, input.brief, f));
      }
      if (f.checkId === 'fact_coverage:missing_ground') {
        missingGrounds.push(f.explanation.replace(/^Defence fact not covered in grounds:\s*/i, ''));
      }
      if (f.checkId === 'fact_coverage:ground_missing_citation') {
        citationGaps.push(f.explanation);
      }
      if (f.checkId.includes('weak_phrase') || f.checkId.includes('petitioner_label')) {
        languageIssues.push(f.explanation);
        amendments.push(...this.deterministicFixes(input.draft, input.brief, f));
      }
    }

    // Insert missing defence grounds with registry citation hint
    for (const mg of missingGrounds.slice(0, 5)) {
      const citeHint =
        input.verifiedAuthoritiesBlock.split('\n').find((l) => /SCC|AIR|Antil|Sarkar/i.test(l)) ??
        'Satender Kumar Antil v. CBI (2022) 10 SCC 51';
      amendments.push({
        originalText: '',
        suggestedText: `That ${mg} Relied upon: ${citeHint.slice(0, 160)}.`,
        reason: `Insert missing defence ground from Case Brief`,
        autoApplicable: true,
        severity: 'HIGH',
        category: 'fact',
      });
    }

    let reviewModel = 'deterministic';
    if (input.filingGrade && input.usePremiumReviewer !== false) {
      try {
        const model = DRAFT_MODEL_ALIASES.PREMIUM_REVIEWER;
        const llmResult = await this.llm.complete({
          modelName: model,
          messages: [
            {
              role: 'system',
              content: `You review Indian court pleadings for filing readiness.
Return JSON only: {"amendments":[{"originalText":"...","suggestedText":"...","reason":"...","autoApplicable":true,"severity":"HIGH","category":"timeline|fact|citation|language|label"}]}
Only suggest safe auto-applicable fixes: date/label corrections, remove invented facts, insert missing brief facts with citations from VERIFIED AUTHORITIES, replace weak phrases.
Never change prayer reliefs or invent new citations not in VERIFIED AUTHORITIES.`,
            },
            {
              role: 'user',
              content: `CASE BRIEF:\n${JSON.stringify(input.brief, null, 0).slice(0, 4000)}\n\nVERIFIED AUTHORITIES:\n${input.verifiedAuthoritiesBlock.slice(0, 3000)}\n\nDRAFT:\n${input.draft.slice(0, 12000)}\n\nKNOWN ISSUES:\n${input.findings
                .map((f) => f.explanation)
                .slice(0, 20)
                .join('\n')}`,
            },
          ],
          maxTokens: 2000,
          temperature: 0.1,
        });
        reviewModel = model;
        const parsed = this.parseAmendments(llmResult.content ?? '');
        for (const a of parsed) {
          if (!amendments.some((x) => x.suggestedText === a.suggestedText)) {
            amendments.push(a);
          }
        }
      } catch (err) {
        this.logger.warn(`Pleading LLM review skipped: ${String(err)}`);
      }
    }

    return {
      amendments,
      missingGrounds,
      timelineIssues,
      citationGaps,
      languageIssues,
      reviewModel,
    };
  }

  private deterministicFixes(
    draft: string,
    brief: DraftCaseBrief,
    finding: VerificationFinding,
  ): PleadingAmendment[] {
    const out: PleadingAmendment[] = [];
    if (finding.checkId === 'procedural_timeline:petitioner_label_in_bail') {
      out.push({
        originalText: 'Petitioner',
        suggestedText: 'Applicant–Accused',
        reason: 'Criminal bail party label',
        autoApplicable: true,
        severity: 'HIGH',
        category: 'label',
      });
    }
    if (finding.checkId === 'procedural_timeline:section_173_for_chargesheet') {
      out.push({
        originalText: 'Section 173',
        suggestedText: 'Section 193',
        reason: 'Chargesheet cites BNSS §193 not §173',
        autoApplicable: true,
        severity: 'HIGH',
        category: 'timeline',
      });
      out.push({
        originalText: 'u/s 173',
        suggestedText: 'u/s 193',
        reason: 'Chargesheet cites BNSS §193 not §173',
        autoApplicable: true,
        severity: 'HIGH',
        category: 'timeline',
      });
    }
    if (finding.checkId === 'procedural_timeline:investigation_ongoing_post_chargesheet') {
      const m = draft.match(/investigation\s+(?:is\s+)?(?:still\s+)?ongoing|investigation\s+pending/i);
      if (m) {
        out.push({
          originalText: m[0],
          suggestedText: 'chargesheet has already been filed',
          reason: 'Post-chargesheet stage language',
          autoApplicable: true,
          severity: 'HIGH',
          category: 'timeline',
        });
      }
    }
    if (finding.checkId === 'procedural_timeline:fir_date_mismatch' && brief.proceduralHistory.firDate) {
      out.push({
        originalText: '',
        suggestedText: brief.proceduralHistory.firDate,
        reason: `Align FIR date to Case Brief: ${brief.proceduralHistory.firDate}`,
        autoApplicable: false,
        severity: 'HIGH',
        category: 'timeline',
      });
    }
    if (finding.checkId.includes('weak_phrase:benefit_of_doubt')) {
      const m = draft.match(/benefit\s+of\s+(?:the\s+)?doubt/i);
      if (m) {
        out.push({
          originalText: m[0],
          suggestedText: 'the settled principle that bail is the rule and jail the exception',
          reason: 'Replace weak phrase',
          autoApplicable: true,
          severity: 'MEDIUM',
          category: 'language',
        });
      }
    }
    if (finding.checkId.includes('person_of_means')) {
      const m = draft.match(/person\s+of\s+means|reputable\s+family/i);
      if (m) {
        out.push({
          originalText: m[0],
          suggestedText: 'the Applicant–Accused',
          reason: 'Remove class-based argument',
          autoApplicable: true,
          severity: 'MEDIUM',
          category: 'language',
        });
      }
    }
    return out;
  }

  private parseAmendments(text: string): PleadingAmendment[] {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]) as { amendments?: PleadingAmendment[] };
      return (parsed.amendments ?? []).filter(
        (a) => a.suggestedText && typeof a.autoApplicable === 'boolean',
      );
    } catch {
      return [];
    }
  }
}
