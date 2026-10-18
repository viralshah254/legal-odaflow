import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { isExplicitDocumentKind, shouldSkipClarifyingQuestions } from './draft-intent.helpers';
import { ALL_DOCUMENT_KINDS, resolveDocumentKind } from '@/config/templates/document-kinds';
import {
  MatterClarificationService,
  filterGenericMiQuestions,
  mergeClarifyingQuestions,
} from './matter-clarification.service';
import { extractMatterFacts, hasMaintenanceLanguage, buildEffectiveQuery, isSelfDefenseHomicideContext, applyExtractedProfileOverride } from './matter-fact-extractor';
import type { ClarifyingQuestion, DraftAnalyzeResult, DraftContext } from './draft-intent.types';
import {
  buildCommercialRecoveryQuestions,
  buildIndiaCommercialRecoveryRoute,
} from './india-commercial-recovery-route';

// ─── City → Indian state code map ────────────────────────────────────────────

const INDIA_CITY_STATE: Array<[RegExp, string]> = [
  [/\b(ahmedabad|surat|vadodara|baroda|gandhinagar|rajkot|bhavnagar|jamnagar|junagadh|anand)\b/i, 'GJ'],
  [/\b(mumbai|pune|nagpur|nashik|aurangabad|thane|solapur|kolhapur|navi\s+mumbai)\b/i, 'MH'],
  [/\b(bengaluru|bangalore|mysuru|mysore|hubli|dharwad|mangaluru|mangalore|belagavi|belgaum)\b/i, 'KA'],
  [/\b(chennai|madurai|coimbatore|trichy|tiruchirappalli|salem|tirunelveli|vellore)\b/i, 'TN'],
  [/\b(hyderabad|warangal|nizamabad|karimnagar|secunderabad)\b/i, 'TS'],
  [/\b(kolkata|howrah|durgapur|asansol|siliguri)\b/i, 'WB'],
  [/\b(jaipur|jodhpur|udaipur|kota|bikaner|ajmer)\b/i, 'RJ'],
  [/\b(lucknow|agra|varanasi|allahabad|prayagraj|kanpur|meerut|ghaziabad|noida)\b/i, 'UP'],
  [/\b(chandigarh)\b/i, 'CH'],
  [/\b(delhi|new\s+delhi|dwarka|rohini)\b/i, 'DL'],
  [/\b(patna|gaya|bhagalpur|muzaffarpur)\b/i, 'BR'],
  [/\b(bhopal|indore|gwalior|jabalpur)\b/i, 'MP'],
  [/\b(bhubaneswar|cuttack|rourkela)\b/i, 'OD'],
  [/\b(thiruvananthapuram|kochi|kozhikode|thrissur|ernakulam)\b/i, 'KL'],
  [/\b(dehradun|haridwar|rishikesh)\b/i, 'UK'],
  [/\b(raipur|bilaspur|bhilai)\b/i, 'CG'],
  [/\b(ranchi|jamshedpur|dhanbad)\b/i, 'JH'],
  [/\b(ludhiana|amritsar|jalandhar|patiala)\b/i, 'PB'],
];

// ─── Regex extractors ─────────────────────────────────────────────────────────

function detectJurisdiction(text: string): string | undefined {
  for (const [pattern, code] of INDIA_CITY_STATE) {
    if (pattern.test(text)) return code;
  }
  if (/\bgujarat\b/i.test(text)) return 'GJ';
  if (/\bmaharashtra\b/i.test(text)) return 'MH';
  if (/\bkarnataka\b/i.test(text)) return 'KA';
  if (/\btamil\s+nadu\b/i.test(text)) return 'TN';
  if (/\btelangana\b/i.test(text)) return 'TS';
  if (/\bwest\s+bengal\b/i.test(text)) return 'WB';
  if (/\bajasthan\b/i.test(text)) return 'RJ';
  if (/\buttar\s+pradesh\b/i.test(text)) return 'UP';
  if (/\bkerala\b/i.test(text)) return 'KL';
  if (/\bpunjab\b/i.test(text)) return 'PB';
  if (/\bbihar\b/i.test(text)) return 'BR';
  if (/\bmadhya\s+pradesh\b/i.test(text)) return 'MP';
  if (/\bodisha\b/i.test(text)) return 'OD';
  return undefined;
}

