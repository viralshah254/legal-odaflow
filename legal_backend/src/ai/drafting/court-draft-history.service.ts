import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { PrismaService } from '@/prisma/prisma.service';
import { HumanReviewService } from './platform/human-review.service';
import type { DraftVerificationAudit } from './draft-verification.types';

export interface SaveCourtDraftInput {
  tenantRole?: string;
  tenantId: string;
  userId: string;
  source: 'india' | 'us' | 'form_catalog' | 'drafting_session';
  kind: string;
  matterId?: string;
  label?: string;
  subtitle?: string;
  category?: string;
  countryCode: string;
  jurisdiction?: string;
  language?: string;
  caseDetails?: string;
  clientName?: string;
  courtName?: string;
  opposingParty?: string;
  draftText: string;
  verificationAudit?: DraftVerificationAudit;
  sourceRegistry?: unknown;
  citationAppendix?: unknown;
  filingReadiness?: unknown;
  creditsUsed?: number;
  creditLedgerId?: string;
}

export interface DraftHistoryItem {
  id: string;
  title: string;
  preview: string;
  kind: string;
  label?: string | null;
  countryCode: string;
  category?: string | null;
  source: string;
  creditsUsed: number;
  requiresLawyerReview: boolean;
  verificationStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourtDraftRecordFull extends DraftHistoryItem {
  subtitle?: string | null;
  jurisdiction?: string | null;
  language: string;
  caseDetails?: string | null;
  clientName?: string | null;
  courtName?: string | null;
  opposingParty?: string | null;
  draftText: string;
  verificationAudit?: DraftVerificationAudit | null;
  sourceRegistry?: unknown;
  citationAppendix?: unknown;
  filingReadiness?: unknown;
  clientId?: string | null;
  matterId?: string | null;
  linkedClientName?: string | null;
}

@Injectable()
export class CourtDraftHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly humanReview: HumanReviewService,
    private readonly access: ArtifactAccessResolver,
  ) {}

  buildTitle(input: {
    label?: string;
    kind: string;
    clientName?: string;
    opposingParty?: string;
    caseDetails?: string;
  }): string {
    const docLabel = input.label ?? input.kind.replace(/_/g, ' ');
    if (input.clientName && input.opposingParty) {
      return `${docLabel} — ${input.clientName} v. ${input.opposingParty}`;
    }
    if (input.clientName) {
      return `${docLabel} — ${input.clientName}`;
    }
    if (input.caseDetails) {
      const snippet = input.caseDetails.trim().slice(0, 60);
      return `${docLabel} — ${snippet}${input.caseDetails.length > 60 ? '…' : ''}`;
    }
    return docLabel;
  }

  async save(input: SaveCourtDraftInput): Promise<DraftHistoryItem> {
    if (input.matterId) await this.access.assertMatterReadable(input, input.matterId);
    const title = this.buildTitle(input);
    const verificationStatus =
      input.verificationAudit?.verificationStatus ?? 'limited_sources';

    const record = await this.prisma.courtDraftRecord.create({
      data: {
        tenantId: input.tenantId,
        matterId: input.matterId,
        userId: input.userId,
        source: input.source,
        kind: input.kind,
        title,
        label: input.label,
        subtitle: input.subtitle,
        category: input.category,
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
        language: input.language ?? 'en',
        caseDetails: input.caseDetails,
        clientName: input.clientName,
        courtName: input.courtName,
        opposingParty: input.opposingParty,
        draftText: input.draftText,
        verificationAudit: input.verificationAudit as unknown as Prisma.InputJsonValue,
        sourceRegistryJson: input.sourceRegistry as Prisma.InputJsonValue | undefined,
        citationAppendixJson: input.citationAppendix as Prisma.InputJsonValue | undefined,
        filingReadinessJson: input.filingReadiness as Prisma.InputJsonValue | undefined,
        creditsUsed: input.creditsUsed ?? 0,
        creditLedgerId: input.creditLedgerId,
        requiresLawyerReview: input.verificationAudit?.requiresLawyerReview ?? false,
        verificationStatus,
      },
    });

    return this.toHistoryItem(record);
  }

  async update(
    id: string,
    tenantId: string,
    userId: string,
    data: {
      draftText?: string;
      expectedRevision?: number;
      /** Server-only writers (generate pipeline). */
      verificationAudit?: DraftVerificationAudit;
      sourceRegistry?: unknown;
      citationAppendix?: unknown;
      filingReadiness?: unknown;
    },
  ): Promise<DraftHistoryItem> {
    const existing = await this.prisma.courtDraftRecord.findFirst({
      where: { id, tenantId, userId, status: 'active' },
    });
    if (!existing) throw new NotFoundException('Draft not found');

    if (
      data.expectedRevision !== undefined &&
      data.expectedRevision !== existing.contentRevision
    ) {
      throw new BadRequestException('Draft revision conflict');
    }

    const textChanged =
      data.draftText !== undefined && data.draftText !== existing.draftText;

    const record = await this.prisma.courtDraftRecord.update({
      where: { id },
      data: {
        ...(data.draftText !== undefined ? { draftText: data.draftText } : {}),
        ...(textChanged
          ? {
              contentRevision: { increment: 1 },
              verificationStatus: 'stale',
              requiresLawyerReview: true,
              filingReadinessJson: Prisma.DbNull,
              verificationAudit: Prisma.DbNull,
            }
          : {}),
        ...(data.verificationAudit !== undefined
          ? {
              verificationAudit: data.verificationAudit as unknown as Prisma.InputJsonValue,
              requiresLawyerReview: data.verificationAudit.requiresLawyerReview,
              verificationStatus: data.verificationAudit.verificationStatus,
            }
          : {}),
        ...(data.sourceRegistry !== undefined
          ? { sourceRegistryJson: data.sourceRegistry as Prisma.InputJsonValue }
          : {}),
        ...(data.citationAppendix !== undefined
          ? { citationAppendixJson: data.citationAppendix as Prisma.InputJsonValue }
          : {}),
        ...(data.filingReadiness !== undefined
          ? { filingReadinessJson: data.filingReadiness as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (textChanged) {
      await this.humanReview.invalidate(tenantId, id, 'Draft content changed');
    }

    return this.toHistoryItem(record);
  }

  async list(
    tenantId: string,
    userId: string,
    filters?: { countryCode?: string; kind?: string; limit?: number },
  ): Promise<DraftHistoryItem[]> {
    const records = await this.prisma.courtDraftRecord.findMany({
      where: {
        tenantId,
        userId,
        status: 'active',
        ...(filters?.countryCode ? { countryCode: filters.countryCode } : {}),
        ...(filters?.kind ? { kind: filters.kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 30,
    });
    return records.map((r) => this.toHistoryItem(r));
  }

  async getById(id: string, tenantId: string, userId: string): Promise<CourtDraftRecordFull> {
    const record = await this.prisma.courtDraftRecord.findFirst({
      where: { id, tenantId, userId, status: 'active' },
    });
    if (!record) throw new NotFoundException('Draft not found');
    return this.toFull(record);
  }

  async archive(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.prisma.courtDraftRecord.findFirst({
      where: { id, tenantId, userId },
    });
    if (!existing) throw new NotFoundException('Draft not found');
    await this.prisma.courtDraftRecord.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Persist a unified-engine DraftJob into CourtDraftRecord history (idempotent).
   * Returns the CourtDraftRecord id linked on the job.
   */
  async persistFromUnifiedJob(input: {
    jobId: string;
    tenantId: string;
    userId: string;
    documentKind: string;
    caseDetails?: string;
    clientName?: string;
    courtName?: string;
    opposingParty?: string;
    jurisdiction?: string;
    language?: string;
    draftText: string;
    creditsUsed: number;
    verificationAudit?: DraftVerificationAudit;
  }): Promise<string> {
    const job = await this.prisma.draftJob.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId, userId: input.userId },
      select: { courtDraftRecordId: true },
    });
    if (!job) throw new NotFoundException('Draft job not found');

    const label = input.documentKind
      .replace(/^india_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (job.courtDraftRecordId) {
      const title = this.buildTitle({
        label,
        kind: input.documentKind,
        clientName: input.clientName,
        opposingParty: input.opposingParty,
        caseDetails: input.caseDetails,
      });
      await this.prisma.courtDraftRecord.update({
        where: { id: job.courtDraftRecordId },
        data: {
          source: 'india',
          kind: input.documentKind,
          title,
          label,
          countryCode: 'IN',
          jurisdiction: input.jurisdiction,
          language: input.language ?? 'en',
          caseDetails: input.caseDetails,
          clientName: input.clientName,
          courtName: input.courtName,
          opposingParty: input.opposingParty,
          draftText: input.draftText,
          creditsUsed: input.creditsUsed,
          ...(input.verificationAudit
            ? {
                verificationAudit:
                  input.verificationAudit as unknown as Prisma.InputJsonValue,
                requiresLawyerReview: input.verificationAudit.requiresLawyerReview,
                verificationStatus: input.verificationAudit.verificationStatus,
              }
            : {}),
        },
      });
      return job.courtDraftRecordId;
    }

    const saved = await this.save({
      tenantId: input.tenantId,
      userId: input.userId,
      source: 'india',
      kind: input.documentKind,
      label,
      countryCode: 'IN',
      jurisdiction: input.jurisdiction,
      language: input.language ?? 'en',
      caseDetails: input.caseDetails,
      clientName: input.clientName,
      courtName: input.courtName,
      opposingParty: input.opposingParty,
      draftText: input.draftText,
      verificationAudit: input.verificationAudit,
      creditsUsed: input.creditsUsed,
    });

    await this.prisma.draftJob.update({
      where: { id: input.jobId },
      data: { courtDraftRecordId: saved.id },
    });

    return saved.id;
  }

  /** Resolve a CourtDraftRecord id from either a record id or a unified DraftJob id. */
  async resolveCourtDraftRecordId(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const existing = await this.prisma.courtDraftRecord.findFirst({
      where: { id, tenantId, userId, status: 'active' },
      select: { id: true },
    });
    if (existing) return existing.id;

    const job = await this.prisma.draftJob.findFirst({
      where: { id, tenantId, userId, status: 'ready' },
    });
    if (!job) throw new NotFoundException('Draft not found');

    if (job.courtDraftRecordId) return job.courtDraftRecordId;

    const assembled = job.assembledDraftJson as { fullText?: string } | null;
    const draftText = assembled?.fullText?.trim() ?? '';
    if (!draftText) throw new NotFoundException('Draft not found');

    const normalized = job.normalizedMatterJson as {
      jurisdiction?: string;
      courtName?: string;
      clientName?: string;
      opposingParty?: string;
    } | null;

    return this.persistFromUnifiedJob({
      jobId: job.id,
      tenantId,
      userId,
      documentKind: job.documentKind,
      caseDetails: undefined,
      clientName: normalized?.clientName,
      courtName: normalized?.courtName,
      opposingParty: normalized?.opposingParty,
      jurisdiction: normalized?.jurisdiction,
      language: 'en',
      draftText,
      creditsUsed: job.consumedCredits,
    });
  }

  async linkToClient(
    id: string,
    tenantId: string,
    userId: string,
    payload: { clientId: string; matterId?: string; clientName?: string },
    tenantRole?: string,
  ): Promise<{
    success: boolean;
    clientId: string;
    clientName: string | null;
    matterId: string | null;
  }> {
    const recordId = await this.resolveCourtDraftRecordId(id, tenantId, userId);

    const actor = { tenantId, userId, tenantRole };
    let linkedName = payload.clientName ?? null;
    if (payload.matterId) {
      const { clientName } = await this.access.assertClientMatterLink(
        actor,
        payload.clientId,
        payload.matterId,
      );
      linkedName = clientName;
    } else {
      await this.access.assertClientReadable(actor, payload.clientId);
    }

    const existing = await this.prisma.courtDraftRecord.findFirst({
      where: { id: recordId, tenantId, userId },
      select: { matterId: true },
    });

    const updated = await this.prisma.courtDraftRecord.update({
      where: { id: recordId },
      data: {
        clientId: payload.clientId,
        matterId:
          payload.matterId !== undefined ? payload.matterId : existing?.matterId ?? null,
        linkedClientName: linkedName,
      },
      select: {
        clientId: true,
        linkedClientName: true,
        matterId: true,
      },
    });
    return {
      success: true,
      clientId: updated.clientId!,
      clientName: updated.linkedClientName,
      matterId: updated.matterId,
    };
  }

  private toHistoryItem(record: {
    id: string;
    title: string;
    draftText: string;
    kind: string;
    label: string | null;
    countryCode: string;
    category: string | null;
    source: string;
    creditsUsed: number;
    requiresLawyerReview: boolean;
    verificationStatus: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DraftHistoryItem {
    return {
      id: record.id,
      title: record.title,
      preview: record.draftText.slice(0, 120),
      kind: record.kind,
      label: record.label,
      countryCode: record.countryCode,
      category: record.category,
      source: record.source,
      creditsUsed: record.creditsUsed,
      requiresLawyerReview: record.requiresLawyerReview,
      verificationStatus: record.verificationStatus ?? undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toFull(record: {
    id: string;
    title: string;
    draftText: string;
    kind: string;
    label: string | null;
    subtitle: string | null;
    countryCode: string;
    category: string | null;
    source: string;
    jurisdiction: string | null;
    language: string;
    caseDetails: string | null;
    clientName: string | null;
    courtName: string | null;
    opposingParty: string | null;
    creditsUsed: number;
    requiresLawyerReview: boolean;
    verificationStatus: string | null;
    verificationAudit: unknown;
    sourceRegistryJson: unknown;
    citationAppendixJson: unknown;
    filingReadinessJson: unknown;
    clientId: string | null;
    matterId: string | null;
    linkedClientName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CourtDraftRecordFull {
    return {
      ...this.toHistoryItem(record),
      subtitle: record.subtitle,
      jurisdiction: record.jurisdiction,
      language: record.language,
      caseDetails: record.caseDetails,
      clientName: record.clientName,
      courtName: record.courtName,
      opposingParty: record.opposingParty,
      draftText: record.draftText,
      verificationAudit: record.verificationAudit as DraftVerificationAudit | null,
      sourceRegistry: record.sourceRegistryJson,
      citationAppendix: record.citationAppendixJson,
      filingReadiness: record.filingReadinessJson,
      clientId: record.clientId,
      matterId: record.matterId,
      linkedClientName: record.linkedClientName,
    };
  }
}
