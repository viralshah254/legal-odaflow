import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { LlmCompletionService } from '../llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '../model-costs.config';
import { STATE_OVERLAYS } from '@/config/state-overlays';
import { US_FEDERAL_DRAFT_PROMPTS } from './us-draft-prompts-federal';
import { US_STATE_BASE_DRAFT_PROMPTS } from './us-draft-prompts-state';
import {
  US_STATE_NAMED_BOUND_STATE,
  US_STATE_NAMED_PROMPTS,
} from './us-draft-prompts-state-named';
import { resolveDynamicFormPrompt, resolveJudicialCouncilPromptByKind } from './prompt-factories/judicial-council-prompt.factory';
import { resolveIrsPrompt, resolveIrsPromptByKind } from './prompt-factories/irs-prompt.factory';
import { resolveUscisPrompt, resolveUscisPromptByKind } from './prompt-factories/uscis-prompt.factory';
import { FillUsBlanksDto, GenerateUsDraftDto, EnrichUsDraftDto } from './us-draft.dto';
import { LEGAL_ACCURACY_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';
import { DraftResearchGroundingService } from '@/ai/drafting/draft-research-grounding.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import { DraftVerificationService } from '@/ai/drafting/draft-verification.service';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import { UsLegalSectionRouterService } from './us-legal-section-router.service';
import { DraftIntakeExtractionService } from '@/ai/drafting/draft-intake-extraction.service';
import { DraftFactFidelityService } from '@/ai/drafting/draft-fact-fidelity.service';
import { getUsSkeletonForKind } from '@/ai/drafting/structural-references/us-reference-skeletons';
import { CaseLawEnrichService } from '@/ai/unified-drafting/enrich/case-law-enrich.service';
import { randomUUID } from 'crypto';

export interface DraftAuthContext {
  userId: string;
  tenantId: string;
}

const US_DRAFTING_RULES = `
${LEGAL_ACCURACY_PROTOCOL}

You are an expert US legal drafter. Follow these rules:
1. Use proper court caption format with parties, court name, case number placeholder, and document title.
2. State facts in numbered paragraphs for pleadings; use clear headings for motions and letters.
3. Cite controlling statutes and rules using standard Bluebook abbreviations — never invent USC or state code numbers.
4. Use active voice and precise legal terminology.
5. Include signature blocks, certificates of service, and verification where customary.
6. For state documents, apply the state overlay statutes, court names, and procedural notes provided.
7. Do not invent facts, evidence, witnesses, or dates not in the intake. Use [BLANK] placeholders.
8. Do not use India court register language (MOST RESPECTFULLY SHOWETH, etc.).
`;

@Injectable()
export class UsDraftService {
  private readonly logger = new Logger(UsDraftService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly creditEnforcement: AiCreditEnforcementService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly usageRecorder: AiUsageRecorderService,
    private readonly verification: DraftVerificationService,
    private readonly proceduralGate: DraftProceduralGateService,
    private readonly researchGrounding: DraftResearchGroundingService,
    private readonly draftHistory: CourtDraftHistoryService,
    private readonly usSectionRouter: UsLegalSectionRouterService,
    private readonly intakeExtraction: DraftIntakeExtractionService,
    private readonly factFidelity: DraftFactFidelityService,
    private readonly caseLawEnrich: CaseLawEnrichService,
  ) {}

  private buildOverlayBlock(overlay: (typeof STATE_OVERLAYS)[string]): string {
    const catalogNote = overlay.officialFormCatalog
      ? `\n- Official form catalog: ${JSON.stringify(overlay.officialFormCatalog)}`
      : '';
    return `
STATE OVERLAY (${overlay.stateName}, ${overlay.code}):
- Apex court: ${overlay.apexCourt}
- Trial court template: ${overlay.trialCourtTemplate}
- Civil code: ${overlay.civilCode}
- Civil rules: ${overlay.civilRules}
- Criminal rules: ${overlay.criminalRules}
- Family statute: ${overlay.familyStatute}
- Probate statute: ${overlay.probateStatute}
- Landlord-tenant statute: ${overlay.landlordTenantStatute}
- Small claims limit: ${overlay.smallClaimsLimit}
- Procedural notes: ${overlay.proceduralNotes.join(' ')}
- Form references: ${JSON.stringify(overlay.formReferences)}${catalogNote}
Use ${overlay.stateName} court names, statutes, and procedural requirements throughout the draft.`;
  }

  private resolvePrompt(dto: GenerateUsDraftDto): string {
    // Tier 4: dynamic form number (long-tail catalog)
    if (dto.formNumber) {
      const uscis = resolveUscisPrompt(dto.formNumber);
      if (uscis) return uscis;
      const irs = resolveIrsPrompt(dto.formNumber);
      if (irs) return irs;
      return resolveDynamicFormPrompt(dto.formNumber, dto.formTitle, dto.stateCode);
    }

    // Tier 4b: dynamic kind prefixes
    if (dto.kind.startsWith('us_form_')) {
      const num = dto.kind.replace('us_form_', '').replace(/_/g, '-').toUpperCase();
      return resolveDynamicFormPrompt(num, undefined, dto.stateCode);
    }

    const uscisByKind = resolveUscisPromptByKind(dto.kind);
    if (uscisByKind) return uscisByKind;

    const irsByKind = resolveIrsPromptByKind(dto.kind);
    if (irsByKind) return irsByKind;

    const jcByKind = resolveJudicialCouncilPromptByKind(dto.kind);
    if (jcByKind) return jcByKind;

    // Tier 1: federal
    const federalPrompt = US_FEDERAL_DRAFT_PROMPTS[dto.kind];
    if (federalPrompt) {
      return federalPrompt;
    }

    // Tier 3: state-named forms
    const namedPrompt = US_STATE_NAMED_PROMPTS[dto.kind];
    if (namedPrompt) {
      const boundState = US_STATE_NAMED_BOUND_STATE[dto.kind];
      const stateCode = dto.stateCode ?? boundState;
      if (!stateCode) {
        throw new BadRequestException(`State code is required for: ${dto.kind}`);
      }
      if (boundState && stateCode !== boundState) {
        throw new BadRequestException(
          `Document kind ${dto.kind} requires state ${boundState}, got ${stateCode}`,
        );
      }
      const overlay = STATE_OVERLAYS[stateCode];
      if (!overlay) {
        throw new BadRequestException(`Unknown state code: ${stateCode}`);
      }
      return `${namedPrompt}\n\n${this.buildOverlayBlock(overlay)}`;
    }

    // Tier 2: state-base + overlay
    const stateBasePrompt = US_STATE_BASE_DRAFT_PROMPTS[dto.kind];
    if (!stateBasePrompt) {
      throw new BadRequestException(`Unknown document kind: ${dto.kind}`);
    }

    if (!dto.stateCode) {
      throw new BadRequestException(
        `State code is required for state document kind: ${dto.kind}`,
      );
    }

    const overlay = STATE_OVERLAYS[dto.stateCode];
    if (!overlay) {
      throw new BadRequestException(`Unknown state code: ${dto.stateCode}`);
    }

    return `${stateBasePrompt}\n\n${this.buildOverlayBlock(overlay)}`;
  }

  async generateDraft(
    dto: GenerateUsDraftDto,
    ctx: DraftAuthContext,
  ): Promise<{
    draft: string;
    creditsUsed: number;
    verification?: DraftVerificationAudit;
  }> {
    const structuredIntake = await this.intakeExtraction.extract({
      caseDetails: dto.caseDetails,
      countryCode: 'US',
      documentKind: dto.kind,
    });
    const sectionRoute = this.usSectionRouter.resolve({
      rawFacts: dto.caseDetails,
      documentKind: dto.kind,
      stateCode: dto.stateCode,
      forumIntent: structuredIntake.forumIntent,
    });
    const effectiveKind =
      sectionRoute.recommendedKind &&
      sectionRoute.recommendedKind !== 'us_form_catalog' &&
      dto.kind === 'us_form_catalog'
        ? sectionRoute.recommendedKind
        : dto.kind;
    // Never silently upgrade catalog → state kind without a state code (would 400).
    const kindForDraft =
      effectiveKind.startsWith('us_state_') && !dto.stateCode && dto.kind === 'us_form_catalog'
        ? dto.kind
        : effectiveKind;

    const formatPrompt = this.resolvePrompt({ ...dto, kind: kindForDraft });
    const gate = this.proceduralGate.check({
      kind: kindForDraft,
      caseDetails: dto.caseDetails,
      countryCode: 'US',
    });
    const gateBlock = this.proceduralGate.buildPromptBlock(gate);
    const skeleton = getUsSkeletonForKind(kindForDraft);
    const skeletonBlock = skeleton
      ? `REFERENCE STRUCTURE (copy register; fill facts only):\n${skeleton.referenceText}`
      : '';

    const filingGrade = /motion|complaint|answer|appeal|brief|petition|writ|restraining|bail|detention/i.test(
      kindForDraft,
    );
    const researchGrounding = filingGrade
      ? await this.researchGrounding.buildGrounding({
          kind: kindForDraft,
          caseDetails: dto.caseDetails,
          countryCode: 'US',
          jurisdiction: dto.stateCode,
          courtName: dto.courtName,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          knowledgeSources: dto.knowledgeSources,
        })
      : null;

    const intakeBlock = this.intakeExtraction.buildPromptBlock(structuredIntake);
    const fidelityBlock = this.factFidelity.buildPromptBlock(dto.caseDetails);

    const systemPrompt = `${US_DRAFTING_RULES}\n\n${formatPrompt}${gateBlock ? `\n\n${gateBlock}` : ''}${sectionRoute.promptBlock ? `\n\n${sectionRoute.promptBlock}` : ''}${skeletonBlock ? `\n\n${skeletonBlock}` : ''}${intakeBlock ? `\n\n${intakeBlock}` : ''}${fidelityBlock ? `\n\n${fidelityBlock}` : ''}${researchGrounding ? `\n\n${researchGrounding.verifiedAuthoritiesBlock}` : ''}

Output the complete draft as plain text with proper paragraph breaks. Do NOT wrap in markdown fences. Use uppercase for headings where customary. Include all standard clauses for this document type. Use descriptive [BLANK] placeholders for missing facts. Cite ONLY from VERIFIED AUTHORITIES when provided. Do not invent statutes.`;

    const contextLines: string[] = [];
    if (dto.clientName) contextLines.push(`Client Name: ${dto.clientName}`);
    if (dto.courtName) contextLines.push(`Court: ${dto.courtName}`);
    if (dto.opposingParty) contextLines.push(`Opposing Party: ${dto.opposingParty}`);
    if (dto.stateCode) contextLines.push(`State: ${dto.stateCode}`);

    const userPrompt = `${contextLines.length ? contextLines.join('\n') + '\n\n' : ''}Case Details / Facts:
${dto.caseDetails}

Draft a complete, filing-ready document for the above matter.`;

    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.TEMPLATE_DRAFT,
    });

    const result = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 3000,
      temperature: 0.2,
    });

    const verified = await this.verification.verify({
      draft: result.content,
      kind: kindForDraft,
      caseDetails: dto.caseDetails,
      countryCode: 'US',
      jurisdiction: dto.stateCode,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      proceduralWarnings: [...gate.proceduralWarnings, ...sectionRoute.warnings],
      completenessGaps: [...gate.completenessGaps, ...sectionRoute.missingFacts],
      recommendedKind: kindForDraft,
      groundingAuthorities: researchGrounding?.authorities,
    });

    const recorded = await this.usageRecorder.recordTokenUsage({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.TEMPLATE_DRAFT,
      mode: 'AUTO',
      modelName: result.modelName,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      countryCode: 'US',
      metadata: {
        kind: kindForDraft,
        userKind: dto.kind,
        stateCode: dto.stateCode,
        strippedCitations: verified.audit.strippedCitations.length,
      },
    });

    try {
      await this.draftHistory.save({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        source: 'us',
        kind: kindForDraft,
        countryCode: 'US',
        jurisdiction: dto.stateCode,
        caseDetails: dto.caseDetails,
        clientName: dto.clientName,
        courtName: dto.courtName,
        opposingParty: dto.opposingParty,
        draftText: verified.draft,
        verificationAudit: verified.audit,
        creditsUsed: recorded.chargedCredits,
      });
    } catch (err) {
      this.logger.warn(`Failed to persist US draft history: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      draft: verified.draft,
      creditsUsed: recorded.chargedCredits,
      verification: verified.audit,
    };
  }

  async fillBlanks(
    dto: FillUsBlanksDto,
    ctx: DraftAuthContext,
  ): Promise<{
    suggestions: Record<string, string>;
    creditsUsed: number;
  }> {
    if (!dto.emptyFields || dto.emptyFields.length === 0) {
      return { suggestions: {}, creditsUsed: 0 };
    }

    const contextStr = Object.entries(dto.context ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const stateNote = dto.stateCode
      ? `State: ${dto.stateCode} (${STATE_OVERLAYS[dto.stateCode]?.stateName ?? 'unknown'})`
      : 'Jurisdiction: Federal';

    const systemPrompt =
      `${US_DRAFTING_RULES}\n\n` +
      'You are filling in blank fields in a US legal document. ' +
      'Output ONLY a valid JSON object mapping field names to suggested string values. ' +
      'No markdown fences, no explanation outside JSON.';

    const userPrompt = `Document kind: ${dto.documentKind}
${stateNote}

Known facts already provided:
${contextStr || '(none)'}

Fields that need AI suggestions (return a JSON object with these keys):
${dto.emptyFields.map((f) => `- "${f}"`).join('\n')}

Output a single JSON object like: {"field1": "value", "field2": "value"}`;

    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_FILL_BLANKS,
    });

    const result = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    });

    let suggestions: Record<string, string> = {};
    try {
      const clean = result.content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      suggestions = JSON.parse(clean) as Record<string, string>;
    } catch {
      this.logger.warn('UsDraft fillBlanks: JSON parse failed, returning empty suggestions');
    }

    const recorded = await this.usageRecorder.recordTokenUsage({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_FILL_BLANKS,
      flatCredits: getCreditCost(AI_TASK_TYPES.DRAFT_FILL_BLANKS),
      mode: 'AUTO',
      modelName: result.modelName,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      countryCode: 'US',
      metadata: { documentKind: dto.documentKind, stateCode: dto.stateCode },
    });

    return {
      suggestions,
      creditsUsed: recorded.chargedCredits,
    };
  }

  async enrichDraft(
    dto: EnrichUsDraftDto,
    ctx: DraftAuthContext,
  ) {
    return this.caseLawEnrich.enrich({
      jobId: randomUUID(),
      draftText: dto.draftText,
      documentKind: dto.documentKind,
      rawFacts: dto.rawFacts ?? '',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      jurisdiction: dto.stateCode ?? 'US',
      countryCode: 'US',
      mode: dto.mode ?? 'case_laws',
    });
  }
}
