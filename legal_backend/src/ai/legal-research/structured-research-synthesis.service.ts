import { Injectable, Logger } from '@nestjs/common';
import {
  renderDraftToMarkdown,
  type AuthorityReliedOn,
  type ClaimBlock,
  type LegalFrameworkAuthority,
  type LegalResearchDraft,
} from './legal-research-draft.types';
import type { LegalEvidencePack } from './legal-evidence-pack.service';
import { linkApplicationClaimsInDraft } from './application-claim-linking';
import {
  ClaimLevelVerificationService,
  type ClaimVerificationResult,
} from './claim-level-verification.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import { evaluateLegalQuality } from './legal-quality-gates';
import type {
  LegalDomain,
  LegalResearchIntent,
} from './legal-research-classifier.service';
import type { ResearchTaskKind } from './research-planning.types';
import { isProvisionTaxonomyQuery } from '@/legal-search/contract-act-waiver.util';
import { isTenancyRemedyQuery } from '@/legal-search/india-tenant-eviction.util';
import type { ModelTier } from '@/ai/model-costs.config';
import { normalizeResearchQuestionPresented } from './research-mode';

export interface StructuredSynthesisInput {
  query: string;
  prompt: string;
  systemPrompt: string;
  modelName: string;
  evidencePack: LegalEvidencePack;
  jurisdiction: string;
  legalDomain?: LegalDomain;
  researchIntent?: LegalResearchIntent;
  legalIssues?: string[];
  taskKind?: ResearchTaskKind;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  maxTokens?: number;
  /** FAST uses a slim memo schema; DEEP uses the full proposition plan. */
  synthesisMode?: 'FAST' | 'DEEP';
  /** When live case-law failed, include an honest banner in salvage/output. */
  caseLawSearchStatus?: string | null;
  /** Refuse to answer from a model below this tier rather than degrade silently. */
  minTier?: ModelTier;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface StructuredSynthesisResult {
  outputMarkdown: string;
  draft: LegalResearchDraft | null;
  usedStructuredPlan: boolean;
  verificationUnavailable: boolean;
  findings: VerificationFinding[];
  claimVerification?: ClaimVerificationResult;
  usage: { inputTokens: number; outputTokens: number };
  suggestedFollowUpQuestions?: string[];
  /** Model and provider that actually produced the memo, after any fallback. */
  actualModel?: string;
  actualProvider?: string;
  /** True when the completion came from a different model than the one routed. */
  modelFellBack?: boolean;
}

export function repairStructuredJsonSyntax(raw: string): string {
  const withoutFences = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? withoutFences.slice(firstBrace, lastBrace + 1)
      : withoutFences;
  return candidate
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
}

const FAST_MEMO_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'questionPresented',
    'shortAnswer',
    'analysisMarkdown',
    'verificationNotes',
    'followUpQuestions',
  ],
  properties: {
    questionPresented: { type: 'string' },
    shortAnswer: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: { text: { type: 'string' } },
    },
    analysisMarkdown: { type: 'string' },
    verificationNotes: { type: 'array', items: { type: 'string' } },
    followUpQuestions: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * Evidence-first research synthesis: JSON proposition plan → claim-level verify → markdown.
 * Markdown-only fallback forces VERIFICATION_UNAVAILABLE (never silent prose-first success).
 */
@Injectable()
export class StructuredResearchSynthesisService {
  private readonly logger = new Logger(StructuredResearchSynthesisService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly claimVerifier: ClaimLevelVerificationService,
  ) {}

