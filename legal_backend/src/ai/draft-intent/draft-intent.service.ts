import { Injectable, Optional } from '@nestjs/common';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { DEFAULT_AUTO_MODEL, DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveDocumentKind, resolveMatterDocumentKind } from '@/config/templates/document-kinds';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { SelectionTrackingService } from '@/ai/matter-intelligence/selection-tracking.service';
import { OutcomeProfileService } from '@/ai/matter-intelligence/outcome-profile.service';
import { getExcludePracticeAreas } from '@/ai/matter-intelligence/matter-taxonomy-routing';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import { TEMPLATE_CATEGORY } from '@/templates/template-categories';
import {
  appendDraftUrlParams,
  buildCuratedDraftUrl,
  buildGenerateDraftUrl,
  buildOfficialFormDraftUrl,
  buildTemplateUseUrl,
  documentKindToDraftKind,
  hasActionableClarifyingAnswers,
  isExplicitDocumentKind,
  listCuratedDraftEntries,
  resolveCuratedDraftCategory,
  resolveCuratedDraftKindForInjection,
  resolveCuratedDraftLabel,
  resolveKindFromAnswers,
  resolveKindFromContext,
  scoreTextMatch,
} from './draft-intent.helpers';
import {
  MatterClarificationService,
  filterGenericMiQuestions,
  mergeClarifyingQuestions,
} from './matter-clarification.service';
import { extractMatterFacts, buildEffectiveQuery, hasBns78Citation, applyExtractedProfileOverride } from './matter-fact-extractor';
import {
  resolveDocumentBundle,
  shouldExcludeDraftIntentMatch,
  isStalkingComplaintQuery,
  hasOnlineConductInQuery,
  resolveSelfDefenseBundle,
} from './draft-intent-bundles';
import { ExplicitDocumentResolverService } from './explicit-document-resolver.service';
import { isFilingGradeDraftKind } from '@/ai/drafting/draft-citation-policy';
import { PlaybookResolverService } from './playbook-resolver.service';
import {
  buildCommercialRecoveryQuestions,
  buildIndiaCommercialRecoveryRoute,
} from './india-commercial-recovery-route';
import { formatCommercialRecoveryCalculation } from './commercial-recovery-calculator';
import type {
  DraftContext,
  DraftIntentClassification,
  DraftIntentCuratedDraftMatch,
  DraftIntentMatch,
  DraftIntentResolveResult,
} from './draft-intent.types';

type Tier1Country = 'IN' | 'US' | 'GB' | 'KE';

@Injectable()
export class DraftIntentService {
  constructor(
    private readonly legalFormsSearch: LegalFormsSearchService,
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly selectionTracking: SelectionTrackingService,
    private readonly outcomeProfile: OutcomeProfileService,
    private readonly clarification: MatterClarificationService,
    private readonly playbookResolver: PlaybookResolverService,
    private readonly explicitDocumentResolver: ExplicitDocumentResolverService,
    @Optional() private readonly llm?: LlmCompletionService,
    @Optional() private readonly usageRecorder?: AiUsageRecorderService,
  ) {}

  async resolve(options: {
    query: string;
    tenantId: string;
    userId: string;
    countryCode?: string;
    jurisdiction?: string;
    answers?: Record<string, string | string[]>;
    context?: DraftContext;
    supplementalContext?: string;
    skipClarification?: boolean;
    language?: string;
  }): Promise<DraftIntentResolveResult> {
    const query = options.query.trim();
    if (!query) {
      return {
        query: '',
        classification: { intent: 'unknown' },
        matches: [],
        creditsUsed: 0,
        balanceRemaining: await this.creditLedger.getBalance({
          userId: options.userId,
          tenantId: options.tenantId,
        }),
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: options.tenantId },
      select: { primaryCountry: true },
    });
    const tenantCountry = (tenant?.primaryCountry ?? 'IN') as Tier1Country;

    const workspaceCountry =
      options.countryCode && options.countryCode !== 'ALL' ? options.countryCode : undefined;

    const baseCountry = workspaceCountry ?? tenantCountry;

    const effectiveQuery = buildEffectiveQuery(query, options.supplementalContext);
    const commercialRoute = buildIndiaCommercialRecoveryRoute(
      effectiveQuery,
      options.answers,
    );

    if (
      commercialRoute &&
      commercialRoute.blockingIssues.length > 0
    ) {
      return {
        query,
        classification: {
          intent: 'filing',
          documentKind: commercialRoute.documentKind,
          countryCode: 'IN',
          jurisdiction: options.jurisdiction,
        },
        matches: [],
        creditsUsed: 0,
        balanceRemaining: await this.creditLedger.getBalance({
          userId: options.userId,
          tenantId: options.tenantId,
        }),
        clarifyingQuestions: buildCommercialRecoveryQuestions(commercialRoute).map(
          (question) => ({
            id: question.id,
            text: question.prompt,
            field: 'nature' as const,
            options: question.options.map((option) => option.label),
          }),
        ),
        recommendationMode: 'clarification_required',
        issues: commercialRoute.blockingIssues.map((issue) => issue.message),
        routeDecision: commercialRoute,
        draftingBlocked: true,
      };
    }

    const miResult = await this.matterPipeline.run({
      facts: effectiveQuery,
      query: effectiveQuery,
      countryCode: baseCountry,
      jurisdiction: options.jurisdiction ?? options.context?.jurisdiction,
      skipRetrieval: true,
      consumer: 'draftIntent',
    });

