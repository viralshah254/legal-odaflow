/**
 * Stage 8 — Section-Level Generator
 *
 * Generates each `SectionPlan` independently with a focused, bounded prompt.
 *
 * Model assignment:
 *   - `cheap`   → DEFAULT_AUTO_MODEL (gpt-5.4-mini)  — heading, parties, verification, annexures
 *   - `mid`     → DRAFT_ENRICH_MODEL (gpt-5.6-terra) — facts, law, maintainability, prayer
 *   - `premium` → DRAFT_PREMIUM_MODEL (gpt-5.6-sol)  — grounds, arguments
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { buildLegalTerminologyBlock } from '@/ai/drafting/legal-latin-corpus';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { PromptInjectionService } from '@/ai/feedback/prompt-injection.service';
import { FineTunedModelResolverService } from '@/ai/feedback/fine-tuned-model-resolver.service';
import { DEFAULT_AUTO_MODEL, DRAFT_PREMIUM_MODEL, DRAFT_ENRICH_MODEL } from '@/ai/model-costs.config';
import { LEGAL_ACCURACY_PROTOCOL, INDIA_COURT_PLEADING_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';
import type {
  SectionPlan,
  SectionType,
  DocumentOutline,
  SectionEvidenceValidation,
} from './drafting-v2.types';

const SECTION_ACCURACY_RULES = `
${LEGAL_ACCURACY_PROTOCOL}

SECTION GENERATION RULES:
1. Generate ONLY the content for this specific section — no other sections.
2. State facts precisely. Do not invent facts not present in the case details.
3. Every legal claim MUST be supported by an authority from the VERIFIED AUTHORITIES block.
4. Use [BLANK: description] for any facts not supplied in the case details.
5. Where evidence is noted as MISSING, write: "The Petitioner has not yet supplied evidence supporting [description]."
6. Do NOT include section headings from other sections.
7. Use numbered paragraphs where appropriate.
`;

export const CAUSE_TITLE_INSTRUCTION =
  `Generate ONLY the cause title / caption block — never leave it empty. Write it as an Indian court filing, filling known particulars from CASE DETAILS and COURT:
1. Court line in UPPERCASE (IN THE HIGH COURT OF [STATE] AT [SEAT] / IN THE COURT OF SESSIONS / IN THE COURT OF [forum from facts]).
2. Document type and number: use the PROCEDURAL VEHICLE; petition/application/suit number as [BLANK: number] OF [BLANK: year] if unknown.
3. Governing article/section from GOVERNING SECTIONS or CASE DETAILS (e.g. Under Article 226 / BNSS §480).
4. Parties with designators and addresses from CASE DETAILS; [BLANK: address] only if missing.
5. End the caption with MOST RESPECTFULLY SHOWETH: where this document is a court pleading.
Do not invent a court, party, or case number. Do not write facts or grounds here.`;

const SECTION_INSTRUCTIONS: Partial<Record<SectionType, string>> = {
  heading: CAUSE_TITLE_INSTRUCTION,
  parties: 'Generate ONLY the parties block. List each party with full name, designation, and relevant description. Use numbered format.',
  maintainability:
    'Generate ONLY the MAINTAINABILITY AND JURISDICTION section. Address forum competence only: (a) pecuniary jurisdiction, (b) territorial jurisdiction, (c) subject-matter / procedural basis (article or section from GOVERNING SECTIONS), (d) limitation if applicable. Do NOT restate the factual narrative. Cite governing statute sections listed above. Do NOT invent AIR/SCC citations.',
  facts: 'Generate ONLY the FACTS section. Use consecutively numbered paragraphs. State material facts chronologically — dates, events, amounts. Use [BLANK: description] for unknown facts. Do NOT state law — state only facts.',
  law: 'Generate ONLY the APPLICABLE LAW section. State which statutes and sections govern this matter and why. One to two paragraphs per applicable provision.',
  grounds: `Generate ONLY the GROUNDS section. Each ground must:
1. Have a clear issue label (GROUND I: [ISSUE DESCRIPTION])
2. State the legal principle from the verified authorities
3. Apply the law to the specific facts
4. Cite ONLY from the VERIFIED AUTHORITIES block above
5. For each authority cite as "[Party v Party, Year Court]" — no invented AIR/SCC reporter numbers
Use numbered paragraphs within each ground.`,
  arguments: 'Generate ONLY the ARGUMENTS section. Build on the GROUNDS. For each argument: state proposition, cite authority, apply to facts, respond to likely counter-argument.',
  prayer: 'Generate ONLY the PRAYER section. Begin with "WHEREFORE, it is most respectfully prayed that this Hon\'ble Court may be pleased to:". List specific reliefs as (a), (b), (c)... Include costs and interim relief.',
  verification: 'Generate ONLY the VERIFICATION block. Standard Indian format: solemnly affirm, true and correct, deponent signature block with [BLANK] placeholders.',
  annexures: 'Generate ONLY the LIST OF ANNEXURES. List as "Annexure A — [Document description]". Mark required items from rule engine outputs.',
};

/**
 * Resolve the model for a section tier, respecting document complexity and quality mode.
 *
 * - PREMIUM mode: always use the highest model for each tier (no cost savings).
 * - simple complexity: cap everything at mini/economy — no Terra/Sol needed.
 * - standard + complex: Sol for premium (grounds/arguments); Terra for mid; mini for cheap.
 */