function detectStatute(text: string): string | undefined {
  if (/section\s+24\s+(of\s+)?(the\s+)?hma\b|hma\s+(sec(tion)?\.?\s*)?24\b/i.test(text)) return 'hma_24';
  if (/hindu\s+marriage\s+act\b/i.test(text) && /\bmaintenance\b/i.test(text)) return 'hma_24';
  if (/section\s+144\s+(of\s+)?bnss\b|bnss\s+(sec(tion)?\.?\s*)?144\b/i.test(text)) return 'bnss_144';
  if (/section\s+125\s+(of\s+)?cr\.?\s*p\.?\s*c\.?\b|crpc\s*(sec(tion)?\.?\s*)?125\b/i.test(text)) return 'bnss_144';
  if (/\bbnss\s+(sec(tion)?\.?\s*)?438\b|section\s+438\s+(of\s+)?bnss\b/i.test(text)) return 'bnss_144';
  if (/\bdomestic\s+violence\b|\bpwdva\b|\bdv\s+act\b|\bdv\s+case\b|\bprotection\s+of\s+women\b/i.test(text)) {
    return 'dv_act';
  }
  if (/\bhindu\s+marriage\b/i.test(text)) return 'hma_24';
  return undefined;
}

function detectCourt(text: string): string | undefined {
  if (/\bcommercial\s+division\b/i.test(text)) return 'commercial_division';
  if (/\bcommercial\s+court\b/i.test(text)) return 'commercial_court';
  if (/\bfamily\s+court\b/i.test(text)) return 'family_court';
  if (/\bmagistrate\b|\bjmfc\b|\bmm\s+court\b|\bmetropolitan\s+magistrate\b/i.test(text)) return 'magistrate';
  if (/\bhigh\s+court\b/i.test(text)) return 'high_court';
  if (/\bdistrict\s+court\b|\bdistrict\s+judge\b/i.test(text)) return 'district_court';
  if (/\bsessions\s+court\b|\bsessions\s+judge\b/i.test(text)) return 'sessions_court';
  return undefined;
}

function detectOrderType(text: string): string | undefined {
  if (/\binterim\b|\bpendente\s+lite\b|\btemporary\s+maintenance\b/i.test(text)) return 'interim';
  if (/\binterim\s+order\b/i.test(text) && hasMaintenanceLanguage(text)) return 'interim';
  if (/\bfinal\s+order\b|\bdisposed\s+on\s+merits\b|\bfinal\s+judgment\b/i.test(text)) return 'final';
  return undefined;
}

function detectDocumentIntent(text: string): string | undefined {
  if (/\bchallenge\b|\bset\s+aside\b|\bquash\b|\bimpugn\b|\bchalleng/i.test(text)) return 'challenge';
  if (/\brevision\b|\brevision\s+petition\b/i.test(text)) return 'challenge';
  if (/\bfile\b|\bapply\b|\bseek\b|\bpetition\s+for\b|\bapplication\s+for\b/i.test(text)) return 'apply';
  return undefined;
}

function computeConfidence(
  statute: string | undefined,
  court: string | undefined,
  text: string,
): DraftContext['statuteConfidence'] {
  if (statute && court) return 'high';
  if (statute || court) return 'medium';
  if (hasMaintenanceLanguage(text) || /\brevision\b/i.test(text)) return 'low';
  return 'none';
}

const DOCUMENT_KIND_SET = new Set<string>(ALL_DOCUMENT_KINDS);

function normalizeDocumentKind(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return DOCUMENT_KIND_SET.has(normalized) ? normalized : undefined;
}

function normalizeDocumentKindConfidence(value: unknown): DraftContext['documentKindConfidence'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : undefined;
}

function normalizeDocumentKindAlternatives(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeDocumentKind(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 2);
}

