import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONTRACT_INTAKE_FIELD_IDS,
  resolveCanonicalDocumentKind,
} from '@/consumers/intake-field-extraction';
import { getClauseCatalogForKind } from '@/config/template-clause-rules';
import { ISSUE_TYPE_TO_PRACTICE_AREA, type IssueCheckerType } from '@/consumers/issue-checker.constants';
import { DocumentDraftService } from '@/document-automation/document-draft.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TemplateSelectionService } from '@/templates/template-selection.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import {
  type DraftingMissingField,
  type MatterDraftWorkspace,
} from './drafting-workspace.types';

function isNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.trim());
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeWorkspace(raw: unknown): MatterDraftWorkspace {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    documentType: typeof obj.documentType === 'string' ? obj.documentType : undefined,
    documentTitle: typeof obj.documentTitle === 'string' ? obj.documentTitle : undefined,
    situation: typeof obj.situation === 'string' ? obj.situation : undefined,
    clauseOutline: Array.isArray(obj.clauseOutline)
      ? (obj.clauseOutline as MatterDraftWorkspace['clauseOutline'])
      : [],
    missingFields: Array.isArray(obj.missingFields)
      ? (obj.missingFields as MatterDraftWorkspace['missingFields'])
      : [],
    smartNextSteps: Array.isArray(obj.smartNextSteps)
      ? (obj.smartNextSteps as MatterDraftWorkspace['smartNextSteps'])
      : [],
    sourcesCited: Array.isArray(obj.sourcesCited)
      ? (obj.sourcesCited as string[]).filter((s) => typeof s === 'string')
      : [],
    draftMarkdown: typeof obj.draftMarkdown === 'string' ? obj.draftMarkdown : undefined,
  };
}

function isWorkspaceIncomplete(workspace: MatterDraftWorkspace): boolean {
  return (
    !workspace.documentType &&
    !(workspace.clauseOutline?.length) &&
    !(workspace.missingFields?.length)
  );
}