function modelForTierWithComplexity(
  tier: 'cheap' | 'mid' | 'premium',
  complexity: 'simple' | 'standard' | 'complex',
  modelMode: 'AUTO' | 'PREMIUM' = 'AUTO',
): string {
  if (modelMode === 'PREMIUM') {
    // Higher accuracy mode: full tiering with best models
    switch (tier) {
      case 'premium': return DRAFT_PREMIUM_MODEL;
      case 'mid':     return DRAFT_ENRICH_MODEL;
      default:        return DEFAULT_AUTO_MODEL;
    }
  }

  switch (complexity) {
    case 'simple':
      // Simple forms: cheap model everywhere — catalog forms, notices, agreements
      return DEFAULT_AUTO_MODEL;

    case 'standard':
    case 'complex':
    default:
      // Serious drafting: Sol for grounds/arguments; Terra for mid; mini for boilerplate
      switch (tier) {
        case 'premium': return DRAFT_PREMIUM_MODEL;
        case 'mid':     return DRAFT_ENRICH_MODEL;
        default:        return DEFAULT_AUTO_MODEL;
      }
  }
}

/** @deprecated Use modelForTierWithComplexity */
function modelForTier(tier: 'cheap' | 'mid' | 'premium'): string {
  return modelForTierWithComplexity(tier, 'complex');
}