function shouldUseLlmDocumentKind(
  heuristicKind: string | undefined,
  regexConfidence: DraftContext['statuteConfidence'],
  miConfidence: number,
  recommendationMode: string | undefined,
  query: string,
): boolean {
  if (!heuristicKind || heuristicKind === 'service_agreement') return true;
  if (regexConfidence === 'low' || regexConfidence === 'none') return true;
  if (miConfidence < 0.65 || recommendationMode !== 'matched') return true;
  return !isExplicitDocumentKind(heuristicKind, query);
}

// ─── Questions builder ────────────────────────────────────────────────────────

/** Family-law statute questions must not appear when MI has classified a different practice area. */
export function shouldOfferFamilyLawClarifyingQuestions(
  practiceArea: string | undefined,
  text: string,
): boolean {
  if (practiceArea === 'employment_labour') return false;
  if (practiceArea === 'corporate_commercial') return false;
  if (practiceArea === 'consumer') return false;
  if (practiceArea === 'family_matrimonial') return true;
  return hasMaintenanceLanguage(text);
}

function buildQuestions(
  text: string,
  statute: string | undefined,
  court: string | undefined,
  confidence: DraftContext['statuteConfidence'],
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];
  const hasMaintenance = hasMaintenanceLanguage(text);
  const hasRevision = /\brevision\b/i.test(text);
  const explicitCriminalRevision = /\bcriminal\s+revision(\s+petition)?\b/i.test(text);

  if (hasMaintenance && confidence !== 'high' && !explicitCriminalRevision) {
    questions.push({
      id: 'maintenance_statute',
      prompt: 'What statute was the maintenance petition filed under?',
      options: [
        {
          value: 'hma_24',
          label: 'Section 24 HMA — Hindu Marriage Act (Family Court)',
          hint: 'Matrimonial proceedings. Challenge goes to High Court via Article 227 or Civil Revision.',
          routes_to: 'hma_section_24_challenge',
        },
        {
          value: 'bnss_144',
          label: 'Section 144 BNSS / Section 125 CrPC (Magistrate Court)',
          hint: 'Criminal maintenance proceedings. Challenged by Criminal Revision Petition.',
          routes_to: 'maintenance_order_revision',
        },
        {
          value: 'dv_act',
          label: 'Section 23 Domestic Violence Act',
          hint: 'Protection of Women from Domestic Violence Act, 2005.',
          routes_to: 'protective_injunction',
        },
        {
          value: 'not_sure',
          label: 'Not sure — let AI decide',
          routes_to: 'maintenance_application',
        },
      ],
    });
  }

  if (hasRevision && !hasMaintenance && !statute && confidence === 'none') {
    questions.push({
      id: 'revision_type',
      prompt: 'Is this a civil or criminal revision?',
      options: [
        {
          value: 'criminal',
          label: 'Criminal Revision (BNSS §438 / CrPC §397)',
          hint: 'Challenging orders in criminal proceedings before a Magistrate or Sessions Court.',
          routes_to: 'criminal_revision',
        },
        {
          value: 'civil',
          label: 'Civil Revision (CPC §115)',
          hint: 'Challenging interlocutory orders in civil proceedings.',
          routes_to: 'civil_revision',
        },
      ],
    });
  }

  return questions;
}

// ─── LLM context schema ───────────────────────────────────────────────────────

