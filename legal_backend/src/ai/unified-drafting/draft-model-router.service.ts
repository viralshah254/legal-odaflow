import { Injectable, Logger } from '@nestjs/common';
import { DRAFT_MODEL_ALIASES, QUALITY_TIER_MODELS, type QualityTier } from './contracts/model-aliases';
import type {
  ComplexityScore,
  SectionModelTier,
  SectionPlan,
} from './contracts/draft-execution-plan';
import type { NormalizedMatter } from './contracts/normalized-matter';

/**
 * Unified Draft Model Router
 *
 * Selects the appropriate model alias for each task based on:
 *   1. Quality tier (express / standard / premium)
 *   2. Section complexity score (0–100)
 *   3. Previous repair failures
 *   4. Budget constraints
 *
 * The single most important rule: do not choose models by section name alone.
 * Route cheap → standard → strong → premium based on evidence.
 */
@Injectable()
export class DraftModelRouterService {
  private readonly logger = new Logger(DraftModelRouterService.name);

  /** Score a normalized matter to determine overall complexity (0–100). */
  scoreComplexity(matter: NormalizedMatter, documentKind: string): ComplexityScore {
    const proceduralAmbiguity = this.scoreProceduralAmbiguity(matter, documentKind);
    const disputedIssues = Math.min(20, matter.userAssertions.filter((a) => a.confidence === 'low').length * 5);
    const authorityConflict = this.scoreAuthorityConflict(matter);
    const factualConflict = Math.min(15, matter.contradictions.length * 5);
    const reliefSeverity = this.scoreReliefSeverity(matter);
    const filingRisk = this.scoreFilingRisk(documentKind);
    const documentLength = this.estimateDocumentLength(documentKind);

    const total = Math.min(
      100,
      proceduralAmbiguity +
        disputedIssues +
        authorityConflict +
        factualConflict +
        reliefSeverity +
        filingRisk +
        documentLength,
    );

    return {
      proceduralAmbiguity,
      disputedIssues,
      authorityConflict,
      factualConflict,
      reliefSeverity,
      filingRisk,
      documentLength,
      total,
    };
  }

  /** Map a complexity score to a model tier. */
  scoreTier(total: number): SectionModelTier {
    if (total <= 20) return 'cheap';
    if (total <= 45) return 'standard';
    if (total <= 70) return 'strong';
    return 'premium';
  }

  /** Resolve the actual model ID for a section, incorporating failures and budget. */
  resolveModelForSection(
    section: SectionPlan,
    qualityTier: QualityTier,
    complexityScore: ComplexityScore,
    previousRepairFailures: number,
    premiumBudgetExhausted: boolean,
  ): string {
    const tierConfig = QUALITY_TIER_MODELS[qualityTier];

    // Sections that are always cheap regardless of document complexity
    const alwaysCheapTypes = ['heading', 'schedule', 'signature', 'verification', 'definitions', 'cover_page'];
    if (alwaysCheapTypes.includes(section.sectionType)) {
      return DRAFT_MODEL_ALIASES.MECHANICAL_DRAFTER;
    }

    // Escalate after two repair failures
    if (previousRepairFailures >= 2 && !premiumBudgetExhausted) {
      this.logger.log(`Escalating section ${section.sectionId} to premium after ${previousRepairFailures} repair failures`);
      return DRAFT_MODEL_ALIASES.PREMIUM_REASONER;
    }

    const effectiveTier = this.resolveEffectiveTier(section.modelTier, qualityTier, complexityScore.total);

    switch (effectiveTier) {
      case 'cheap':
        return DRAFT_MODEL_ALIASES.MECHANICAL_DRAFTER;
      case 'standard':
        return tierConfig.substantiveDrafter;
      case 'strong':
        return tierConfig.substantiveDrafter;
      case 'premium':
        if (premiumBudgetExhausted) {
          // Filing-grade grounds/arguments must not silently drop Sol → Terra.
          const isPremiumSection = /grounds|arguments|legal_grounds/i.test(section.sectionType);
          if (isPremiumSection) {
            this.logger.warn(
              `Premium budget exhausted but refusing silent downgrade for ${section.sectionId} (${section.sectionType}) — using escalateTo`,
            );
            return tierConfig.escalateTo;
          }
          this.logger.warn(`Premium budget exhausted — using LEGAL_DRAFTER for ${section.sectionId}`);
          return DRAFT_MODEL_ALIASES.LEGAL_DRAFTER;
        }
        return tierConfig.escalateTo;
    }
  }