  async synthesize(input: StructuredSynthesisInput): Promise<StructuredSynthesisResult> {
    // Empty pack cannot satisfy DEEP proposition graph — use FAST/gap schema.
    // Keep DEEP when ≥1 admitted authority exists (Verified must stay research-grade).
    let mode = input.synthesisMode ?? 'DEEP';
    if (mode === 'DEEP' && this.isEmptyEvidencePack(input.evidencePack)) {
      mode = 'FAST';
      this.logger.log(
        '[structured-synthesis] Empty evidence pack — forcing FAST slim schema',
      );
    }
    const evidenceCatalog = this.buildEvidenceCatalog(
      input.evidencePack,
      mode === 'FAST' || (input.maxTokens ?? 4500) <= 4500,
    );
    const providerNote = this.providerFailureNote(input.caseLawSearchStatus);
    const maxTokens =
      mode === 'FAST'
        ? Math.max(input.maxTokens ?? 3500, 4000)
        : Math.max(input.maxTokens ?? 6000, 6000);

    const structuredSystem =
      mode === 'FAST'
        ? this.buildFastStructuredSystem(input, evidenceCatalog, providerNote)
        : this.buildDeepStructuredSystem(input, evidenceCatalog, providerNote);

    const llmStartedAt = Date.now();
    const completion = await this.llm.complete({
      modelName: input.modelName,
      minTier: input.minTier,
      messages: [
        { role: 'system', content: structuredSystem },
        { role: 'user', content: input.prompt },
      ],
      temperature: 0.1,
      reasoningEffort: input.reasoningEffort ?? (mode === 'FAST' ? 'low' : 'medium'),
      maxTokens,
      responseFormat:
        mode === 'FAST'
          ? {
              type: 'json_schema',
              json_schema: {
                name: 'fast_research_memo',
                strict: true,
                schema: FAST_MEMO_SCHEMA,
              },
            }
          : { type: 'json_object' },
      store: false,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });

    let usage = {
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };

    // Report the model that actually answered, not the one we asked for. A
    // silent fallback is exactly the kind of quality drop a caller must see.
    const modelTelemetry = {
      actualModel: completion.modelName,
      actualProvider: completion.provider as string,
      modelFellBack: completion.modelName !== input.modelName,
    };
    if (modelTelemetry.modelFellBack) {
      this.logger.warn(
        `[structured-synthesis] Routed ${input.modelName} but ${completion.modelName} answered`,
      );
    }

    const truncated =
      completion.finishReason === 'length' ||
      (completion.content?.trim().length ?? 0) > 0 &&
        !completion.content.trim().endsWith('}');

    let parsed =
      this.parseDraftJson(completion.content, input.query) ??
      this.parseDraftJson(repairStructuredJsonSyntax(completion.content), input.query);

    const remainingTimeoutMs =
      input.timeoutMs && input.timeoutMs > 0
        ? Math.max(0, input.timeoutMs - (Date.now() - llmStartedAt))
        : undefined;
    if ((!parsed || truncated) && input.signal?.aborted) {
      throw input.signal.reason instanceof Error
        ? input.signal.reason
        : new Error('Research drafting exceeded the mode deadline; returning a first-pass note.');
    }
    if ((!parsed || truncated) && remainingTimeoutMs !== undefined && remainingTimeoutMs < 1_500) {
      this.logger.warn(
        'Structured research JSON parse incomplete — skipping repair after synthesis deadline',
      );
    } else if (!parsed || truncated) {
      this.logger.warn(
        `Structured research JSON parse ${parsed ? 'truncated' : 'failed'} — running bounded correction`,
      );
      const retry = await this.llm.complete({
        modelName: input.modelName,
        messages: [
          {
            role: 'system',
            content:
              mode === 'FAST'
                ? 'Repair into valid fast_research_memo JSON with shortAnswer.text, analysisMarkdown, verificationNotes, followUpQuestions. Return JSON only.'
                : 'Repair malformed JSON into a complete LegalResearchDraft. Preserve fields. Ensure shortAnswer.text and issues[]. Return JSON only.',
          },
          {
            role: 'user',
            content: completion.content.slice(0, 24_000),
          },
        ],
        temperature: 0,
        reasoningEffort: 'low',
        maxTokens: Math.min(Math.max(maxTokens, 4000), 8000),
        responseFormat: { type: 'json_object' },
        store: false,
        timeoutMs: remainingTimeoutMs,
        signal: input.signal,
      });
      usage = {
        inputTokens: usage.inputTokens + retry.inputTokens,
        outputTokens: usage.outputTokens + retry.outputTokens,
      };
      parsed =
        this.parseDraftJson(retry.content, input.query) ??
        this.parseDraftJson(repairStructuredJsonSyntax(retry.content), input.query) ??
        parsed;
    }

    if (!parsed) {
      this.logger.warn(
        'Structured research JSON parse failed after retry — forcing VERIFICATION_UNAVAILABLE with salvage memo',
      );
      const fallbackMarkdown = this.buildParseFailureMarkdown(
        completion.content,
        input.evidencePack,
        input.query,
        input.caseLawSearchStatus,
      );
      return {
        outputMarkdown: fallbackMarkdown,
        draft: null,
        usedStructuredPlan: false,
        verificationUnavailable: true,
        findings: [
          {
            checkId: 'system:structured_plan_parse_failed',
            state: 'INDETERMINATE',
            severity: 'BLOCKER',
            dimension: 'system',
            evidenceIds: [],
            explanation:
              'Synthesis did not return a valid LegalResearchDraft JSON plan — publication is verification-unavailable.',
            repairAction: 'ABSTAIN',
            verifierVersion: 'structured-research-v2',
          },
        ],
        usage,
        ...modelTelemetry,
      };
    }

    const draft = this.sanitizeDraft(
      this.applyTaskShape(parsed.draft, input.taskKind),
      input.evidencePack,
    );
    const claimVerification = this.claimVerifier.verify({
      draft,
      evidencePack: input.evidencePack,
      jurisdiction: input.jurisdiction,
      query: input.query,
      legalIssues: input.legalIssues,
      legalDomain: input.legalDomain,
    });

    // Drop REMOVE claims before render
    const cleaned = this.applyClaimActions(draft, claimVerification.claimAudits);
    const qualityFindings = evaluateLegalQuality(cleaned, input.evidencePack);
    const citationMap = this.buildCitationMap(input.evidencePack);
    const rendered = renderDraftToMarkdown(cleaned, citationMap);
    const providerBanner = this.providerFailureBanner(input.caseLawSearchStatus);
    // FAST path: prefer analysisMarkdown, but always keep lawyer-memo section headings.
    const body =
      mode === 'FAST' && parsed.analysisMarkdown && parsed.analysisMarkdown.length > 40
        ? this.expandFastMemoMarkdown(
            cleaned.shortAnswer?.text ?? parsed.draft.shortAnswer?.text ?? '',
            parsed.analysisMarkdown,
            cleaned.verificationNotes,
            input.evidencePack,
            input.query,
          )
        : rendered;
    const outputMarkdown = `${providerBanner}${body}`;
    const findings = [...claimVerification.findings, ...qualityFindings];
    const qualityBlocked = qualityFindings.some(
      (finding) => finding.severity === 'BLOCKER' && finding.state === 'FAIL',
    );

    return {
      outputMarkdown,
      draft: cleaned,
      usedStructuredPlan: true,
      // FAST with a structured plan is still a usable memo — do not mark plan-failed.
      // Empty-pack FAST stays verification-unavailable for reliance badges only.
      verificationUnavailable:
        (mode === 'FAST' && this.isEmptyEvidencePack(input.evidencePack)) ||
        claimVerification.publicationState === 'VERIFICATION_UNAVAILABLE' ||
        qualityBlocked,
      findings,
      claimVerification,
      usage,
      suggestedFollowUpQuestions: parsed.followUpQuestions,
      ...modelTelemetry,
    };
  }

  private taskContract(kind?: ResearchTaskKind): string {
    switch (kind) {
      case 'CITATION_VERIFICATION':
      case 'CASE_LOOKUP':
        return 'TASK SHAPE: return identity, corrected citation if needed, court/date, supported holding, source and verification gaps only. Omit risks, strategy, practical steps and factual application.';
      case 'SECTION_LOOKUP':
        return 'TASK SHAPE: return exact operative text, version/effective-date status, source and linked interpretation gaps. Omit matter application, risks, strategy and practical steps.';
      case 'CASE_ANALYSIS':
        return 'TASK SHAPE: organize facts, issues, holding, ratio/obiter, disposition, posture, bench, treatment and pinpoint passages. Do not add client strategy.';
      case 'CASE_COMPARISON':
        return 'TASK SHAPE: organize each case consistently and compare analogous and distinguishing facts, holdings, posture, relief and treatment. Do not add client strategy.';
      case 'CASE_SURVEY':
        return 'TASK SHAPE: return a layered case survey. For verified judgments state only source-supported material facts, issue, holding and disposition. Put judgments with one unsupported requested field in a clearly labelled partially verified layer. Put candidate names/search phrases in a research-leads layer without asserting facts, holdings, outcomes or treatment. Missing subsequent treatment must be labelled but must not prevent the supported survey.';
      case 'PROCEDURE':
        return 'TASK SHAPE: organize forum, prerequisites, steps, timing, burden, relief, exceptions and source links. Practical steps must be legal-procedure steps, not generic advice.';
      case 'MATTER_OPINION':
        return 'TASK SHAPE: a matter opinion may include verified law, fact application, assumptions, unresolved facts, risks, strategy and conditional practical steps. Never present an inference as a supplied fact.';
      default:
        return 'TASK SHAPE: provide an issue-organized research answer and authority summaries. Omit strategy, risks and practical steps unless the task is MATTER_OPINION.';
    }
  }

  private applyTaskShape(
    draft: LegalResearchDraft,
    kind?: ResearchTaskKind,
  ): LegalResearchDraft {
    if (!kind || kind === 'MATTER_OPINION') return draft;
    const keepProcedureSteps = kind === 'PROCEDURE';
    return {
      ...draft,
      issues: draft.issues.map((issue) => {
        const propositions = issue.propositions.filter(
          (claim) => claim.type !== 'APPLICATION',
        );
        return {
          ...issue,
          application: [],
          propositions,
        };
      }),
      risksAndDefences: [],
      practicalSteps: keepProcedureSteps ? draft.practicalSteps : [],
    };
  }

