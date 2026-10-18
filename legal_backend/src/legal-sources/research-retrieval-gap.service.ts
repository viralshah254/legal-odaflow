import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { LEGAL_INGEST_JOB_TYPES } from '@/jobs/jobs.constants';
import { PrismaService } from '@/prisma/prisma.service';
import { findStatuteById } from '@/legal-search/statute-registry';
import { isHeadingOnlySection } from './parsers/india-act-text.parser';

export const RETRIEVAL_GAP_TYPES = [
  'stub_text',
  'missing_regulation',
  'off_point_blocked',
  'no_case_law',
  'checklist_unmet',
  'citation_metadata',
] as const;
export type RetrievalGapType = (typeof RETRIEVAL_GAP_TYPES)[number];

export const RETRIEVAL_GAP_STATUSES = ['open', 'in_progress', 'resolved', 'ignored'] as const;
export type RetrievalGapStatus = (typeof RETRIEVAL_GAP_STATUSES)[number];

interface PipelineGapInput {
  query: string;
  countryCode: string;
  legalDomain?: string;
  aiOutputId?: string;
  authorities?: Array<{ sourceTier?: string }>;
  requestedSection?: { actId: string; section: string; statuteShortName?: string };
  exactSectionFound?: boolean;
  domainFitLow?: boolean;
  caseLawRequested?: boolean;
  rejectedCandidates?: Array<{
    authorityId: string;
    reason: string;
    gate: 'heading_only_statute' | 'citation_metadata' | 'case_relevance';
  }>;
  verificationGaps?: unknown;
  rejectedCitations?: unknown;
}

interface GapCandidate {
  gapType: RetrievalGapType;
  expectedAuthority: string;
  detail?: Record<string, unknown>;
}

