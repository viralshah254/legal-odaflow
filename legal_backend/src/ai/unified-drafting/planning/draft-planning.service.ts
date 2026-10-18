import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DraftModelRouterService } from '../draft-model-router.service';
import type { QualityTier } from '../contracts/model-aliases';
import type {
  DraftExecutionPlan,
  SectionPlan,
  SectionModelTier,
  ModelBudget,
} from '../contracts/draft-execution-plan';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import type { ProceduralGateResult } from '../procedural/unified-procedural-gate.service';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';

export interface BuildPlanInput {
  jobId: string;
  matter: NormalizedMatter;
  proceduralResult: ProceduralGateResult;
  sourceRegistry: VerifiedSourceRegistry;
  qualityTier: QualityTier;
  tenantId: string;
  userId: string;
}

const PLANNER_SYSTEM_PROMPT = `You are a legal document planning assistant. Your job is to create a drafting execution plan — not the document itself.

Given a document type, key facts, and procedural context, output a JSON plan with:
- An ordered list of document sections
- For each section: its type, purpose, required fact IDs, allowed source IDs, whether it depends on other sections, token budget, and model tier

Model tiers:
- "cheap": headings, schedules, signature blocks, cover pages, verification clauses
- "standard": synopsis, chronology, list of dates, memo of parties, definitions
- "strong": facts, jurisdiction, limitation, maintainability, grounds, arguments, prayers, interim relief
- "premium": only for explicitly complex constitutional issues or authority conflicts

Wave rules:
- Sections with no dependencies form wave 0 and run in parallel
- A section may depend on earlier sections only when it genuinely requires their content
- Batch tiny related sections (e.g. heading+parties, verification+signature)

Section count guidelines:
- Matrimonial / family law petitions: 5–7 sections maximum
- Bail / revision petitions: 3–5 sections
- Civil plaints / suits: 6–8 sections
- Notices / letters: 3–5 sections
- Trademark / IPR legal notices: exactly 5 sections (heading+parties, facts+TM particulars, grounds, demands, signature)
- Trademark / IPR commercial suits (plaint): 7–8 sections including a standalone interim-injunction application section
- Legal research memoranda (research_memo / legal_research / consumer_research_memo): exactly 6 sections — SHORT ANSWER, ISSUES, FACTS, ANALYSIS, AUTHORITIES, NEXT STEPS. FORBIDDEN: CAUSE TITLE, MEMO OF PARTIES, PRAYER, VERIFICATION, jurisdiction/maintainability as standalone pleading sections.
- Case strategy memoranda (case_strategy_memo): 7 sections — CASE THESIS, PARTY ANALYSIS, ISSUES, AUTHORITIES, EVIDENCE PLAN, STRATEGY, RISKS. Same forbidden pleading form.
Do not create separate "Synopsis", "List of Dates", or "Jurisdiction" sections unless the document type specifically requires them as standalone pleadings (e.g. Supreme Court / High Court appeals). Family Court petitions do not need these; merge jurisdiction into the grounds section as a short paragraph.

Output ONLY valid JSON. No markdown, no preamble.`;

@Injectable()
export class DraftPlanningService {
  private readonly logger = new Logger(DraftPlanningService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly modelRouter: DraftModelRouterService,
  ) {}