const ANALYZE_SYSTEM_PROMPT = `You are an Indian legal document classifier. Extract structured context from the user's text.

Return ONLY valid JSON. No explanation. Schema:
{
  "jurisdiction": string|null,   // Indian state code: "GJ","MH","KA","TN","TS","WB","RJ","UP","DL","CH","KL","PB","BR","MP","OD","UK","CG","JH","AS","HP","JK" or null
  "statute": string|null,        // controlling statute/procedure slug when identifiable, else null
  "court": string|null,          // "commercial_court" | "civil_court" | "family_court" | "magistrate" | "high_court" | "district_court" | "sessions_court" | "tribunal" | null
  "orderType": string|null,      // "interim" | "final" | null
  "documentIntent": string|null, // "challenge" | "apply" | null
  "documentKind": string|null,   // canonical document kind slug from the allowlist below
  "documentKindConfidence": string|null, // "high" | "medium" | "low" | null
  "documentKindAlternatives": string[],  // up to 2 alternate canonical slugs
  "documentKindReason": string|null
}

Rules:
- "hma_24": Hindu Marriage Act §24 (matrimonial maintenance), Family Court
- "bnss_144": BNSS §144 / CrPC §125 maintenance OR BNSS §438 / CrPC §397 criminal revision
- "dv_act": Domestic Violence Act §23
- "challenge": user wants to contest/appeal/revise an existing order
- "apply": user wants to file a fresh petition/application
- Choose the documentKind that best matches the user's factual goal, even if they use non-legal language.
- Prefer complaint/petition/notice/suit/revision kinds over service_agreement when the facts describe a dispute or filing.
- Use "service_agreement" only for actual commercial service-contract drafting.
- Commercial unpaid-invoice/purchase-order recovery is not family maintenance. Prefer summary_suit_recovery for an express Order XXXVII request and money_recovery_suit for an ordinary recovery claim.
- Court level, territorial jurisdiction, specified value, and mandatory pre-filing steps are independent fields; never infer Family Court or Magistrate merely from generic words such as petition, application, interim, or payment.
- CRITICAL — death + self-defence / private defence / "trying to save himself": NEVER set documentKindConfidence to "high". Prefer "low". Do NOT assume the user wants an FIR as complainant. Set documentKindAlternatives to include defense_memo and bail_application alongside police_complaint. documentKindReason must say posture is ambiguous (survivor complaint vs accused defence) and clarification is required.
- If unsure between 2-3 procedural routes, set confidence "low" and include alternatives.
- Allowed documentKind slugs: ${ALL_DOCUMENT_KINDS.join(', ')}
- If a fact is not mentioned, return null for that field.`;