@Injectable()
export class ResearchRetrievalGapService {
  private readonly logger = new Logger(ResearchRetrievalGapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async record(input: {
    countryCode: string;
    legalDomain?: string;
    gapType: RetrievalGapType;
    expectedAuthority: string;
    query: string;
    aiOutputId?: string;
    detail?: Record<string, unknown>;
  }) {
    const countryCode = input.countryCode.trim().toUpperCase();
    const expectedAuthority = this.normalizeDisplay(input.expectedAuthority);
    if (!countryCode || !expectedAuthority || !RETRIEVAL_GAP_TYPES.includes(input.gapType)) return;

    const authorityFingerprint = this.fingerprint(expectedAuthority);
    const queryFingerprint = this.fingerprint(input.query);
    const detail = input.detail as Prisma.InputJsonValue | undefined;

    return this.prisma.researchRetrievalGap.upsert({
      where: {
        countryCode_gapType_authorityFingerprint_queryFingerprint: {
          countryCode,
          gapType: input.gapType,
          authorityFingerprint,
          queryFingerprint,
        },
      },
      create: {
        countryCode,
        legalDomain: input.legalDomain,
        gapType: input.gapType,
        expectedAuthority,
        authorityFingerprint,
        queryFingerprint,
        aiOutputId: input.aiOutputId,
        detail,
      },
      update: {
        occurrenceCount: { increment: 1 },
        legalDomain: input.legalDomain ?? undefined,
        aiOutputId: input.aiOutputId ?? undefined,
        detail,
      },
    });
  }

  async recordPipelineGaps(input: PipelineGapInput): Promise<void> {
    try {
      const candidates = this.pipelineCandidates(input);
      const seen = new Set<string>();
      for (const candidate of candidates) {
        const key = `${candidate.gapType}:${this.fingerprint(candidate.expectedAuthority)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await this.record({
          countryCode: input.countryCode,
          legalDomain: input.legalDomain,
          aiOutputId: input.aiOutputId,
          query: input.query,
          ...candidate,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Retrieval-gap persistence failed (non-critical): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(query: {
    status?: string;
    countryCode?: string;
    gapType?: string;
    legalDomain?: string;
    limit?: number;
    offset?: number;
  }) {
    if (query.status && !RETRIEVAL_GAP_STATUSES.includes(query.status as RetrievalGapStatus)) {
      throw new BadRequestException(`Invalid status: ${query.status}`);
    }
    if (query.gapType && !RETRIEVAL_GAP_TYPES.includes(query.gapType as RetrievalGapType)) {
      throw new BadRequestException(`Invalid gap type: ${query.gapType}`);
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const where: Prisma.ResearchRetrievalGapWhereInput = {
      status: query.status || undefined,
      countryCode: query.countryCode?.toUpperCase() || undefined,
      gapType: query.gapType || undefined,
      legalDomain: query.legalDomain || undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.researchRetrievalGap.findMany({
        where,
        orderBy: [{ occurrenceCount: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.researchRetrievalGap.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async getStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [open, inProgress, resolved7d, ignored, byType] = await Promise.all([
      this.prisma.researchRetrievalGap.count({ where: { status: 'open' } }),
      this.prisma.researchRetrievalGap.count({ where: { status: 'in_progress' } }),
      this.prisma.researchRetrievalGap.count({
        where: { status: 'resolved', resolvedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.researchRetrievalGap.count({ where: { status: 'ignored' } }),
      this.prisma.researchRetrievalGap.groupBy({
        by: ['gapType'],
        where: { status: { in: ['open', 'in_progress'] } },
        _count: { id: true },
        _sum: { occurrenceCount: true },
      }),
    ]);
    return { open, inProgress, resolved7d, ignored, byType };
  }

  async update(
    id: string,
    data: {
      status?: string;
      resolvedAuthorityId?: string;
      resolvedNote?: string;
    },
  ) {
    const existing = await this.getById(id);
    if (data.status && !RETRIEVAL_GAP_STATUSES.includes(data.status as RetrievalGapStatus)) {
      throw new BadRequestException(`Invalid status: ${data.status}`);
    }
    const isResolved = data.status === 'resolved';
    return this.prisma.researchRetrievalGap.update({
      where: { id },
      data: {
        status: data.status,
        resolvedAuthorityId: data.resolvedAuthorityId,
        resolvedNote: data.resolvedNote,
        resolvedAt: data.status ? (isResolved ? new Date() : null) : existing.resolvedAt,
      },
    });
  }

  async triggerIngest(id: string) {
    const gap = await this.getById(id);
    const detail = this.asRecord(gap.detail);
    const actId = this.stringValue(detail.actId);
    const section = this.stringValue(detail.section);
    const statute = actId ? findStatuteById(actId) : undefined;

    if (
      (gap.gapType === 'stub_text' || gap.gapType === 'missing_regulation') &&
      actId &&
      section &&
      statute?.countryCode === gap.countryCode
    ) {
      const result = await this.jobs.enqueueLegalIngestJob({
        countryCode: gap.countryCode,
        actId,
        jobType: LEGAL_INGEST_JOB_TYPES.STATUTE_ACT_INGEST,
      });
      return {
        ok: result.status === 'QUEUED',
        state: result.status === 'QUEUED' ? 'queued' : 'failed',
        message:
          result.status === 'QUEUED'
            ? `Act ingest queued for ${actId}${section ? ` section ${section}` : ''}.`
            : result.message ?? 'The ingest job could not be queued.',
        agentJobId: result.agentJobId,
        actId,
        section: section ?? null,
      };
    }

    if (gap.gapType === 'no_case_law') {
      const jobType =
        gap.countryCode === 'IN'
          ? LEGAL_INGEST_JOB_TYPES.ESCR_SYNC
          : LEGAL_INGEST_JOB_TYPES.COURTLISTENER_SYNC;
      const result = await this.jobs.enqueueLegalIngestJob({
        countryCode: gap.countryCode,
        query: gap.expectedAuthority,
        queries: [gap.expectedAuthority],
        jobType,
      });
      return {
        ok: result.status === 'QUEUED',
        state: result.status === 'QUEUED' ? 'queued' : 'failed',
        message:
          result.status === 'QUEUED'
            ? `Case-law sync queued for ${gap.countryCode}.`
            : result.message ?? 'The case-law sync could not be queued.',
        agentJobId: result.agentJobId,
      };
    }

    return {
      ok: false,
      state: 'manual_required',
      message:
        'Manual remediation required: this gap does not contain a resolvable act identifier or a supported case-law sync target.',
    };
  }

  async getCorpusHealth(countryCode?: string) {
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        authorityType: 'STATUTE_SECTION',
        countryCode: countryCode?.toUpperCase() || undefined,
      },
      select: { id: true, countryCode: true, title: true, fullText: true, isRepealed: true },
    });
    const byAct = new Map<
      string,
      { countryCode: string; actId: string; total: number; headingOnly: number }
    >();
    for (const row of rows) {
      const parsed = this.parseStatuteSectionId(row.id, row.countryCode);
      const key = `${row.countryCode}:${parsed.actId}`;
      const current = byAct.get(key) ?? {
        countryCode: row.countryCode,
        actId: parsed.actId,
        total: 0,
        headingOnly: 0,
      };
      current.total += 1;
      if (
        isHeadingOnlySection({
          section: parsed.section,
          title: row.title,
          fullText: row.fullText ?? '',
          isRepealed: row.isRepealed,
        })
      ) {
        current.headingOnly += 1;
      }
      byAct.set(key, current);
    }
    return [...byAct.values()]
      .map((row) => ({
        ...row,
        stubRatio: row.total === 0 ? 0 : row.headingOnly / row.total,
      }))
      .sort((a, b) => b.stubRatio - a.stubRatio || b.total - a.total);
  }

  private async getById(id: string) {
    const gap = await this.prisma.researchRetrievalGap.findUnique({ where: { id } });
    if (!gap) throw new NotFoundException(`Research retrieval gap ${id} not found`);
    return gap;
  }

  private pipelineCandidates(input: PipelineGapInput): GapCandidate[] {
    const candidates: GapCandidate[] = [];
    if (input.requestedSection && input.exactSectionFound === false) {
      candidates.push({
        gapType: 'missing_regulation',
        expectedAuthority: `${input.requestedSection.statuteShortName ?? input.requestedSection.actId} section ${input.requestedSection.section}`,
        detail: {
          actId: input.requestedSection.actId,
          section: input.requestedSection.section,
          source: 'exact_section_missing',
        },
      });
    }
    if (input.domainFitLow) {
      candidates.push({
        gapType: 'off_point_blocked',
        expectedAuthority: input.legalDomain
          ? `${input.legalDomain} authorities responsive to the query`
          : 'Authorities responsive to the query',
        detail: { source: 'domain_fit_gate' },
      });
    }
    if (
      input.caseLawRequested &&
      !(input.authorities ?? []).some((authority) => authority.sourceTier === 'case_law')
    ) {
      candidates.push({
        gapType: 'no_case_law',
        expectedAuthority: input.query,
        detail: { source: 'case_law_slot_empty' },
      });
    }
    for (const rejected of input.rejectedCandidates ?? []) {
      const parsed = this.parseStatuteSectionId(rejected.authorityId, input.countryCode);
      candidates.push({
        gapType: rejected.gate === 'heading_only_statute' ? 'stub_text' : 'citation_metadata',
        expectedAuthority: rejected.authorityId,
        detail: {
          authorityId: rejected.authorityId,
          reason: rejected.reason,
          ...(parsed.actId !== 'unknown' ? parsed : {}),
        },
      });
    }
    for (const gap of this.arrayValue(input.verificationGaps)) {
      const row = this.asRecord(gap);
      const type = row.type === 'checklist_unmet' ? 'checklist_unmet' : 'citation_metadata';
      candidates.push({
        gapType: type,
        expectedAuthority:
          this.stringValue(row.retrievalTarget) ??
          this.stringValue(row.citation) ??
          this.stringValue(row.label) ??
          'Citation verification metadata',
        detail: row,
      });
    }
    for (const citation of this.arrayValue(input.rejectedCitations)) {
      const row = this.asRecord(citation);
      candidates.push({
        gapType: 'citation_metadata',
        expectedAuthority:
          this.stringValue(row.citation) ??
          this.stringValue(row.authorityId) ??
          'Rejected citation metadata',
        detail: row,
      });
    }
    return candidates;
  }

  private parseStatuteSectionId(id: string, countryCode: string) {
    const prefix = `statute-${countryCode.toLowerCase()}-`;
    const rest = id.startsWith(prefix) ? id.slice(prefix.length) : id;
    const match = rest.match(/^(.+)-s(.+)$/);
    return { actId: match?.[1] ?? 'unknown', section: match?.[2] ?? 'unknown' };
  }

  private fingerprint(value: string): string {
    return createHash('sha256')
      .update(value.trim().toLowerCase().replace(/\s+/g, ' '))
      .digest('hex');
  }

  private normalizeDisplay(value: string): string {
    return value.trim().replace(/\s+/g, ' ').slice(0, 1000);
  }

  private arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