@Injectable()
export class DraftingWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentDraft: DocumentDraftService,
    private readonly templateSelection: TemplateSelectionService,
    private readonly matterMemory: MatterMemoryService,
  ) {}

  async getWorkspace(tenantId: string, matterId: string) {
    let matter = await this.loadMatter(tenantId, matterId);
    const storedWorkspace = await this.ensureDraftWorkspaceBackfill(tenantId, matterId, matter);
    matter = { ...matter, draftWorkspace: storedWorkspace as Prisma.JsonValue };

    const planningAnswers = (matter.planningAnswers ?? {}) as Record<string, string | string[]>;
    const pendingMissingFields = this.getPendingMissingFields(storedWorkspace, planningAnswers);
    const { answeredCount, totalRequired, completionScore } = this.computeCompletionMetrics(
      planningAnswers,
      storedWorkspace,
    );

    const displayWorkspace: MatterDraftWorkspace = {
      ...storedWorkspace,
      documentType:
        storedWorkspace.documentType ??
        (typeof planningAnswers.documentType === 'string'
          ? planningAnswers.documentType
          : undefined),
      missingFields: pendingMissingFields,
    };

    const confirmedFields = this.getConfirmedFields(
      planningAnswers,
      pendingMissingFields,
    );

    const drafts = await this.prisma.document.findMany({
      where: {
        tenantId,
        matterId,
        generatedFromTemplateId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        htmlContent: true,
        aiDraftStatus: true,
        generatedFromTemplateId: true,
        docxUrl: true,
        pdfUrl: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const resolvedDocumentKind = resolveCanonicalDocumentKind(
      displayWorkspace.documentType ?? (typeof planningAnswers.documentType === 'string' ? planningAnswers.documentType : undefined),
      undefined,
      planningAnswers as Record<string, string>,
      matter.title,
    );
    const clauseCatalog = getClauseCatalogForKind(resolvedDocumentKind);

    return {
      matterId: matter.id,
      matterTitle: matter.title,
      matterType: matter.matterType,
      practiceArea: matter.practiceArea,
      countryCode: matter.countryCode,
      matterProfile: matter.matterProfile ?? undefined,
      matterGraph: matter.matterGraph ?? undefined,
      matterTaskGraph: matter.matterTaskGraph ?? undefined,
      draftWorkspace: displayWorkspace,
      planningAnswers,
      confirmedFields,
      pendingMissingFields,
      answeredCount,
      totalRequired,
      completionScore,
      drafts,
      primaryDraft: drafts[0] ?? null,
      clauseCatalog,
    };
  }

  async patchFields(
    tenantId: string,
    userId: string,
    matterId: string,
    fields: Record<string, string | string[]>,
    regenerateDraft = false,
    selectedClauses?: string[],
    knowledgeSources?: string[],
  ) {
    const matter = await this.loadMatter(tenantId, matterId);
    const storedWorkspace = await this.ensureDraftWorkspaceBackfill(tenantId, matterId, matter);
    const existingAnswers = (matter.planningAnswers ?? {}) as Record<string, string | string[]>;
    const mergedAnswers = { ...existingAnswers, ...fields };
    const pendingMissingFields = this.getPendingMissingFields(storedWorkspace, mergedAnswers);
    const { answeredCount, totalRequired, completionScore } = this.computeCompletionMetrics(
      mergedAnswers,
      storedWorkspace,
    );

    const updatedWorkspace: MatterDraftWorkspace = {
      ...storedWorkspace,
      ...(selectedClauses !== undefined ? { selectedClauses } : {}),
    };

    const displayWorkspace: MatterDraftWorkspace = {
      ...updatedWorkspace,
      missingFields: pendingMissingFields,
    };

    await this.prisma.matter.update({
      where: { id: matterId },
      data: {
        planningAnswers: mergedAnswers as Prisma.InputJsonValue,
        draftWorkspace: updatedWorkspace as Prisma.InputJsonValue,
      },
    });

    let generateResult = null;
    if (regenerateDraft) {
      generateResult = await this.generateDraft(
        tenantId,
        userId,
        matterId,
        undefined,
        undefined,
        selectedClauses,
        knowledgeSources,
      );
    }

    return {
      planningAnswers: mergedAnswers,
      draftWorkspace: displayWorkspace,
      pendingMissingFields,
      answeredCount,
      totalRequired,
      completionScore,
      generateResult,
    };
  }

  async generateDraft(
    tenantId: string,
    userId: string,
    matterId: string,
    sectionHint?: string,
    locale?: string,
    selectedClauses?: string[],
    knowledgeSources?: string[],
  ) {
    const matter = await this.loadMatter(tenantId, matterId);
    let workspace = await this.ensureDraftWorkspaceBackfill(tenantId, matterId, matter);

    // If caller passed selectedClauses, persist them before generating
    if (selectedClauses !== undefined) {
      workspace = { ...workspace, selectedClauses };
      await this.prisma.matter.update({
        where: { id: matterId },
        data: { draftWorkspace: workspace as Prisma.InputJsonValue },
      });
    }
    const planningAnswers = (matter.planningAnswers ?? {}) as Record<string, string>;

    const documentType = resolveCanonicalDocumentKind(
      workspace.documentType ?? planningAnswers.documentType,
      matter.factsSummary ?? undefined,
      planningAnswers,
      matter.title,
    );

    const practiceAreaSlug =
      ISSUE_TYPE_TO_PRACTICE_AREA[matter.practiceArea as IssueCheckerType] ??
      'corporate_commercial';

    const selected = await this.templateSelection.selectTemplate({
      tenantId,
      documentType,
      countryCode: matter.countryCode,
      practiceAreaSlug,
      matterJurisdiction: matter.jurisdiction,
      factsSummary: matter.factsSummary,
      planningAnswers,
    });

    const mergeOverrides = this.buildMergeOverrides(planningAnswers, workspace, sectionHint);
    mergeOverrides._selectedTemplateKind = selected.documentKind ?? documentType;
    mergeOverrides._selectedTemplateJurisdiction = selected.jurisdiction ?? matter.jurisdiction ?? '';
    if (workspace.selectedClauses?.length) {
      mergeOverrides._clauseSelections = workspace.selectedClauses.join('\n');
    }

    const draftResult = await this.documentDraft.draftWithAi(
      tenantId,
      userId,
      matterId,
      selected.id,
      locale,
      mergeOverrides,
      knowledgeSources,
    );

    void this.matterMemory
      .mergeGeneratedDocument('matter', matterId, {
        title: selected.name ?? documentType,
        documentType,
      })
      .catch(() => undefined);

    return draftResult;
  }

  private buildMergeOverrides(
    planningAnswers: Record<string, string>,
    workspace: MatterDraftWorkspace,
    sectionHint?: string,
  ): Record<string, string> {
    const overrides: Record<string, string> = { ...planningAnswers };

    if (planningAnswers.scopeOfWork && !overrides.servicesDescription) {
      overrides.servicesDescription = planningAnswers.scopeOfWork;
    }
    if (workspace.situation) {
      overrides._situationSummary = workspace.situation;
    }
    if (workspace.clauseOutline?.length) {
      overrides._clauseOutline = JSON.stringify(workspace.clauseOutline);
    }
    if (sectionHint) {
      overrides._sectionHint = sectionHint;
    }

    return overrides;
  }

  private async ensureDraftWorkspaceBackfill(
    tenantId: string,
    matterId: string,
    matter: {
      draftWorkspace?: unknown;
      sourceLeadId?: string | null;
      planningAnswers?: unknown;
      title?: string | null;
    },
  ): Promise<MatterDraftWorkspace> {
    const workspace = normalizeWorkspace(matter.draftWorkspace);

    if (!matter.sourceLeadId) {
      return workspace;
    }

    const needsBackfill =
      isWorkspaceIncomplete(workspace) ||
      (!workspace.missingFields?.length && !workspace.clauseOutline?.length);

    if (!needsBackfill) {
      return workspace;
    }

    const previewRun = await this.prisma.caseAnalysisRun.findFirst({
      where: {
        lawyerLeadId: matter.sourceLeadId,
        runType: 'PREVIEW',
        structuredOutput: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!previewRun?.structuredOutput) {
      return workspace;
    }

    const fromLead = normalizeWorkspace(previewRun.structuredOutput);
    const planningAnswers = (matter.planningAnswers ?? {}) as Record<string, string>;
    const resolvedKind = resolveCanonicalDocumentKind(
      workspace.documentType ?? fromLead.documentType,
      undefined,
      planningAnswers,
      matter.title ?? undefined,
    );
    const merged: MatterDraftWorkspace = {
      documentType: resolvedKind,
      documentTitle: workspace.documentTitle ?? fromLead.documentTitle,
      situation: workspace.situation ?? fromLead.situation,
      clauseOutline: workspace.clauseOutline?.length
        ? workspace.clauseOutline
        : fromLead.clauseOutline,
      missingFields: workspace.missingFields?.length
        ? workspace.missingFields
        : fromLead.missingFields,
      smartNextSteps: workspace.smartNextSteps?.length
        ? workspace.smartNextSteps
        : fromLead.smartNextSteps,
      sourcesCited: workspace.sourcesCited?.length
        ? workspace.sourcesCited
        : fromLead.sourcesCited,
      draftMarkdown: workspace.draftMarkdown ?? fromLead.draftMarkdown,
    };

    await this.prisma.matter.update({
      where: { id: matterId, tenantId },
      data: { draftWorkspace: merged as Prisma.InputJsonValue },
    });

    return merged;
  }

  private getRequiredFieldIds(storedWorkspace: MatterDraftWorkspace): Set<string> {
    const required = new Set<string>(CONTRACT_INTAKE_FIELD_IDS);
    for (const mf of storedWorkspace.missingFields ?? []) {
      required.add(mf.field);
    }
    return required;
  }

  private getPendingMissingFields(
    storedWorkspace: MatterDraftWorkspace,
    planningAnswers: Record<string, string | string[]>,
  ): DraftingMissingField[] {
    return (storedWorkspace.missingFields ?? []).filter(
      (mf) => !isNonEmpty(planningAnswers[mf.field]),
    );
  }

  private computeCompletionMetrics(
    planningAnswers: Record<string, string | string[]>,
    storedWorkspace: MatterDraftWorkspace,
  ): { answeredCount: number; totalRequired: number; completionScore: number } {
    const required = this.getRequiredFieldIds(storedWorkspace);
    const totalRequired = required.size;
    let answeredCount = 0;
    for (const fieldId of required) {
      if (isNonEmpty(planningAnswers[fieldId])) {
        answeredCount += 1;
      }
    }

    const pendingCount = this.getPendingMissingFields(storedWorkspace, planningAnswers).length;

    // When there are no pending fields, all required fields are satisfied regardless
    // of whether planningAnswers keys match CONTRACT_INTAKE_FIELD_IDS (e.g. AI workspace flow).
    const resolvedAnsweredCount = pendingCount === 0 ? totalRequired : answeredCount;

    const completionScore =
      totalRequired === 0
        ? pendingCount === 0
          ? 100
          : 0
        : pendingCount === 0
          ? 100
          : Math.min(99, Math.round((answeredCount / totalRequired) * 100));

    return { answeredCount: resolvedAnsweredCount, totalRequired, completionScore };
  }

  private async loadMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: { client: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');
    return matter;
  }

  private getConfirmedFields(
    planningAnswers: Record<string, string | string[]>,
    pendingMissingFields: { field: string }[],
  ): Record<string, string | string[]> {
    const pendingIds = new Set(pendingMissingFields.map((m) => m.field));
    const confirmed: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(planningAnswers)) {
      if (key.startsWith('_')) continue;
      if (pendingIds.has(key)) continue;
      if (isNonEmpty(value)) confirmed[key] = value;
    }
    return confirmed;
  }
}
