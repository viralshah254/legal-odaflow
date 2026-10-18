import { Injectable, Logger, Optional, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@/jobs/jobs.constants';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DraftJobService } from './draft-job.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import { DraftProgressService } from './progress/draft-progress.service';
import { MatterNormalizationService } from './intake/matter-normalization.service';
import { UnifiedProceduralGateService } from './procedural/unified-procedural-gate.service';
import { DraftRetrievalCoordinator } from './retrieval/draft-retrieval-coordinator.service';
import { VerifiedSourceRegistryService } from './retrieval/verified-source-registry.service';
import { DraftPlanningService } from './planning/draft-planning.service';
import { UnifiedSectionGenerationService } from './generation/unified-section-generation.service';
import { UnifiedDraftVerificationService } from './verification/unified-draft-verification.service';
import { DraftDefectReportService } from './verification/draft-defect-report.service';
import { UnifiedTargetedRepairService } from './repair/unified-targeted-repair.service';
import { DraftAssemblyService } from './assembly/draft-assembly.service';
import {
  LawyerReadyPipelineService,
  type LawyerReadyPassResult,
} from './verification/lawyer-ready-pipeline.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { DraftCaseTheoryService } from '@/ai/drafting/draft-case-theory.service';
import { DraftArgumentGraphService } from '@/ai/drafting/draft-argument-graph.service';
import {
  DraftCoherenceReviewService,
  type CoherenceIssue,
} from '@/ai/drafting/draft-coherence-review.service';
import { DraftModelRouterService } from './draft-model-router.service';
import type { VerifiedSource } from './contracts/verified-source';
import { DraftPipelineService } from '@/ai/drafting/platform/draft-pipeline.service';
import { DraftAuthorityVerificationService } from './verification/draft-authority-verification.service';
import { sanitizeDraftOutput } from '@/ai/drafting/draft-output-sanitizer';
import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import type { PinnedCaseLaw } from '@/ai/drafting/draft-pinned-authorities';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { CreditPricingService } from '@/ai-credits/credit-pricing.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { LegalSectionRouterService } from '@/ai/legal-section-router.service';
import { DraftVerificationOutcomeService } from '@/ai/feedback/draft-verification-outcome.service';
import { normalizeCountry } from '@/ai/feedback/draft-training-pipeline.service';
import type {
  DraftVerificationAudit,
  StrippedCitation,
} from '@/ai/drafting/draft-verification.types';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import type { QualityTier } from './contracts/model-aliases';
import type { CaseRecord } from '@/ai/drafting/contracts/case-record';
import {
  buildCaseRecordPromptBlock,
  isConfirmedCaseRecord,
} from '@/ai/drafting/accuracy/case-record-prompt.util';
import { mergeCaseRecordIntoNormalizedMatter } from '@/ai/drafting/accuracy/case-record-to-normalized-matter.util';
import {
  hasConsumerMatterSignals,
  isResearchMemoKind,
  resolveBundleResearchMemoKind,
  resolveResearchMemoAccuracyMode,
} from '@/ai/drafting/draft-kind.util';
import { resolveSkipConfirmRequirement } from './skip-confirm-requirement';
import { extractVerifiedAuthoritiesFromSavedResearch } from '@/ai/drafting/matter-saved-research-authorities';

@Injectable()
export class DraftWorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DraftWorkerProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jobService: DraftJobService,
    private readonly draftHistory: CourtDraftHistoryService,
    private readonly progressService: DraftProgressService,
    private readonly normalization: MatterNormalizationService,
    private readonly proceduralGate: UnifiedProceduralGateService,
    private readonly retrieval: DraftRetrievalCoordinator,
    private readonly sourceRegistry: VerifiedSourceRegistryService,
    private readonly planning: DraftPlanningService,
    private readonly generation: UnifiedSectionGenerationService,
    private readonly verification: UnifiedDraftVerificationService,
    private readonly defectReport: DraftDefectReportService,
    private readonly repair: UnifiedTargetedRepairService,
    private readonly assembly: DraftAssemblyService,
    private readonly lawyerReady: LawyerReadyPipelineService,
    private readonly playbooks: DraftKindPlaybookService,
    private readonly caseTheory: DraftCaseTheoryService,
    private readonly argumentGraph: DraftArgumentGraphService,
    private readonly coherenceReview: DraftCoherenceReviewService,
    private readonly modelRouter: DraftModelRouterService,
    private readonly draftPipeline: DraftPipelineService,
    private readonly authorityVerification: DraftAuthorityVerificationService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly creditPricing: CreditPricingService,
    private readonly legalSectionRouter: LegalSectionRouterService,
    @Optional() private readonly verificationOutcomes: DraftVerificationOutcomeService | null,
  ) {}

  onModuleInit(): void {
    if (process.env.UNIFIED_DRAFT_ENGINE_ENABLED !== 'true') {
      this.logger.log('Unified draft worker disabled (UNIFIED_DRAFT_ENGINE_ENABLED != true)');
      return;
    }

    this.worker = new Worker(
      QUEUE_NAMES.DRAFT_GENERATE,
      async (job: Job) => {
        await this.process(job);
      },
      {
        connection: {
          url: this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
          maxRetriesPerRequest: null,
        },
        concurrency: 3,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Draft job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Draft worker started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async process(job: Job): Promise<void> {
    const payload = job.data as DraftJobPayload;
    const { jobId } = payload;
    const startTime = Date.now();
    this.logger.log(`Processing draft job ${jobId}`);

    try {
      await this.runPipeline(payload, startTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Draft job ${jobId} failed: ${message}`);
      await this.jobService.markFailed(jobId, message);
      const event = await this.jobService.advanceStage(jobId, 'failed', { error: message });
      this.progressService.emit(event);
      throw err;
    }
  }

  private async runPipeline(payload: DraftJobPayload, startTime: number): Promise<void> {
    const {
      jobId, tenantId, userId, matterId, qualityTier,
      facts, jurisdiction, courtName, clientName, opposingParty, parties, attachmentContext,
      language,
      confirmedCaseRecord,
      accuracyMode,
      bundleMode,
      bundleIndex,
      pinnedCaseLaws,
      knowledgeSources,
    } = payload;
    // `jurisdiction` is free text off the API body — "IN", "in", "IN-DL". Every
    // country lookup downstream (source preference, official case sources,
    // section finder) keys on a bare uppercase code, so an unnormalised value
    // silently misses and falls back to the generic path. Resolve it once.
    // An unrecognised code is kept as-is rather than coerced to IN: the generic
    // jurisdiction-agnostic path is the right answer for a country we do not
    // have a corpus for, whereas India's rules would simply be wrong.
    const countryCode = normalizeCountry(jurisdiction) || 'IN';

    let documentKind = payload.documentKind;
    if (
      bundleMode &&
      (bundleIndex ?? 0) === 0 &&
      documentKind === 'india_legal_research_memo'
    ) {
      documentKind = resolveBundleResearchMemoKind(documentKind, facts);
      if (documentKind !== payload.documentKind) {
        this.logger.log(
          `Bundle Doc 1 research memo remapped: ${payload.documentKind} → ${documentKind}`,
        );
      }
    }

    // ── Stage 1: Intake Normalization ─────────────────────────────────────────
    let event = await this.jobService.advanceStage(jobId, 'normalizing');
    this.progressService.emit(event);

    const dbJob = await this.prisma.draftJob.findUnique({ where: { id: jobId } });
    if (!dbJob) throw new Error(`Job ${jobId} not found in database`);

    let normalizedMatter = dbJob.normalizedMatterJson as Record<string, unknown> | null;
    if (!normalizedMatter) {
      const t0 = Date.now();
      normalizedMatter = await this.normalization.normalize({
        rawFacts: facts,
        documentKind,
        jurisdiction,
        courtName,
        clientName,
        opposingParty,
        parties,
        attachmentContext,
        tenantId,
        userId,
        qualityTier: qualityTier as QualityTier,
      }) as unknown as Record<string, unknown>;
      await this.jobService.persistStageOutput(jobId, 'normalizing', normalizedMatter, Date.now() - t0);
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { normalizedMatterJson: normalizedMatter as Prisma.InputJsonValue },
      });
    }

    // Prefer UI-confirmed CaseRecord (payload or persisted executionPlanJson) — merge before retrieval
    const persistedPlanEarly = (dbJob.executionPlanJson ?? {}) as {
      confirmedCaseRecord?: unknown;
    };
    const confirmedRawEarly = confirmedCaseRecord ?? persistedPlanEarly.confirmedCaseRecord;
    const confirmedRecordEarly: CaseRecord | undefined = isConfirmedCaseRecord(confirmedRawEarly)
      ? confirmedRawEarly
      : undefined;
    if (confirmedRecordEarly && normalizedMatter) {
      normalizedMatter = mergeCaseRecordIntoNormalizedMatter(
        normalizedMatter as unknown as import('./contracts/normalized-matter').NormalizedMatter,
        confirmedRecordEarly,
      ) as unknown as Record<string, unknown>;
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { normalizedMatterJson: normalizedMatter as Prisma.InputJsonValue },
      });
    }

    // Case Brief + preflight intake gate for filing-grade kinds
    const playbook = this.playbooks.resolve(documentKind);
    const caseBrief = this.lawyerReady.extractBrief(facts, documentKind);
    await this.jobService.persistStageOutput(jobId, 'case_brief', caseBrief as unknown as Record<string, unknown>, 0);
    if (playbook.filingGrade && caseBrief.intakeIncomplete && caseBrief.missingCriticalFields.length > 0) {
      const reason = `Complete intake before generating a filing-grade draft. Missing: ${caseBrief.missingCriticalFields.join(', ')}`;
      await this.jobService.markBlocked(jobId, reason);
      event = await this.jobService.advanceStage(jobId, 'blocked', { reason, missingCriticalFields: caseBrief.missingCriticalFields });
      this.progressService.emit(event);
      return;
    }

    // ── Stage 2: Procedural Gate ──────────────────────────────────────────────
    event = await this.jobService.advanceStage(jobId, 'procedural_check');
    this.progressService.emit(event);

    let proceduralResult = dbJob.proceduralResultJson as Record<string, unknown> | null;
    if (!proceduralResult) {
      const t0 = Date.now();
      proceduralResult = await this.proceduralGate.check(normalizedMatter as any) as unknown as Record<string, unknown>;
      await this.jobService.persistStageOutput(jobId, 'procedural_check', proceduralResult, Date.now() - t0);
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { proceduralResultJson: proceduralResult as Prisma.InputJsonValue },
      });
    }

    if ((proceduralResult as any)['status'] === 'blocked') {
      const reason = ((proceduralResult as any)['issues'] as Array<{ message: string; severity: string }>)
        .filter((i) => i.severity === 'critical')
        .map((i) => i.message)
        .join('; ');
      await this.jobService.markBlocked(jobId, reason || 'Procedural check failed');
      event = await this.jobService.advanceStage(jobId, 'blocked', { reason });
      this.progressService.emit(event);
      return;
    }

    // ── Stage 2b: Theory of the case ──────────────────────────────────────────
    // Settled before anything is searched or drafted, so authority research is
    // aimed at the grounds we actually intend to plead.
    const caseTheory = await this.caseTheory.build({
      facts,
      documentKind,
      countryCode,
      jurisdiction,
      caseBrief,
      model: this.modelRouter.resolveReviewerModel(qualityTier as QualityTier),
      filingGrade: playbook.filingGrade,
    });
    await this.jobService.persistStageOutput(
      jobId,
      'case_theory',
      caseTheory as unknown as Record<string, unknown>,
      0,
    );

    // ── Stage 3: Retrieval + Source Registry ──────────────────────────────────
    event = await this.jobService.advanceStage(jobId, 'retrieving');
    this.progressService.emit(event);

    let sourceRegistry = dbJob.sourceRegistryJson as Record<string, unknown> | null;
    if (!sourceRegistry) {
      const t0 = Date.now();
      const savedResearchAuthorities = await this.loadMatterSavedResearch(tenantId, matterId);
      const sources = await this.retrieval.retrieveAll({
        matter: normalizedMatter as any,
        proceduralResult: proceduralResult as any,
        tenantId,
        userId,
        caseBriefJson: caseBrief as unknown as Record<string, unknown>,
        knowledgeSources,
        savedResearchAuthorities,
        groundQueries: this.caseTheory.buildAuthorityQueries(caseTheory, {
          documentKind,
          jurisdiction,
        }),
      });
      const registry = await this.sourceRegistry.build(jobId, sources);
      sourceRegistry = registry as unknown as Record<string, unknown>;
      await this.jobService.persistStageOutput(jobId, 'retrieving', sourceRegistry, Date.now() - t0);
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { sourceRegistryJson: sourceRegistry as Prisma.InputJsonValue },
      });
    }

    // ── Stage 4: Planning ─────────────────────────────────────────────────────
    event = await this.jobService.advanceStage(jobId, 'planning');
    this.progressService.emit(event);

    let executionPlan = dbJob.executionPlanJson as Record<string, unknown> | null;
    const hasSectionPlan =
      !!executionPlan &&
      Array.isArray(executionPlan['sections']) &&
      (executionPlan['sections'] as unknown[]).length > 0;
    const seedMeta = {
      confirmedCaseRecord:
        (executionPlan as { confirmedCaseRecord?: unknown } | null)?.confirmedCaseRecord ??
        confirmedCaseRecord ??
        null,
      accuracyMode:
        (executionPlan as { accuracyMode?: unknown } | null)?.accuracyMode ??
        accuracyMode ??
        null,
      bundleMode: (executionPlan as { bundleMode?: unknown } | null)?.bundleMode ?? null,
      bundleIndex: (executionPlan as { bundleIndex?: unknown } | null)?.bundleIndex ?? null,
    };
    if (!hasSectionPlan) {
      const t0 = Date.now();
      const plan = await this.planning.buildPlan({
        jobId,
        matter: normalizedMatter as any,
        proceduralResult: proceduralResult as any,
        sourceRegistry: sourceRegistry as any,
        qualityTier: qualityTier as QualityTier,
        tenantId,
        userId,
      });
      executionPlan = {
        ...(plan as unknown as Record<string, unknown>),
        ...seedMeta,
      };
      await this.jobService.persistStageOutput(jobId, 'planning', executionPlan, Date.now() - t0);
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { executionPlanJson: executionPlan as Prisma.InputJsonValue },
      });
    }

    // ── Stage 5: Generation ───────────────────────────────────────────────────
    const totalSections = ((executionPlan as any)['sections'] as unknown[])?.length ?? 0;
    event = await this.jobService.advanceStage(jobId, 'generating', { totalSections });
    this.progressService.emit(event);

    const governingStatutes: string[] =
      ((proceduralResult as any)?.['proceduralProfile']?.['governingProcedure'] as string[] | undefined) ?? [];

    const sectionRoute = this.legalSectionRouter.resolve({
      consumer: 'unified_drafting',
      countryCode,
      documentKind,
      courtName,
      rawFacts: facts,
    });
    const bailSectionLabel = sectionRoute.bailResolution?.label;

    // Prefer UI-confirmed CaseRecord (payload or persisted executionPlanJson)
    const persistedPlan = (dbJob.executionPlanJson ?? {}) as {
      confirmedCaseRecord?: unknown;
      accuracyMode?: 'fast' | 'balanced' | 'strict';
    };
    const confirmedRaw = confirmedCaseRecord ?? persistedPlan.confirmedCaseRecord;
    const confirmedRecord: CaseRecord | undefined =
      confirmedRecordEarly ?? (isConfirmedCaseRecord(confirmedRaw) ? confirmedRaw : undefined);
    const caseRecordPrompt = confirmedRecord
      ? buildCaseRecordPromptBlock(confirmedRecord)
      : '';
    const briefBlock = this.lawyerReady.buildBriefPromptBlock(caseBrief);
    const registrySourceList = ((sourceRegistry as { sources?: unknown[] } | null)?.sources ??
      []) as VerifiedSource[];
    const argumentGraph = this.argumentGraph.build({
      theory: caseTheory,
      sources: registrySourceList,
      facts: caseBrief.defenceFacts,
    });
    if (argumentGraph.unsupportedGroundIds.length > 0) {
      this.logger.warn(
        `${argumentGraph.unsupportedGroundIds.length}/${argumentGraph.nodes.length} grounds have no verified authority for job ${jobId}; they will carry an authority-gap marker`,
      );
    }
    const caseTheoryBlock = this.caseTheory.buildPromptBlock(caseTheory);
    const argumentGraphBlock = this.argumentGraph.buildPromptBlock(
      argumentGraph,
      registrySourceList,
    );
    const isResearchMemo = isResearchMemoKind(documentKind);
    const consumerMedical = hasConsumerMatterSignals(documentKind, facts);
    const consumerFidelityBlock = /consumer/i.test(documentKind) && !isResearchMemo
      ? [
          '',
          'CONSUMER FILING RULES:',
          '- Use Complainant / Opposite Party (not Petitioner/Respondent).',
          '- FACTS and GROUNDS must be substantive (chronology, parties, amounts from CASE RECORD).',
          '- Do not invent insurer denial/repudiation unless CASE RECORD supports it.',
          '- Never leave STATEMENT OF FACTS or GROUNDS as a stub or single name line.',
        ].join('\n')
      : '';
    const researchMemoFidelityBlock = isResearchMemo
      ? [
          '',
          'RESEARCH MEMORANDUM RULES (mandatory — NOT a court pleading):',
          '- Required sections: SHORT ANSWER, ISSUES, FACTS, ANALYSIS, AUTHORITIES, NEXT STEPS.',
          '- FORBIDDEN: CAUSE TITLE, MEMO OF PARTIES, PRAYER, VERIFICATION, Petitioner/Respondent captions.',
          consumerMedical
            ? '- Use Complainant / Opposite Party terminology for consumer/medical matters.'
            : '- Use Client / Opposite Party or neutral party labels.',
          '- FACTS: neutral chronology from CASE RECORD only; fill known dates/names/amounts; [BLANK] only if truly missing.',
          '- ANALYSIS: qualify expert opinions; separate liability theories; cite supporting AND adverse authorities.',
          '- Do NOT invent insurer denial/repudiation unless CASE RECORD supports it.',
          '- CPA 2019: cite §§34/35/47/51 as applicable; never CPA 1986 §2(1)(*) or invented pecuniary bands.',
        ].join('\n')
      : '';

    await this.generation.generateAllSections({
      jobId,
      executionPlan: executionPlan as any,
      matter: normalizedMatter as any,
      sourceRegistry: sourceRegistry as any,
      qualityTier: qualityTier as QualityTier,
      tenantId,
      userId,
      governingStatutes,
      bailSectionLabel,
      language,
      countryCode,
      filingGrade: playbook.filingGrade,
      caseBriefPromptBlock: [
        briefBlock,
        caseTheoryBlock,
        argumentGraphBlock,
        caseRecordPrompt,
        consumerFidelityBlock,
        researchMemoFidelityBlock,
      ]
        .filter(Boolean)
        .join('\n\n'),
      confirmedCaseRecord: confirmedRecord,
      onSectionComplete: (completedCount, total) => {
        this.progressService.emit({
          jobId,
          status: 'generating',
          stage: 'generating',
          percent: 30 + Math.round((completedCount / total) * 25),
          message: `Drafting sections (${completedCount}/${total})`,
          completedSections: completedCount,
          totalSections: total,
          timestamp: new Date().toISOString(),
        });
      },
    });

    // ── Stage 6: Verification + Defect Report ─────────────────────────────────
    event = await this.jobService.advanceStage(jobId, 'verifying');
    this.progressService.emit(event);

    const sections = await this.prisma.draftJobSection.findMany({ where: { jobId } });
    const t0verify = Date.now();

    const verificationReport = await this.verification.verify({
      jobId,
      sections: sections as any,
      sourceRegistry: sourceRegistry as any,
      matter: normalizedMatter as any,
    });

    const defectReport = await this.defectReport.generateReport({
      jobId,
      sections: sections as any,
      verificationIssues: verificationReport.issues,
      qualityTier: qualityTier as QualityTier,
      caseDetails: facts,
      caseRecord: confirmedRecord,
      documentKind,
      requiredSections: playbook.requiredSections,
      prohibitedAssertions: playbook.prohibitedAssertions,
    });

    const allIssues = [...verificationReport.issues, ...defectReport.additionalIssues];
    if (allIssues.length > 0) {
      await this.prisma.draftJobIssue.createMany({
        data: allIssues.map((issue) => ({
          jobId,
          sectionId: issue.sectionId,
          category: issue.category,
          severity: issue.severity,
          message: issue.message,
          suggestedCorrection: issue.suggestedCorrection,
          sourceId: issue.sourceId,
          repairableAutomatically: issue.repairableAutomatically,
          validator: issue.validator,
          fingerprint: issue.fingerprint,
        })),
        skipDuplicates: true,
      });
    }

    await this.jobService.persistStageOutput(jobId, 'verifying', verificationReport as any, Date.now() - t0verify);
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { verificationReportJson: verificationReport as any },
    });

    // ── Stage 7: Targeted Repair ──────────────────────────────────────────────
    const repairableIssues = allIssues.filter((i) => i.repairableAutomatically);
    if (repairableIssues.length > 0) {
      event = await this.jobService.advanceStage(jobId, 'repairing');
      this.progressService.emit(event);

      const sectionsForRepair = await this.prisma.draftJobSection.findMany({ where: { jobId } });
      await this.repair.repairAll({
        jobId,
        issues: repairableIssues,
        sections: sectionsForRepair as any,
        sourceRegistry: sourceRegistry as any,
        matter: normalizedMatter as any,
        qualityTier: qualityTier as QualityTier,
      });
    }

    // ── Stage 8: Assembly ─────────────────────────────────────────────────────
    event = await this.jobService.advanceStage(jobId, 'assembling');
    this.progressService.emit(event);

    const finalSections = await this.prisma.draftJobSection.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });

    const assembled = await this.assembly.assemble({
      jobId,
      sections: finalSections as any,
      sourceRegistry: sourceRegistry as any,
      executionPlan: executionPlan as any,
    });

    // ── Stage 9–11: Lawyer-ready review + auto-apply + final verify ─────────
    let assembledDraftText =
      typeof assembled === 'string'
        ? assembled
        : String((assembled as any)?.fullText ?? (assembled as any)?.draft ?? JSON.stringify(assembled));

    const sanitized = sanitizeDraftOutput(assembledDraftText, {
      documentClass: 'pleading',
      kind: documentKind,
      caseDetails: facts,
    });
    const registrySources = Array.isArray((sourceRegistry as { sources?: unknown[] } | null)?.sources)
      ? ((sourceRegistry as { sources: Array<Record<string, unknown>> }).sources)
      : [];
    const packAuthorities = registrySources.map((source) => ({
      id: String(source.id ?? ''),
      title: String(source.title ?? ''),
      citation: source.citation ? String(source.citation) : null,
      summary: source.text ? String(source.text) : source.proposition ? String(source.proposition) : null,
    }));
    const citationStrip = stripUnverifiedCitations(sanitized.text, packAuthorities, [], 'strip');
    assembledDraftText = citationStrip.text;

    event = await this.jobService.advanceStage(jobId, 'reviewing');
    this.progressService.emit(event);

    // Senior-partner read of the whole filing: parties, dates, chronology, and
    // whether the prayer actually follows from the grounds. A revision is only
    // taken if it added no new citation, date, or dropped gap marker.
    const coherence = await this.coherenceReview.review({
      draft: assembledDraftText,
      documentKind,
      countryCode,
      jurisdiction,
      caseTheoryPromptBlock: caseTheoryBlock,
      model: this.modelRouter.resolveReviewerModel(qualityTier as QualityTier),
      allowRevision: playbook.filingGrade,
    });
    if (coherence.revisedDraft) {
      assembledDraftText = coherence.revisedDraft;
    }
    if (coherence.issues.length > 0 || coherence.revisionRejectedReason) {
      await this.jobService.persistStageOutput(
        jobId,
        'coherence_review',
        coherence as unknown as Record<string, unknown>,
        0,
      );
    }
    const blockingCoherenceIssues = coherence.issues.filter(
      (issue) => issue.severity === 'BLOCKER' || issue.severity === 'HIGH',
    );
    if (blockingCoherenceIssues.length > 0) {
      await this.prisma.draftJobIssue.createMany({
        data: blockingCoherenceIssues.map((issue) => ({
          jobId,
          category: 'coherence',
          severity: issue.severity === 'BLOCKER' ? 'critical' : 'high',
          message: `${issue.category}: ${issue.explanation}`,
          suggestedCorrection: issue.suggestedFix,
          repairableAutomatically: false,
          validator: 'senior-partner-coherence',
          fingerprint: `coherence:${issue.category}:${issue.explanation.slice(0, 80)}`,
        })),
        skipDuplicates: true,
      });
    }

    const certify = await this.lawyerReady.certifyAssembledDraft({
      draft: assembledDraftText,
      caseDetails: facts,
      kind: documentKind,
      sourceRegistry: sourceRegistry as any,
      runReviewLoop: playbook.filingGrade,
      countryCode,
    });

    if (certify.appliedFixes.length > 0) {
      event = await this.jobService.advanceStage(jobId, 'applying_fixes', {
        appliedCount: certify.appliedFixes.length,
      });
      this.progressService.emit(event);
    }

    event = await this.jobService.advanceStage(jobId, 'final_verify', {
      certificationLabel: certify.certificationLabel,
      lawyerReady: certify.lawyerReady,
    });
    this.progressService.emit(event);

    assembledDraftText = certify.draft;
    const lawyerReadyIssues = this.lawyerReady.toDraftIssues(certify.findings);
    if (lawyerReadyIssues.length > 0) {
      await this.prisma.draftJobIssue.createMany({
        data: lawyerReadyIssues.map((issue) => ({
          jobId,
          sectionId: issue.sectionId,
          category: issue.category,
          severity: issue.severity,
          message: issue.message,
          suggestedCorrection: issue.suggestedCorrection,
          repairableAutomatically: issue.repairableAutomatically,
          validator: issue.validator,
          fingerprint: issue.fingerprint,
        })),
        skipDuplicates: true,
      }).catch(() => undefined);
    }

    // Platform release gate (universal + playbook checks) — hard-blocks export on red
    let releaseGateJson: Record<string, unknown> | null = null;
    let platformCanExport = true;
    let pipelineBlockedReason: string | undefined;
    try {
      const pipelineResult = await this.draftPipeline.run({
        tenantId,
        userId,
        documentKind,
        caseDetails: facts,
        jurisdiction: countryCode,
        courtName,
        clientName,
        opposingParty,
        existingDraftMarkdown: assembledDraftText,
        caseRecord: confirmedRecord,
        skipConfirmRequirement: resolveSkipConfirmRequirement(
          playbook.filingGrade,
          confirmedRecord,
        ),
        confirmUserId: confirmedRecord ? userId : undefined,
        accuracyMode: resolveResearchMemoAccuracyMode({
          documentKind,
          caseDetails: facts,
          confirmedCaseRecord: confirmedRecord,
          filingGrade: playbook.filingGrade,
          explicitMode:
            accuracyMode ?? (persistedPlan.accuracyMode as 'fast' | 'balanced' | 'strict' | undefined),
        }),
        lineage: {
          adapterKind: documentKind,
          playbookVersion: '1.0.0',
          validatorVersions: {},
          generatedAt: new Date().toISOString(),
        },
      });
      if (pipelineResult.releaseGate) {
        releaseGateJson = pipelineResult.releaseGate as unknown as Record<string, unknown>;
        platformCanExport = pipelineResult.canExport;
        if (pipelineResult.caseRecord) {
          (releaseGateJson as any).caseRecordId = pipelineResult.caseRecord.metadata.caseRecordId;
          (releaseGateJson as any).caseRecordVersion =
            pipelineResult.caseRecord.metadata.version;
        }
        if (pipelineResult.structuredDraft?.fullMarkdown) {
          assembledDraftText = pipelineResult.structuredDraft.fullMarkdown;
        }
        if (
          pipelineResult.releaseGate.finalResolutionStatus === 'blocked' ||
          pipelineResult.releaseGate.finalResolutionStatus === 'needs_user_confirmation' ||
          pipelineResult.releaseGate.finalResolutionStatus === 'needs_advocate_review'
        ) {
          pipelineBlockedReason =
            pipelineResult.releaseGate.userLabel ||
            `Accuracy: ${pipelineResult.releaseGate.finalResolutionStatus}`;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Platform release gate failed for ${jobId}: ${message}`);
      platformCanExport = false;
      pipelineBlockedReason = `Release gate error: ${message}`;
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { blockedReason: pipelineBlockedReason },
      }).catch(() => undefined);
    }

    let authorityVerificationResult: Awaited<ReturnType<DraftAuthorityVerificationService['verify']>> | null =
      null;
    if (this.authorityVerification.isEnabled()) {
      try {
        authorityVerificationResult = await this.authorityVerification.verify({
          draftText: assembledDraftText,
          documentKind,
          jurisdiction: countryCode,
          courtName,
          rawFacts: facts,
          sourceRegistry: sourceRegistry as any,
          pinnedCaseLaws: pinnedCaseLaws as PinnedCaseLaw[] | undefined,
          tenantId,
          userId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Authority verification failed for ${jobId}: ${message}`);
      }
    }

    const authorityGate = authorityVerificationResult?.gate;
    const authorityCanExport = authorityGate?.canExport ?? true;
    if (authorityVerificationResult && releaseGateJson) {
      const authAccuracy = this.authorityVerification.toAccuracyFindings(authorityVerificationResult);
      const existingCodes = (releaseGateJson.unresolvedFindingCodes as string[]) ?? [];
      releaseGateJson.unresolvedFindingCodes = [
        ...new Set([...existingCodes, ...authAccuracy.map((f) => f.code)]),
      ];
      if (!authorityCanExport && playbook.filingGrade) {
        releaseGateJson.finalResolutionStatus = 'blocked';
        releaseGateJson.userLabel = authorityGate?.userLabel ?? releaseGateJson.userLabel;
      }
    }

    const enrichedAssembled = {
      ...(typeof assembled === 'object' && assembled ? assembled : { fullText: assembledDraftText }),
      fullText: assembledDraftText,
      certificationLabel: certify.certificationLabel,
      lawyerReady: certify.lawyerReady,
      factCoverageRate: certify.factCoverageRate,
      missingDefenceFacts: certify.brief.defenceFacts.filter(
        (f) => !assembledDraftText.toLowerCase().includes(f.toLowerCase().slice(0, 20)),
      ),
      autoAppliedFixes: certify.appliedFixes,
      verifiedCaseAuthorityCount: certify.verifiedCaseAuthorityCount,
      liveCaseLawAvailable: certify.liveCaseLawAvailable,
      caseBrief: certify.brief,
      releaseGate: releaseGateJson,
      canExport: platformCanExport && authorityCanExport && (certify.lawyerReady || !playbook.filingGrade),
      citationAppendix: authorityVerificationResult?.citationAppendix ?? (assembled as any)?.citationAppendix ?? [],
      authorityVerificationSummary: authorityGate
        ? {
            ...authorityGate,
            dimensions: authorityVerificationResult?.aggregateDimensions,
          }
        : undefined,
      authorityDimensions: authorityVerificationResult?.aggregateDimensions,
      userLabel:
        (releaseGateJson?.userLabel as string | undefined) ??
        (certify.lawyerReady ? 'Lawyer review recommended' : 'Draft blocked — action required'),
      finalResolutionStatus:
        (releaseGateJson?.finalResolutionStatus as string | undefined) ??
        (platformCanExport ? 'clean' : 'blocked'),
      confirmationQuestions: (releaseGateJson?.confirmationQuestions as unknown[]) ?? [],
      repairAttemptCount: (releaseGateJson?.repairAttemptCount as number | undefined) ?? 0,
      unresolvedFindingCodes: (releaseGateJson?.unresolvedFindingCodes as string[]) ?? [],
      blockedReason: pipelineBlockedReason,
    };

    if (pipelineBlockedReason) {
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { blockedReason: pipelineBlockedReason },
      }).catch(() => undefined);
    }

    const usages = await this.prisma.draftJobModelUsage.findMany({ where: { jobId } }) as Array<{ costUsd: number }>;
    const totalCostUsd = usages.reduce((sum: number, u: { costUsd: number }) => sum + u.costUsd, 0);

    // Usage charge uses net margin (AI_PLATFORM_NET_MARGIN_PERCENT, default 20%).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });
    const netMarginPercent = this.creditPricing.getNetMarginPercent(tenant?.billingPlan ?? null);
    const platformMargin = netMarginPercent / 100;
    const creditUsdValue = this.creditPricing.getCreditUsdValue();
    const budgetPerCredit = creditUsdValue * (1 - platformMargin);
    const consumedCredits = Math.max(1, Math.ceil(totalCostUsd / budgetPerCredit));

    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { assembledDraftJson: enrichedAssembled as any },
    });

    // A ready job must always point at its editable CourtDraftRecord. Persist first
    // so result polling can never observe a ready job without the durable draft id.
    await this.draftHistory.persistFromUnifiedJob({
      jobId,
      tenantId,
      userId,
      documentKind,
      caseDetails: facts,
      clientName,
      courtName,
      opposingParty,
      jurisdiction,
      language: language ?? 'en',
      draftText: assembledDraftText,
      creditsUsed: consumedCredits,
    });

    await this.jobService.markReady(jobId, totalCostUsd, consumedCredits);

    // Every run teaches the loop, even when the lawyer never rates the draft.
    await this.recordVerificationOutcome({
      tenantId,
      userId,
      documentKind,
      jurisdiction,
      jobId,
      certify,
      coherenceIssues: coherence.issues,
      strippedCitations: citationStrip.stripped,
      repairAttempted: certify.appliedFixes.length > 0,
      canExport: enrichedAssembled.canExport,
      modelUsed: this.modelRouter.resolveReviewerModel(qualityTier as QualityTier),
    });

    // Quality telemetry is independent of billing: a draft that was produced but
    // could not be charged still needs to show up on the per-jurisdiction health
    // view, otherwise a billing outage looks like the drafter went quiet.
    const draftTelemetry = {
      flow: 'drafting',
      countryCode,
      jurisdiction: jurisdiction ?? null,
      documentKind,
      qualityTier,
      filingGrade: playbook.filingGrade,
      authoritiesRetrieved: registrySources.length,
      authoritiesAfterPack: packAuthorities.length,
      citationsStripped: citationStrip.stripped.length,
      coherenceIssues: coherence.issues.length,
      blockingCoherenceIssues: blockingCoherenceIssues.length,
      certificationLabel: certify.certificationLabel,
      lawyerReady: certify.lawyerReady,
      repairAttempted: certify.appliedFixes.length > 0,
      canExport: enrichedAssembled.canExport,
      routedModel: this.modelRouter.resolveReviewerModel(qualityTier as QualityTier),
      groundsBound: argumentGraph.nodes.length,
      groundsWithoutAuthority: argumentGraph.unsupportedGroundIds.length,
    } as unknown as import('@prisma/client').Prisma.InputJsonValue;

    // Debit the wallet and log usage now that the actual cost is known.
    try {
      await this.creditLedger.assertAndDebit({
        userId,
        tenantId,
        taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
        credits: consumedCredits,
        metadata: {
          jobId,
          totalCostUsd,
          providerCostUsd: totalCostUsd,
          platformMarginPercent: Math.round(platformMargin * 100),
          netMarginPercent,
          billingPlan: tenant?.billingPlan ?? 'unknown',
          chargeMode: 'unified_draft_worker',
        } as unknown as import('@prisma/client').Prisma.InputJsonValue,
      });

      // Write AIUsageLog directly (AiUsageRecorderService lives in AiModule which
      // imports this module, so we avoid circular injection by writing via Prisma).
      const creditValueUsd = consumedCredits * this.creditPricing.getCreditUsdValue();
      await this.writeUsageLog({
        userId,
        tenantId,
        costUsd: totalCostUsd,
        chargedCredits: consumedCredits,
        creditValueUsd,
        platformMarginUsd: Math.max(0, creditValueUsd - totalCostUsd),
        status: 'SUCCESS',
        telemetry: draftTelemetry,
      });
    } catch (creditErr) {
      // Log but do not fail the job — draft is already assembled and marked ready.
      const msg = creditErr instanceof Error ? creditErr.message : String(creditErr);
      this.logger.warn(`Draft job ${jobId}: credit debit failed — ${msg}`);
      await this.prisma.draftJob.update({
        where: { id: jobId },
        data: { failureReason: `credit_debit_failed: ${msg}` },
      }).catch(() => undefined);
      await this.prisma.draftJobAuditEvent.create({
        data: {
          jobId,
          event: 'credit_debit_failed',
          metadata: { message: msg, consumedCredits, totalCostUsd } as object,
        },
      }).catch(() => undefined);
      await this.writeUsageLog({
        userId,
        tenantId,
        costUsd: totalCostUsd,
        chargedCredits: 0,
        status: 'UNCHARGED',
        error: `credit_debit_failed: ${msg}`,
        telemetry: draftTelemetry,
      }).catch(() => undefined);
      this.progressService.emit({
        jobId,
        status: 'ready',
        stage: 'ready',
        percent: 100,
        message: `Your draft is ready — credit debit failed: ${msg}`,
        error: `credit_debit_failed: ${msg}`,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(
        `Draft job ${jobId} completed in ${Date.now() - startTime} ms — cost $${totalCostUsd.toFixed(4)}, credits debit FAILED`,
      );
      return;
    }

    this.progressService.emit({
      jobId,
      status: 'ready',
      stage: 'ready',
      percent: 100,
      message: 'Your draft is ready',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Draft job ${jobId} completed in ${Date.now() - startTime} ms — cost $${totalCostUsd.toFixed(4)}, credits debited: ${consumedCredits}`,
    );
  }

  /**
   * Persist one usage row. Typed on our own payload so a stale Prisma client
   * cannot reject `telemetry` as an unknown create field.
   */
  private writeUsageLog(data: {
    userId: string;
    tenantId: string;
    status: string;
    error?: string;
    chargedCredits: number;
    costUsd: number;
    creditValueUsd?: number;
    platformMarginUsd?: number;
    telemetry: Prisma.InputJsonValue;
  }) {
    return this.prisma.aIUsageLog.create({
      data: {
        ...data,
        taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
        mode: 'AUTO',
        modelProvider: 'pipeline',
        modelName: 'unified-draft-pipeline',
      } as Prisma.AIUsageLogUncheckedCreateInput,
    });
  }

  /**
   * Persist a verify/repair signal so the training pipeline learns from runs the
   * lawyer never explicitly rates. Never allowed to fail the job.
   */
  private async recordVerificationOutcome(input: {
    tenantId: string;
    userId: string;
    documentKind: string;
    jurisdiction?: string;
    jobId: string;
    certify: LawyerReadyPassResult;
    coherenceIssues: CoherenceIssue[];
    strippedCitations: StrippedCitation[];
    repairAttempted: boolean;
    canExport: boolean;
    modelUsed?: string;
  }): Promise<void> {
    if (!this.verificationOutcomes) return;

    const coherenceFindings: VerificationFinding[] = input.coherenceIssues.map((issue) => ({
      checkId: `coherence:${issue.category}`,
      state: 'FAIL',
      severity: issue.severity,
      dimension: 'coherence',
      evidenceIds: [],
      explanation: issue.explanation,
      verifierVersion: 'senior-partner-coherence-v1',
    }));

    const audit: DraftVerificationAudit = {
      corrections: [],
      similarCases: [],
      sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
      citationWarnings: [],
      strippedCitations: input.strippedCitations,
      proceduralWarnings: [],
      completenessGaps: [],
      requiresLawyerReview: !input.certify.lawyerReady,
      verificationStatus:
        input.canExport && input.certify.lawyerReady ? 'verified' : 'needs_review',
      findings: [...input.certify.findings, ...coherenceFindings],
      factCoverageRate: input.certify.factCoverageRate,
    };

    await this.verificationOutcomes
      .record({
        tenantId: input.tenantId,
        userId: input.userId,
        documentKind: input.documentKind,
        jurisdiction: input.jurisdiction,
        countryCode: normalizeCountry(input.jurisdiction) || 'IN',
        draftJobId: input.jobId,
        audit,
        repairAttempted: input.repairAttempted,
        repairSucceeded: input.repairAttempted && input.certify.lawyerReady,
        modelUsed: input.modelUsed,
      })
      .catch((err) =>
        this.logger.warn(
          `Verification outcome not recorded for ${input.jobId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }

  private async loadMatterSavedResearch(
    tenantId: string,
    matterId?: string,
  ): Promise<ReturnType<typeof extractVerifiedAuthoritiesFromSavedResearch>> {
    if (!matterId || !tenantId) return [];
    try {
      const rows = await this.prisma.savedResearch.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { researchJson: true },
      });
      return extractVerifiedAuthoritiesFromSavedResearch(rows.map((row) => row.researchJson));
    } catch (err) {
      this.logger.warn(
        `Matter saved-research check pack failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}

interface DraftJobPayload {
  jobId: string;
  tenantId: string;
  userId: string;
  matterId?: string;
  documentKind: string;
  qualityTier: string;
  facts: string;
  jurisdiction?: string;
  courtName?: string;
  clientName?: string;
  opposingParty?: string;
  parties?: {
    plaintiffs: Array<{ name: string; role: string }>;
    defendants: Array<{ name: string; role: string }>;
  };
  attachmentContext?: string;
  language?: string;
  confirmedCaseRecord?: Record<string, unknown>;
  accuracyMode?: 'fast' | 'balanced' | 'strict';
  bundleMode?: boolean;
  bundleIndex?: number;
  pinnedCaseLaws?: PinnedCaseLaw[];
  knowledgeSources?: string[];
}
