/**
 * Stage 11 — Targeted Repair Engine
 *
 * When a section fails verification (status `repair_needed`), this service
 * regenerates ONLY that section using a correction prompt built from the
 * verification result. All other sections remain untouched.
 *
 * Bounded retries: `DRAFT_V2_MAX_SECTION_REPAIRS` (default: 2).
 * If all retries fail, the section is marked `repair_failed` and flagged
 * for lawyer review — the document still assembles with a warning.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { DRAFT_ENRICH_MODEL } from '@/ai/model-costs.config';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { SectionGeneratorService } from './section-generator.service';
import { SectionVerifierService } from './section-verifier.service';
import { ConfidenceEngineService } from './confidence-engine.service';
import type {
  SectionPlan,
  SectionResult,
  DocumentOutline,
  SectionEvidenceValidation,
} from './drafting-v2.types';

const DEFAULT_MAX_REPAIRS = 2;

@Injectable()
export class TargetedRepairService {
  private readonly logger = new Logger(TargetedRepairService.name);
  private readonly maxRepairs: number;

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly unifiedVerification: UnifiedVerificationService,
    private readonly sectionGenerator: SectionGeneratorService,
    private readonly sectionVerifier: SectionVerifierService,
    private readonly confidenceEngine: ConfidenceEngineService,
    private readonly config: ConfigService,
  ) {
    this.maxRepairs = Number(
      this.config.get<string>('DRAFT_V2_MAX_SECTION_REPAIRS', String(DEFAULT_MAX_REPAIRS)),
    );
  }

  /**
   * Attempt to repair a failing section.
   * Returns the updated `SectionResult` — either repaired (verified/needs_review)
   * or `repair_failed` if all attempts exhausted.
   */
  async repairSection(
    current: SectionResult,
    section: SectionPlan,
    outline: DocumentOutline,
    priorSections: Map<string, string>,
    caseDetails: string,
    countryCode: string,
    authorities: RetrievedAuthority[],
    evidenceValidation?: SectionEvidenceValidation,
  ): Promise<SectionResult> {
    let result = current;
    let attempts = current.repairAttempts;

    while (attempts < this.maxRepairs && result.verificationStatus === 'repair_needed') {
      attempts += 1;
      this.logger.log(
        `Targeted repair attempt ${attempts}/${this.maxRepairs} for section ${section.id} (${section.type})`,
      );

      try {
        // Build correction prompt from unified verification
        const unifiedChecks = await this.unifiedVerification.runChecks({
          query: `${caseDetails} ${section.type}`,
          outputMarkdown: result.content,
          authorities,
          countryCode,
        });

        const correctionBlock = this.unifiedVerification.buildCorrectionPrompt(
          {
            query: `${caseDetails} ${section.type}`,
            outputMarkdown: result.content,
            authorities,
            countryCode,
          },
          unifiedChecks,
        );

        // Regenerate with correction context appended to case details
        const correctedCaseDetails = `${caseDetails}\n\n${correctionBlock}`;
        const correctedOutline: DocumentOutline = {
          ...outline,
          globalContext: {
            ...outline.globalContext,
            caseDetails: correctedCaseDetails,
          },
        };

        const generated = await this.sectionGenerator.generateSection(
          section,
          correctedOutline,
          priorSections,
          evidenceValidation,
        );

        const { confidence, evidenceChains } = this.confidenceEngine.computeSectionConfidence(
          generated.content,
          authorities,
          section,
        );

        result = await this.sectionVerifier.verify(
          section,
          generated.content,
          caseDetails,
          countryCode,
          authorities,
          confidence,
          evidenceChains,
          generated.modelUsed,
          {
            input: generated.inputTokens + result.tokensUsed.input,
            output: generated.outputTokens + result.tokensUsed.output,
          },
        );

        result = { ...result, repairAttempts: attempts };
      } catch (err) {
        this.logger.error(
          `Repair attempt ${attempts} failed for section ${section.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        break;
      }
    }

    if (result.verificationStatus === 'repair_needed') {
      this.logger.warn(
        `Section ${section.id} (${section.type}) exhausted ${attempts} repair attempt(s) — marking repair_failed`,
      );
      return {
        ...result,
        verificationStatus: 'repair_failed',
        repairAttempts: attempts,
        verificationWarnings: [
          ...result.verificationWarnings,
          `Auto-repair exhausted after ${attempts} attempt(s) — requires lawyer review`,
        ],
      };
    }

    return result;
  }
}