function buildSectionSystemPrompt(
  section: SectionPlan,
  outline: DocumentOutline,
  evidenceValidation?: SectionEvidenceValidation,
  docComplexity: 'simple' | 'standard' | 'complex' = 'complex',
  modelMode: 'AUTO' | 'PREMIUM' = 'AUTO',
): string {
  const { globalContext: ctx } = outline;
  const parts: string[] = [SECTION_ACCURACY_RULES];

  if (
    outline.documentKind.includes('petition') ||
    outline.documentKind.includes('pleading') ||
    outline.documentKind.includes('bail') ||
    outline.documentKind.includes('writ') ||
    outline.documentKind.includes('complaint') ||
    outline.documentKind.includes('plaint') ||
    outline.documentKind.includes('revision') ||
    outline.documentKind.includes('appeal')
  ) {
    parts.push(INDIA_COURT_PLEADING_PROTOCOL);
  }

  parts.push(`\nDOCUMENT: ${outline.documentTitle}`);
  parts.push(`KIND: ${outline.documentKind}`);
  parts.push(`JURISDICTION: ${outline.jurisdiction} (${outline.countryCode})`);
  if (ctx.courtName) parts.push(`COURT: ${ctx.courtName}`);

  const pr = ctx.proceduralResult;
  if (pr.causeTitleVehicle) {
    parts.push(`PROCEDURAL VEHICLE: ${pr.causeTitleVehicle}`);
  }
  if (pr.governingSections.length > 0) {
    parts.push(
      `GOVERNING SECTIONS: ${pr.governingSections.map((g) => `${g.actId} §${g.section} (${g.label})`).join(', ')}`,
    );
  }
  if (pr.proceduralWarnings.length > 0) {
    parts.push(`PROCEDURAL NOTES: ${pr.proceduralWarnings.join('; ')}`);
  }

  if (ctx.statuteGrounding && ['grounds', 'law', 'facts', 'maintainability'].includes(section.type)) {
    parts.push(`\n${ctx.statuteGrounding}`);
  }

  if (['grounds', 'arguments', 'law', 'maintainability'].includes(section.type)) {
    if (ctx.verifiedAuthorities.length > 0) {
      // Limit injected authorities per section: 10 for simple/standard, 15 for complex/PREMIUM.
      // Each authority adds ~50 tokens; trimming reduces input cost on non-complex sections.
      const maxAuthorities = (docComplexity === 'complex' || modelMode === 'PREMIUM') ? 15 : 10;
      parts.push('\nVERIFIED AUTHORITIES (cite ONLY from this list — do NOT invent citations):');
      for (const auth of ctx.verifiedAuthorities.slice(0, maxAuthorities)) {
        parts.push(
          `- ${auth.title}${auth.citation ? ` [${auth.citation}]` : ''}: ${(auth.summary ?? '').slice(0, 200)}`,
        );
      }
    } else {
      parts.push(
        '\nVERIFIED AUTHORITIES: None retrieved — use governing statute sections only. Do NOT invent AIR/SCC citations.',
      );
    }

    const terminologyBlock = buildLegalTerminologyBlock(outline.documentKind);
    if (terminologyBlock) {
      parts.push(`\n${terminologyBlock}`);
    }
  }

  if (section.structuralGuide) {
    parts.push(`\n${section.structuralGuide}`);
  }

  if (section.ruleOutputs && section.ruleOutputs.length > 0) {
    parts.push('\nVERIFIED RULE ENGINE OUTPUTS (deterministic — do not override):');
    for (const r of section.ruleOutputs) {
      parts.push(`- ${r}`);
    }
  }

  if (evidenceValidation) {
    if (evidenceValidation.missingDescriptions.length > 0) {
      parts.push('\nMISSING EVIDENCE (disclose explicitly — do NOT invent):');
      for (const m of evidenceValidation.missingDescriptions) {
        parts.push(`- MISSING: ${m}`);
      }
    }
    if (evidenceValidation.generatorInstruction) {
      parts.push(`\n${evidenceValidation.generatorInstruction}`);
    }
  }

  if (section.requiredIngredients.length > 0) {
    parts.push('\nREQUIRED INGREDIENTS (ensure all are addressed):');
    for (const ing of section.requiredIngredients) {
      parts.push(`- ${ing}`);
    }
  }

  const instruction = SECTION_INSTRUCTIONS[section.type] ?? `Generate the ${section.title} section.`;
  parts.push(`\nINSTRUCTION: ${instruction}`);

  return parts.join('\n');
}

function buildPriorSectionsContext(
  section: SectionPlan,
  priorSections: Map<string, string>,
  outline: DocumentOutline,
): string {
  if (priorSections.size === 0) return '';

  const relevantTypes: SectionType[] = (() => {
    switch (section.type) {
      case 'grounds':
        return ['facts', 'law', 'maintainability'] as SectionType[];
      case 'arguments':
        return ['facts', 'grounds'] as SectionType[];
      case 'prayer':
        return ['grounds'] as SectionType[];
      case 'maintainability':
        return ['parties', 'facts'] as SectionType[];
      case 'law':
        return ['facts'] as SectionType[];
      default:
        return [] as SectionType[];
    }
  })();

  const relevantSections: string[] = [];
  for (const sectionId of section.dependsOn) {
    const sectionType = outline.sections.find((s) => s.id === sectionId)?.type;
    if (sectionType && relevantTypes.includes(sectionType)) {
      const content = priorSections.get(sectionId);
      if (content) {
        relevantSections.push(`ALREADY DRAFTED — ${sectionType.toUpperCase()}:\n${content}`);
      }
    }
  }

  return relevantSections.length > 0
    ? `CONTEXT FROM ALREADY GENERATED SECTIONS (for consistency — do not repeat):\n${relevantSections.join('\n\n')}`
    : '';
}