    const extracted = extractMatterFacts(effectiveQuery);
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
      };
    }
    const context = options.context ?? {};
    const contextualQuestions = commercialRoute
      ? buildCommercialRecoveryQuestions(commercialRoute)
      : this.clarification.buildContextualQuestions(
          effectiveQuery,
          matterProfile,
          context,
          extracted,
        );
    const filteredMi = commercialRoute
      ? []
      : filterGenericMiQuestions(
          miResult.clarifyingQuestions,
          matterProfile,
          extracted,
          context,
        );
    const mergedQuestions = mergeClarifyingQuestions(contextualQuestions, [], filteredMi);
    const actionableAnswers = hasActionableClarifyingAnswers(options.answers, effectiveQuery);
    const unansweredRequired = mergedQuestions.some((q) => {
      const ans = options.answers?.[q.id];
      if (!ans) return true;
      return Array.isArray(ans) ? ans.length === 0 : false;
    });
    const skipClarification = Boolean(options.skipClarification);
    // Self-defence: never block on empty matches — facts drive a provisional playbook.
    // Other matters still require clarification when MI is unsure.
    if (
      !skipClarification &&
      !extracted.isSelfDefenseHomicideContext &&
      !miResult.shouldProceed &&
      (!actionableAnswers || unansweredRequired)
    ) {
      return {
        query,
        classification: { intent: 'unknown' },
        matches: [],
        creditsUsed: 0,
        balanceRemaining: await this.creditLedger.getBalance({
          userId: options.userId,
          tenantId: options.tenantId,
        }),
        matterProfile,
        clarifyingQuestions: mergedQuestions.map((q) => ({
          id: q.id,
          text: q.prompt,
          field: 'nature' as const,
          options: q.options.map((o) => o.label),
        })),
        recommendationMode: 'clarification_required',
        issues: matterProfile.issues,
      };
    }

    // Token-based charging: estimate tokens consumed by matterPipeline.run() (which uses
    // DEFAULT_EXTRACT_MODEL for classification). Input ≈ query chars/4 + ~650 system overhead.
    // Output ≈ 220 tokens (classification JSON). At nano rates this rounds to 1 credit
    // for all realistic query lengths — accurate and fair.
    const estimatedInputTokens = Math.ceil(effectiveQuery.length / 4) + 650;
    const estimatedOutputTokens = 220;

    let chargedCredits = 1;
    let balanceAfterDebit: number | undefined;

    if (this.usageRecorder) {
      const usageResult = await this.usageRecorder.recordTokenUsage({
        userId: options.userId,
        tenantId: options.tenantId,
        taskType: AI_TASK_TYPES.DRAFT_INTENT_SEARCH,
        mode: 'AUTO',
        modelName: DEFAULT_EXTRACT_MODEL,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
      });
      chargedCredits = usageResult.chargedCredits;
    } else {
      // Fallback when recorder not available (tests / mocked envs)
      const debitResult = await this.creditLedger.assertAndDebit({
        userId: options.userId,
        tenantId: options.tenantId,
        taskType: AI_TASK_TYPES.DRAFT_INTENT_SEARCH,
        credits: 1,
      });
      chargedCredits = debitResult.creditsDebited;
      balanceAfterDebit = debitResult.balanceAfter;
    }

    if (balanceAfterDebit === undefined) {
      balanceAfterDebit = await this.creditLedger.getBalance({
        userId: options.userId,
        tenantId: options.tenantId,
      });
    }

    const classification = this.classifyQuery(effectiveQuery, baseCountry, options.context, matterProfile);

    // If the query explicitly names a city or jurisdiction from a different country than the
    // workspace, the text takes priority. This prevents a KE-configured workspace from
    // returning Kenyan forms when a user asks about a matter in Ahmedabad or Delhi.
    const textCountry = this.detectCountryFromText(effectiveQuery.toLowerCase());
    const effectiveCountry = textCountry ?? workspaceCountry ?? classification.countryCode ?? tenantCountry;
    const effectiveJurisdiction =
      options.jurisdiction ?? options.context?.jurisdiction ?? classification.jurisdiction;

    const excludeAreas = getExcludePracticeAreas(
      matterProfile.practiceArea,
      matterProfile.subPracticeArea,
    );

    const [formsResult, curatedMatches, templateMatches] = await Promise.all([
      this.searchOfficialForms(effectiveQuery, effectiveCountry, effectiveJurisdiction, matterProfile, excludeAreas),
      Promise.resolve(
        this.searchCuratedDrafts(
          effectiveQuery,
          effectiveCountry,
          matterProfile,
          excludeAreas,
          options.answers,
          extracted,
        ),
      ),
      this.searchTemplates(effectiveQuery, options.tenantId, effectiveCountry),
    ]);

    // Answers from clarifying questions override the classification's documentKind
    const answeredKind = options.answers
      ? resolveKindFromAnswers(options.answers, effectiveQuery)
      : undefined;
    const contextKind = options.context
      ? resolveKindFromContext(options.context, effectiveQuery)
      : undefined;
    const playbook = this.playbookResolver.resolve({
      extracted,
      query: effectiveQuery,
      answers: options.answers,
    });
    const documentKind =
      commercialRoute?.documentKind ??
      answeredKind ??
      contextKind ??
      playbook?.primaryDocumentKind ??
      resolveMatterDocumentKind(matterProfile, effectiveQuery) ??
      classification.documentKind ??
      // Unknown filing posture must remain uncommitted until facts identify a vehicle.
      // Never turn a generic filing request into a criminal complaint by default.
      (classification.intent === 'filing' ? 'unknown_filing' : 'service_agreement');
    const kindExplicit = isExplicitDocumentKind(documentKind, effectiveQuery);

    let matches: DraftIntentMatch[] = [
      ...formsResult,
      ...curatedMatches,
      ...(isFilingGradeDraftKind(documentKind) ? [] : templateMatches),
    ];

    if (commercialRoute) {
      const allowedKinds = new Set([
        commercialRoute.draftKind,
        commercialRoute.proceedingType === 'summary_suit'
          ? 'india_civil_suit_money_recovery'
          : 'india_suit_recovery_cpc_37',
      ]);
      matches = matches.filter((match) => {
        if (match.type === 'curated_draft') {
          return allowedKinds.has(match.kind);
        }
        if (match.type === 'official_form') {
          const text = `${match.formName} ${match.summary}`;
          return (
            !/\b(marriage|matrimonial|divorce|maintenance|bail|criminal|sebi|delisting|set[-\s]?off|counter[-\s]?claim|revision|appeal)\b/i.test(
              text,
            ) &&
            /\b(summary|order\s*(?:xxxvii|37)|recovery|commercial|money|debt|invoice|plaint)\b/i.test(
              text,
            )
          );
        }
        return false;
      });
    }

    if (kindExplicit) {
      // Legal filing kinds (petitions, revisions, maintenance etc.) must not be overridden by
      // untagged firm templates (documentKind = null). Generic contract/NDA kinds still allow
      // null-tagged templates through so user-created contracts continue to surface.
      const isFilingKind =
        documentKind !== 'service_agreement' &&
        documentKind !== 'employment_contract' &&
        documentKind !== 'nda' &&
        documentKind !== 'llc_operating_agreement' &&
        documentKind !== 'partnership_agreement' &&
        documentKind !== 'shareholders_agreement' &&
        documentKind !== 'lease_agreement';
      matches = matches.filter(
        (m) =>
          m.type !== 'template' ||
          m.documentKind === documentKind ||
          (m.documentKind === null && !isFilingKind),
      );
    }

    if (miResult.recommendationMode === 'low_confidence') {
      matches = matches.filter(
        (m) =>
          m.type === 'generate' ||
          m.type === 'curated_draft' ||
          (m.type === 'official_form' && m.confidence >= 0.7),
      );
    }

    matches = matches.filter((m) => {
      if (m.type !== 'official_form') return true;
      const formPractice = matterProfile.practiceArea;
      if (excludeAreas.some((area) => m.summary.toLowerCase().includes(area.replace(/_/g, ' ')))) {
        return false;
      }
      if (/\barbitration\b/i.test(m.summary) && formPractice === 'employment_labour') {
        return false;
      }
      return true;
    });

    matches = matches.sort((a, b) => b.confidence - a.confidence);

    const draftCountry = this.resolveDraftCountry(
      tenantCountry,
      textCountry ?? workspaceCountry,
      classification,
      query,
    );

    // If resolveDocumentKind mapped to a known curated kind (not generic catalog),
    // inject it as the first result so users land directly on the AI draft editor.
    // Exception: death + self-defence without answered clarification — do not force FIR.
    // Self-defence also uses stage-aware injection (skip chargesheet pin pre-complaint).
    const injectDraftKind = resolveCuratedDraftKindForInjection(
      documentKind,
      draftCountry,
      options.answers,
      effectiveQuery,
    );
    const resolvedDraftKind =
      injectDraftKind ?? documentKindToDraftKind(documentKind, draftCountry);
    const isGenericCatalog =
      resolvedDraftKind === 'india_form_catalog' ||
      resolvedDraftKind === 'us_form_catalog' ||
      resolvedDraftKind === 'kenya_form_catalog';
    const selfDefenseAmbiguous =
      Boolean(extracted?.isSelfDefenseHomicideContext) &&
      !hasActionableClarifyingAnswers(options.answers, effectiveQuery);
    const stalkingQuery = isStalkingComplaintQuery(effectiveQuery);
    const defenseAnswersChosen =
      options.answers?.self_defense_goal === 'defense_against_homicide' ||
      options.answers?.self_defense_goal === 'discharge_application' ||
      options.answers?.self_defense_goal === 'police_statement_only' ||
      options.answers?.self_defense_fir_status === 'fir_against_client' ||
      (Array.isArray(options.answers?.self_defense_goal) &&
        options.answers.self_defense_goal.some((v) =>
          ['defense_against_homicide', 'discharge_application', 'police_statement_only'].includes(v),
        ));
    // Stalking complainant flows should surface FIR/magistrate bundle, not Reply to Chargesheet.
    const skipDefenseInjectionForStalking =
      stalkingQuery &&
      (documentKind === 'defense_memo' || documentKind === 'discharge_application') &&
      !defenseAnswersChosen;

    // Self-defence: always inject playbook primary even when answers are not_sure/unknown.
    const allowSelfDefenseProvisionalInject =
      extracted.isSelfDefenseHomicideContext && Boolean(injectDraftKind || playbook?.bundle[0]);

    if (
      kindExplicit &&
      injectDraftKind &&
      !isGenericCatalog &&
      (!selfDefenseAmbiguous || allowSelfDefenseProvisionalInject) &&
      !skipDefenseInjectionForStalking
    ) {
      const { label: curatedLabel, proceduralNote } = resolveCuratedDraftLabel(
        documentKind,
        injectDraftKind,
        effectiveQuery,
      );
      const category = resolveCuratedDraftCategory(injectDraftKind);
      const baseUrl = buildCuratedDraftUrl(injectDraftKind, draftCountry, curatedLabel);
      const curatedUrl = category
        ? `${baseUrl}&category=${encodeURIComponent(category)}`
        : baseUrl;
      const urlWithDetails = appendDraftUrlParams(curatedUrl, {
        details: effectiveQuery,
        documentKind,
      });
      const alreadyHasCurated = matches.some(
        (m) => m.type === 'curated_draft' && m.kind === injectDraftKind,
      );
      if (!alreadyHasCurated) {
        matches = [
          {
            type: 'curated_draft' as const,
            confidence: 0.96,
            summary: curatedLabel,
            kind: injectDraftKind,
            label: curatedLabel,
            countryCode: draftCountry,
            draftUrl: urlWithDetails,
            proceduralNote,
          },
          ...matches,
        ];
      }

      // For writ petitions, also inject the habeas corpus petition as an explicit alternative
      // so users always see both options when the facts describe unlawful detention.
      if (documentKind === 'writ_petition') {
        const habeasKind = 'india_habeas_corpus_petition';
        const alreadyHasHabeas = matches.some(
          (m) => m.type === 'curated_draft' && (m as { kind?: string }).kind === habeasKind,
        );
        if (!alreadyHasHabeas) {
          const { label: habeasLabel } = resolveCuratedDraftLabel(documentKind, habeasKind, effectiveQuery);
          const habeasBase = buildCuratedDraftUrl(habeasKind, draftCountry, habeasLabel);
          const habeasUrl = appendDraftUrlParams(habeasBase, { details: effectiveQuery, documentKind });
          matches = [
            ...matches,
            {
              type: 'curated_draft' as const,
              confidence: 0.94,
              summary: habeasLabel,
              kind: habeasKind,
              label: habeasLabel,
              countryCode: draftCountry,
              draftUrl: habeasUrl,
            },
          ];
        }
      }
    }

    const generateMatch = this.buildGenerateMatch(
      documentKind,
      draftCountry,
      kindExplicit,
      effectiveQuery,
    );

    const importMatch = this.buildImportMatch(effectiveQuery, documentKind);
    if (/\b(edit|revise|update|modify|upload|attach|existing)\b/i.test(effectiveQuery)) {
      matches = [importMatch, ...matches];
    }

    const entitySuggestion = this.buildEntitySuggestion(effectiveQuery, documentKind);
    if (entitySuggestion) {
      matches = [entitySuggestion, ...matches];
    }

    const hasStrongKindMatch = matches.some(
      (m) =>
        (m.type === 'official_form' && m.confidence >= 0.7) ||
        (m.type === 'template' && m.documentKind === documentKind) ||
        (m.type === 'curated_draft' &&
          documentKindToDraftKind(documentKind, draftCountry).includes(
            m.kind.replace(/^india_|^us_/, ''),
          )),
    );

    const topIntentScore = matches.reduce((max, m) => Math.max(max, m.confidence), 0);
    const filingHasGoodMatch =
      classification.intent === 'filing' && topIntentScore >= 0.5;
    const shouldInjectGenerate =
      !filingHasGoodMatch && (kindExplicit || !hasStrongKindMatch);

    if (shouldInjectGenerate) {
      matches = [generateMatch, ...matches];
    }

    matches = matches.filter(
      (m) => !shouldExcludeDraftIntentMatch(m, matterProfile, effectiveQuery),
    );

    const includeCyber =
      extracted.hasOnlineConduct ||
      hasOnlineConductInQuery(effectiveQuery) ||
      this.answersIndicateOnline(options.answers);
    const explicitResult = commercialRoute
      ? {
          hasExplicitSection: false,
          bundle: [],
          resolutions: [],
          unmapped: [],
        }
      : await this.explicitDocumentResolver.resolve({
          query: effectiveQuery,
          countryCode: draftCountry,
          matterProfile,
        });
    const explicitBundle =
      !commercialRoute &&
      explicitResult.hasExplicitSection &&
      explicitResult.bundle.length > 0
        ? explicitResult.bundle
        : undefined;
    const playbookBundle =
      commercialRoute
        ? playbook?.bundle
        : explicitResult.hasExplicitSection
        ? undefined
        : playbook?.bundle ??
          resolveDocumentBundle(matterProfile, effectiveQuery, {
            includeCyber,
            selfDefenseHomicide: extracted.isSelfDefenseHomicideContext,
            extracted,
            answers: options.answers,
          });
    const documentBundle = explicitBundle ?? playbookBundle;
    const bundleSource = explicitResult.hasExplicitSection
      ? commercialRoute
        ? ('playbook' as const)
        : ('explicit' as const)
      : documentBundle?.length
        ? ('playbook' as const)
        : undefined;
    if (documentBundle?.length) {
      const bundleQuery =
        commercialRoute?.calculation
          ? `${effectiveQuery}\n\n${formatCommercialRecoveryCalculation(commercialRoute.calculation)}`
          : effectiveQuery;
      let bundleMatches = this.buildBundleMatches(
        documentBundle,
        draftCountry,
        bundleQuery,
        options.language,
        playbook?.provisional,
        playbook?.proceduralNotes,
      );
      // Enrich bundle matches with fact-grounded LLM reasons (falls back to static defaults)
      bundleMatches = await this.enrichMatchesWithReasons(bundleMatches, effectiveQuery);
      const bundleKinds = new Set(documentBundle.map((item) => item.kind));
      matches = [
        ...bundleMatches,
        ...matches.filter(
          (m) => m.type !== 'curated_draft' || !bundleKinds.has(m.kind),
        ),
      ];
    }

    // Self-defence safety net: never leave the user with zero suggestions.
    if (extracted.isSelfDefenseHomicideContext && matches.length === 0) {
      const fallback = resolveSelfDefenseBundle(extracted, options.answers, effectiveQuery);
      matches = this.buildBundleMatches(
        fallback,
        draftCountry,
        effectiveQuery,
        options.language,
        true,
        playbook?.proceduralNotes,
      );
    }

    // Keep every bundle-recommended match, then fill remaining slots by confidence.
    const bundleKept = matches.filter(
      (m) => m.type === 'curated_draft' && Boolean(m.bundleRecommended),
    );
    const nonBundle = commercialRoute
      ? []
      : matches
          .filter(
            (m) =>
              !(m.type === 'curated_draft' && Boolean(m.bundleRecommended)),
          )
          .sort((a, b) => b.confidence - a.confidence);
    const bundleSorted = [...bundleKept].sort(
      (a, b) =>
        ((a as DraftIntentCuratedDraftMatch).bundleOrder ?? 0) -
        ((b as DraftIntentCuratedDraftMatch).bundleOrder ?? 0),
    );
    const limit = Math.max(8, bundleSorted.length);
    matches = [...bundleSorted, ...nonBundle].slice(0, limit);

    if (matches.length === 0) {
      matches.push(generateMatch);
    }

    const topMatch = matches[0];
    if (topMatch) {
      const profileHash = this.selectionTracking.profileHash(matterProfile);
      void this.selectionTracking.record({
        eventType: 'document_selected',
        matterProfileHash: profileHash,
        practiceArea: matterProfile.practiceArea,
        subPracticeArea: matterProfile.subPracticeArea,
        nature: matterProfile.nature,
        documentKind:
          topMatch.type === 'curated_draft'
            ? topMatch.kind
            : topMatch.type === 'official_form'
              ? topMatch.formNumber ?? topMatch.formName
              : topMatch.type === 'template'
                ? topMatch.documentKind ?? undefined
                : topMatch.type === 'generate'
                  ? topMatch.suggestedKind
                  : undefined,
        tenantId: options.tenantId,
        userId: options.userId,
      }).catch(() => undefined);
    }

    const outcome = await this.outcomeProfile.getForProfile(matterProfile, {
      playbookId: playbook?.playbookId,
    });
    const outcomeHint =
      outcome.sampleSize >= 5 && outcome.commonDocuments[0]
        ? `${Math.round((outcome.sampleSize / (outcome.sampleSize + 10)) * 100)}% of similar ${outcome.practiceArea.replace(/_/g, ' ')} matters started with ${outcome.commonDocuments[0].replace(/_/g, ' ')}`
        : undefined;

    return {
      query,
      classification,
      matches,
      creditsUsed: chargedCredits,
      balanceRemaining: balanceAfterDebit,
      matterProfile,
      matterGraph: miResult.graph,
      taskGraph: miResult.taskGraph,
      recommendedActions: miResult.taskGraph?.recommendedActions,
      issues: skipClarification
        ? [
            ...(matterProfile.issues ?? []),
            'Clarifying questions were skipped — document suggestions are provisional until facts are confirmed.',
          ]
        : [
            ...(matterProfile.issues ?? []),
            ...(playbook?.provisional
              ? [
                  'Suggestions based on your facts; refine FIR/stage answers above to sharpen ranking.',
                ]
              : []),
          ],
      recommendationMode: miResult.recommendationMode,
      nextBestAction: miResult.taskGraph?.nextBestAction,
      outcomeHint,
      documentBundle,
      bundleSource,
      explicitDocumentResolutions: explicitResult.hasExplicitSection
        ? explicitResult.resolutions
        : undefined,
      unmappedExplicitPhrases: explicitResult.hasExplicitSection
        ? explicitResult.unmapped
        : undefined,
      clarificationSkipped: skipClarification || undefined,
      playbookId: playbook?.playbookId,
      provisionalSuggestions: playbook?.provisional || undefined,
      routeDecision: commercialRoute,
      draftingBlocked: false,
    };
  }

  private buildBundleMatches(
    bundle: import('./draft-intent-bundles').DraftIntentBundleItem[],
    country: Tier1Country,
    query: string,
    language?: string,
    provisional?: boolean,
    proceduralNotes?: string[],
  ): DraftIntentCuratedDraftMatch[] {
    return bundle.map((item) => {
      const { label: resolvedLabel, proceduralNote } = resolveCuratedDraftLabel(
        item.documentKind,
        item.kind,
        query,
      );
      const label = item.label || resolvedLabel;
      const category = resolveCuratedDraftCategory(item.kind);
      const baseUrl = buildCuratedDraftUrl(item.kind, country, label);
      const draftUrl = appendDraftUrlParams(
        category ? `${baseUrl}&category=${encodeURIComponent(category)}` : baseUrl,
        { details: query, documentKind: item.documentKind, language },
      );
      const positionalConfidence =
        item.order === 1 ? 0.97 : item.order === 2 ? 0.88 : item.order === 3 ? 0.9 : 0.85;
      const confidence = item.confidence ?? positionalConfidence;
      const noteParts = [
        proceduralNote,
        item.defaultReason,
        provisional
          ? 'Provisional — confirm FIR/stage above to refine.'
          : undefined,
        proceduralNotes?.[0],
      ].filter(Boolean);
      return {
        type: 'curated_draft' as const,
        confidence: provisional ? Math.min(confidence, 0.9) : confidence,
        summary: item.defaultReason ?? label,
        kind: item.kind,
        label,
        countryCode: country,
        draftUrl,
        proceduralNote: noteParts.join(' '),
        reason: item.defaultReason,
        bundleRecommended: true,
        bundleOrder: item.order,
        bundleRole: item.bundleRole,
        provisional: item.provisional || provisional || undefined,
      };
    });
  }

  private answersIndicateOnline(answers?: Record<string, string | string[]>): boolean {
    if (!answers) return false;
    const conduct = answers.stalking_conduct;
    const values = Array.isArray(conduct) ? conduct : conduct ? [conduct] : [];
    return values.includes('monitor_online');
  }

  private answersPreferMagistrate(answers?: Record<string, string | string[]>): boolean {
    if (!answers) return false;
    const agg = answers.stalking_aggravation;
    const values = Array.isArray(agg) ? agg : agg ? [agg] : [];
    return values.includes('police_refused');
  }

  /**
   * Enriches the top matches with fact-grounded per-document reasons via a single LLM call.
   * Falls back gracefully (no error) when the LLM provider is not configured or errors.
   */
  private async enrichMatchesWithReasons(
    matches: DraftIntentCuratedDraftMatch[],
    facts: string,
  ): Promise<DraftIntentCuratedDraftMatch[]> {
    if (!this.llm?.isProviderConfigured('openai')) return matches;
    if (matches.length === 0) return matches;

    const documentList = matches
      .map((m, i) => `${i + 1}. ${m.label}`)
      .join('\n');

    const prompt = `You are a senior Indian advocate. Given these case facts and a list of recommended legal documents, write a short (max 15 words) fact-grounded reason for each document explaining why it is relevant to this specific case. Respond ONLY with a JSON array of objects with keys "index" (1-based) and "reason".

Documents:
${documentList}

Facts:
${facts.slice(0, 2500)}`;

    try {
      const response = await this.llm.complete({
        modelName: DEFAULT_AUTO_MODEL,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 400,
        temperature: 0.2,
      });
      const text = response.content?.trim() ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return matches;
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; reason: string }>;
      return matches.map((m, i) => {
        const entry = parsed.find((r) => r.index === i + 1);
        return entry?.reason ? { ...m, reason: entry.reason } : m;
      });
    } catch {
      return matches;
    }
  }

  /**
   * Returns a two-letter country code when the text contains a specific city, state,
   * or jurisdiction name that unambiguously identifies a country. Returns undefined
   * when the text is generic or ambiguous so the workspace setting is not overridden.
   */
  private detectCountryFromText(lower: string): string | undefined {
    if (
      /\b(india|indian|karnataka|maharashtra|delhi|ahmedabad|gst|bnss|ipc|hma|crpc|gujarat|rajasthan|tamil\s+nadu|west\s+bengal|uttar\s+pradesh|kerala|punjab|bihar|madhya\s+pradesh|odisha|telangana|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|jaipur|lucknow|surat|pune|nagpur|noida|gurgaon|gurugram|varanasi|prayagraj|allahabad|agra|chandigarh|patna)\b/i.test(
        lower,
      )
    ) {
      return 'IN';
    }
    if (/\b(kenya|nairobi|mombasa|kisumu|nakuru|eldoret)\b/i.test(lower)) {
      return 'KE';
    }
    if (/\b(uk|britain|england|wales|scotland|london|manchester|birmingham|glasgow|edinburgh)\b/i.test(lower)) {
      return 'GB';
    }
    if (
      /\b(us|usa|american|california|texas|federal|uscis|delaware|new\s+york|florida|illinois|virginia|washington\s+dc)\b/i.test(
        lower,
      )
    ) {
      return 'US';
    }
    return undefined;
  }

  private classifyQuery(
    query: string,
    countryCode?: string,
    context?: DraftContext,
    profile?: MatterProfile,
  ): DraftIntentClassification {
    const lower = query.toLowerCase();
    const contextKind = context ? resolveKindFromContext(context, query) : undefined;
    const documentKind =
      contextKind ?? resolveMatterDocumentKind(profile, query) ?? resolveDocumentKind(undefined, query);

    let intent: DraftIntentClassification['intent'] = 'unknown';
    if (profile?.nature === 'dispute' || profile?.nature === 'compliance') {
      intent = 'filing';
    } else if (profile?.nature === 'transaction') {
      intent = 'contract';
    } else if (
      /\b(form|petition|application|filing|uscis|irs|court|bail|writ|complaint|notice|appeal|revision|maintenance|slp|quashing|plaint|memorandum)\b/i.test(
        lower,
      )
    ) {
      intent = 'filing';
    } else if (
      /\b(contract|agreement|nda|lease|employment|contractor|construction|offer letter|msa|partnership|partership)\b/i.test(
        lower,
      )
    ) {
      intent = 'contract';
    } else if (/\b(letter|memo|demand|notice)\b/i.test(lower)) {
      intent = 'letter';
    }

    let inferredCountry = countryCode;
    if (!inferredCountry || inferredCountry === 'ALL') {
      if (/\b(india|indian|karnataka|maharashtra|delhi|ahmedabad|gst|bnss|ipc|hma|crpc|gujarat|rajasthan|tamil\s+nadu|west\s+bengal|uttar\s+pradesh|kerala|punjab|bihar|madhya\s+pradesh|odisha|telangana)\b/i.test(lower)) {
        inferredCountry = 'IN';
      } else if (/\b(kenya|nairobi)\b/i.test(lower)) {
        inferredCountry = 'KE';
      } else if (/\b(uk|britain|england|wales|scotland)\b/i.test(lower)) {
        inferredCountry = 'GB';
      } else if (/\b(us|usa|american|california|texas|federal|uscis|delaware|c corp|c-corp)\b/i.test(lower)) {
        inferredCountry = 'US';
      }
    }

    // City/state → Indian jurisdiction code
    const jurisdiction =
      context?.jurisdiction ??
      (inferredCountry === 'IN' ||
      (!inferredCountry && countryCode !== 'US' && countryCode !== 'GB' && countryCode !== 'KE')
        ? this.detectIndianJurisdiction(lower)
        : undefined);

    return {
      intent,
      documentKind,
      countryCode: inferredCountry,
      jurisdiction,
    };
  }

  private detectIndianJurisdiction(lower: string): string | undefined {
    const CITY_STATE: Array<[RegExp, string]> = [
      [/\b(ahmedabad|surat|vadodara|baroda|gandhinagar|rajkot|bhavnagar|jamnagar)\b/, 'GJ'],
      [/\b(mumbai|pune|nagpur|nashik|aurangabad|thane|solapur|navi\s+mumbai)\b/, 'MH'],
      [/\b(bengaluru|bangalore|mysuru|mysore|hubli|dharwad|mangaluru|mangalore|belagavi)\b/, 'KA'],
      [/\b(chennai|madurai|coimbatore|trichy|tiruchirappalli|salem|tirunelveli)\b/, 'TN'],
      [/\b(hyderabad|warangal|nizamabad|karimnagar|secunderabad)\b/, 'TS'],
      [/\b(kolkata|howrah|durgapur|asansol|siliguri)\b/, 'WB'],
      [/\b(jaipur|jodhpur|udaipur|kota|bikaner|ajmer)\b/, 'RJ'],
      [/\b(lucknow|agra|varanasi|allahabad|prayagraj|kanpur|meerut|ghaziabad|noida)\b/, 'UP'],
      [/\b(chandigarh)\b/, 'CH'],
      [/\b(delhi|new\s+delhi|dwarka|rohini)\b/, 'DL'],
      [/\b(patna|gaya|muzaffarpur)\b/, 'BR'],
      [/\b(bhopal|indore|gwalior|jabalpur)\b/, 'MP'],
      [/\b(bhubaneswar|cuttack|rourkela)\b/, 'OD'],
      [/\b(thiruvananthapuram|kochi|kozhikode|thrissur|ernakulam)\b/, 'KL'],
      [/\b(dehradun|haridwar|rishikesh)\b/, 'UK'],
      [/\b(raipur|bilaspur|bhilai)\b/, 'CG'],
      [/\b(ranchi|jamshedpur|dhanbad)\b/, 'JH'],
      [/\b(ludhiana|amritsar|jalandhar|patiala)\b/, 'PB'],
    ];
    for (const [pattern, code] of CITY_STATE) {
      if (pattern.test(lower)) return code;
    }
    // Explicit state names
    if (/\bgujarat\b/.test(lower)) return 'GJ';
    if (/\bmaharashtra\b/.test(lower)) return 'MH';
    if (/\bkarnataka\b/.test(lower)) return 'KA';
    if (/\btamil\s+nadu\b/.test(lower)) return 'TN';
    if (/\btelangana\b/.test(lower)) return 'TS';
    if (/\bwest\s+bengal\b/.test(lower)) return 'WB';
    if (/\bajasthan\b/.test(lower)) return 'RJ';
    if (/\buttar\s+pradesh\b/.test(lower)) return 'UP';
    if (/\bkerala\b/.test(lower)) return 'KL';
    if (/\bpunjab\b/.test(lower)) return 'PB';
    if (/\bbihar\b/.test(lower)) return 'BR';
    if (/\bmadhya\s+pradesh\b/.test(lower)) return 'MP';
    if (/\bodisha\b/.test(lower)) return 'OD';
    return undefined;
  }

  private resolveDraftCountry(
    tenantCountry: Tier1Country,
    workspaceCountry: string | undefined,
    classification: DraftIntentClassification,
    query: string,
  ): Tier1Country {
    const lower = query.toLowerCase();
    const usKeywords = /\b(delaware|c corp|c-corp|uscis|irs)\b/i.test(lower);

    if (workspaceCountry === 'IN' || workspaceCountry === 'US' || workspaceCountry === 'GB' || workspaceCountry === 'KE') {
      if (usKeywords && workspaceCountry === 'US') return 'US';
      if (!usKeywords || tenantCountry === workspaceCountry) {
        return workspaceCountry;
      }
    }

    if (usKeywords && tenantCountry === 'US') return 'US';

    const fromClassification = classification.countryCode;
    if (fromClassification === 'IN' || fromClassification === 'US' || fromClassification === 'GB' || fromClassification === 'KE') {
      if (usKeywords && fromClassification !== 'US' && tenantCountry !== 'US') {
        return tenantCountry;
      }
      return fromClassification;
    }

    return tenantCountry;
  }

  private buildGenerateMatch(
    documentKind: string,
    country: Tier1Country,
    kindExplicit: boolean,
    query: string,
  ): DraftIntentMatch {
    const label = kindExplicit
      ? documentKind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Draft';
    const draftKind = documentKindToDraftKind(documentKind, country);
    return {
      type: 'generate',
      confidence: kindExplicit ? 0.94 : 0.55,
      summary: kindExplicit
        ? `Generate ${label} with AI from your description`
        : 'Generate draft with AI from your description',
      suggestedKind: draftKind,
      countryCode: country,
      documentKind,
      reason: kindExplicit
        ? 'AI will draft a custom document using the details you provided.'
        : 'No exact catalog match — AI can draft from your description.',
      draftUrl: buildGenerateDraftUrl(documentKind, country, label, {
        details: query,
        documentKind,
      }),
    };
  }

  private buildImportMatch(query: string, documentKind: string): DraftIntentMatch {
    return {
      type: 'import_edit',
      confidence: 0.72,
      summary: 'Upload & edit an existing Word or PDF document with AI',
      documentKind,
      draftUrl: `/app/document-drafting/edit?documentKind=${encodeURIComponent(documentKind)}&query=${encodeURIComponent(query.slice(0, 500))}`,
    };
  }

  private buildEntitySuggestion(
    query: string,
    documentKind: string,
  ): DraftIntentMatch | null {
    const lower = query.toLowerCase();
    if (
      documentKind === 'partnership_agreement' &&
      /\b(c corp|c-corp|delaware|incorporated|corporation)\b/i.test(lower)
    ) {
      return {
        type: 'generate',
        confidence: 0.78,
        summary: 'Consider a Founders / Shareholders Agreement (Delaware C-Corp)',
        suggestedKind: 'shareholders_agreement',
        countryCode: 'US',
        documentKind: 'shareholders_agreement',
        reason:
          'A Delaware C-Corp is typically governed by shareholders/founders agreements rather than a classic partnership deed.',
        draftUrl: buildGenerateDraftUrl('shareholders_agreement', 'US', 'Shareholders Agreement', {
          details: query,
          documentKind: 'shareholders_agreement',
        }),
      };
    }
    return null;
  }

  private async searchOfficialForms(
    query: string,
    countryCode: string,
    jurisdiction?: string,
    profile?: MatterProfile,
    excludePracticeAreas?: string[],
  ): Promise<DraftIntentMatch[]> {
    const documentKind = resolveMatterDocumentKind(profile, query);
    const hits = await this.legalFormsSearch.searchByIntent(query, {
      countryCode: countryCode === 'ALL' ? undefined : countryCode,
      jurisdiction,
      limit: 12,
      practiceArea: profile?.practiceArea,
      excludePracticeAreas,
    });

    return hits
      .map(({ form, combinedScore }) => {
        const draftUrl = buildOfficialFormDraftUrl(form);
        if (!draftUrl) return null;
        return {
          type: 'official_form' as const,
          confidence: Math.min(0.97, 0.5 + combinedScore * 0.47),
          summary: `${form.formName}${form.formNumber ? ` (${form.formNumber})` : ''} — ${form.authority}`,
          formId: form.id,
          formName: form.formName,
          formNumber: form.formNumber,
          countryCode: form.countryCode,
          authority: form.authority,
          draftUrl: appendDraftUrlParams(draftUrl, { details: query, documentKind }),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }

  private searchCuratedDrafts(
    query: string,
    countryCode: string,
    profile?: MatterProfile,
    excludePracticeAreas?: string[],
    answers?: Record<string, string | string[]>,
    extracted?: ReturnType<typeof extractMatterFacts>,
  ): DraftIntentMatch[] {
    const documentKind = resolveMatterDocumentKind(profile, query);
    const stalking = isStalkingComplaintQuery(query) || Boolean(extracted?.hasStalkingAllegation);
    const cites78 = hasBns78Citation(extracted?.citedStatutes ?? []);
    const includeCyber =
      Boolean(extracted?.hasOnlineConduct) ||
      hasOnlineConductInQuery(query) ||
      this.answersIndicateOnline(answers);
    const preferMagistrate = this.answersPreferMagistrate(answers);

    const priorityScore = (kind: string): number | undefined => {
      if (extracted?.isSelfDefenseHomicideContext) {
        if (kind === 'india_discharge_application_bnss_250') {
          return extracted.seeksDischarge || extracted.hasChargesheetFiled ? 0.96 : 0.9;
        }
        if (kind === 'india_reply_to_chargesheet') return 0.88;
        if (kind === 'india_regular_bail_bnss_480' || kind === 'india_anticipatory_bail_bnss_482') {
          return 0.82;
        }
      }
      if (!stalking && !profile?.curatedKinds?.includes(kind)) return undefined;
      if (kind === 'india_fir_complaint') return cites78 ? 0.985 : 0.97;
      if (kind === 'india_complaint_magistrate_bnss_223') {
        return preferMagistrate ? 0.95 : 0.88;
      }
      if (kind === 'india_cyber_crime_complaint') {
        return includeCyber ? 0.9 : undefined; // omit when no online signal
      }
      // Non-stalking curatedKinds keep a modest boost
      if (profile?.curatedKinds?.includes(kind) && !stalking) return 0.92;
      return undefined;
    };

    return listCuratedDraftEntries()
      .filter((entry) => countryCode === 'ALL' || entry.countryCode === countryCode)
      .map((entry) => {
        let score = scoreTextMatch(query, `${entry.label} ${entry.kind}`);
        const boosted = priorityScore(entry.kind);
        if (boosted === undefined && stalking && profile?.curatedKinds?.includes(entry.kind)) {
          // Explicitly drop cyber (and other equal-boost leftovers) when not online
          if (entry.kind === 'india_cyber_crime_complaint' && !includeCyber) {
            score = 0;
          }
        } else if (boosted !== undefined) {
          score = Math.max(score, boosted);
        }
        if (excludePracticeAreas?.length && /\barbitration\b/i.test(entry.kind) && profile?.practiceArea === 'employment_labour') {
          score *= 0.1;
        }
        // Self-defence: keep playbook kinds even when lexical score is low.
        const selfDefenseFloor =
          extracted?.isSelfDefenseHomicideContext &&
          /discharge|chargesheet|bail_bnss|reply_to_chargesheet/i.test(entry.kind)
            ? 0.2
            : 0.25;
        return { entry, score, floor: selfDefenseFloor };
      })
      .filter(({ score, floor }) => score >= floor)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ entry, score }) => {
        const { label, proceduralNote } = resolveCuratedDraftLabel(documentKind, entry.kind, query);
        const category = resolveCuratedDraftCategory(entry.kind);
        const baseUrl = buildCuratedDraftUrl(entry.kind, entry.countryCode, label);
        const draftUrl = appendDraftUrlParams(
          category ? `${baseUrl}&category=${encodeURIComponent(category)}` : baseUrl,
          { details: query, documentKind },
        );
        const confidence =
          priorityScore(entry.kind) ?? Math.min(0.9, 0.4 + score * 0.5);
        return {
          type: 'curated_draft' as const,
          confidence,
          summary: label,
          kind: entry.kind,
          label,
          countryCode: entry.countryCode,
          draftUrl,
          proceduralNote,
          advocateReviewStatus: entry.advocateReviewStatus,
          requiredAuthorityFields: entry.requiredAuthorityFields,
        };
      });
  }

  private async searchTemplates(
    query: string,
    tenantId: string,
    countryCode: string,
  ): Promise<DraftIntentMatch[]> {
    const documentKind = resolveDocumentKind(undefined, query);
    const kindExplicit = isExplicitDocumentKind(documentKind, query);

    const [firmTemplates, systemTemplates] = await Promise.all([
      this.prisma.documentTemplate.findMany({
        where: {
          tenantId,
          isActive: true,
          NOT: {
            category: { in: ['CLIENT_DOCUMENT', 'CLIENT'] },
          },
          ...(countryCode && countryCode !== 'ALL'
            ? { OR: [{ countryCode }, { countryCode: null }] }
            : {}),
        },
        take: 30,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.systemDocumentTemplate.findMany({
        where: {
          isActive: true,
          ...(countryCode && countryCode !== 'ALL' ? { countryCode } : {}),
        },
        take: 30,
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const firmMatches = firmTemplates
      .map((template) => {
        const score = Math.max(
          scoreTextMatch(query, template.name),
          template.documentKind === documentKind && kindExplicit ? 0.7 : 0,
          scoreTextMatch(query, template.documentKind ?? ''),
        );
        return { template, score, source: template.category === TEMPLATE_CATEGORY.USER ? 'user' as const : 'firm' as const };
      })
      .filter(({ score }) => score >= 0.2);

    const provisionedSystemIds = new Set(
      firmTemplates.map((t) => t.systemTemplateId).filter(Boolean),
    );

    const systemMatches = systemTemplates
      .filter((t) => !provisionedSystemIds.has(t.id))
      .map((template) => {
        const score = Math.max(
          scoreTextMatch(query, template.name),
          template.documentKind === documentKind && kindExplicit ? 0.65 : 0,
        );
        return { template, score, source: 'system' as const, systemId: template.id };
      })
      .filter(({ score }) => score >= 0.2);

    const mapTemplate = (
      template: { id: string; name: string; documentKind: string | null; countryCode: string | null },
      score: number,
      source: 'system' | 'firm' | 'user',
    ) => ({
      type: 'template' as const,
      confidence: Math.min(0.88, 0.35 + score * 0.55),
      summary: `${template.name} — ${source === 'user' ? 'user template' : source === 'system' ? 'library template' : 'firm template'}`,
      templateId: template.id,
      name: template.name,
      source,
      documentKind: template.documentKind ?? null,
      countryCode: template.countryCode ?? null,
      editUrl:
        source === 'system'
          ? '/app/templates'
          : `/app/templates/${template.id}/edit`,
      useUrl: isFilingGradeDraftKind(documentKind)
        ? buildGenerateDraftUrl(documentKind, (template.countryCode as Tier1Country) ?? 'IN', template.name, {
            details: query,
            documentKind,
          })
        : buildTemplateUseUrl(template.id, { query, documentKind }),
    });

    const firmResults = firmMatches.map(({ template, score, source }) =>
      mapTemplate(template, score, source),
    );

    const systemResults = await Promise.all(
      systemMatches.map(async ({ template, score, source, systemId }) => {
        const provisioned = await this.prisma.documentTemplate.findFirst({
          where: { tenantId, systemTemplateId: systemId, isActive: true },
          select: { id: true, name: true, documentKind: true, countryCode: true },
        });
        if (provisioned) {
          return mapTemplate(provisioned, score, 'firm');
        }
        return {
          ...mapTemplate(
            {
              id: systemId,
              name: template.name,
              documentKind: template.documentKind,
              countryCode: template.countryCode,
            },
            score,
            source,
          ),
          useUrl: isFilingGradeDraftKind(documentKind)
            ? buildGenerateDraftUrl(documentKind, (template.countryCode as Tier1Country) ?? 'IN', template.name, {
                details: query,
                documentKind,
              })
            : buildTemplateUseUrl(systemId, {
                query,
                documentKind,
                systemTemplate: 'true',
              }),
        };
      }),
    );

    return [...firmResults, ...systemResults]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4);
  }
}
