/**
 * Draft Orchestration Service — v3 main pipeline coordinator.
 *
 * Pipeline stages:
 *   1.  createWorkspace     → provisions DraftWorkspaceV3 (+ backward-compat links)
 *   2.  runProcedural       → ProceduralGateService checks
 *   3.  buildPlanAndOutline → DraftPlannerService → plan + sections
 *   4.  generateAllSections → per-section LLM generation (stub)
 *   5.  verifySections      → VerificationService
 *   6.  runAdversarialReview → AdversarialReviewService (high/critical risk only)
 *   7.  repairSections      → TargetedRepairService
 *   8.  getFilingReadiness  → filing readiness score
 *   9.  finalize            → mark ready
 *   10. export              → generate download URL
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { DraftWorkspaceV3, DraftSectionV3, VerificationJobV3 } from '@prisma/client';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { PrismaService } from '@/prisma/prisma.service';
import { renderDocumentHtml } from '@/ai/drafting/document-style-renderer';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { ProceduralGateService } from './procedural-gate.service';
import { DraftPlannerService } from './draft-planner.service';
import { AdversarialReviewService } from './adversarial-review.service';
import { TargetedRepairService } from './targeted-repair.service';
import { VerificationService } from '@/platform/verification/verification.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { PromptInjectionService } from '@/ai/feedback/prompt-injection.service';
import { DraftVerificationOutcomeService } from '@/ai/feedback/draft-verification-outcome.service';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import type {
  FindingSeverity,
  VerificationFinding as AuditVerificationFinding,
} from '@/ai/verification/verification-finding.types';
import { STORAGE_GATEWAY, StorageGateway } from '@/platform/gateways/storage-gateway.interface';
import { WorkflowPersistenceService } from '@/platform/workflow/workflow-persistence.service';
import type {
  CreateDraftWorkspaceDto,
  DraftPlan,
  ProceduralCheckResult,
  AdversarialFinding,
  FilingReadinessReport,
  VerificationFinding,
} from './drafting.types';

const DRAFTING_SYSTEM_PROMPT = `You are an expert legal drafter with deep knowledge of Indian and international law.
Your task is to draft a specific section of a legal document.
Follow these rules:
- Use precise, formal legal language appropriate to the jurisdiction and court
- Every legal proposition must be supported by a specific citation (statute section, case citation)
- Do not hallucinate citations — if you cannot verify a citation, use descriptive placeholders like [cite authority]
- Structure the section according to standard legal drafting conventions
- Be comprehensive but concise — courts value clarity and precision
- Output ONLY the section text, no preamble or meta-commentary`;

@Injectable()
export class DraftOrchestrationService {
  private readonly logger = new Logger(DraftOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly proceduralGate: ProceduralGateService,
    private readonly draftPlanner: DraftPlannerService,
    private readonly adversarialReview: AdversarialReviewService,
    private readonly targetedRepair: TargetedRepairService,
    private readonly verificationService: VerificationService,
    @Optional() private readonly llm: LlmCompletionService | null,
    @Optional() @Inject(STORAGE_GATEWAY) private readonly storageGateway: StorageGateway | null,
    @Optional() private readonly workflowPersistence: WorkflowPersistenceService | null,
    @Optional() private readonly promptInjection: PromptInjectionService | null,
    @Optional() private readonly verificationOutcomes: DraftVerificationOutcomeService | null,
    private readonly access: ArtifactAccessResolver,
  ) {}

  // ─── Stage 1: Create workspace ────────────────────────────────────────────

  async createWorkspace(
    tenantId: string,
    userId: string,
    dto: CreateDraftWorkspaceDto,
  ): Promise<DraftWorkspaceV3> {
    this.logger.log(`Creating draft workspace for tenant=${tenantId} user=${userId}`);

    // Optionally verify backward-compat links exist before creating
    if (dto.existingCourtDraftId) {
      const record = await this.prisma.courtDraftRecord.findFirst({
        where: { id: dto.existingCourtDraftId, tenantId },
        select: { id: true },
      });
      if (!record) {
        throw new DomainError(
          DomainErrorCode.NOT_FOUND,
          `CourtDraftRecord ${dto.existingCourtDraftId} not found.`,
          404,
        );
      }
    }

    if (dto.existingDraftingSessionId) {
      const session = await this.prisma.draftingSession.findFirst({
        where: { id: dto.existingDraftingSessionId, tenantId },
        select: { id: true },
      });
      if (!session) {
        throw new DomainError(
          DomainErrorCode.NOT_FOUND,
          `DraftingSession ${dto.existingDraftingSessionId} not found.`,
          404,
        );
      }
    }

    // Load MatterFacts if linked to a matter — inject into the plan for LLM context
    let matterFacts: Array<{ text: string; factType: string; confidence: number }> = [];
    let matterIssues: Array<{ issueText: string; severity: string }> = [];

    if (dto.matterId) {
      await this.access.assertMatterReadable({ tenantId, userId }, dto.matterId);
      const [rawFacts, rawIssues] = await Promise.all([
        this.prisma.matterFactV2.findMany({
          where: { matterId: dto.matterId, tenantId },
          orderBy: { confidence: 'desc' },
        }),
        this.prisma.matterIssueV2.findMany({
          where: { matterId: dto.matterId, tenantId },
        }),
      ]);

      matterFacts = rawFacts.map((f) => ({
        text: (f as any).text ?? (f as any).content ?? '',
        factType: (f as any).factType ?? 'general',
        confidence: (f as any).confidence ?? 0.8,
      })).filter((f) => f.text.length > 0);

      matterIssues = rawIssues.map((i) => ({
        issueText: (i as any).issueText ?? (i as any).title ?? '',
        severity: (i as any).severity ?? 'medium',
      })).filter((i) => i.issueText.length > 0);

      if (matterFacts.length > 0 || matterIssues.length > 0) {
        this.logger.log(
          `Workspace for matter ${dto.matterId}: loaded ${matterFacts.length} facts and ${matterIssues.length} issues`,
        );
      }
    }

    const planJson = {
      ...(dto.facts ? { assumedFacts: dto.facts } : {}),
      matterFacts,
      matterIssues,
      objective: dto.objective ?? '',
    };

    const workspace = await this.prisma.draftWorkspaceV3.create({
      data: {
        tenantId,
        userId,
        matterId: dto.matterId ?? null,
        mode: dto.mode ?? 'standalone',
        documentType: dto.documentType ?? null,
        objective: dto.objective ?? null,
        jurisdiction: dto.jurisdiction ?? null,
        region: dto.region ?? null,
        court: dto.court ?? null,
        riskLevel: dto.riskLevel ?? 'medium',
        status: 'planning',
        courtDraftRecordId: dto.existingCourtDraftId ?? null,
        draftingSessionId: dto.existingDraftingSessionId ?? null,
        planJson: planJson as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Workspace created: ${workspace.id}`);
    return workspace;
  }

  // ─── Stage 2: Procedural gate ─────────────────────────────────────────────

  async runProcedural(workspaceId: string, tenantId: string): Promise<ProceduralCheckResult[]> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);

    const results = await this.proceduralGate.runGate({
      jurisdiction: workspace.jurisdiction ?? 'India',
      region: workspace.region ?? undefined,
      court: workspace.court ?? undefined,
      documentType: workspace.documentType ?? 'court_draft',
      objective: workspace.objective ?? '',
      facts: (workspace.planJson as { assumedFacts?: never[] } | null)?.assumedFacts,
    });

    const hasBlockers = this.proceduralGate.hasBlockingErrors(results);

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: {
        status: hasBlockers ? 'planning' : 'outlining',
        planJson: {
          ...(typeof workspace.planJson === 'object' && workspace.planJson !== null ? workspace.planJson as Record<string, unknown> : {}),
          proceduralResults: results,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return results;
  }

  // ─── Stage 3: Plan + outline ──────────────────────────────────────────────

  async buildPlanAndOutline(
    workspaceId: string,
    tenantId: string,
  ): Promise<{ plan: DraftPlan; sections: DraftSectionV3[] }> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);

    const proceduralResults: ProceduralCheckResult[] =
      ((workspace.planJson as { proceduralResults?: ProceduralCheckResult[] } | null)?.proceduralResults) ?? [];

    const plan = await this.draftPlanner.buildPlan(workspace, proceduralResults);
    const sectionTemplates = this.draftPlanner.buildOutline(plan, workspaceId);

    // Delete any existing sections before rebuilding outline
    await this.prisma.draftSectionV3.deleteMany({ where: { workspaceId } });

    const createdSections = await this.prisma.$transaction(
      sectionTemplates.map((s) =>
        this.prisma.draftSectionV3.create({
          data: {
            id: randomUUID(),
            workspaceId: s.workspaceId,
            sectionType: s.sectionType,
            title: s.title,
            orderIndex: s.orderIndex,
            required: s.required,
            content: s.content,
            status: s.status,
            confidence: s.confidence,
            verificationJson: s.verificationJson !== null ? (s.verificationJson as Prisma.InputJsonValue) : Prisma.JsonNull,
            provenanceJson: s.provenanceJson !== null ? (s.provenanceJson as Prisma.InputJsonValue) : Prisma.JsonNull,
            repairHistoryJson: s.repairHistoryJson !== null ? (s.repairHistoryJson as Prisma.InputJsonValue) : Prisma.JsonNull,
            modelUsed: s.modelUsed,
            costUsd: s.costUsd,
            version: s.version,
          },
        }),
      ),
    );

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: {
        planJson: plan as unknown as object,
        outlineJson: { sections: sectionTemplates } as unknown as object,
        status: 'generating',
      },
    });

    return { plan, sections: createdSections };
  }

  // ─── Stage 4a: Generate single section ───────────────────────────────────

  async generateSection(
    workspaceId: string,
    sectionId: string,
    tenantId: string,
  ): Promise<DraftSectionV3> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);
    const section = await this.prisma.draftSectionV3.findFirst({
      where: { id: sectionId, workspaceId },
    });

    if (!section) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Section ${sectionId} not found.`, 404);
    }

    // Mark as generating
    await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: { status: 'generating' },
    });

    const modelUsed = this.selectModelForSectionType(section.sectionType);
    let content: string;
    let costUsd = 0;

    // Track stage in WorkflowRun if available — workflowId on the workspace maps to the run ID
    const workflowRunId = workspace.workflowId ?? undefined;
    let stageId: string | undefined;

    if (this.workflowPersistence && workflowRunId) {
      stageId = await this.workflowPersistence.startStage(workflowRunId, `generate_${section.sectionType}`, {
        sectionId,
        sectionTitle: section.title,
      }).catch(() => undefined);
    }

    if (this.llm) {
      // Append firm-learned preferences for this section type
      let systemPrompt = DRAFTING_SYSTEM_PROMPT;
      if (this.promptInjection && workspace.documentType) {
        const firmSuffix = await this.promptInjection
          .buildPromptSuffix(
            tenantId,
            workspace.documentType,
            section.sectionType,
            workspace.jurisdiction ?? undefined,
          )
          .catch(() => null);
        if (firmSuffix) systemPrompt += firmSuffix;
      }

      // Fetch preceding sections for continuity context
      const precedingSections = await this.prisma.draftSectionV3.findMany({
        where: { workspaceId, orderIndex: { lt: section.orderIndex } },
        orderBy: { orderIndex: 'asc' },
        select: { title: true, sectionType: true, content: true },
      });

      const plan = workspace.planJson as Record<string, unknown> | null;
      const matterFacts = (plan?.['matterFacts'] as Array<{ text: string; factType: string }>) ?? [];
      const matterIssues = (plan?.['matterIssues'] as Array<{ issueText: string; severity: string }>) ?? [];
      const planSummary = [
        `Objective: ${plan?.['objective'] ?? workspace.objective ?? 'Not specified'}`,
        matterFacts.length > 0
          ? `\nKEY FACTS FROM MATTER:\n${matterFacts.slice(0, 8).map((f) => `- [${f.factType}] ${f.text}`).join('\n')}`
          : '',
        matterIssues.length > 0
          ? `\nLEGAL ISSUES:\n${matterIssues.slice(0, 5).map((i) => `- [${i.severity}] ${i.issueText}`).join('\n')}`
          : '',
        `Issues: ${JSON.stringify(plan?.['issues'] ?? [])}`,
        `Authorities: ${JSON.stringify(plan?.['requiredAuthorities'] ?? [])}`,
      ].filter(Boolean).join('\n');

      const precedingContext = precedingSections
        .filter((s) => s.content)
        .map((s) => `=== ${s.title} ===\n${s.content}`)
        .join('\n\n');

      const userPrompt = [
        `DOCUMENT TYPE: ${workspace.documentType ?? 'legal document'}`,
        `JURISDICTION: ${workspace.jurisdiction ?? 'India'}${workspace.court ? ` | Court: ${workspace.court}` : ''}`,
        '',
        `DRAFT PLAN:\n${planSummary}`,
        '',
        precedingContext ? `PRECEDING SECTIONS (for continuity):\n${precedingContext}\n` : '',
        `SECTION TO DRAFT: ${section.title} (type: ${section.sectionType})`,
        `Draft this section completely and professionally.`,
      ].join('\n');

      try {
        const result = await this.llm.complete({
          modelName: modelUsed,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          maxTokens: 2000,
        });
        content = result.content;
        costUsd = result.inputTokens * 0.000001 + result.outputTokens * 0.000004;
      } catch (err) {
        this.logger.error(`LLM generation failed for section ${sectionId}: ${String(err)}`);
        if (process.env.NODE_ENV === 'production') {
          throw new DomainError(
            DomainErrorCode.AI_PROVIDER_UNAVAILABLE,
            `Section generation failed: ${String(err)}`,
            500,
          );
        }
        this.logger.warn(`Falling back to placeholder (non-production only)`);
        content = this.buildPlaceholderContent(section, workspace);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new DomainError(
          DomainErrorCode.AI_PROVIDER_UNAVAILABLE,
          'LLM service is unavailable — section generation cannot proceed',
          500,
        );
      }
      content = this.buildPlaceholderContent(section, workspace);
    }

    // Complete workflow stage tracking
    if (this.workflowPersistence && workflowRunId && stageId) {
      await this.workflowPersistence.completeStage(stageId, workflowRunId, { costUsd }).catch(() => {});
    }

    // Snapshot initial generation
    await this.prisma.draftSectionVersion.create({
      data: {
        sectionId,
        version: 1,
        content,
        status: 'generated',
        changedBy: 'ai_generation',
        metadata: { generatedAt: new Date().toISOString(), model: modelUsed, costUsd },
      },
    });

    const updated = await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: {
        content,
        status: 'generated',
        modelUsed,
        costUsd,
        version: 1,
      },
    });

    return updated;
  }

  // ─── Stage 4b: Generate all sections ─────────────────────────────────────

  async generateAllSections(workspaceId: string, tenantId: string): Promise<DraftSectionV3[]> {
    await this.requireWorkspace(workspaceId, tenantId);

    const sections = await this.prisma.draftSectionV3.findMany({
      where: { workspaceId },
      orderBy: { orderIndex: 'asc' },
    });

    // Group sections into dependency waves by orderIndex buckets.
    // Sections with the same wave index (rounded to nearest 3) run in parallel;
    // waves execute sequentially so each section can reference prior content.
    const WAVE_SIZE = 3;
    const waves: DraftSectionV3[][] = [];
    for (const section of sections) {
      const waveIndex = Math.floor(section.orderIndex / WAVE_SIZE);
      if (!waves[waveIndex]) waves[waveIndex] = [];
      waves[waveIndex].push(section);
    }

    const results: DraftSectionV3[] = [];
    for (const wave of waves.filter(Boolean)) {
      const generated = await Promise.all(
        wave.map((section) => this.generateSection(workspaceId, section.id, tenantId)),
      );
      results.push(...generated);
    }

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: { status: 'verifying' },
    });

    return results;
  }

  // ─── Stage 5: Verification ────────────────────────────────────────────────

  async verifySections(workspaceId: string, tenantId: string): Promise<VerificationJobV3> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);

    const job = await this.verificationService.verifyDraftWorkspace(workspaceId, tenantId);

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: {
        status: 'adversarial_review',
        verificationSummaryJson: {
          jobId: job.id,
          score: job.overallScore,
          completedAt: job.completedAt,
        } as unknown as object,
      },
    });

    await this.recordVerificationOutcome(workspace, job);

    return job;
  }

  /**
   * Feed the platform verification result into the same learning loop the
   * unified engine uses, so v3 drafts are not a blind spot for the training
   * pipeline. Never allowed to fail verification.
   */
  private async recordVerificationOutcome(
    workspace: DraftWorkspaceV3,
    job: VerificationJobV3,
  ): Promise<void> {
    if (!this.verificationOutcomes || !workspace.documentType) return;

    const rawFindings = Array.isArray(job.findings)
      ? (job.findings as unknown as VerificationFinding[])
      : [];
    const failures = rawFindings.filter((f) => f.status === 'failed' || f.status === 'warning');
    if (failures.length === 0 && job.status !== 'completed') return;

    const severityMap: Record<VerificationFinding['severity'], FindingSeverity> = {
      critical: 'BLOCKER',
      major: 'HIGH',
      minor: 'MEDIUM',
      info: 'LOW',
    };
    const findings: AuditVerificationFinding[] = failures.map((f) => ({
      checkId: `platform_v3:${f.dimension}`,
      state: f.status === 'failed' ? 'FAIL' : 'INDETERMINATE',
      severity: severityMap[f.severity] ?? 'MEDIUM',
      dimension: f.dimension === 'case_law' || f.dimension === 'statutory' ? 'citation' : 'coverage',
      evidenceIds: [],
      explanation: f.message,
      verifierVersion: 'platform-verification-v3',
    }));

    const blockers = findings.some((f) => f.severity === 'BLOCKER' || f.severity === 'HIGH');
    const audit: DraftVerificationAudit = {
      corrections: [],
      similarCases: [],
      sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
      citationWarnings: [],
      strippedCitations: [],
      proceduralWarnings: [],
      completenessGaps: [],
      requiresLawyerReview: blockers,
      verificationStatus: blockers ? 'needs_review' : 'verified',
      findings,
    };

    await this.verificationOutcomes
      .record({
        tenantId: workspace.tenantId,
        userId: workspace.userId,
        documentKind: workspace.documentType,
        jurisdiction: workspace.jurisdiction ?? undefined,
        countryCode: workspace.jurisdiction ?? undefined,
        audit,
      })
      .catch((err) =>
        this.logger.warn(
          `Verification outcome not recorded for workspace ${workspace.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
  }

  // ─── Stage 6: Adversarial review ─────────────────────────────────────────

  async runAdversarialReview(
    workspaceId: string,
    tenantId: string,
  ): Promise<AdversarialFinding[]> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);
    const sections = await this.prisma.draftSectionV3.findMany({
      where: { workspaceId },
      orderBy: { orderIndex: 'asc' },
    });

    const [counselFindings, judgeFindings] = await Promise.all([
      this.adversarialReview.runOpposingCounselReview(workspace, sections as DraftSectionV3[]),
      this.adversarialReview.runJudgeReview(workspace, sections as DraftSectionV3[]),
    ]);

    const allFindings = [...counselFindings, ...judgeFindings];

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: {
        adversarialFindingsJson: allFindings as unknown as object[],
        judgeReviewJson: judgeFindings as unknown as object[],
        status: 'repairing',
      },
    });

    return allFindings;
  }

  // ─── Stage 7: Repair ──────────────────────────────────────────────────────

  async repairSections(
    workspaceId: string,
    tenantId: string,
    findingIds?: string[],
  ): Promise<DraftSectionV3[]> {
    await this.requireWorkspace(workspaceId, tenantId);
    return this.targetedRepair.repair(workspaceId, tenantId, findingIds);
  }

  // ─── Stage 8: Filing readiness ────────────────────────────────────────────

  async getFilingReadiness(workspaceId: string, tenantId: string): Promise<FilingReadinessReport> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);
    const sections = await this.prisma.draftSectionV3.findMany({ where: { workspaceId } });

    const allFindings: VerificationFinding[] = sections.flatMap(
      (s) => (s.verificationJson as VerificationFinding[] | null) ?? [],
    );

    const report = this.verificationService.calculateFilingReadiness(
      workspace,
      allFindings,
    );

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: { filingReadinessJson: report as unknown as object },
    });

    return report;
  }

  // ─── Stage 9: Finalize ────────────────────────────────────────────────────

  async finalize(workspaceId: string, tenantId: string): Promise<DraftWorkspaceV3> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);

    const sections = await this.prisma.draftSectionV3.findMany({ where: { workspaceId } });
    if (sections.length === 0) {
      throw new DomainError(
        DomainErrorCode.VERIFICATION_FAILED,
        'Cannot finalize: no sections have been generated.',
        400,
      );
    }
    const hasFailedRequired = sections.some(
      (s) => s.required && s.status === 'repair_needed',
    );

    if (hasFailedRequired) {
      throw new DomainError(
        DomainErrorCode.VERIFICATION_FAILED,
        'Cannot finalize: one or more required sections are still in repair_needed state.',
        400,
      );
    }

    const readiness = await this.getFilingReadiness(workspaceId, tenantId);
    if (!readiness.readyForFiling) {
      throw new DomainError(
        DomainErrorCode.VERIFICATION_FAILED,
        'Cannot finalize: mandatory verification checks are incomplete or failing.',
        400,
      );
    }

    return this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: { status: 'ready', updatedAt: new Date() },
    });
  }

  // ─── Stage 10: Export ─────────────────────────────────────────────────────

  async export(
    workspaceId: string,
    tenantId: string,
    format: 'pdf' | 'docx',
  ): Promise<{ downloadUrl: string }> {
    const workspace = await this.requireWorkspace(workspaceId, tenantId);

    if (workspace.status !== 'ready') {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        `Workspace must be in 'ready' status before export. Current status: ${workspace.status}`,
        400,
      );
    }

    const sections = await this.prisma.draftSectionV3.findMany({
      where: { workspaceId },
      orderBy: { orderIndex: 'asc' },
    });

    // Assemble document text from all sections
    const documentText = [
      `# ${workspace.objective ?? 'Legal Document'}`,
      `Jurisdiction: ${workspace.jurisdiction ?? 'India'} | Type: ${workspace.documentType ?? 'court_draft'}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      ...sections.map((s) => `## ${s.title}\n\n${s.content ?? '[Section content not generated]'}`),
    ].join('\n\n');

    const html = renderDocumentHtml({
      plainText: documentText,
      documentKind: workspace.documentType ?? 'court_draft',
    });

    if (format === 'pdf') {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        'PDF export requires the shared filing renderer pipeline; use working HTML export or approved India draft export.',
        400,
      );
    }

    const exportKey = `drafts/${tenantId}/${workspaceId}/export-${Date.now()}.docx`;
    if (!this.storageGateway) {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        'Document storage is not configured; export cannot complete.',
        503,
      );
    }

    let docxBuffer: Buffer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const htmlToDocx = require('html-to-docx') as (
        html: string,
        header?: string,
        opts?: Record<string, unknown>,
        footer?: string,
      ) => Promise<Buffer>;
      docxBuffer = await htmlToDocx(html);
    } catch (err) {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        `DOCX conversion failed: ${String(err)}`,
        422,
      );
    }

    const result = await this.storageGateway.upload({
      key: exportKey,
      content: docxBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata: { workspaceId, tenantId, format: 'docx' },
    });
    const downloadUrl = await this.storageGateway.getSignedUrl(result.key, 3600);

    await this.prisma.draftWorkspaceV3.update({
      where: { id: workspaceId },
      data: { status: 'exported' },
    });

    return { downloadUrl };
  }

  // ─── Read helpers ─────────────────────────────────────────────────────────

  async getWorkspace(workspaceId: string, tenantId: string): Promise<DraftWorkspaceV3 & { sections: DraftSectionV3[] }> {
    const workspace = await this.prisma.draftWorkspaceV3.findFirst({
      where: { id: workspaceId, tenantId },
      include: { sections: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!workspace) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Workspace ${workspaceId} not found.`, 404);
    }

    return workspace as DraftWorkspaceV3 & { sections: DraftSectionV3[] };
  }

  async listWorkspaces(
    tenantId: string,
    userId?: string,
    skip = 0,
    take = 20,
  ): Promise<DraftWorkspaceV3[]> {
    return this.prisma.draftWorkspaceV3.findMany({
      where: { tenantId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  // ─── Private utilities ────────────────────────────────────────────────────

  private async requireWorkspace(workspaceId: string, tenantId: string): Promise<DraftWorkspaceV3> {
    const workspace = await this.prisma.draftWorkspaceV3.findFirst({
      where: { id: workspaceId, tenantId },
    });

    if (!workspace) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Workspace ${workspaceId} not found.`, 404);
    }

    return workspace;
  }

  private buildPlaceholderContent(section: DraftSectionV3, workspace: DraftWorkspaceV3): string {
    const docType = workspace.documentType ?? 'court document';
    const jurisdiction = workspace.jurisdiction ?? 'the applicable jurisdiction';

    const templates: Record<string, string> = {
      heading: `IN THE [COURT NAME]\nAT [CITY]\n\n[CASE NUMBER]\n\nIN THE MATTER OF:\n[PETITIONER NAME] ... PETITIONER\n\nVERSUS\n\n[RESPONDENT NAME] ... RESPONDENT\n\nPETITION UNDER [APPLICABLE PROVISION]`,

      parties: `THE PETITIONER:\n[Petitioner full name, age, occupation, address] …\n\nTHE RESPONDENT:\n[Respondent full name / organization, registered office address] …`,

      facts: `1. The Petitioner states that [BRIEF BACKGROUND].\n\n2. On [DATE], [KEY EVENT].\n\n3. The cause of action arose on [DATE] when [TRIGGERING EVENT].\n\n4. The matter is within the limitation period under the Limitation Act, 1963 / [APPLICABLE LAW].`,

      legal_grounds: `GROUND I — [FIRST LEGAL GROUND]\n[Statement of law + citation + application to facts]\n\nGROUND II — [SECOND LEGAL GROUND]\n[Statement of law + citation + application to facts]`,

      prayer: `In view of the foregoing, it is most respectfully prayed that this Hon'ble Court may be pleased to:\n\na) [PRIMARY RELIEF SOUGHT];\n\nb) [ANCILLARY RELIEF];\n\nc) Award costs of this petition to the Petitioner;\n\nd) Pass such other and further order(s) as this Hon'ble Court may deem fit and proper in the interest of justice.`,

      verification: `I, [DEPONENT NAME], the Petitioner above-named, do hereby verify that the contents of paragraphs 1 to [LAST PARAGRAPH] of this petition are true to my knowledge and belief, and that I have not suppressed any material fact.\n\nVerified at [CITY] on [DATE].\n\n[SIGNATURE]`,

      definitions: `In this Agreement, unless the context otherwise requires:\n\n"Agreement" means this [Document Title] dated [DATE];\n"Parties" means [PARTY A] and [PARTY B] collectively;\n"Services" means [DESCRIPTION OF SERVICES];`,

      schedule: `LIST OF ANNEXURES\n\nAnnexure A: [DOCUMENT DESCRIPTION]\nAnnexure B: [DOCUMENT DESCRIPTION]`,

      signature: `IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.\n\n[PARTY A NAME]\nBy: ___________________________\nName:\nTitle:\nDate:\n\n[PARTY B NAME]\nBy: ___________________________\nName:\nTitle:\nDate:`,
    };

    return (
      templates[section.sectionType] ??
      `[Content for ${section.title} to be generated — document type: ${docType}, jurisdiction: ${jurisdiction}]`
    );
  }

  private selectModelForSectionType(sectionType: string): string {
    const strongSections = ['legal_grounds', 'facts', 'arguments', 'jurisdiction', 'maintainability'];
    const cheapSections = ['heading', 'schedule', 'signature', 'verification', 'definitions'];

    if (strongSections.includes(sectionType)) return 'gpt-5.6-luna';
    if (cheapSections.includes(sectionType)) return 'gpt-5.4-mini';
    return 'gpt-5.4-mini';
  }
}
