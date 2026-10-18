import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { ResearchPlanService } from './research-plan.service';
import { AuthorityRankingService } from './authority-ranking.service';
import { ContextAssemblerService } from './context-assembler.service';
import { CitationBindingService } from './citation-binding.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { WorkflowPersistenceService } from '@/platform/workflow/workflow-persistence.service';
import {
  AuthorityReference,
  CreateResearchWorkflowDto,
  LegalRequestContext,
  ResearchResult,
} from './research.types';
import { ResearchWorkspace } from '@prisma/client';

@Injectable()
export class ResearchWorkflowService {
  private readonly logger = new Logger(ResearchWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planService: ResearchPlanService,
    private readonly rankingService: AuthorityRankingService,
    private readonly assemblerService: ContextAssemblerService,
    private readonly citationService: CitationBindingService,
    @Optional() private readonly llm: LlmCompletionService | null,
    @Optional() private readonly workflowPersistence: WorkflowPersistenceService | null,
  ) {}

  async createWorkspace(
    tenantId: string,
    userId: string,
    dto: CreateResearchWorkflowDto,
  ): Promise<ResearchWorkspace> {
    return this.prisma.researchWorkspace.create({
      data: {
        tenantId,
        userId,
        matterId: dto.matterId,
        objective: dto.objective,
        jurisdiction: dto.jurisdiction,
        region: dto.region,
        mode: dto.mode ?? 'quick',
        status: 'pending',
      },
    });
  }