@Injectable()
export class SectionGeneratorService {
  private readonly logger = new Logger(SectionGeneratorService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    @Optional() private readonly promptInjection: PromptInjectionService | null,
    @Optional() private readonly fineTunedModels: FineTunedModelResolverService | null,
  ) {}

  /**
   * Generate a single section. Returns raw content + token usage.
   * Does NOT run verification — that is SectionVerifierService's job.
   *
   * @param docComplexity  — overall document complexity from DraftComplexityService
   * @param modelMode      — AUTO (default) or PREMIUM (user toggled "Higher accuracy")
   */
  async generateSection(
    section: SectionPlan,
    outline: DocumentOutline,
    priorSections: Map<string, string>,
    evidenceValidation?: SectionEvidenceValidation,
    docComplexity: 'simple' | 'standard' | 'complex' = 'complex',
    modelMode: 'AUTO' | 'PREMIUM' = 'AUTO',
    tenantId?: string,
  ): Promise<{ content: string; modelUsed: string; inputTokens: number; outputTokens: number }> {
    if (section.boilerplateContent) {
      this.logger.debug(`Injecting boilerplate for section ${section.id} (${section.type})`);
      return {
        content: section.boilerplateContent,
        modelUsed: 'boilerplate',
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    let modelName = modelForTierWithComplexity(section.modelTier, docComplexity, modelMode);
    // A/B fine-tuned drafter for substantive sections (never replaces independent verifier)
    if (
      this.fineTunedModels &&
      tenantId &&
      (section.modelTier === 'mid' || section.modelTier === 'premium')
    ) {
      modelName = await this.fineTunedModels.resolveDrafterModel(
        outline.documentKind,
        section.type,
        modelName,
      );
    }
    let systemPrompt = buildSectionSystemPrompt(section, outline, evidenceValidation, docComplexity, modelMode);

    if (this.promptInjection) {
      // User personal style / preset (injected first — highest specificity)
      const ctx = outline.globalContext as typeof outline.globalContext & { userId?: string; styleId?: string };
      if (ctx?.userId) {
        const styleBlock = await this.promptInjection
          .resolveStyleBlock(ctx.userId, ctx.styleId)
          .catch(() => null);
        if (styleBlock) systemPrompt += styleBlock;
      }
      // Firm-learned preference (injected after — baseline)
      if (tenantId) {
        const firmSuffix = await this.promptInjection
          .buildPromptSuffix(tenantId, outline.documentKind, section.type, outline.countryCode)
          .catch(() => null);
        if (firmSuffix) systemPrompt += firmSuffix;
      }
    }

    const { globalContext: ctx } = outline;
    const contextLines: string[] = [];
    if (ctx.clientName) contextLines.push(`Client/Petitioner: ${ctx.clientName}`);
    if (ctx.courtName) contextLines.push(`Court: ${ctx.courtName}`);
    if (ctx.opposingParty) contextLines.push(`Opposing Party: ${ctx.opposingParty}`);

    const priorContent = buildPriorSectionsContext(section, priorSections, outline);

    const userMessage = [
      ...contextLines,
      '',
      'CASE DETAILS / FACTS:',
      ctx.caseDetails,
      ctx.attachmentContext
        ? `\nATTACHED DOCUMENT CONTEXT:\n${ctx.attachmentContext.slice(0, 3000)}`
        : '',
      priorContent ? `\n${priorContent}` : '',
      '',
      `Now generate ONLY the "${section.title}" section.`,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    try {
      const result = await this.llm.complete({
        modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        maxTokens: section.maxTokens,
        temperature: section.type === 'grounds' || section.type === 'arguments' ? 0.15 : 0.2,
      });

      return {
        content: result.content.trim(),
        modelUsed: result.modelName,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (err) {
      this.logger.error(
        `Section generation failed for ${section.id} (${section.type}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }
}