  async buildPlan(input: BuildPlanInput): Promise<DraftExecutionPlan> {
    const complexityScore = this.modelRouter.scoreComplexity(input.matter, input.matter.documentKind);
    const riskLevel = this.computeRiskLevel(complexityScore.total, input.proceduralResult);
    const model = this.modelRouter.resolvePlannerModel();

    let sections: SectionPlan[] = [];

    try {
      const prompt = this.buildPrompt(input, complexityScore.total);
      const result = await this.llm.complete({
        modelName: model,
        messages: [
          { role: 'system', content: PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 2000,
      });

      const parsed = JSON.parse(result.content) as { sections?: RawSectionPlan[] };
      sections = (parsed.sections ?? []).map((s, idx) =>
        this.normalizeSectionPlan(s, input, idx),
      );
    } catch (err) {
      this.logger.warn(`Planning LLM failed, using template plan: ${String(err)}`);
      sections = this.buildTemplatePlan(input.matter.documentKind, input);
    }

    const waves = this.buildWaves(sections);
    const modelBudget = this.buildModelBudget(input.qualityTier, complexityScore.total);

    return {
      jobId: input.jobId,
      documentKind: input.matter.documentKind,
      qualityTier: input.qualityTier,
      sections,
      generationWaves: waves,
      globalTokenBudget: sections.reduce((sum, s) => sum + s.tokenBudget, 0),
      modelBudget,
      complexityScore,
      riskLevel,
      builtAt: new Date().toISOString(),
    };
  }

  private buildPrompt(input: BuildPlanInput, complexityTotal: number): string {
    const sourceIds = input.sourceRegistry.sources.slice(0, 20).map((s) => s.id);
    const factIds = input.matter.facts.slice(0, 15).map((f) => f.id);
    const isResearchMemo = /research_memo|case_strategy|legal_research/i.test(
      input.matter.documentKind,
    );

    const schemaExample = isResearchMemo
      ? `{
  "sections": [
    {"sectionType": "short_answer", "title": "SHORT ANSWER", "purpose": "Executive summary with qualified conclusions", "dependencySectionIds": [], "modelTier": "strong", "tokenBudget": 600, "batchable": false, "verificationRules": ["no_placeholders"]},
    {"sectionType": "issues", "title": "ISSUES", "purpose": "Numbered legal questions for research", "dependencySectionIds": ["section_short_answer"], "modelTier": "strong", "tokenBudget": 700, "batchable": false, "verificationRules": ["no_placeholders"]},
    {"sectionType": "facts", "title": "FACTS", "purpose": "Neutral chronology from CaseRecord only", "dependencySectionIds": [], "modelTier": "strong", "tokenBudget": 1500, "batchable": false, "verificationRules": ["fact_support", "no_invented_dates"]},
    {"sectionType": "analysis", "title": "ANALYSIS", "purpose": "Apply law to facts with qualifications", "dependencySectionIds": ["section_facts", "section_issues"], "modelTier": "strong", "tokenBudget": 2000, "batchable": false, "verificationRules": ["no_placeholders"]},
    {"sectionType": "authorities", "title": "AUTHORITIES", "purpose": "Supporting and adverse authorities", "dependencySectionIds": ["section_analysis"], "modelTier": "strong", "tokenBudget": 1200, "batchable": false, "verificationRules": ["no_placeholders"]},
    {"sectionType": "next_steps", "title": "NEXT STEPS", "purpose": "Practical next steps and limitations", "dependencySectionIds": ["section_analysis"], "modelTier": "standard", "tokenBudget": 500, "batchable": false, "verificationRules": ["no_placeholders"]}
  ]
}`
      : `{
  "sections": [
    {"sectionType": "heading", "title": "Cause Title", "purpose": "...", "dependencySectionIds": [], "modelTier": "cheap", "tokenBudget": 300, "batchable": true, "verificationRules": ["no_placeholders"]},
    {"sectionType": "facts", "title": "Statement of Facts", "purpose": "...", "dependencySectionIds": [], "modelTier": "strong", "tokenBudget": 1500, "batchable": false, "verificationRules": ["fact_support", "no_invented_dates"]}
  ]
}`;

    return [
      `DOCUMENT TYPE: ${input.matter.documentKind}`,
      `JURISDICTION: ${input.matter.jurisdiction}`,
      `COURT: ${input.matter.court?.name ?? 'Not specified'}`,
      `QUALITY TIER: ${input.qualityTier}`,
      `COMPLEXITY SCORE: ${complexityTotal}/100`,
      `RISK LEVEL: ${this.computeRiskLevel(complexityTotal, input.proceduralResult)}`,
      '',
      `AVAILABLE FACT IDs: ${factIds.join(', ')}`,
      `AVAILABLE SOURCE IDs: ${sourceIds.join(', ')}`,
      '',
      `PROCEDURAL WARNINGS: ${input.proceduralResult.issues.map((i) => i.message).join('; ') || 'None'}`,
      `MANDATORY NOTICES: ${input.proceduralResult.proceduralProfile.mandatoryNotices?.join(', ') || 'None'}`,
      '',
      `OUTPUT SCHEMA:`,
      schemaExample,
    ].join('\n');
  }

  private normalizeSectionPlan(raw: RawSectionPlan, input: BuildPlanInput, index: number): SectionPlan {
    const allSourceIds = input.sourceRegistry.sources.map((s) => s.id);
    const factIds = input.matter.caseRecordBacked
      ? input.matter.facts.map((f) => f.id)
      : input.matter.facts.slice(0, 5).map((f) => f.id);
    return {
      sectionId: `section_${index}_${raw.sectionType ?? 'unknown'}`,
      title: raw.title ?? raw.sectionType ?? `Section ${index + 1}`,
      sectionType: raw.sectionType ?? 'unknown',
      purpose: raw.purpose ?? '',
      requiredFactIds: raw.requiredFactIds ?? factIds,
      allowedSourceIds: raw.allowedSourceIds ?? allSourceIds,
      dependencySectionIds: raw.dependencySectionIds ?? [],
      tokenBudget: raw.tokenBudget ?? 1000,
      modelTier: (raw.modelTier ?? 'standard') as SectionModelTier,
      verificationRules: raw.verificationRules ?? ['no_placeholders'],
      batchable: raw.batchable ?? true,
    };
  }

  private buildWaves(sections: SectionPlan[]): string[][] {
    const waves: string[][] = [];
    const placed = new Set<string>();

    let maxIterations = sections.length + 1;
    while (placed.size < sections.length && maxIterations-- > 0) {
      const wave: string[] = [];
      for (const section of sections) {
        if (placed.has(section.sectionId)) continue;
        const depsReady = section.dependencySectionIds.every((d) => placed.has(d));
        if (depsReady) wave.push(section.sectionId);
      }
      if (wave.length === 0) {
        // Circular dependency — place remaining sections in one wave
        const remaining = sections.filter((s) => !placed.has(s.sectionId)).map((s) => s.sectionId);
        waves.push(remaining);
        break;
      }
      waves.push(wave);
      for (const id of wave) placed.add(id);
    }

    return waves;
  }

  private buildTemplatePlan(documentKind: string, input: BuildPlanInput): SectionPlan[] {
    const sourceIds = input.sourceRegistry.sources.slice(0, 20).map((s) => s.id);
    const factIds = input.matter.facts.map((f) => f.id);

    const mkSection = (
      type: string,
      title: string,
      tier: SectionModelTier,
      budget: number,
      deps: string[] = [],
    ): SectionPlan => ({
      sectionId: `section_${type}`,
      title,
      sectionType: type,
      purpose: `Draft the ${title.toLowerCase()} section`,
      requiredFactIds: factIds,
      allowedSourceIds: sourceIds,
      dependencySectionIds: deps,
      tokenBudget: budget,
      modelTier: tier,
      verificationRules: ['no_placeholders'],
      batchable: tier === 'cheap',
    });

    if (/notice|letter/i.test(documentKind)) {
      // Trademark / IPR legal notice — more specific than the generic notice template
      if (/trademark|trade.?mark|passing.?off|ipr|intellectual.?property/i.test(documentKind)) {
        return [
          mkSection('heading', 'Cause Title & Parties', 'cheap', 300),
          mkSection('facts', 'Statement of Facts & Trademark Particulars', 'strong', 1800, ['section_heading']),
          mkSection('grounds', 'Legal Grounds — Infringement (Sections 28, 29 TM Act) & Passing Off', 'strong', 1500, ['section_facts']),
          mkSection('prayer', 'Demands & Consequences of Non-Compliance', 'strong', 800, ['section_grounds']),
          mkSection('signature', 'Without-Prejudice Reservation & Signature Block', 'cheap', 200, ['section_prayer']),
        ];
      }
      return [
        mkSection('heading', 'Letterhead & Date', 'cheap', 200),
        mkSection('parties', 'From/To Parties', 'cheap', 300),
        mkSection('facts', 'Subject & Facts', 'strong', 1000, ['section_parties']),
        mkSection('prayer', 'Relief & Demand', 'strong', 500, ['section_facts']),
        mkSection('signature', 'Signature Block', 'cheap', 100, ['section_prayer']),
      ];
    }

    // Matrimonial / family law petitions (divorce, separation, maintenance, conjugal rights)
    if (/divorce|matrimon|conjugal|maintenance|separation|dissolution/i.test(documentKind)) {
      return [
        mkSection('heading', 'Cause Title', 'cheap', 250),
        mkSection('parties', 'Memo of Parties', 'standard', 500),
        mkSection('facts', 'Statement of Facts', 'strong', 2500, ['section_parties']),
        mkSection('grounds', 'Grounds for Relief', 'strong', 2500, ['section_facts']),
        mkSection('prayer', 'Prayer Clause', 'strong', 600, ['section_grounds']),
        mkSection('verification', 'Verification', 'cheap', 250, ['section_prayer']),
      ];
    }

    // Bail / criminal revision petitions
    if (/bail|criminal.?revision|anticipatory/i.test(documentKind)) {
      return [
        mkSection('heading', 'Cause Title', 'cheap', 200),
        mkSection('grounds', 'Grounds for Bail', 'strong', 2000),
        mkSection('prayer', 'Prayer', 'strong', 500, ['section_grounds']),
        mkSection('verification', 'Verification', 'cheap', 200, ['section_prayer']),
      ];
    }

    // Trademark / IPR commercial suit (plaint + interim-injunction application)
    if (/trademark|trade.?mark|passing.?off|ipr|intellectual.?property/i.test(documentKind)) {
      return [
        mkSection('heading', 'Cause Title', 'cheap', 300),
        mkSection('parties', 'Memo of Parties', 'cheap', 400),
        mkSection('facts', 'Statement of Facts & Trademark Particulars', 'strong', 2000, ['section_parties']),
        mkSection('jurisdiction', 'Jurisdiction, Maintainability & Commercial Court Allocation', 'strong', 900, ['section_facts']),
        mkSection('grounds', 'Grounds — Infringement (Sections 28, 29 TM Act) & Passing Off', 'strong', 2500, ['section_jurisdiction']),
        mkSection('interim', 'Application for Interim Injunction — Urgency & Balance of Convenience', 'strong', 1200, ['section_grounds']),
        mkSection('prayer', 'Prayer Clause', 'strong', 600, ['section_grounds', 'section_interim']),
        mkSection('verification', 'Verification', 'cheap', 200, ['section_prayer']),
      ];
    }

    // Legal research memorandum (internal counsel — NOT a court pleading)
    if (/research_memo|legal_research/i.test(documentKind) && !/case_strategy/i.test(documentKind)) {
      return [
        mkSection('short_answer', 'SHORT ANSWER', 'strong', 600),
        mkSection('issues', 'ISSUES', 'strong', 700, ['section_short_answer']),
        mkSection('facts', 'FACTS', 'strong', 1800),
        mkSection('analysis', 'ANALYSIS', 'strong', 2200, ['section_facts', 'section_issues']),
        mkSection('authorities', 'AUTHORITIES', 'strong', 1200, ['section_analysis']),
        mkSection('next_steps', 'NEXT STEPS', 'standard', 500, ['section_analysis']),
      ];
    }

    // Case strategy memorandum
    if (/case_strategy/i.test(documentKind)) {
      return [
        mkSection('thesis', 'CASE THESIS', 'strong', 600),
        mkSection('party_analysis', 'PARTY ANALYSIS', 'strong', 900, ['section_thesis']),
        mkSection('issues', 'ISSUES', 'strong', 700, ['section_thesis']),
        mkSection('authorities', 'AUTHORITIES', 'strong', 1200, ['section_issues']),
        mkSection('evidence_plan', 'EVIDENCE PLAN', 'strong', 1000, ['section_issues']),
        mkSection('strategy', 'STRATEGY', 'strong', 1200, ['section_evidence_plan', 'section_authorities']),
        mkSection('risks', 'RISKS', 'standard', 500, ['section_strategy']),
      ];
    }

    // Default court document template
    return [
      mkSection('heading', 'Cause Title', 'cheap', 300),
      mkSection('parties', 'Memo of Parties', 'cheap', 400),
      mkSection('facts', 'Statement of Facts', 'strong', 1500, ['section_parties']),
      mkSection('jurisdiction', 'Jurisdiction & Maintainability', 'strong', 800, ['section_facts']),
      mkSection('grounds', 'Grounds', 'strong', 2000, ['section_jurisdiction']),
      mkSection('prayer', 'Prayer', 'strong', 600, ['section_grounds']),
      mkSection('verification', 'Verification', 'cheap', 200, ['section_prayer']),
    ];
  }

  private computeRiskLevel(
    complexityTotal: number,
    proceduralResult: ProceduralGateResult,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (proceduralResult.issues.some((i) => i.severity === 'critical')) return 'critical';
    if (complexityTotal > 70) return 'high';
    if (complexityTotal > 45) return 'medium';
    return 'low';
  }

  private buildModelBudget(qualityTier: QualityTier, complexityTotal: number): ModelBudget {
    const budgets: Record<QualityTier, ModelBudget> = {
      express: { maximumUsd: 0.10, maximumInputTokens: 30_000, maximumOutputTokens: 8_000, premiumModelAllowed: false },
      standard: { maximumUsd: 0.40, maximumInputTokens: 80_000, maximumOutputTokens: 20_000, premiumModelAllowed: false },
      premium: { maximumUsd: 2.00, maximumInputTokens: 200_000, maximumOutputTokens: 50_000, premiumModelAllowed: true },
    };
    const budget = budgets[qualityTier];
    if (complexityTotal > 70 && qualityTier === 'standard') {
      budget.premiumModelAllowed = true;
    }
    return budget;
  }
}

interface RawSectionPlan {
  sectionType?: string;
  title?: string;
  purpose?: string;
  requiredFactIds?: string[];
  allowedSourceIds?: string[];
  dependencySectionIds?: string[];
  tokenBudget?: number;
  modelTier?: string;
  verificationRules?: string[];
  batchable?: boolean;
}
