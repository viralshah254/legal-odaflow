import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { AI_TASK_TYPES } from '@/ai/constants';
import {
  normalizeBillingPlan,
  planIncludesDeepAnalysis,
} from '@/config/billing-plans';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { LegalResearchVerificationService } from '@/legal-search/legal-research-verification.service';
import { AuthorityThreadService } from '@/legal-search/authority-thread.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import { hashPrompt } from '@/common/utils/prompt-hash.util';
import {
  buildLeadAnalysisPrompt,
  buildCaseSummaryPrompt,
  type AuthorityRow,
  type LeadAnalysisKind,
  type CaseSummaryBrief,
} from './intake-analysis-prompt.builder';
import type { HybridSearchResult } from '@/legal-sources/search/hybrid-search.service';
import { RunLeadAnalysisDto } from './dto/run-lead-analysis.dto';

const RUN_TYPE_TO_QUOTA: Record<string, string> = {
  SIMILAR_CASES: 'similarCases',
  OPPONENT: 'opponentAngles',
  STRATEGY: 'strategyMemo',
};

export const ANALYSIS_RUN_TYPES = {
  PREVIEW: 'PREVIEW',
  SIMILAR_CASES: 'SIMILAR_CASES',
  OPPONENT: 'OPPONENT',
  STRATEGY: 'STRATEGY',
  DOC_REFRESH: 'DOC_REFRESH',
} as const;