  async runResearch(
    workspaceId: string,
    tenantId: string,
    context: LegalRequestContext,
  ): Promise<ResearchResult> {
    const workspace = await this.getWorkspace(workspaceId, tenantId, context.userId);
    let currentRevision = workspace.revision;

    // Start WorkflowRun tracking
    let workflowRunId: string | undefined;
    if (this.workflowPersistence) {
      workflowRunId = await this.workflowPersistence.startRun({
        tenantId,
        userId: context.userId ?? tenantId,
        feature: 'research',
        objective: workspace.objective,
        matterId: workspace.matterId ?? undefined,
        jurisdictionCode: workspace.jurisdiction ?? undefined,
      }).catch(() => undefined);
    }

    // 1. Build plan
    currentRevision = await this.setStatus(
      workspaceId,
      tenantId,
      context.userId,
      currentRevision,
      'planning',
    );
    let planStageId: string | undefined;
    if (this.workflowPersistence && workflowRunId) {
      planStageId = await this.workflowPersistence.startStage(workflowRunId, 'planning').catch(() => undefined);
    }
    const plan = this.planService.buildPlan(
      workspace.objective,
      workspace.jurisdiction ?? context.countryCode ?? 'IN',
      workspace.mode as any,
      context,
      { region: workspace.region ?? undefined },
    );

    if (this.workflowPersistence && workflowRunId && planStageId) {
      await this.workflowPersistence.completeStage(planStageId, workflowRunId, { progress: 15 }).catch(() => {});
    }

    // 2. Retrieve legal documents — semantic search on objective + sub-questions
    currentRevision = await this.setStatus(
      workspaceId,
      tenantId,
      context.userId,
      currentRevision,
      'retrieving',
    );
    let retrieveStageId: string | undefined;
    if (this.workflowPersistence && workflowRunId) {
      retrieveStageId = await this.workflowPersistence.startStage(workflowRunId, 'retrieving').catch(() => undefined);
    }
    const searchQuery = [workspace.objective, ...plan.subQuestions.slice(0, 3)].join(' ');

    // Try full-text search first; fall back to authority-weight ordering
    const rawDocs = await this.prisma.legalSearchDocument.findMany({
      where: {
        jurisdiction: workspace.jurisdiction ?? undefined,
        status: 'active',
        OR: [
          { title: { contains: workspace.objective.split(' ').slice(0, 4).join(' '), mode: 'insensitive' } },
          { rawText: { contains: workspace.objective.split(' ').slice(0, 3).join(' '), mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: { authorityWeight: 'desc' },
    }).catch(() =>
      this.prisma.legalSearchDocument.findMany({
        where: { jurisdiction: workspace.jurisdiction ?? undefined, status: 'active' },
        take: 30,
        orderBy: { authorityWeight: 'desc' },
      }),
    );

    const authorities: AuthorityReference[] = rawDocs.map((doc) => ({
      id: doc.id,
      canonicalId: doc.canonicalId,
      title: doc.title,
      citation: doc.citation ?? undefined,
      court: doc.court ?? undefined,
      jurisdiction: doc.jurisdiction,
      publicationDate: doc.publicationDate?.toISOString(),
      treatmentStatus: doc.treatmentStatus,
      authorityWeight: doc.authorityWeight,
      relevanceScore: 0.6,
      snippet: doc.rawText ? doc.rawText.slice(0, 500) : undefined,
      sourceUrl: doc.sourceUrl ?? undefined,
    }));

    // 3. Rank authorities
    const ranked = this.rankingService.rankAuthorities(
      authorities,
      workspace.jurisdiction ?? 'IN',
    );
    const flagged = this.rankingService.filterOverruled(ranked);

    // 4. Assemble context
    currentRevision = await this.setStatus(
      workspaceId,
      tenantId,
      context.userId,
      currentRevision,
      'synthesizing',
    );
    const { context: legalContext, selectedAuthorities } = this.assemblerService.assemble(
      flagged,
      12000,
      2000,
    );

    if (this.workflowPersistence && workflowRunId && retrieveStageId) {
      await this.workflowPersistence.completeStage(retrieveStageId, workflowRunId, { progress: 45 }).catch(() => {});
    }

    // 5. Generate synthesis via LLM or fallback to placeholder
    let synthesis: string;
    let costUsd = 0;

    if (this.llm) {
      const synthesisResult = await this.generateLlmSynthesis(
        workspace.objective,
        selectedAuthorities,
        legalContext,
        plan.subQuestions,
        workspace.jurisdiction ?? 'IN',
      );
      synthesis = synthesisResult.text;
      costUsd = synthesisResult.costUsd;
    } else {
      synthesis = this.generatePlaceholderSynthesis(workspace.objective, selectedAuthorities, legalContext);
    }

    // 6. Track synthesis stage cost
    if (this.workflowPersistence && workflowRunId) {
      const synthStageId = await this.workflowPersistence.startStage(workflowRunId, 'synthesis').catch(() => undefined);
      if (synthStageId) {
        await this.workflowPersistence.completeStage(synthStageId, workflowRunId, { costUsd, progress: 80 }).catch(() => {});
      }
    }

    // 6. Detect conflicting authorities — pair each overruled/superseded authority
    // with the most authoritative counterpart to surface the conflict.
    const conflictingAuthorities: import('./research.types').ConflictingAuthority[] = [];
    for (const auth of selectedAuthorities) {
      if (auth.treatmentStatus === 'overruled' || auth.treatmentStatus === 'superseded') {
        const counterpart = selectedAuthorities.find(
          (a) => a.id !== auth.id && (a.treatmentStatus === 'good_law' || !a.treatmentStatus),
        );
        if (counterpart) {
          conflictingAuthorities.push({
            authorityA: auth,
            authorityB: counterpart,
            conflict: `"${auth.title}" is ${auth.treatmentStatus} — superseded by or in conflict with "${counterpart.title}"`,
          });
        }
      }
    }

    // 7. Bind citations
    currentRevision = await this.setStatus(
      workspaceId,
      tenantId,
      context.userId,
      currentRevision,
      'verifying',
    );
    const propositions = this.citationService.bindCitations(synthesis, selectedAuthorities);

    // 8. Build result
    const result: ResearchResult = {
      id: uuidv4(),
      workspaceId,
      summary: synthesis,
      issues: plan.subQuestions,
      authorities: selectedAuthorities,
      conflictingAuthorities,
      propositions,
      assumptions: ['This research is based on documents currently in the corpus.'],
      unansweredQuestions: plan.subQuestions.slice(1),
      confidence: this.computeConfidence(selectedAuthorities, propositions),
      costUsd,
      generatedAt: new Date().toISOString(),
    };

    // 8. Persist result
    const completed = await this.prisma.researchWorkspace.updateMany({
      where: {
        id: workspaceId,
        tenantId,
        userId: context.userId,
        revision: currentRevision,
      },
      data: {
        status: 'completed',
        plan: plan as any,
        result: result as any,
        authorities: selectedAuthorities as any,
        confidence: result.confidence,
        revision: { increment: 1 },
      },
    });
    if (completed.count !== 1) throw this.revisionConflict();

    // Complete WorkflowRun
    if (this.workflowPersistence && workflowRunId) {
      await this.workflowPersistence.completeRun(workflowRunId, { costUsd }).catch(() => {});
    }

    return result;
  }

  async appendClarification(
    workspaceId: string,
    tenantId: string,
    userId: string,
    clarification: string,
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId, tenantId, userId);
    const ordinal =
      (await this.prisma.researchWorkspaceContextItem.count({ where: { workspaceId } })) + 1;
    await this.prisma.researchWorkspaceContextItem.create({
      data: {
        workspaceId,
        tenantId,
        userId,
        matterId: workspace.matterId,
        ordinal,
        kind: 'user_clarification',
        label: 'Clarification',
        content: { text: clarification },
        provenance: { source: 'user', at: new Date().toISOString() },
      },
    });
    await this.prisma.researchWorkspace.update({
      where: { id: workspaceId },
      data: {
        objective: `${workspace.objective}\n\nUser clarification: ${clarification}`,
        revision: { increment: 1 },
      },
    });
  }

  async saveToMatter(
    workspaceId: string,
    tenantId: string,
    userId: string,
    matterId: string,
    expectedRevision: number,
  ): Promise<void> {
    await this.getWorkspace(workspaceId, tenantId, userId);
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');
    const updated = await this.prisma.researchWorkspace.updateMany({
      where: { id: workspaceId, tenantId, userId, revision: expectedRevision },
      data: { matterId, savedToMatter: true, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw this.revisionConflict();
  }

  async getWorkspace(
    workspaceId: string,
    tenantId: string,
    userId: string,
  ): Promise<ResearchWorkspace> {
    const ws = await this.prisma.researchWorkspace.findFirst({
      where: { id: workspaceId, tenantId, userId },
    });
    if (!ws) throw new NotFoundException('Research workspace not found');
    return ws;
  }

  async listWorkspaces(
    tenantId: string,
    userId: string,
    filters: { matterId?: string; status?: string },
  ): Promise<ResearchWorkspace[]> {
    return this.prisma.researchWorkspace.findMany({
      where: {
        tenantId,
        userId,
        ...(filters.matterId ? { matterId: filters.matterId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async setStatus(
    workspaceId: string,
    tenantId: string,
    userId: string,
    expectedRevision: number,
    status: string,
  ): Promise<number> {
    const updated = await this.prisma.researchWorkspace.updateMany({
      where: { id: workspaceId, tenantId, userId, revision: expectedRevision },
      data: { status, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw this.revisionConflict();
    return expectedRevision + 1;
  }

  private revisionConflict(): ConflictException {
    return new ConflictException({
      code: 'RESEARCH_WORKSPACE_REVISION_CONFLICT',
      message: 'Research workspace changed; reload it before retrying the workflow',
    });
  }

  private async generateLlmSynthesis(
    objective: string,
    authorities: AuthorityReference[],
    context: string,
    subQuestions: string[],
    jurisdiction: string,
  ): Promise<{ text: string; costUsd: number }> {
    const authorityList = authorities
      .slice(0, 10)
      .map((a) => `- ${a.title}${a.citation ? ` (${a.citation})` : ''}${a.court ? ` [${a.court}]` : ''}`)
      .join('\n');

    const systemPrompt = `You are a senior legal researcher. Produce a comprehensive legal research memo.
Structure:
1. Executive Summary (2-3 sentences)
2. Key Legal Issues
3. Applicable Law and Authorities (cite each authority specifically)
4. Analysis per sub-question
5. Conclusions and Recommendations
6. Caveats and unanswered questions

Rules:
- Cite every legal proposition to a specific authority from the list provided
- Use precise legal language
- Note where the law is unsettled or conflicting
- Jurisdiction: ${jurisdiction}`;

    const userPrompt = `RESEARCH OBJECTIVE: ${objective}

SUB-QUESTIONS TO ADDRESS:
${subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

RELEVANT AUTHORITIES:
${authorityList}

CONTEXT FROM CORPUS:
${context.slice(0, 6000)}

Write the legal research memo.`;

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 3000,
      });

      const costUsd = result.inputTokens * 0.000001 + result.outputTokens * 0.000004;
      return { text: result.content, costUsd };
    } catch (err) {
      this.logger.warn(`LLM research synthesis failed: ${String(err)}`);
      return {
        text: this.generatePlaceholderSynthesis(objective, authorities, context),
        costUsd: 0,
      };
    }
  }

  private generatePlaceholderSynthesis(
    objective: string,
    authorities: AuthorityReference[],
    _context: string,
  ): string {
    const authorityList = authorities
      .slice(0, 5)
      .map((a) => `- ${a.title}${a.citation ? ` (${a.citation})` : ''}`)
      .join('\n');

    return [
      `## Legal Research: ${objective}`,
      '',
      'Based on the available legal corpus, the following analysis addresses the research objective.',
      '',
      '### Key Authorities',
      authorityList || 'No specific authorities retrieved for this jurisdiction.',
      '',
      '### Analysis',
      'The applicable legal framework requires further examination of the statutory provisions and case law identified above. The authorities retrieved provide a foundation for analysis, but a qualified legal professional should review and expand upon this research.',
      '',
      '### Conclusion',
      'This preliminary research identifies the relevant legal sources. A full legal opinion should be obtained from a qualified practitioner before relying on this analysis.',
    ].join('\n');
  }

  private computeConfidence(
    authorities: AuthorityReference[],
    propositions: import('./research.types').LegalProposition[],
  ): number {
    if (authorities.length === 0) return 0.1;
    const supportedProps = propositions.filter(
      (p) => p.supportStatus === 'verified' || p.supportStatus === 'partially_supported',
    ).length;
    const propRate = propositions.length > 0 ? supportedProps / propositions.length : 0.5;
    const authWeight = Math.min(authorities.length / 10, 1) * 0.3;
    return Math.min(0.95, 0.4 + authWeight + propRate * 0.3);
  }
}