interface LlmExtractedContext {
  jurisdiction: string | null;
  statute: string | null;
  court: string | null;
  orderType: string | null;
  documentIntent: string | null;
  documentKind?: string | null;
  documentKindConfidence?: 'high' | 'medium' | 'low' | null;
  documentKindAlternatives?: string[] | null;
  documentKindReason?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DraftIntentAnalyzeService {
  private readonly logger = new Logger(DraftIntentAnalyzeService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly clarification: MatterClarificationService,
  ) {}

  async analyze(query: string, supplementalContext?: string): Promise<DraftAnalyzeResult> {
    const effectiveQuery = buildEffectiveQuery(query, supplementalContext);

    const miResult = await this.matterPipeline.run({
      facts: effectiveQuery,
      query: effectiveQuery,
      skipRetrieval: true,
      consumer: 'draftIntent',
    });

    // Layer 1: regex (instant, always runs)
    const jurisdiction = detectJurisdiction(effectiveQuery);
    const statute = detectStatute(effectiveQuery);
    const court = detectCourt(effectiveQuery);
    const orderType = detectOrderType(effectiveQuery);
    const documentIntent = detectDocumentIntent(effectiveQuery);
    const heuristicKind = resolveDocumentKind(undefined, effectiveQuery);

    const regexConfidence = computeConfidence(statute, court, effectiveQuery);

    // Layer 2: cheap LLM fallback — only when regex is uncertain
    let finalJurisdiction = jurisdiction;
    let finalStatute = statute;
    let finalCourt = court;
    let finalOrderType = orderType;
    let finalDocumentIntent = documentIntent;
    let finalConfidence = regexConfidence;
    let finalDocumentKind: string | undefined;
    let finalDocumentKindConfidence: DraftContext['documentKindConfidence'];
    let finalDocumentKindAlternatives: string[] = [];
    let finalDocumentKindReason: string | undefined;

    if (
      regexConfidence === 'low' ||
      regexConfidence === 'none' ||
      shouldUseLlmDocumentKind(
        heuristicKind,
        regexConfidence,
        miResult.profile.confidence,
        miResult.recommendationMode,
        effectiveQuery,
      )
    ) {
      try {
        const extracted = await this.llmExtract(effectiveQuery);
        // Merge: LLM fills in what regex missed; regex values take precedence if present
        if (!finalJurisdiction && extracted.jurisdiction) finalJurisdiction = extracted.jurisdiction;
        if (!finalStatute && extracted.statute) finalStatute = extracted.statute;
        if (!finalCourt && extracted.court) finalCourt = extracted.court;
        if (!finalOrderType && extracted.orderType) finalOrderType = extracted.orderType;
        if (!finalDocumentIntent && extracted.documentIntent) finalDocumentIntent = extracted.documentIntent;
        const llmDocumentKind = normalizeDocumentKind(extracted.documentKind);
        if (llmDocumentKind) {
          finalDocumentKind = llmDocumentKind;
          finalDocumentKindConfidence = normalizeDocumentKindConfidence(
            extracted.documentKindConfidence,
          ) ?? 'medium';
          finalDocumentKindAlternatives = normalizeDocumentKindAlternatives(
            extracted.documentKindAlternatives,
          ).filter((kind) => kind !== llmDocumentKind);
          if (typeof extracted.documentKindReason === 'string') {
            finalDocumentKindReason = extracted.documentKindReason.slice(0, 240);
          }
        }
        // Recompute confidence with merged results
        finalConfidence = computeConfidence(finalStatute ?? undefined, finalCourt ?? undefined, effectiveQuery);
      } catch (err) {
        // LLM failed — fall through to regex results only
        this.logger.warn(`LLM fallback in analyze failed: ${String(err)}`);
      }
    }

    if (!finalDocumentKind && heuristicKind && heuristicKind !== 'service_agreement') {
      finalDocumentKind = heuristicKind;
      finalDocumentKindConfidence = isExplicitDocumentKind(heuristicKind, effectiveQuery)
        ? 'high'
        : 'medium';
    }

    const extracted = extractMatterFacts(effectiveQuery);
    const commercialRoute = buildIndiaCommercialRecoveryRoute(effectiveQuery);

    if (commercialRoute) {
      finalJurisdiction = finalJurisdiction ?? detectJurisdiction(effectiveQuery);
      finalCourt = commercialRoute.forum;
      finalDocumentIntent = 'apply';
      finalDocumentKind = commercialRoute.documentKind;
      finalDocumentKindConfidence = commercialRoute.confidence;
      finalDocumentKindAlternatives =
        commercialRoute.proceedingType === 'summary_suit'
          ? ['money_recovery_suit']
          : ['summary_suit_recovery'];
      finalDocumentKindReason = commercialRoute.reasons.join(' ').slice(0, 240);
      finalConfidence = commercialRoute.confidence;
    }

    // Death + self-defence: never present high-confidence FIR as the settled route.
    if (isSelfDefenseHomicideContext(extracted)) {
      finalDocumentKindConfidence = 'low';
      finalDocumentKind = finalDocumentKind ?? 'defense_memo';
      const alts = new Set<string>([
        ...(finalDocumentKindAlternatives ?? []),
        'defense_memo',
        'bail_application',
        'police_complaint',
      ]);
      if (finalDocumentKind) alts.delete(finalDocumentKind);
      finalDocumentKindAlternatives = Array.from(alts).slice(0, 3);
      finalDocumentKindReason =
        'Death reported with self-defence narrative — posture is ambiguous (survivor FIR vs accused defence / bail). Clarification required; do not treat FIR as high-confidence.';
      if (finalDocumentKind === 'police_complaint' || finalDocumentKind === 'criminal_complaint') {
        // Prefer defence-leaning default until the user answers.
        finalDocumentKind = 'defense_memo';
        finalDocumentKindAlternatives = ['bail_application', 'police_complaint'].slice(0, 3);
      }
    }

    const context: DraftContext = {
      jurisdiction: finalJurisdiction ?? undefined,
      statute: finalStatute ?? undefined,
      court: finalCourt ?? undefined,
      orderType: finalOrderType ?? undefined,
      documentIntent: finalDocumentIntent ?? undefined,
      statuteConfidence: finalConfidence,
      documentKind: finalDocumentKind,
      documentKindConfidence: finalDocumentKindConfidence,
      documentKindAlternatives: finalDocumentKindAlternatives.length
        ? finalDocumentKindAlternatives
        : undefined,
      documentKindReason: finalDocumentKindReason,
    };

    const contextualQuestions = commercialRoute
      ? buildCommercialRecoveryQuestions(commercialRoute)
      : this.clarification.buildContextualQuestions(
          effectiveQuery,
          miResult.profile,
          context,
          extracted,
        );

    const legacyQuestions =
      commercialRoute ||
      (!isSelfDefenseHomicideContext(extracted) && shouldSkipClarifyingQuestions(effectiveQuery)) ||
      !shouldOfferFamilyLawClarifyingQuestions(miResult.profile.practiceArea, effectiveQuery)
        ? []
        : buildQuestions(effectiveQuery, finalStatute ?? undefined, finalCourt ?? undefined, finalConfidence);

    const filteredMi = commercialRoute
      ? []
      : filterGenericMiQuestions(
          miResult.clarifyingQuestions,
          miResult.profile,
          extracted,
          context,
        );

    let questions = mergeClarifyingQuestions(contextualQuestions, legacyQuestions, filteredMi);
    questions = await this.clarification.polishQuestions(questions, extracted);

    const recommendationMode =
      questions.length > 0 || isSelfDefenseHomicideContext(extracted)
        ? ('clarification_required' as const)
        : miResult.recommendationMode;

    // Override MI family/maintenance misclassification for self-defence homicide.
    let matterProfile = applyExtractedProfileOverride(
      miResult.profile,
      extracted,
      effectiveQuery,
    );
    if (commercialRoute) {
      matterProfile = {
        ...matterProfile,
        country: 'IN',
        practiceArea: commercialRoute.practiceArea,
        subPracticeArea: commercialRoute.subPracticeArea,
        nature: 'dispute',
        forum: commercialRoute.forum,
        posture: 'original',
        remedies: ['recovery', 'contractual_interest'],
        issues: ['Commercial debt recovery', 'Order XXXVII maintainability'],
        documentTypes: [commercialRoute.documentKind],
        documentKind: commercialRoute.documentKind,
        curatedKinds: [commercialRoute.draftKind],
        confidence: commercialRoute.confidence === 'high' ? 0.95 : 0.75,
        jurisdiction: finalJurisdiction,
      };
    }
    if (isSelfDefenseHomicideContext(extracted) && matterProfile.confidence > 0.55) {
      const prev = matterProfile.fieldConfidence;
      matterProfile = {
        ...matterProfile,
        confidence: 0.55,
        fieldConfidence: {
          practiceArea: Math.min(prev?.practiceArea ?? 0.55, 0.7),
          subPracticeArea: Math.min(prev?.subPracticeArea ?? 0.55, 0.55),
          nature: Math.min(prev?.nature ?? 0.55, 0.7),
          forum: Math.min(prev?.forum ?? 0.55, 0.55),
        },
      };
    }

    return {
      context,
      questions,
      extractedFacts: extracted,
      matterProfile,
      matterGraph: miResult.graph,
      taskGraph: miResult.taskGraph,
      recommendedActions: miResult.taskGraph?.recommendedActions,
      issues: matterProfile.issues,
      recommendationMode,
      nextBestAction: miResult.taskGraph?.nextBestAction,
      routeDecision: commercialRoute,
      draftingBlocked: Boolean(commercialRoute?.blockingIssues.length),
    };
  }

  private async llmExtract(query: string): Promise<LlmExtractedContext> {
    // Use the cheapest available model — ~$0.001 per call
    const result = await this.llm.complete({
      modelName: DEFAULT_EXTRACT_MODEL,
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        { role: 'user', content: query.slice(0, 1500) },  // cap input to save tokens
      ],
      maxTokens: 350,
      temperature: 0,
    });

    // Strip markdown fences if present
    const raw = result.content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(raw) as LlmExtractedContext;
  }
}