@Injectable()
export class IntakeAnalysisService {
  private readonly logger = new Logger(IntakeAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AiGatewayService))
    private readonly aiGateway: AiGatewayService,
    private readonly retrievalOrchestrator: LegalRetrievalOrchestrator,
    private readonly researchVerification: LegalResearchVerificationService,
    private readonly authorityThread: AuthorityThreadService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly encryption: EncryptionService,
  ) {}

  async verifyLeadAccess(userId: string, leadId: string) {
    return this.requireLeadAccess(userId, leadId);
  }

  async updateLeadContext(
    userId: string,
    leadId: string,
    lawyerContextMarkdown?: string,
  ) {
    const lead = await this.requireLeadAccess(userId, leadId);
    return this.prisma.lawyerLead.update({
      where: { id: lead.id },
      data: { lawyerContextMarkdown: lawyerContextMarkdown ?? null },
    });
  }

  async getAnalysisRuns(userId: string, leadId: string) {
    await this.requireLeadAccess(userId, leadId);
    return this.prisma.caseAnalysisRun.findMany({
      where: { lawyerLeadId: leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runSimilarCases(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.runAnalysis(userId, leadId, 'SIMILAR_CASES', dto, locale);
  }

  async runOpponentAngles(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.runAnalysis(userId, leadId, 'OPPONENT', dto, locale);
  }

  async runStrategyMemo(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.runAnalysis(userId, leadId, 'STRATEGY', dto, locale);
  }

  private async runAnalysis(
    userId: string,
    leadId: string,
    kind: LeadAnalysisKind,
    dto?: RunLeadAnalysisDto,
    locale?: string,
  ) {
    const lead = await this.requireLeadAccess(userId, leadId);
    const runType = ANALYSIS_RUN_TYPES[kind];

    // Feature gate: Professional+ required; no run count quota
    await this.assertDeepAnalysisAccess(lead.tenantId!);

    // Resolve tenant's preferred deep analysis model
    const tenantBase = await this.prisma.tenant.findUnique({
      where: { id: lead.tenantId! },
      select: { premiumModelId: true },
    });
    const tenantExtra = await this.prisma.$queryRaw<Array<{ deepAnalysisPremiumModelId: string }>>`
      SELECT "deepAnalysisPremiumModelId" FROM "Tenant" WHERE "id" = ${lead.tenantId!} LIMIT 1
    `.catch(() => [] as Array<{ deepAnalysisPremiumModelId: string }>);
    const deepAnalysisPremiumModelId: string =
      tenantExtra[0]?.deepAnalysisPremiumModelId ?? dto?.premiumModelId ?? tenantBase?.premiumModelId ?? 'gpt-4.1';

    const context = await this.loadLeadContext(lead, dto);
    const compliancePolicy = await this.complianceGuard.getPolicyForCountry(
      context.countryCode,
    );

    // Phase 1 (SIMILAR_CASES only): generate a structured case brief used to build smarter RAG queries
    let caseSummary: CaseSummaryBrief | undefined;
    if (kind === 'SIMILAR_CASES') {
      try {
        const { systemPrompt: s1Sys, userPrompt: s1User } = buildCaseSummaryPrompt(context, locale);
        const phase1 = await this.aiGateway.runIntakeDeepAnalysis({
          userId,
          tenantId: lead.tenantId!,
          taskType: 'CASE_SUMMARY',
          systemPrompt: s1Sys,
          userPrompt: s1User,
          countryCode: context.countryCode,
          modelMode: 'PREMIUM',
          premiumModelId: deepAnalysisPremiumModelId,
          // Phase 1 is a cheap structured call; skip debit to avoid double-charging tiny summarize step
          skipDebit: true,
        });
        const rawJson = phase1.outputMarkdown.replace(/```json|```/g, '').trim();
        caseSummary = JSON.parse(rawJson) as CaseSummaryBrief;
      } catch {
        this.logger.warn('Phase 1 case summary failed — continuing with raw facts for RAG');
      }
    }

    let authorities: HybridSearchResult[] = [];
    const searchQueries: string[] = caseSummary?.searchQueries?.length
      ? caseSummary.searchQueries
      : [this.buildAuthoritySearchQuery(kind, context)];
    const searchQuery = searchQueries.join(' ');

    const priorBundles = await this.authorityThread.loadChain({
      consumerCaseId: lead.consumerCaseId ?? undefined,
      leadId: lead.id,
    });
    const priorAuthorities = priorBundles.flatMap((b) =>
      b.entries.map((e) => ({
        id: e.authorityId,
        title: e.title,
        citation: e.citation,
        sourceName: e.sourceName,
        summary: null,
        sourceUrl: e.sourceUrl,
        sourceTier: e.sourceTier,
      })),
    );

    const retrieval = await this.retrievalOrchestrator.retrieve({
      query: searchQuery,
      countryCode: context.countryCode,
      jurisdiction: context.jurisdiction,
      tenantId: lead.tenantId!,
      userId,
      intakeFacts: context.facts,
      priorAuthorities,
      supplementLive: true,
    });

    authorities = retrieval.authorities.map((row) => ({
      id: row.id,
      title: row.title,
      citation: row.citation,
      sourceName: row.sourceName,
      summary: row.summary,
      sourceUrl: row.sourceUrl ?? null,
      fullText: row.fullText ?? null,
      holding: null,
      countryCode: context.countryCode,
      jurisdiction: context.jurisdiction ?? null,
      authorityType: row.authorityType ?? 'STATUTE',
      score: row.score ?? 0.5,
    })) as HybridSearchResult[];

    const authorityRows: AuthorityRow[] = authorities.map((row) => ({
      id: row.id,
      title: row.title,
      citation: row.citation,
      sourceName: row.sourceName,
      summary: row.summary,
      sourceUrl: row.sourceUrl,
      holding: row.holding,
      court: (row as any).court ?? null,
      decisionDate: (row as any).decisionDate ?? null,
      judges: (row as any).judges ?? [],
    }));

    const { systemPrompt, userPrompt, reasoningModel } = buildLeadAnalysisPrompt({
      kind,
      context,
      authorities: authorityRows,
      compliancePolicy,
      caseSummary,
      locale,
    });

    const taskType =
      kind === 'SIMILAR_CASES'
        ? AI_TASK_TYPES.LEGAL_RESEARCH
        : kind === 'OPPONENT'
          ? AI_TASK_TYPES.OPPONENT_ANALYZER
          : AI_TASK_TYPES.STRATEGY_MEMO;

    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId: lead.tenantId!,
      taskType,
      systemPrompt,
      userPrompt,
      reasoningModel,
      countryCode: context.countryCode,
      modelMode: 'PREMIUM',
      premiumModelId: deepAnalysisPremiumModelId,
    });

    const parsed = this.parseStructuredOutput(aiResult.outputMarkdown, kind);
    const enrichedStructured = this.enrichStructuredOutput(parsed, authorities);
    const structured = caseSummary
      ? { ...enrichedStructured, caseSummary }
      : enrichedStructured;
    let contentMarkdown = this.stripJsonBlock(aiResult.outputMarkdown);

    const verified = await this.researchVerification.verifyAndPublish({
      query: searchQuery,
      outputMarkdown: contentMarkdown,
      authorities: retrieval.authorities,
      isBareActQuery: retrieval.isBareActQuery,
      modelName: deepAnalysisPremiumModelId,
      countryCode: context.countryCode,
      requestedSection: retrieval.requestedSection,
      exactSectionFound: retrieval.exactSectionFound,
      retrievalSignals: {
        domainFitLow: retrieval.domainFitLow,
        caseLawRequested: true,
        rejectedCandidates: retrieval.rejectedCandidates,
      },
    });
    contentMarkdown = verified.outputMarkdown;

    await this.authorityThread.saveBundle({
      scope: 'lead',
      scopeId: lead.id,
      query: searchQuery,
      queryHash: retrieval.queryHash,
      countryCode: context.countryCode,
      jurisdiction: context.jurisdiction,
      authorities: retrieval.authorities,
      parentBundleId: priorBundles.at(-1)?.id,
    });

    return this.persistRun({
      tenantId: lead.tenantId!,
      consumerCaseId: lead.consumerCaseId!,
      lawyerLeadId: lead.id,
      runType,
      trigger: 'manual',
      structuredOutput: {
        ...structured,
        provenance: verified.provenance,
        sentenceAudit: verified.sentenceAudit.entries.slice(0, 15),
      } as unknown as Prisma.InputJsonValue,
      contentMarkdown,
      citations: verified.citations,
      createdByUserId: userId,
      inputHash: hashPrompt(userPrompt),
    });
  }

  private buildAuthoritySearchQuery(
    kind: LeadAnalysisKind,
    context: {
      issueType: string;
      title: string;
      facts?: string;
      desiredOutcome?: string;
      jurisdiction?: string;
    },
  ): string {
    const base = [context.issueType, context.title, context.facts]
      .filter(Boolean)
      .join(' ');

    if (kind === 'OPPONENT') {
      return [
        'opponent defenses counterclaims',
        context.issueType,
        context.jurisdiction,
        context.facts?.slice(0, 200),
      ]
        .filter(Boolean)
        .join(' ');
    }

    if (kind === 'STRATEGY') {
      return [
        'remedies ADR arbitration mediation settlement procedure filing',
        context.issueType,
        context.desiredOutcome,
        context.jurisdiction,
      ]
        .filter(Boolean)
        .join(' ');
    }

    return base;
  }

  private buildCitations(authorities: HybridSearchResult[]) {
    return authorities.map((row) => ({
      authorityId: row.id,
      citation: row.citation ?? row.title,
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl ?? undefined,
      summary: row.summary ?? undefined,
    }));
  }

  private enrichStructuredOutput(
    structured: Record<string, unknown>,
    authorities: HybridSearchResult[],
  ): Record<string, unknown> {
    const authorityMap = new Map(authorities.map((row) => [row.id, row]));
    const enriched = { ...structured };

    if (Array.isArray(enriched.cases)) {
      enriched.cases = (enriched.cases as Record<string, unknown>[]).map((c) => {
        const authorityId = typeof c.authorityId === 'string' ? c.authorityId : undefined;
        const authority = authorityId ? authorityMap.get(authorityId) : undefined;
        return {
          ...c,
          sourceUrl: c.sourceUrl ?? authority?.sourceUrl ?? undefined,
          summary: c.summary ?? authority?.summary ?? c.excerpt,
          citation: c.citation ?? authority?.citation ?? undefined,
          title: c.title ?? authority?.title ?? c.title,
          court: c.court ?? (authority as any)?.court ?? undefined,
          year: c.year ?? ((authority as any)?.decisionDate ? String(new Date((authority as any).decisionDate).getFullYear()) : undefined),
          judges: (c.judges && Array.isArray(c.judges) && c.judges.length) ? c.judges : ((authority as any)?.judges ?? []),
        };
      });
    }

    if (Array.isArray(enriched.opponentClaims)) {
      enriched.opponentClaims = (enriched.opponentClaims as Record<string, unknown>[]).map(
        (claim) => {
          if (typeof claim === 'string') {
            return { claim, counter: '', evidenceNeeded: [], likelihood: 50, impact: 50 };
          }
          const authorityId =
            typeof claim.authorityId === 'string' ? claim.authorityId : undefined;
          const authority = authorityId ? authorityMap.get(authorityId) : undefined;
          return {
            ...claim,
            sourceUrl: claim.sourceUrl ?? authority?.sourceUrl ?? undefined,
          };
        },
      );
    }

    if (Array.isArray(enriched.weaknesses)) {
      enriched.weaknesses = (enriched.weaknesses as unknown[]).map((w) => {
        if (typeof w === 'string') {
          return { weakness: w, mitigation: '' };
        }
        return w;
      });
    }

    return enriched;
  }

  async triggerDocRefresh(consumerCaseId: string, userId?: string) {
    const lead = await this.prisma.lawyerLead.findFirst({
      where: { consumerCaseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lead?.tenantId || !lead.consumerCaseId) {
      return null;
    }

    const context = await this.loadLeadContext(lead);
    const documents = await this.prisma.consumerDocument.findMany({
      where: { consumerCaseId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const docSummaries = documents
      .map((doc) => {
        const extractedText = this.decryptConsumerDocumentText(doc.id, doc.extractedText);
        const excerpt = doc.aiSummary?.slice(0, 500) ?? extractedText?.slice(0, 500);
        return `- ${doc.fileName}${excerpt ? `: ${excerpt}` : ''}`;
      })
      .join('\n');

    const previewRun = await this.prisma.caseAnalysisRun.findFirst({
      where: { lawyerLeadId: lead.id, runType: ANALYSIS_RUN_TYPES.PREVIEW },
      orderBy: { createdAt: 'desc' },
    });

    const priorStructured: Record<string, unknown> =
      (previewRun?.structuredOutput as Record<string, unknown> | null) ?? {
        situation: context.facts ?? '',
        legalIssues: [context.issueType],
        strengths: [],
        risksAndGaps: [],
        recommendedNextSteps: [],
        sourcesCited: [],
      };

    const compliancePolicy = await this.complianceGuard.getPolicyForCountry(
      context.countryCode,
    );

    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId: userId ?? lead.userId ?? lead.tenantId,
      tenantId: lead.tenantId,
      taskType: AI_TASK_TYPES.DOCUMENT_EXPLAINER,
      systemPrompt:
        'Update a client matter intake workspace with new document context for licensed attorneys.',
      userPrompt: [
        `Refresh intake analysis after new documents uploaded.`,
        `Legal location: ${context.jurisdiction ?? context.countryCode}`,
        compliancePolicy.countryName
          ? `Compliance: ${compliancePolicy.countryName}`
          : '',
        `Prior situation: ${String(priorStructured.situation ?? '')}`,
        `New documents:\n${docSummaries || 'No extracted summaries yet.'}`,
        '',
        'Update strengths, risks, and next steps. Use ## section headings.',
        'Append JSON matching intake workspace schema:',
        '```json',
        '{"situation":"","legalIssues":[],"strengths":[],"risksAndGaps":[],"recommendedNextSteps":[],"sourcesCited":[]}',
        '```',
      ].join('\n'),
      skipDebit: true,
      countryCode: context.countryCode,
    });

    const structured = this.parseGenericJson(
      aiResult.outputMarkdown,
      priorStructured,
    );

    return this.persistRun({
      tenantId: lead.tenantId,
      consumerCaseId: lead.consumerCaseId,
      lawyerLeadId: lead.id,
      runType: ANALYSIS_RUN_TYPES.DOC_REFRESH,
      trigger: 'document_upload',
      structuredOutput: structured as Prisma.InputJsonValue,
      contentMarkdown: this.stripJsonBlock(aiResult.outputMarkdown),
      createdByUserId: userId,
    });
  }

  async getQuotaStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true, aiCreditsRemaining: true },
    });
    const tenantExtra = await this.prisma.$queryRaw<Array<{ deepAnalysisPremiumModelId: string }>>`
      SELECT "deepAnalysisPremiumModelId" FROM "Tenant" WHERE "id" = ${tenantId} LIMIT 1
    `.catch(() => [] as Array<{ deepAnalysisPremiumModelId: string }>);

    const plan = normalizeBillingPlan(tenant?.billingPlan);

    return {
      plan,
      includesDeepAnalysis: planIncludesDeepAnalysis(tenant?.billingPlan),
      creditsRemaining: tenant?.aiCreditsRemaining ?? 0,
      deepAnalysisPremiumModelId: tenantExtra[0]?.deepAnalysisPremiumModelId ?? 'gpt-4.1',
      // Estimated credit costs per analysis type (typical run guidance)
      estimatedCredits: {
        similarCases: { min: 3, max: 5 },
        opponentAngles: { min: 3, max: 5 },
        strategyMemo: { min: 3, max: 5 },
      },
    };
  }

  private async persistRun(data: {
    tenantId: string;
    consumerCaseId: string;
    lawyerLeadId: string;
    runType: string;
    trigger: string;
    structuredOutput?: Prisma.InputJsonValue;
    contentMarkdown?: string;
    citations?: Prisma.InputJsonValue;
    createdByUserId?: string;
    inputHash?: string;
  }) {
    return this.prisma.caseAnalysisRun.create({
      data: {
        tenantId: data.tenantId,
        consumerCaseId: data.consumerCaseId,
        lawyerLeadId: data.lawyerLeadId,
        runType: data.runType,
        trigger: data.trigger,
        structuredOutput: data.structuredOutput ?? Prisma.JsonNull,
        contentMarkdown: data.contentMarkdown,
        citations: data.citations ?? Prisma.JsonNull,
        createdByUserId: data.createdByUserId,
        inputHash: data.inputHash,
      },
    });
  }

  private async assertDeepAnalysisAccess(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });

    if (!planIncludesDeepAnalysis(tenant?.billingPlan)) {
      throw new ForbiddenException(
        'Deep case analysis requires Professional plan or above. Upgrade in billing settings.',
      );
    }
  }

  private async assertQuota(tenantId: string, runType: string) {
    // Legacy method — kept for backwards compatibility but now delegates to feature gate
    await this.assertDeepAnalysisAccess(tenantId);
  }

  private async requireLeadAccess(userId: string, leadId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    const tenantId = user?.tenantUsers[0]?.tenantId;
    const lead = await this.prisma.lawyerLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (user?.userType === 'LAWYER') {
      if (!tenantId || lead.tenantId !== tenantId) {
        throw new ForbiddenException('Lead not accessible for this firm');
      }
      return lead;
    }

    if (lead.userId !== userId) {
      throw new ForbiddenException('Lead not accessible');
    }

    return lead;
  }

  private async loadLeadContext(
    lead: {
      id: string;
      consumerCaseId: string | null;
      issueType: string;
      summary: string | null;
      countryCode: string;
      jurisdiction: string | null;
      lawyerContextMarkdown?: string | null;
    },
    dto?: RunLeadAnalysisDto,
  ) {
    const consumerCase = lead.consumerCaseId
      ? await this.prisma.consumerCase.findUnique({
          where: { id: lead.consumerCaseId },
        })
      : null;

    const previewReport = lead.consumerCaseId
      ? await this.prisma.consumerLegalReport.findFirst({
          where: {
            consumerCaseId: lead.consumerCaseId,
            reportType: 'ISSUE_CHECKER_PREVIEW',
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const partiesMatch = consumerCase?.facts?.match(/Parties involved: (.+)/i);

    const documentSummaries = await this.loadDocumentSummaries(lead.id, dto?.documentIds);

    return {
      issueType: lead.issueType,
      title: consumerCase?.title ?? lead.issueType,
      facts: consumerCase?.facts ?? lead.summary ?? undefined,
      desiredOutcome: consumerCase?.desiredOutcome ?? undefined,
      countryCode: lead.countryCode,
      jurisdiction: lead.jurisdiction ?? consumerCase?.jurisdiction ?? undefined,
      clientSide: partiesMatch?.[1],
      lawyerContextMarkdown: lead.lawyerContextMarkdown ?? undefined,
      additionalContext: dto?.additionalContext,
      focusPrompt: dto?.focusPrompt,
      previewExcerpt: previewReport?.contentMarkdown?.slice(0, 2000),
      documentSummaries,
    };
  }

  private async loadDocumentSummaries(leadId: string, documentIds?: string[]) {
    const leadDocs = await this.prisma.leadDocument.findMany({
      where: {
        leadId,
        ...(documentIds?.length ? { id: { in: documentIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const summaries: string[] = leadDocs.map((doc) => {
      const excerpt =
        doc.aiSummary?.slice(0, 500) ??
        this.decryptLeadDocumentText(doc.id, doc.extractedText)?.slice(0, 500) ??
        '(pending OCR)';
      return `- [Firm] ${doc.fileName}: ${excerpt}`;
    });

    const lead = await this.prisma.lawyerLead.findUnique({
      where: { id: leadId },
      select: { consumerCaseId: true },
    });

    if (lead?.consumerCaseId) {
      const consumerDocs = await this.prisma.consumerDocument.findMany({
        where: { consumerCaseId: lead.consumerCaseId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      for (const doc of consumerDocs) {
        if (documentIds?.length && !documentIds.includes(doc.id)) continue;
        const excerpt =
          doc.aiSummary?.slice(0, 500) ??
          this.decryptConsumerDocumentText(doc.id, doc.extractedText)?.slice(0, 500) ??
          '(pending OCR)';
        summaries.push(`- [Client] ${doc.fileName}: ${excerpt}`);
      }
    }

    return summaries;
  }

  private decryptLeadDocumentText(documentId: string, value: string | null) {
    return this.encryption.decryptStringFromStorage(
      value,
      `lead-document-extracted-text:${documentId}`,
    );
  }

  private decryptConsumerDocumentText(documentId: string, value: string | null) {
    return this.encryption.decryptStringFromStorage(
      value,
      `consumer-document-extracted-text:${documentId}`,
    );
  }

  private parseStructuredOutput(content: string, kind: LeadAnalysisKind) {
    if (kind === 'SIMILAR_CASES') {
      return this.parseGenericJson(content, {
        executiveSummary: '',
        cases: [] as unknown[],
        pathToVictory: [] as string[],
        winThemes: [] as string[],
        visualizations: [] as unknown[],
      });
    }
    if (kind === 'OPPONENT') {
      return this.parseGenericJson(content, {
        executiveSummary: '',
        opponentClaims: [] as unknown[],
        weaknesses: [] as unknown[],
        pathToVictory: [] as string[],
        visualizations: [] as unknown[],
      });
    }
    return this.parseGenericJson(content, {
      executiveSummary: '',
      shortAnswer: '',
      pathToVictory: [] as string[],
      options: [] as unknown[],
      recommendedPath: '',
      deadlines: [] as unknown[],
      evidenceToGather: [] as unknown[],
      visualizations: [] as unknown[],
    });
  }

  private parseGenericJson<T extends Record<string, unknown>>(
    content: string,
    fallback: T,
  ): T {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    if (!jsonMatch?.[1]) return fallback;
    try {
      return { ...fallback, ...(JSON.parse(jsonMatch[1]) as T) };
    } catch {
      return fallback;
    }
  }

  private stripJsonBlock(content: string): string {
    return content.replace(/```json[\s\S]*?```/gi, '').trim();
  }
}