  resolveIntakeModel(qualityTier: QualityTier): string {
    return QUALITY_TIER_MODELS[qualityTier].intake;
  }

  resolvePlannerModel(): string {
    return DRAFT_MODEL_ALIASES.PLANNER;
  }

  resolveReviewerModel(qualityTier: QualityTier): string {
    // Premium / lawyer_ready path: independent Sol reviewer (never self-certify).
    if (qualityTier === 'premium') {
      return DRAFT_MODEL_ALIASES.PREMIUM_REVIEWER;
    }
    return QUALITY_TIER_MODELS[qualityTier].reviewer;
  }

  resolveRepairModel(isSubstantive: boolean, attemptNumber: number, qualityTier: QualityTier): string {
    if (attemptNumber >= 2) return DRAFT_MODEL_ALIASES.PREMIUM_REASONER;
    if (isSubstantive) return QUALITY_TIER_MODELS[qualityTier].repair;
    return DRAFT_MODEL_ALIASES.ROUTINE_REPAIR;
  }

  /** True when the complexity score and quality tier justify using Sol (premium). */
  shouldEscalateToPremium(
    complexityScore: ComplexityScore,
    qualityTier: QualityTier,
    hasAuthorityConflict: boolean,
    repairFailures: number,
  ): boolean {
    if (qualityTier === 'express') return false;
    if (complexityScore.total > 70) return true;
    if (hasAuthorityConflict && complexityScore.authorityConflict >= 10) return true;
    if (repairFailures >= 2) return true;
    return false;
  }

  // ─── Private scoring helpers ──────────────────────────────────────────────

  private resolveEffectiveTier(
    sectionTier: SectionModelTier,
    qualityTier: QualityTier,
    totalScore: number,
  ): SectionModelTier {
    // Express tier caps at 'standard' even for complex sections
    if (qualityTier === 'express') {
      if (sectionTier === 'premium' || sectionTier === 'strong') return 'standard';
      return sectionTier;
    }
    // Standard/premium: use section tier but upgrade if doc complexity demands it
    if (totalScore > 70 && sectionTier === 'standard') return 'strong';
    return sectionTier;
  }

  private scoreProceduralAmbiguity(matter: NormalizedMatter, documentKind: string): number {
    let score = 0;
    if (matter.missingInputs.some((m) => m.blocking)) score += 10;
    if (/writ|constitutional|scr|slp|quashing/i.test(documentKind)) score += 10;
    if (/revision|appeal|rehearing/i.test(documentKind)) score += 8;
    if (matter.proceduralHistory.length > 3) score += 5;
    return Math.min(25, score);
  }

  private scoreAuthorityConflict(matter: NormalizedMatter): number {
    // Heuristic: conflicting assertions at low confidence imply authority conflict
    const lowConfidenceAssertions = matter.userAssertions.filter((a) => a.confidence === 'low').length;
    return Math.min(15, lowConfidenceAssertions * 3);
  }

  private scoreReliefSeverity(matter: NormalizedMatter): number {
    const hasInterim = matter.requestedRelief.some((r) => r.type === 'interim');
    const hasPrimary = matter.requestedRelief.some((r) => r.type === 'primary');
    let score = 0;
    if (hasInterim) score += 8;
    if (hasPrimary) score += 5;
    return Math.min(15, score);
  }

  private scoreFilingRisk(documentKind: string): number {
    if (/criminal|bail|custody|habeas|arrest/i.test(documentKind)) return 10;
    if (/maintenance|domestic|divorce|custody/i.test(documentKind)) return 8;
    if (/contempt|enforcement/i.test(documentKind)) return 8;
    if (/writ|constitutional/i.test(documentKind)) return 10;
    if (/notice|reminder|application/i.test(documentKind)) return 2;
    return 5;
  }

  private estimateDocumentLength(documentKind: string): number {
    if (/writ|plaint|complaint|petition/i.test(documentKind)) return 10;
    if (/notice|letter|affidavit/i.test(documentKind)) return 2;
    return 5;
  }
}
