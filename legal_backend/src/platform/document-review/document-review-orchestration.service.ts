/**
 * TODO-069 – TODO-072 — Document Review Orchestration Service
 *
 * Coordinates the full document review pipeline:
 *   1. Create workspace
 *   2. Fetch / parse document text
 *   3. Extract obligations
 *   4. Extract clauses
 *   5. Compare against playbooks
 *   6. Generate findings + redlines
 *   7. Calculate risk score
 *   8. Persist results
 */

import { Injectable, Logger } from '@nestjs/common';
import type { DocumentReviewWorkspace, ContractObligation } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { DocumentParserService } from './document-parser.service';
import { ObligationExtractorService } from './obligation-extractor.service';
import { ContractIntelligenceService } from './contract-intelligence.service';
import { PlaybookComparisonService } from './playbook-comparison.service';
import { ReviewFindingsService } from './review-findings.service';
import { RedlineExportService } from './redline-export.service';
import type {
  DocumentStructure,
  ReviewFinding,
  Redline,
  RedlineEditOp,
  ObligationExtract,
  ClauseExtract,
  PlaybookComparisonResult,
  PlaybookDashboardSummary,
} from './document-review.types';

export interface CreateReviewWorkspaceDto {
  documentId?: string;
  documentUrl?: string;
  rawText?: string;
  matterId?: string;
  title?: string;
  documentType?: string;
  reviewProfileId?: string;
}

export interface ListWorkspacesFilters {
  matterId?: string;
  status?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class DocumentReviewOrchestrationService {
  private readonly logger = new Logger(DocumentReviewOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: DocumentParserService,
    private readonly obligationExtractor: ObligationExtractorService,
    private readonly contractIntelligence: ContractIntelligenceService,
    private readonly playbookComparison: PlaybookComparisonService,
    private readonly reviewFindings: ReviewFindingsService,
    private readonly redlineExport: RedlineExportService,
  ) {}

  // ─── Stage 1: Create workspace ────────────────────────────────────────────

  async createWorkspace(
    tenantId: string,
    userId: string,
    dto: CreateReviewWorkspaceDto,
  ): Promise<DocumentReviewWorkspace> {
    if (!dto.documentId && !dto.documentUrl && !dto.rawText?.trim()) {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        'Either documentId, documentUrl, or rawText must be provided.',
        400,
      );
    }

    const workspace = await this.prisma.documentReviewWorkspace.create({
      data: {
        tenantId,
        userId,
        matterId: dto.matterId,
        documentId: dto.documentId,
        documentUrl: dto.documentUrl,
        title: dto.title,
        documentType: dto.documentType,
        reviewProfileId: dto.reviewProfileId,
        status: dto.rawText?.trim() ? 'parsing' : 'uploading',
        structureJson: dto.rawText?.trim()
          ? ({ rawText: dto.rawText.trim() } as any)
          : undefined,
      },
    });

    this.logger.log(`Created review workspace ${workspace.id} for tenant=${tenantId}`);
    return workspace;
  }

  // ─── Stage 2–8: Full review pipeline ─────────────────────────────────────