  private providerFailureNote(status?: string | null): string {
    if (
      status === 'unauthorized' ||
      status === 'circuit_open' ||
      status === 'rate_limited' ||
      status === 'timeout' ||
      status === 'error' ||
      status === 'not_configured'
    ) {
      return `Live case-law search status: ${status}. Do not invent case citations. State once that live case-law retrieval was unavailable or incomplete.`;
    }
    return '';
  }

  private buildFastStructuredSystem(
    input: StructuredSynthesisInput,
    evidenceCatalog: string,
    providerNote: string,
  ): string {
    return [
      input.systemPrompt,
      '',
      '=== FAST RESEARCH MEMO (REQUIRED JSON) ===',
      this.intentContract(input.researchIntent),
      this.taskContract(input.taskKind),
      this.tenancyRemedyContract(input.query),
      'Return JSON with: questionPresented, shortAnswer.text, analysisMarkdown (full lawyer memo body in markdown), verificationNotes[], followUpQuestions[].',
      'Write a complete readable memo from your legal knowledge for the stated jurisdiction. No live source APIs ran.',
      'Do not invent reporter citations (SCC, AIR, SCR, All ER) or exact section numbers unless you are sure. If unsure, state the principle and say the pinpoint needs confirmation.',
      'After the memo, include a short Self-check: weakest assumptions, what would change the answer, and any cites you are not sure of.',
      'analysisMarkdown MUST include distinct sections — do not copy shortAnswer into other fields:',
      '- Short Answer: 2–4 sentences on what the lawyer can do now.',
      '- Legal rule: notice/cure, suspension, forum, governing law — not a restatement of the answer.',
      '- Application: map the supplied facts/contract to that rule.',
      '- Conclusion: recommended sequence and what is still unknown.',
      '- Self-check: weakest assumptions and what would change the answer.',
      'questionPresented must be one or two sentences covering the user problem (not only the ? lines). Never paste the full contract, signature block, or document dump.',
      'shortAnswer must NOT repeat or paraphrase the user query.',
      providerNote,
      '=== EVIDENCE CATALOG ===',
      evidenceCatalog,
      '=== END FAST RESEARCH MEMO ===',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildDeepStructuredSystem(
    input: StructuredSynthesisInput,
    evidenceCatalog: string,
    providerNote: string,
  ): string {
    return [
      input.systemPrompt,
      '',
      '=== STRUCTURED RESEARCH OUTPUT (REQUIRED) ===',
      this.intentContract(input.researchIntent),
      this.taskContract(input.taskKind),
      this.provisionTaxonomyContract(input.query),
      this.tenancyRemedyContract(input.query),
      'Respond with a single JSON object matching this schema (no markdown fences):',
      '{',
      '  "questionPresented": string,',
      '  "shortAnswer": { "text": string },',
      '  "legalFramework": [{ "evidenceId": string, "authorityType": "STATUTE"|"REGULATION"|"CASE"|"OTHER", "claimIds": string[] }],',
      '  "issues": [{ "issueId": string, "heading": string,',
      '    "rule": [{ "claimId": string, "text": string,',
      '      "type": "RULE"|"HOLDING"|"APPLICATION"|"PROCEDURE"|"LIMITATION"|"GENERAL_PRINCIPLE",',
      '      "evidenceIds": string[], "factIds"?: string[], "basedOnClaimIds"?: string[] }],',
      '    "application": [same claim shape, with type "APPLICATION"],',
      '    "conclusion": { "text": string, "strength": "STRONG"|"MODERATE"|"TENTATIVE"|"INSUFFICIENT", "controllingReasons": string[], "factualDependencies": string[], "adverseConsiderations": string[] } }],',
      '  "risksAndDefences": [{ "risk": string, "defence"?: string }],',
      '  "practicalSteps": [{ "id": string, "action": string, "timing": string, "purpose": string, "evidenceNeeded": string[], "dependsOnQuestionIds"?: string[], "safeActionType": "PRESERVE_EVIDENCE"|"GATHER_INFORMATION"|"VERIFY_AUTHORITY"|"SEEK_LEGAL_ADVICE"|"PREPARE_DRAFT"|"CONSIDER_FILING"|"CONSIDER_SETTLEMENT"|"COMPLY_WITH_ORDER"|"OTHER_SAFE", "condition"?: string }],',
      '  "authoritiesReliedOn": [{ "evidenceId": string, "claimIds": string[] }],',
      '  "unansweredQuestions": [{ "id": string, "question": string, "whyItMatters": string, "expectedAnswerType": "YES_NO"|"DATE"|"DOCUMENT"|"PERSON"|"AMOUNT"|"NARRATIVE"|"LEGAL_STATUS"|"OTHER", "affectedIssueId"?: string, "affectedConclusion"?: string, "suggestedSource": string }],',
      '  "verificationNotes": string[],',
      '  "scopeNote"?: string,',
      '  "followUpQuestions"?: string[]',
      '}',
      'Write a complete attorney-ready memo plan. Give the best supported answer and commit to issue conclusions where the evidence permits; do not replace analysis with generic caveats.',
      'Do not generate confidence scores or percentages. Confidence is computed after verification. Give controlling reasons, concrete factual dependencies, adverse considerations, and an evidence-bounded strength label.',
      'Use stable semantic ids (for example question_service_date and step_preserve_messages), not array indexes. Every unanswered question must explain why it matters, name the affected issue/conclusion, specify the expected answer type, and suggest a likely source where possible.',
      'Every practical step must state timing, purpose, evidence needed, dependencies, and a safe action type. Consequential filing, reporting, contact, payment, or publication steps must be framed conditionally and subject to applicable legal advice, permission, or factual predicates.',
      'Keep qualifications precise and proportionate. Put retrieval and verification caveats only in verificationNotes, not repeatedly in the short answer, rule, application, or conclusion.',
      'Order legalFramework with statutes and regulations before cases. Every legalFramework and authoritiesReliedOn entry must use an evidenceId from the catalog and point to supporting claimIds.',
      'RULE and HOLDING propositions MUST include evidenceIds from the catalog below when the catalog has a matching statute or a proposition-relevant case.',
      'Only emit a CASE HOLDING when the case is proposition-relevant to the query (same issue, not mere name existence). Irrelevant catalog cases must not become controlling holdings.',
      'APPLICATION must include factIds (from FACT lines) and basedOnClaimIds (claimIds of RULE/HOLDING propositions).',
      'Example APPLICATION: { "claimId": "app_1", "type": "APPLICATION", "text": "...", "evidenceIds": [], "factIds": ["research_fact_1"], "basedOnClaimIds": ["rule_1"] }',
      'Do not invent evidenceIds. If a useful framework statement lacks retrieved support, emit it as GENERAL_PRINCIPLE with no evidenceIds and add one compact verificationNote for the retrieval gap.',
      'Write from model knowledge for the stated jurisdiction. No live source APIs ran. Do not invent reporter citations or exact section numbers unless you are sure; if unsure, state the principle.',
      'SELF-CRITIQUE (same call, required): attack your own holdings, name the weakest assumptions, what facts would change the answer, and correct the memo before you finish. Put that critique in verificationNotes and a Self-check section — do not copy shortAnswer into rule or conclusion.',
      'shortAnswer must NOT echo the user prompt. Distinct Short Answer (options now), Legal rule (mechanics), Conclusion (sequence and unknowns).',
      'Cover strongest arguments both sides, evidence to obtain, strategy, forums/regulators, and a Weak→Very Strong case-strength label in conclusions or verificationNotes.',
      providerNote,
      '=== EVIDENCE CATALOG ===',
      evidenceCatalog,
      '=== END STRUCTURED RESEARCH OUTPUT ===',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private intentContract(intent?: LegalResearchIntent): string {
    switch (intent) {
      case 'CASE_COMPARISON':
        return 'CASE COMPARISON CONTRACT: for each case state material facts, issue/clause, court and posture, holding, disposition, treatment, pinpoint, and analogous/distinguishing relevance.';
      case 'STATUTORY_INTERPRETATION':
        return 'STATUTORY INTERPRETATION CONTRACT: identify the operative provision/version, exact supported text, elements, exceptions, judicial construction, and unresolved ambiguity.';
      case 'PROCEDURE':
        return 'PROCEDURE CONTRACT: identify forum, jurisdiction, standing/maintainability, required steps, documents, notice, limitation/timing, exceptions, and consequence of non-compliance.';
      case 'CURRENT_LAW':
        return 'CURRENT-LAW CONTRACT: distinguish current and superseded law, identify effective dates and treatment, and state the present rule only when current-law evidence supports it.';
      case 'ADVERSE_AUTHORITY':
        return 'ADVERSE-AUTHORITY CONTRACT: present the strongest supporting and adverse authorities, treatment, hierarchy, disposition, and principled distinctions without advocacy bias.';
      case 'CITATION_LOOKUP':
        return 'CITATION LOOKUP CONTRACT: verify identity, reporter/neutral citation, court, date, and supported holding; abstain if the identity or passage is not retrieved.';
      default:
        return 'GENERAL RESEARCH CONTRACT: answer each identified issue with rule, application, conclusion, and explicit gaps. Use model knowledge; mark uncertainty instead of inventing cites.';
    }
  }

  private provisionTaxonomyContract(query: string): string {
    if (!isProvisionTaxonomyQuery(query)) return '';
    return [
      'PROVISION TAXONOMY CONTRACT (MANDATORY):',
      'The query asks which statutory provisions are mandatory (non-waivable) vs default (modifiable by agreement).',
      'Produce a markdown table with columns: Section | Bucket (Mandatory bar / Remedial constraint / Default party choice) | Can parties contract out? | Retrieved evidenceId.',
      'Classify every retrieved Contract Act section in the catalog. For sections named in the query but not retrieved, list them as research gaps — do NOT refuse the taxonomy.',
      'Use STATUTE_CHARACTERIZATION claims linked to retrieved section evidenceIds. Mandatory = voidness/illegality bars (e.g. s.23, ss.25–30); remedial constraint = statutory limits on remedies (e.g. s.74, s.28); default = express party-choice provisions (e.g. ss.62–63).',
      'Give a direct Executive answer: parties cannot waive the Act wholesale; freedom exists inside the Act, not above it.',
    ].join('\n');
  }

  private tenancyRemedyContract(query: string): string {
    if (!isTenancyRemedyQuery(query)) return '';
    return [
      'TENANCY REMEDY CONTRACT (MANDATORY):',
      'Answer like a lawyer: a premature vacate demand without a valid termination ground does not end the tenancy; the tenant can usually stay in possession and seek injunction, declaration, and/or damages. Lack of alternative accommodation is hardship, not a free-standing statutory bar.',
      'Produce a markdown remedies table: Remedy | Source (TPA / SRA / CPC / Contract Act) | Retrieved evidenceId.',
      'Governing instrument: lease vs TPA default vs state rent act. If state is unknown, apply TPA and flag the overlay as a research gap — do not refuse the memo.',
      'Do not treat Olga Tellis / Article 21 as controlling against a private landlord unless the facts show state action.',
      'Apply retrieved TPA/SRA/CPC text in RULE claims. Put case-law gaps once in verificationNotes, not in the Executive answer.',
    ].join('\n');
  }

  private parseDraftJson(
    content: string,
    fallbackQuestion: string,
  ): { draft: LegalResearchDraft; followUpQuestions?: string[]; analysisMarkdown?: string } | null {
    const trimmed = this.stripCodeFences(content).trim();
    const candidates = [trimmed];
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }
    for (const candidate of candidates) {
      try {
        const obj = JSON.parse(candidate) as Partial<LegalResearchDraft> & {
          followUpQuestions?: string[];
          analysisMarkdown?: string;
        };
        const answer = obj.shortAnswer ?? obj.directAnswer;
        const answerText =
          typeof answer === 'object' && answer && typeof answer.text === 'string'
            ? answer.text
            : typeof answer === 'string'
              ? answer
              : '';
        if (!answerText.trim()) continue;

        // FAST / slim: shortAnswer + analysisMarkdown without full issues[] is enough.
        const analysisMarkdown =
          typeof obj.analysisMarkdown === 'string' ? obj.analysisMarkdown.trim() : '';
        const rawIssues = Array.isArray(obj.issues) ? obj.issues : [];
        const defaultIssues = this.issuesFromAnalysisMarkdown(analysisMarkdown, answerText);
        const issues = (rawIssues.length > 0 ? rawIssues : defaultIssues).map((issue) => {
          const normalizeClaim = (claim: ClaimBlock): ClaimBlock => ({
            ...claim,
            // Compatibility-only placeholder. User-visible confidence is derived after verification.
            confidence: 0.5,
          });
          const rule = Array.isArray(issue.rule) ? issue.rule.map(normalizeClaim) : [];
          const application = Array.isArray(issue.application)
            ? issue.application.map(normalizeClaim)
            : [];
          const propositions = Array.isArray(issue.propositions)
            ? issue.propositions.map(normalizeClaim)
            : [...rule, ...application];
          const distinctClaim = (claim: ClaimBlock) =>
            this.memoTextOverlap(claim.text ?? '', answerText) < 0.9;
          const distinctRule = rule.filter(distinctClaim);
          const distinctApplication = application.filter(distinctClaim);
          const distinctPropositions = propositions.filter(distinctClaim);
          const rawConclusion =
            typeof issue.conclusion === 'object' && issue.conclusion
              ? { ...issue.conclusion, confidence: 0.5 }
              : issue.conclusion;
          const conclusionText =
            typeof rawConclusion === 'string'
              ? rawConclusion
              : rawConclusion && typeof rawConclusion === 'object'
                ? rawConclusion.text
                : '';
          const conclusion =
            conclusionText && this.memoTextOverlap(conclusionText, answerText) >= 0.9
              ? typeof rawConclusion === 'string'
                ? ''
                : rawConclusion && typeof rawConclusion === 'object'
                  ? { ...rawConclusion, text: '' }
                  : rawConclusion
              : rawConclusion;
          return {
            ...issue,
            rule: distinctRule,
            application: distinctApplication,
            propositions: distinctPropositions,
            conclusion,
          };
        }).filter((issue) => {
          const conclusionText =
            typeof issue.conclusion === 'string'
              ? issue.conclusion
              : issue.conclusion && typeof issue.conclusion === 'object'
                ? issue.conclusion.text
                : '';
          return (
            issue.rule.length > 0 ||
            issue.application.length > 0 ||
            Boolean(conclusionText?.trim())
          );
        });
        const normalizedAnswer = {
          text: answerText,
          confidence: 0.5,
        };
        return {
          draft: {
            questionPresented: normalizeResearchQuestionPresented(
              typeof obj.questionPresented === 'string' ? obj.questionPresented : undefined,
              fallbackQuestion,
            ),
            shortAnswer: normalizedAnswer,
            directAnswer: normalizedAnswer,
            legalFramework: Array.isArray(obj.legalFramework) ? obj.legalFramework : [],
            issues,
            risksAndDefences: Array.isArray(obj.risksAndDefences)
              ? obj.risksAndDefences
              : [],
            practicalSteps: Array.isArray(obj.practicalSteps) ? obj.practicalSteps : [],
            authoritiesReliedOn: Array.isArray(obj.authoritiesReliedOn)
              ? obj.authoritiesReliedOn
              : [],
            limitations: Array.isArray(obj.limitations) ? obj.limitations : [],
            unansweredQuestions: Array.isArray(obj.unansweredQuestions)
              ? obj.unansweredQuestions
              : [],
            verificationNotes: Array.isArray(obj.verificationNotes)
              ? obj.verificationNotes
              : Array.isArray(obj.limitations)
                ? obj.limitations
                : [],
            scopeNote: obj.scopeNote,
          },
          followUpQuestions: Array.isArray(obj.followUpQuestions)
            ? obj.followUpQuestions.filter((q) => typeof q === 'string').slice(0, 4)
            : undefined,
          analysisMarkdown: analysisMarkdown || undefined,
        };
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  private sanitizeDraft(draft: LegalResearchDraft, pack: LegalEvidencePack): LegalResearchDraft {
    const registered = new Set<string>();
    const authorityTypes = new Map<string, LegalFrameworkAuthority['authorityType']>();
    for (const s of pack.statutes) {
      registered.add(s.evidenceId);
      authorityTypes.set(s.evidenceId, 'STATUTE');
    }
    for (const c of pack.authorities) {
      registered.add(c.evidenceId);
      authorityTypes.set(c.evidenceId, 'CASE');
      for (const p of c.passages) {
        registered.add(p.evidenceId);
        authorityTypes.set(p.evidenceId, 'CASE');
      }
    }
    for (const o of pack.officialMaterials) {
      registered.add(o.evidenceId);
      authorityTypes.set(o.evidenceId, 'OTHER');
    }
    const factIds = new Set(pack.matterFacts.map((f) => f.factId));

    const sanitizedIssues = draft.issues.map((issue) => ({
      ...issue,
      propositions: (issue.propositions ?? []).map((p) =>
        this.sanitizeClaim(p, registered, factIds),
      ),
    }));
    const linkedIssues = linkApplicationClaimsInDraft(sanitizedIssues, pack.matterFacts).map(
      (issue) => ({
        ...issue,
        rule: issue.propositions.filter((claim) => claim.type !== 'APPLICATION'),
        application: issue.propositions.filter((claim) => claim.type === 'APPLICATION'),
      }),
    );
    const claimIds = new Set(linkedIssues.flatMap((issue) => issue.propositions.map((p) => p.claimId)));

    return {
      ...draft,
      legalFramework: this.sanitizeFrameworkReferences(
        draft.legalFramework ?? [],
        registered,
        claimIds,
        authorityTypes,
      ),
      authoritiesReliedOn: this.sanitizeAuthorityReferences(
        draft.authoritiesReliedOn ?? [],
        registered,
        claimIds,
      ),
      issues: linkedIssues,
    };
  }

  private sanitizeFrameworkReferences(
    references: LegalFrameworkAuthority[],
    registered: Set<string>,
    claimIds: Set<string>,
    authorityTypes: Map<string, LegalFrameworkAuthority['authorityType']>,
  ): LegalFrameworkAuthority[] {
    return references
      .filter((reference) => registered.has(reference.evidenceId))
      .map((reference) => ({
        ...reference,
        authorityType: authorityTypes.get(reference.evidenceId) ?? 'OTHER',
        claimIds: (reference.claimIds ?? []).filter((claimId) => claimIds.has(claimId)),
      }));
  }

  private sanitizeAuthorityReferences<T extends LegalFrameworkAuthority | AuthorityReliedOn>(
    references: T[],
    registered: Set<string>,
    claimIds: Set<string>,
  ): T[] {
    return references
      .filter((reference) => registered.has(reference.evidenceId))
      .map((reference) => ({
        ...reference,
        claimIds: (reference.claimIds ?? []).filter((claimId) => claimIds.has(claimId)),
      }));
  }

  private sanitizeClaim(
    claim: ClaimBlock,
    registered: Set<string>,
    factIds: Set<string>,
  ): ClaimBlock {
    return {
      ...claim,
      evidenceIds: (claim.evidenceIds ?? []).filter((id) => registered.has(id)),
      factIds: (claim.factIds ?? []).filter((id) => factIds.has(id)),
      basedOnClaimIds: claim.basedOnClaimIds ?? [],
      confidence: typeof claim.confidence === 'number' ? claim.confidence : 0.5,
    };
  }

  private applyClaimActions(
    draft: LegalResearchDraft,
    audits: Array<{ claimId: string; action: string; notes?: string }>,
  ): LegalResearchDraft {
    const byId = new Map(audits.map((a) => [a.claimId, a]));
    const isStatuteCharacterization = (p: ClaimBlock) =>
      (p.type === 'RULE' || p.type === 'GENERAL_PRINCIPLE') &&
      (p.evidenceIds?.length ?? 0) > 0 &&
      /\b(?:mandatory|default|characteriz|notice period|notice to quit|lease|injunction|declaration|premature|section|s\.\s*\d+)\b/i.test(
        p.text,
      );
    const issues = draft.issues.map((issue) => {
      const propositions = issue.propositions
        .filter((p) => byId.get(p.claimId)?.action !== 'REMOVE' || isStatuteCharacterization(p))
        .map((p) =>
          byId.get(p.claimId)?.action === 'QUALIFY' && !isStatuteCharacterization(p)
            ? { ...p, confidence: Math.min(p.confidence, 0.45) }
            : p,
        );
      return {
        ...issue,
        rule: propositions.filter((claim) => claim.type !== 'APPLICATION'),
        application: propositions.filter((claim) => claim.type === 'APPLICATION'),
        propositions,
      };
    });
    const retainedClaimIds = new Set(
      issues.flatMap((issue) => issue.propositions.map((claim) => claim.claimId)),
    );
    const retainAuthorityClaims = <T extends LegalFrameworkAuthority | AuthorityReliedOn>(
      references: T[] | undefined,
    ): T[] =>
      (references ?? []).map((reference) => ({
        ...reference,
        claimIds: reference.claimIds.filter((claimId) => retainedClaimIds.has(claimId)),
      }));

    return {
      ...draft,
      issues,
      legalFramework: retainAuthorityClaims(draft.legalFramework),
      authoritiesReliedOn: retainAuthorityClaims(draft.authoritiesReliedOn),
      limitations: [
        ...draft.limitations,
        ...audits
          .filter((a) => a.action === 'REMOVE' || a.action === 'QUALIFY')
          .map((a) => a.notes ?? `Claim ${a.claimId} ${a.action.toLowerCase()}d by verifier.`),
      ],
      verificationNotes: [
        ...(draft.verificationNotes ?? []),
        ...audits
          .filter((a) => a.action === 'REMOVE' || a.action === 'QUALIFY')
          .map((a) => a.notes ?? `Claim ${a.claimId} ${a.action.toLowerCase()}d by verifier.`),
      ],
    };
  }

  private buildCitationMap(pack: LegalEvidencePack): Map<string, string> {
    const map = new Map<string, string>();
    for (const s of pack.statutes) {
      map.set(
        s.evidenceId,
        `${s.actName ?? s.heading ?? s.actId}${s.section ? ` s.${s.section}` : ''}`,
      );
    }
    for (const c of pack.authorities) {
      const cite = c.citation || c.title;
      map.set(c.evidenceId, cite);
      for (const p of c.passages) map.set(p.evidenceId, cite);
    }
    for (const o of pack.officialMaterials) {
      map.set(o.evidenceId, o.title);
    }
    return map;
  }

  private buildEvidenceCatalog(pack: LegalEvidencePack, compact: boolean): string {
    const lines: string[] = [];
    for (const s of pack.statutes.slice(0, compact ? 24 : 40)) {
      const statuteLabel = s.actName ?? s.heading ?? s.actId;
      lines.push(
        `- ${s.evidenceId}: STATUTE ${statuteLabel}${s.section ? ` s.${s.section}` : ''} — ${(s.text ?? '').slice(0, 240)}`,
      );
    }
    for (const c of pack.authorities.slice(0, compact ? 24 : 40)) {
      for (const p of c.passages.slice(0, compact ? 2 : 3)) {
        lines.push(
          `- ${p.evidenceId}: CASE ${c.title}${c.citation ? ` (${c.citation})` : ''} — ${p.text.slice(0, 280)}`,
        );
      }
    }
    for (const f of pack.matterFacts.slice(0, 20)) {
      lines.push(`- FACT ${f.factId}: ${f.description}`);
    }
    return lines.join('\n') || '(empty evidence pack)';
  }

  private stripCodeFences(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }

  private stripJsonBlocks(text: string): string {
    return text.replace(/```json[\s\S]*?```/gi, '').trim();
  }

  private providerFailureBanner(status?: string | null): string {
    if (
      status === 'unauthorized' ||
      status === 'circuit_open' ||
      status === 'rate_limited' ||
      status === 'timeout' ||
      status === 'error' ||
      status === 'not_configured'
    ) {
      return `> ⚠️ **Live case-law search incomplete** (\`${status}\`). Similar Cases may show PROVIDER_FAILURE. Do not treat missing precedents as “no cases exist.”\n\n`;
    }
    return '';
  }

  private isEmptyEvidencePack(pack?: LegalEvidencePack | null): boolean {
    if (!pack) return true;
    return (
      pack.statutes.length + pack.authorities.length + pack.officialMaterials.length === 0
    );
  }

  /** True when salvage text is mostly the user query (legacy echo Bottom Line). */
  private isQueryEcho(text: string, query: string): boolean {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const nt = norm(text);
    const nq = norm(query);
    if (!nt || !nq || nt.length < 40) return false;
    if (nt.startsWith('based on retrieved materials for')) return true;
    if (/here'?s a strong kenya-specific test/i.test(text)) return true;
    if (nq.length >= 80 && (nt.includes(nq.slice(0, 120)) || nq.includes(nt.slice(0, 120)))) {
      return true;
    }
    // High token overlap with the research question → treat as echo, not analysis.
    const qTokens = new Set(nq.split(' ').filter((t) => t.length > 4));
    if (qTokens.size < 8) return false;
    const tTokens = nt.split(' ').filter((t) => t.length > 4);
    const hits = tTokens.filter((t) => qTokens.has(t)).length;
    return hits / Math.max(tTokens.length, 1) > 0.55 && tTokens.length > 30;
  }

  private buildParseFailureMarkdown(
    rawContent: string,
    pack?: LegalEvidencePack,
    query?: string,
    caseLawSearchStatus?: string | null,
  ): string {
    const stripped = this.stripJsonBlocks(rawContent);
    const q = query ?? 'Research question';
    const fromPack = this.buildIracFallbackMemo(pack, q, caseLawSearchStatus);
    const salvage = this.extractUsableMemoFromFailedSynthesis(rawContent, q);
    const looksLikeProse =
      stripped.length > 40 &&
      !stripped.trimStart().startsWith('{') &&
      (/^#{1,3}\s/m.test(stripped) || /[.!?]\s/.test(stripped) || stripped.length > 120);
    const proseCandidate =
      salvage && !this.isQueryEcho(salvage, q)
        ? salvage
        : looksLikeProse &&
            !/^Based on retrieved materials for:/i.test(stripped) &&
            !this.isQueryEcho(stripped, q)
          ? stripped.slice(0, 12_000)
          : null;
    // Prefer pack-grounded IRAC over query-echo shortAnswer salvage.
    const prose = proseCandidate ?? fromPack;

    const warning =
      '\n\n> ⚠️ **Verification unavailable:** structured proposition plan could not be parsed. Do not treat this memo as passage-verified.';
    const banner = this.providerFailureBanner(caseLawSearchStatus);

    return banner + prose + warning;
  }

  /**
   * IRAC gap / partial-pack memo when structured JSON fails.
   * Never echoes the user query as the Bottom Line holding.
   */
  private buildIracFallbackMemo(
    pack: LegalEvidencePack | undefined,
    query: string,
    caseLawSearchStatus?: string | null,
  ): string {
    const statutes = pack?.statutes.slice(0, 8) ?? [];
    const cases = pack?.authorities.slice(0, 8) ?? [];
    const materials = pack?.officialMaterials.slice(0, 4) ?? [];
    const hasMaterials =
      statutes.length > 0 || cases.length > 0 || materials.length > 0;

    if (!hasMaterials) {
      return [
        '## Executive answer',
        '',
        'Live/corpus retrieval did not admit verifiable authorities for this query. This is a research gap notice — not a legal holding. Do not treat the question text as analysis.',
        '',
        '## Bottom line',
        '',
        'Research incomplete — sources unavailable. Not safe for reliance until primary materials are retrieved.',
        '',
        '## Issue',
        '',
        query.slice(0, 800),
        '',
        '## Rule',
        '',
        'No retrieved primary statute or case text was available to ground a rule statement.',
        '',
        '## Application',
        '',
        'Cannot apply jurisdiction-specific authority without retrieved materials. Confirm connector health in the Research Trail and retry Verified research, or obtain primary sources manually.',
        '',
        '## Strongest arguments for the client',
        '',
        '- Reserved until governing statutes/cases are retrieved and verified.',
        '',
        '## Strongest arguments for the counterparty',
        '',
        '- Reserved until governing statutes/cases are retrieved and verified.',
        '',
        '## Evidence to obtain',
        '',
        '- Primary statute/regulation text and any electronic/KYC/credit records named in the facts',
        '- Official case-law hits for the same issue (neutral citation + court)',
        '',
        '## Recommended legal strategy',
        '',
        '1. Re-run Verified research after confirming live connectors are healthy.',
        '2. Pull named statutes from official gazettes / Kenya Law / India Code as applicable.',
        '3. Search the jurisdiction’s official law reports for analogous judgments.',
        '',
        '## Potential regulators / forums',
        '',
        '- Identify the competent court, ombudsman, data-protection authority, and sector regulator from official sources once retrieval succeeds.',
        '',
        '## What was attempted',
        '',
        '- Local corpus hybrid / statute search',
        '- Live judgment and legislation search for the selected jurisdiction',
        '- Targeted gap fill / recovery',
        caseLawSearchStatus
          ? `- Case-law search status: \`${caseLawSearchStatus}\``
          : '- Case-law search status: not reported',
        '',
        '## Table of authorities',
        '',
        '_None admitted from live/corpus retrieval._',
        '',
        '## Case-strength assessment',
        '',
        '**Weak** (for research completeness) — no retrieved primary authorities to ground a strength rating on the merits.',
      ].join('\n');
    }

    const lines = [
      '## Executive answer',
      '',
      'Retrieved materials were located but structured synthesis failed. The following IRAC outline is grounded only in the evidence catalog — not passage-verified.',
      '',
      '## Bottom line',
      '',
      'Counsel must complete verification against the Authorities tab and primary sources before reliance.',
      '',
      '## Issue',
      '',
      query.slice(0, 800),
      '',
      '## Rule (retrieved authorities)',
      '',
    ];
    for (const s of statutes) {
      const label =
        s.heading ||
        [s.actName, s.section ? `s.${s.section}` : null].filter(Boolean).join(' ') ||
        s.evidenceId;
      lines.push(`- **Statute** (${s.evidenceId}): ${label}`);
    }
    for (const c of cases) {
      lines.push(
        `- **Case** (${c.evidenceId}): ${c.title || c.citation || c.evidenceId}${c.citation ? ` — ${c.citation}` : ''}`,
      );
    }
    for (const m of materials) {
      lines.push(`- **Material** (${m.evidenceId}): ${m.title || m.evidenceId}`);
    }
    lines.push(
      '',
      '## Application',
      '',
      'Map the client facts onto the retrieved authorities above. Treat each citation as a research lead until passage-level verification completes.',
      '',
      '## Strongest arguments for the client',
      '',
      '- Apply the retrieved authorities above to the stated facts; do not invent additional case names.',
      '',
      '## Strongest arguments for the counterparty',
      '',
      '- Identify contrary readings of the same retrieved instruments; list as research leads if not retrieved.',
      '',
      '## Evidence to obtain',
      '',
      '- Full-text passages for each catalog entry below',
      '- Any missing primary instruments named in the facts but not yet retrieved',
      '',
      '## Recommended legal strategy',
      '',
      '1. Verify each catalog authority on the primary source site.',
      '2. Complete claim-level verification before filing.',
      '',
      '## Potential regulators / forums',
      '',
      '- Confirm competent forums from the retrieved statutes/regulations.',
      '',
      '## Table of authorities',
      '',
    );
    for (const s of statutes) {
      lines.push(`- ${s.actName || s.heading || s.evidenceId}`);
    }
    for (const c of cases) {
      lines.push(`- ${c.title || c.citation || c.evidenceId}`);
    }
    lines.push(
      '',
      '## Case-strength assessment',
      '',
      '**Moderate** for research completeness only — authorities retrieved but structured verification did not complete.',
    );
    return lines.join('\n');
  }

  private memoTextOverlap(left: string, right: string): number {
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    const a = normalize(left);
    const b = normalize(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) {
      return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    }
    const aWords = new Set(a.split(' ').filter(Boolean));
    const bWords = new Set(b.split(' ').filter(Boolean));
    let inter = 0;
    for (const word of aWords) {
      if (bWords.has(word)) inter += 1;
    }
    return inter / Math.max(aWords.size, bWords.size);
  }

  private stripOverlappingMemoSections(markdown: string, shortAnswer: string): string {
    if (!markdown.trim() || !shortAnswer.trim()) return markdown;
    const parts = markdown.split(/(?=^#{1,3}\s+)/m);
    return parts
      .filter((part) => {
        const heading = part.match(/^#{1,3}\s+([^\n]+)/);
        if (!heading) return true;
        if (!/^(Legal rule|Rule|Conclusion|Bottom line|Executive answer)\b/i.test(heading[1].trim())) {
          return true;
        }
        const body = part.slice(heading[0].length).trim();
        return this.memoTextOverlap(body, shortAnswer) < 0.9;
      })
      .join('')
      .trim();
  }

  private extractMarkdownSection(markdown: string, heading: RegExp): string {
    const match = markdown.match(heading);
    if (!match || match.index === undefined) return '';
    const rest = markdown.slice(match.index + match[0].length);
    const nextHeading = rest.search(/\n#{1,3}\s+\S/);
    return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
  }

  private issuesFromAnalysisMarkdown(
    analysisMarkdown: string,
    shortAnswer: string,
  ): LegalResearchDraft['issues'] {
    if (!analysisMarkdown.trim()) return [];
    const ruleText = this.extractMarkdownSection(
      analysisMarkdown,
      /^#{2,3}\s*(?:Legal rule|Rule)\b[^\n]*/im,
    );
    const applicationText = this.extractMarkdownSection(
      analysisMarkdown,
      /^#{2,3}\s*(?:Fact application|Application)\b[^\n]*/im,
    );
    const conclusionText = this.extractMarkdownSection(
      analysisMarkdown,
      /^#{2,3}\s*Conclusion\b[^\n]*/im,
    );
    const distinct = (text: string) =>
      Boolean(text) && this.memoTextOverlap(text, shortAnswer) < 0.9;
    const rule = distinct(ruleText)
      ? [
          {
            claimId: 'rule_1',
            text: ruleText,
            type: 'GENERAL_PRINCIPLE' as const,
            evidenceIds: [],
            confidence: 0.5,
          },
        ]
      : [];
    const application = distinct(applicationText)
      ? [
          {
            claimId: 'app_1',
            text: applicationText,
            type: 'APPLICATION' as const,
            evidenceIds: [],
            confidence: 0.5,
          },
        ]
      : [];
    if (rule.length === 0 && application.length === 0 && !distinct(conclusionText)) {
      return [];
    }
    return [
      {
        issueId: 'issue_primary',
        heading: 'Analysis',
        rule,
        application,
        propositions: [...rule, ...application],
        conclusion: {
          text: distinct(conclusionText) ? conclusionText : '',
          strength: 'TENTATIVE',
          controllingReasons: [],
          factualDependencies: [],
          adverseConsiderations: [],
          confidence: 0.5,
        },
      },
    ];
  }

  private expandFastMemoMarkdown(
    shortAnswer: string,
    analysisMarkdown: string,
    verificationNotes: string[] | undefined,
    pack: LegalEvidencePack,
    query: string,
  ): string {
    const bottom =
      shortAnswer && !this.isQueryEcho(shortAnswer, query)
        ? shortAnswer
        : 'See detailed analysis below. Do not treat the research question text as the holding.';
    const hasLead = /^#{1,3}\s*(Short Answer|Executive answer|Bottom line)\b/im.test(
      analysisMarkdown,
    );
    const analysis = this.stripOverlappingMemoSections(analysisMarkdown, bottom);
    const sections = [
      !hasLead ? `## Short Answer\n\n${bottom}` : '',
      analysis.startsWith('#')
        ? analysis
        : `## Detailed legal analysis\n\n${analysis}`,
    ];
    if (!/##\s*Table of authorities/i.test(analysisMarkdown)) {
      const toa = [
        ...pack.statutes.slice(0, 8).map(
          (s) => `- ${s.actName || s.heading || s.evidenceId}`,
        ),
        ...pack.authorities.slice(0, 8).map(
          (c) => `- ${c.title || c.citation || c.evidenceId}`,
        ),
      ];
      if (toa.length > 0) {
        sections.push(`## Table of authorities\n\n${toa.join('\n')}`);
      }
    }
    if (verificationNotes?.length) {
      sections.push(
        `## Verification notes\n\n${verificationNotes.map((n) => `- ${n}`).join('\n')}`,
      );
    }
    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Best-effort lawyer-readable memo when LegalResearchDraft JSON cannot be parsed.
   * Still labeled VERIFICATION_UNAVAILABLE — never invents verified citations.
   */
  private extractUsableMemoFromFailedSynthesis(
    content: string,
    query?: string,
  ): string | null {
    const direct = this.extractDirectAnswerText(content, query);
    if (direct) return `## Bottom line\n\n${direct}`;

    const trimmed = this.stripCodeFences(content).trim();
    const sections: string[] = [];
    const fieldPatterns: Array<{ label: string; re: RegExp }> = [
      {
        label: 'Bottom line',
        re: /"(?:shortAnswer|directAnswer|bottomLine)"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/i,
      },
      {
        label: 'Bottom line',
        re: /"(?:shortAnswer|directAnswer|bottomLine)"\s*:\s*"((?:\\.|[^"\\])*)"/i,
      },
      {
        label: 'Analysis',
        re: /"(?:analysis|reasoning|discussion|analysisMarkdown)"\s*:\s*"((?:\\.|[^"\\])*)"/i,
      },
      {
        label: 'Key authorities',
        re: /"(?:keyAuthorities|authoritiesSummary)"\s*:\s*"((?:\\.|[^"\\])*)"/i,
      },
    ];
    for (const { label, re } of fieldPatterns) {
      const match = trimmed.match(re);
      if (!match?.[1]) continue;
      const text = this.unescapeJsonString(match[1]).trim();
      if (text.length < 20) continue;
      if (query && this.isQueryEcho(text, query)) continue;
      if (sections.some((s) => s.includes(text.slice(0, 40)))) continue;
      sections.push(`## ${label}\n\n${text}`);
    }
    if (sections.length > 0) return sections.join('\n\n').slice(0, 12_000);

    // Trailing prose after a broken JSON object.
    const afterJson = trimmed.replace(/^[\s\S]*?\}\s*/, '').trim();
    if (
      afterJson.length > 80 &&
      !afterJson.startsWith('{') &&
      !(query && this.isQueryEcho(afterJson, query))
    ) {
      return afterJson.slice(0, 12_000);
    }
    return null;
  }

  private unescapeJsonString(value: string): string {
    try {
      return JSON.parse(`"${value}"`) as string;
    } catch {
      return value
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  }

  private extractDirectAnswerText(content: string, query?: string): string | null {
    const trimmed = this.stripCodeFences(content).trim();
    const candidates = [trimmed];
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }

    for (const candidate of candidates) {
      try {
        const obj = JSON.parse(candidate) as {
          directAnswer?: { text?: string } | string;
          shortAnswer?: { text?: string } | string;
          bottomLine?: { text?: string } | string;
          memoMarkdown?: string;
          outputMarkdown?: string;
        };
        const pick = (v: unknown): string | null => {
          if (typeof v === 'string' && v.trim()) return v.trim();
          if (v && typeof v === 'object' && typeof (v as { text?: string }).text === 'string') {
            const t = (v as { text: string }).text.trim();
            return t || null;
          }
          return null;
        };
        const text =
          pick(obj?.shortAnswer) ??
          pick(obj?.directAnswer) ??
          pick(obj?.bottomLine) ??
          pick(obj?.memoMarkdown) ??
          pick(obj?.outputMarkdown);
        if (text && !(query && this.isQueryEcho(text, query))) return text;
      } catch {
        // try next candidate
      }
    }
    return null;
  }
}