  async runReview(workspaceId: string, tenantId: string): Promise<DocumentReviewWorkspace> {
    const workspace = await this.getWorkspace(workspaceId, tenantId);

    try {
      // Stage 2: Fetch raw text
      await this.updateStatus(workspaceId, 'parsing');
      const rawText = await this.fetchDocumentText(workspace);

      // Stage 3: Parse structure
      await this.updateStatus(workspaceId, 'extracting');
      const structure: DocumentStructure = this.parser.parseDocument(rawText);

      // Stage 4: Extract obligations (regex + LLM augmentation)
      const partyNames = structure.parties.map((p) => p.name);
      const obligationExtracts: ObligationExtract[] = await this.obligationExtractor.extractObligationsWithLlm(
        rawText,
        partyNames,
        workspace.documentType ?? undefined,
      );

      // Stage 5: Extract clauses
      await this.updateStatus(workspaceId, 'analyzing');
      const documentType = workspace.documentType ?? 'other';
      const clauseExtracts: ClauseExtract[] = this.contractIntelligence.extractClauses(
        rawText,
        documentType,
      );

      // Build minimal ContractClauseV2-like objects for playbook comparison
      const clausesForPlaybook = clauseExtracts.map((c) => ({
        id: '',
        contractId: workspaceId,
        tenantId,
        clauseType: c.clauseType,
        title: c.title,
        rawText: c.rawText,
        normalizedText: null,
        section: c.section ?? null,
        pageNumber: null,
        playbookStatus: 'acceptable',
        riskLevel: c.riskLevel,
        riskFactors: c.riskFactors,
        negotiationNote: null,
        fallbackClauseId: null,
        accepted: false,
        acceptedBy: null,
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Stage 6: Compare against playbooks
      const playbookResults: PlaybookComparisonResult[] = await this.playbookComparison.compare(
        clausesForPlaybook,
        tenantId,
        documentType,
      );

      // Stage 7: Generate findings + redlines
      await this.updateStatus(workspaceId, 'reviewing');
      const findings: ReviewFinding[] = this.reviewFindings.generateFindings(
        structure,
        obligationExtracts,
        playbookResults,
      );
      const redlines: Redline[] = this.reviewFindings.generateRedlines(findings, structure);
      const { score, breakdown } = this.reviewFindings.calculateRiskScore(findings);

      // Stage 8: Persist results
      const updated = await this.prisma.documentReviewWorkspace.update({
        where: { id: workspaceId },
        data: {
          status: 'completed',
          structureJson: structure as any,
          definedTermsJson: structure.definedTerms as any,
          obligationsJson: obligationExtracts as any,
          findingsJson: findings as any,
          redlinesJson: redlines as any,
          riskScore: score,
          riskBreakdown: breakdown as any,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Review completed workspace=${workspaceId} score=${score} findings=${findings.length}`,
      );
      return updated;
    } catch (err) {
      await this.prisma.documentReviewWorkspace.update({
        where: { id: workspaceId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  /** Run full review pipeline on inline text (Word add-in). Creates workspace + runs review. */
  async runInlineReview(
    tenantId: string,
    userId: string,
    dto: {
      rawText: string;
      matterId?: string;
      title?: string;
      documentType?: string;
    },
  ): Promise<{
    workspaceId: string;
    findings: ReviewFinding[];
    redlines: Redline[];
    editOps: RedlineEditOp[];
    playbookResults: PlaybookComparisonResult[];
    playbookSummary: PlaybookDashboardSummary;
    riskScore: number;
  }> {
    const workspace = await this.createWorkspace(tenantId, userId, {
      rawText: dto.rawText,
      matterId: dto.matterId,
      title: dto.title ?? 'Word document review',
      documentType: dto.documentType ?? 'contract',
    });

    const completed = await this.runReview(workspace.id, tenantId);
    const findings = (completed.findingsJson as ReviewFinding[] | null) ?? [];
    const redlines = (completed.redlinesJson as Redline[] | null) ?? [];
    const structure = completed.structureJson as DocumentStructure | null;
    const editOps = this.redlineExport.toEditOps(redlines, structure ?? undefined);

    const playbookResults = await this.comparePlaybooksForText(
      tenantId,
      dto.rawText,
      dto.documentType ?? 'contract',
    );

    return {
      workspaceId: workspace.id,
      findings,
      redlines,
      editOps,
      playbookResults,
      playbookSummary: this.summarizePlaybookResults(playbookResults),
      riskScore: completed.riskScore ?? 0,
    };
  }

  async exportRedlineOps(
    workspaceId: string,
    tenantId: string,
  ): Promise<{ editOps: RedlineEditOp[]; redlines: Redline[] }> {
    const ws = await this.getWorkspace(workspaceId, tenantId);
    const redlines = (ws.redlinesJson as Redline[] | null) ?? [];
    const structure = ws.structureJson as DocumentStructure | null;
    return {
      redlines,
      editOps: this.redlineExport.toEditOps(redlines, structure ?? undefined),
    };
  }

  async comparePlaybooksForText(
    tenantId: string,
    rawText: string,
    contractType: string,
  ): Promise<PlaybookComparisonResult[]> {
    const documentType = contractType || 'contract';
    const clauseExtracts = this.contractIntelligence.extractClauses(rawText, documentType);
    const clausesForPlaybook = clauseExtracts.map((c) => ({
      id: '',
      contractId: '',
      tenantId,
      clauseType: c.clauseType,
      title: c.title,
      rawText: c.rawText,
      normalizedText: null,
      section: c.section ?? null,
      pageNumber: null,
      playbookStatus: 'acceptable',
      riskLevel: c.riskLevel,
      riskFactors: c.riskFactors,
      negotiationNote: null,
      fallbackClauseId: null,
      accepted: false,
      acceptedBy: null,
      acceptedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return this.playbookComparison.compare(clausesForPlaybook, tenantId, documentType);
  }

  summarizePlaybookResults(results: PlaybookComparisonResult[]): PlaybookDashboardSummary {
    return {
      unacceptable: results.filter((r) => r.status === 'prohibited').length,
      fallback: results.filter((r) => r.status === 'acceptable' || r.status === 'flagged').length,
      preferred: results.filter((r) => r.status === 'preferred').length,
      missing: results.filter((r) => r.status === 'missing').length,
      total: results.length,
    };
  }

  async getWorkspace(workspaceId: string, tenantId: string): Promise<DocumentReviewWorkspace> {
    const workspace = await this.prisma.documentReviewWorkspace.findFirst({
      where: { id: workspaceId, tenantId },
    });

    if (!workspace) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Document review workspace ${workspaceId} not found.`,
        404,
      );
    }

    return workspace;
  }

  async listWorkspaces(
    tenantId: string,
    filters: ListWorkspacesFilters,
  ): Promise<DocumentReviewWorkspace[]> {
    return this.prisma.documentReviewWorkspace.findMany({
      where: {
        tenantId,
        ...(filters.matterId ? { matterId: filters.matterId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip ?? 0,
      take: filters.take ?? 20,
    });
  }

  // ─── TODO-082: Persist obligations to a ContractEntity ───────────────────

  async saveObligationsToContract(
    workspaceId: string,
    tenantId: string,
    contractId: string,
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId, tenantId);

    // Verify the contract belongs to this tenant
    const contract = await this.prisma.contractEntity.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });

    if (!contract) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Contract ${contractId} not found.`,
        404,
      );
    }

    const obligations = (workspace.obligationsJson as ObligationExtract[] | null) ?? [];

    if (obligations.length === 0) return;

    await this.prisma.contractObligation.createMany({
      data: obligations.map((o) => ({
        contractId,
        tenantId,
        title: o.title,
        description: o.description,
        obligorParty: o.obligorParty,
        obligeeParty: o.obligeeParty ?? null,
        obligationType: o.obligationType,
        dueDate: o.dueDate ?? null,
        recurringSchedule: o.recurringSchedule ?? null,
        consequences: o.consequences ?? null,
        status: 'active',
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Saved ${obligations.length} obligations from workspace=${workspaceId} to contract=${contractId}`,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchDocumentText(
    workspace: DocumentReviewWorkspace,
  ): Promise<string> {
    const stored = workspace.structureJson as { rawText?: string } | null;
    if (stored?.rawText?.trim()) {
      return stored.rawText.trim();
    }

    // Try to get text from a Document record
    if (workspace.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: workspace.documentId, tenantId: workspace.tenantId },
        select: { extractedText: true },
      });

      if (doc?.extractedText) {
        return doc.extractedText;
      }
    }

    // Fall back to downloading from URL
    if (workspace.documentUrl) {
      return this.downloadText(workspace.documentUrl);
    }

    throw new DomainError(
      DomainErrorCode.NOT_FOUND,
      'No document text available for this review workspace.',
      422,
    );
  }

  private async downloadText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Failed to download document from URL: ${response.statusText}`,
        422,
      );
    }
    return response.text();
  }

  private async updateStatus(workspaceId: string, status: string): Promise<void> {
    await this.prisma.documentReviewWorkspace.update({
      where: { id: workspaceId },
      data: { status },
    });
  }
}
