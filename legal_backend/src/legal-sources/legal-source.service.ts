import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  LEGAL_SOURCE_CONNECTOR_SEEDS,
  LEGAL_SOURCE_COUNTRY_CODES,
} from './legal-source.seed';
import { PRACTICE_AREA_AUTHORITY_SEEDS } from './practice-area-authority.seed';
import { StatuteIngestService } from './statute-ingest.service';
import { OpenSearchAdapterService } from './search/opensearch-adapter.service';
import { LEGAL_INGEST_JOB_TYPES, QUEUE_NAMES } from '@/jobs/jobs.constants';
import {
  listIndiaAbbreviations,
  type IndiaAbbreviationCategory,
} from '@/legal-search/india-legal-abbreviations';
import { ALL_STATUTES, findStatuteById } from '@/legal-search/statute-registry';
import {
  keManifestExists,
  loadKeSourcesManifest,
  resolveKeActEntry,
} from './ke-manifest.loader';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { HybridSearchService } from './search/hybrid-search.service';
import { PRIORITY_STATUTE_SECTIONS } from './statute-sections.seed';
import {
  getActStructure,
  type ActStructureReferenceEntry,
} from './act-structure.loader';
import {
  buildKenyaCaseAuthorityId,
  KenyaLawJudgmentConnector,
  type KenyaLawSearchHit,
} from './connectors/kenya-law-judgment.connector';
import {
  buildEscrAuthorityId,
  EscrConnector,
  isCompleteEscrCaseHit,
  type EscrSearchHit,
} from './connectors/escr.connector';
import {
  buildLicensedAuthorityId,
  LicensedCaseLawConnector,
  type LicensedCaseLawHit,
} from './connectors/licensed-case-law.connector';
import {
  IndiaKanoonConnector,
  type IndiaKanoonResult,
} from './connectors/india-kanoon.connector';
import { AuthorityRecordRegistryService } from './authority-record-registry.service';
import { TreatmentEdgeParserService } from './treatment-edge-parser.service';

/** actId → priority section numbers from hand-written seed corpus */
const PRIORITY_SECTIONS_BY_ACT = (() => {
  const map = new Map<string, string[]>();
  for (const row of PRIORITY_STATUTE_SECTIONS) {
    const key = `${row.countryCode}:${row.actId}`;
    const list = map.get(key) ?? [];
    if (!list.includes(row.section)) list.push(row.section);
    map.set(key, list);
  }
  return map;
})();

function buildSectionAuthorityId(countryCode: string, actId: string, section: string): string {
  return `statute-${countryCode.toLowerCase()}-${actId}-s${section.replace(/\s+/g, '')}`;
}

function parseActIdFromAuthorityId(id: string, countryCode: string): string | null {
  const prefix = `statute-${countryCode.toLowerCase()}-`;
  if (!id.startsWith(prefix)) return null;
  const rest = id.slice(prefix.length);
  const match = rest.match(/^(.+)-s(.+)$/);
  return match?.[1] ?? null;
}

function collectProvisionIdsFromStructure(entry: ActStructureReferenceEntry): string[] {
  const ids: string[] = [];
  const structure = entry.structure;
  if (structure.sections?.ids) {
    ids.push(...structure.sections.ids);
  } else if (structure.articles?.ids) {
    ids.push(...structure.articles.ids);
  }
  if (structure.orders?.ids) {
    for (const orderId of structure.orders.ids) {
      ids.push(`order-${orderId}`);
    }
  }
  if (structure.schedules?.ids) {
    for (const schedId of structure.schedules.ids) {
      ids.push(`schedule-${schedId}`);
    }
  }
  return ids;
}

function resolveCataloguedSectionCount(
  actId: string,
  countryCode: string,
  registrySectionCount: number | null | undefined,
): number {
  if (countryCode === 'IN') {
    const structure = getActStructure(actId);
    if (structure) {
      const fromStructure = collectProvisionIdsFromStructure(structure);
      if (fromStructure.length > 0) return fromStructure.length;
      if (structure.sectionCount > 0) return structure.sectionCount;
    }
  }
  return registrySectionCount ?? 0;
}

export interface CreateLegalSourceInput {
  countryCode: string;
  name: string;
  sourceType: string;
  baseUrl?: string;
  apiAvailable?: boolean;
  scrapingAllowed?: boolean;
  licenseTerms?: string;
  refreshFrequency?: string;
  enabled?: boolean;
}

export interface UpdateLegalSourceInput {
  name?: string;
  sourceType?: string;
  baseUrl?: string;
  apiAvailable?: boolean;
  scrapingAllowed?: boolean;
  licenseTerms?: string;
  refreshFrequency?: string;
  enabled?: boolean;
  chunkCount?: number;
}

export interface IngestLegalAuthorityInput {
  countryCode: string;
  title: string;
  authorityType: string;
  sourceName: string;
  citation?: string;
  jurisdiction?: string;
  court?: string;
  courtLevel?: string;
  sourceUrl?: string;
  sourceLicense?: string;
  fullText?: string;
  summary?: string;
  holding?: string;
  decisionDate?: string;
  topics?: string[];
  practiceAreas?: string[];
  legalSourceId?: string;
}

@Injectable()
export class LegalSourceService {
  private readonly logger = new Logger(LegalSourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly embeddingService: EmbeddingService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly hybridSearch: HybridSearchService,
    private readonly bareActLookup: BareActLookupService,
    private readonly kenyaLawJudgments: KenyaLawJudgmentConnector,
    private readonly escr: EscrConnector,
    private readonly licensedCaseLaw: LicensedCaseLawConnector,
    private readonly indiaKanoon: IndiaKanoonConnector,
    private readonly authorityRegistry: AuthorityRecordRegistryService,
    private readonly treatmentParser: TreatmentEdgeParserService,
    @Optional() private readonly openSearch?: OpenSearchAdapterService,
  ) {}

  async list(filters?: { countryCode?: string; enabled?: boolean }) {
    return this.prisma.legalSource.findMany({
      where: {
        countryCode: filters?.countryCode?.toUpperCase(),
        enabled: filters?.enabled,
      },
      orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const source = await this.prisma.legalSource.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Legal source not found');
    }
    return source;
  }

  async create(input: CreateLegalSourceInput) {
    return this.prisma.legalSource.create({
      data: {
        countryCode: input.countryCode.toUpperCase(),
        name: input.name,
        sourceType: input.sourceType,
        baseUrl: input.baseUrl,
        apiAvailable: input.apiAvailable ?? false,
        scrapingAllowed: input.scrapingAllowed ?? false,
        licenseTerms: input.licenseTerms,
        refreshFrequency: input.refreshFrequency,
        enabled: input.enabled ?? true,
      },
    });
  }

  async update(id: string, input: UpdateLegalSourceInput) {
    await this.findById(id);
    return this.prisma.legalSource.update({
      where: { id },
      data: input,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.legalSource.delete({ where: { id } });
    return { success: true };
  }

  async seedConnectors(countryCodes: string[] = [...LEGAL_SOURCE_COUNTRY_CODES]) {
    const normalized = countryCodes.map((code) => code.toUpperCase());
    const seeds = LEGAL_SOURCE_CONNECTOR_SEEDS.filter((seed) =>
      normalized.includes(seed.countryCode),
    );

    const results = [];
    for (const seed of seeds) {
      const existing = await this.prisma.legalSource.findFirst({
        where: {
          countryCode: seed.countryCode,
          name: seed.name,
        },
      });

      if (existing) {
        const updated = await this.prisma.legalSource.update({
          where: { id: existing.id },
          data: {
            sourceType: seed.sourceType,
            baseUrl: seed.baseUrl,
            apiAvailable: seed.apiAvailable ?? false,
            scrapingAllowed: seed.scrapingAllowed ?? false,
            licenseTerms: seed.licenseTerms,
            refreshFrequency: seed.refreshFrequency,
            enabled: true,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.legalSource.create({
          data: {
            countryCode: seed.countryCode,
            name: seed.name,
            sourceType: seed.sourceType,
            baseUrl: seed.baseUrl,
            apiAvailable: seed.apiAvailable ?? false,
            scrapingAllowed: seed.scrapingAllowed ?? false,
            licenseTerms: seed.licenseTerms,
            refreshFrequency: seed.refreshFrequency,
            enabled: true,
          },
        });
        results.push(created);
      }
    }

    return { seeded: results.length, sources: results };
  }

  async syncSources(countryCode?: string) {
    await this.seedConnectors(countryCode ? [countryCode] : undefined);

    const sources = await this.list({
      countryCode,
      enabled: true,
    });

    const synced = [];
    for (const source of sources) {
      const chunkEstimate = source.apiAvailable ? 250 : 50;
      const updated = await this.prisma.legalSource.update({
        where: { id: source.id },
        data: {
          lastSyncedAt: new Date(),
          chunkCount: source.chunkCount > 0 ? source.chunkCount : chunkEstimate,
        },
      });
      synced.push(updated);

      if (source.name === 'CourtListener' && source.apiAvailable) {
        await this.jobsService.enqueueLegalIngestJob({
          countryCode: source.countryCode,
          query: 'contract dispute',
          limit: 10,
        });
      }
    }

    return {
      syncedAt: new Date().toISOString(),
      count: synced.length,
      sources: synced,
      ingestQueued: countryCode ?? 'ALL',
    };
  }

  private chunkText(text: string, chunkSize = 1200): string[] {
    const normalized = text.trim();
    if (!normalized) return [];
    const chunks: string[] = [];
    for (let index = 0; index < normalized.length; index += chunkSize) {
      chunks.push(normalized.slice(index, index + chunkSize));
    }
    return chunks;
  }

  async ingestAuthority(input: IngestLegalAuthorityInput) {
    const authority = await this.prisma.legalAuthority.create({
      data: {
        countryCode: input.countryCode.toUpperCase(),
        title: input.title,
        authorityType: input.authorityType,
        sourceName: input.sourceName,
        citation: input.citation,
        jurisdiction: input.jurisdiction,
        court: input.court,
        courtLevel: input.courtLevel,
        sourceUrl: input.sourceUrl,
        sourceLicense: input.sourceLicense,
        fullText: input.fullText,
        summary: input.summary,
        holding: input.holding,
        decisionDate: input.decisionDate ? new Date(input.decisionDate) : undefined,
        topics: input.topics ?? [],
        practiceAreas: input.practiceAreas ?? [],
        embeddingStatus: 'PENDING',
      },
    });

    const textParts = this.chunkText(
      [input.title, input.summary ?? '', input.holding ?? '', input.fullText ?? '']
        .filter(Boolean)
        .join('\n'),
    );

    let chunkCount = 0;
    if (textParts.length > 0) {
      const stored = await this.embeddingService.storeChunks(
        textParts.map((content, chunkIndex) => ({
          sourceType: 'LEGAL_AUTHORITY',
          sourceId: authority.id,
          chunkIndex,
          content,
          countryCode: input.countryCode.toUpperCase(),
          jurisdiction: input.jurisdiction,
          modelName: this.embeddingService.getEmbeddingModel(),
        })),
      );
      chunkCount = stored.stored;
      await this.prisma.legalAuthority.update({
        where: { id: authority.id },
        data: { embeddingStatus: chunkCount > 0 ? 'INDEXED' : 'PENDING' },
      });
    }

    if (input.legalSourceId) {
      const source = await this.findById(input.legalSourceId);
      await this.prisma.legalSource.update({
        where: { id: source.id },
        data: {
          chunkCount: source.chunkCount + chunkCount,
          lastSyncedAt: new Date(),
        },
      });
    }

    return {
      authority,
      chunksIndexed: chunkCount,
      ingestedAt: new Date().toISOString(),
    };
  }

  async exportSources(countryCode?: string) {
    const sources = await this.list({ countryCode, enabled: true });
    return {
      exportedAt: new Date().toISOString(),
      countryCode: countryCode?.toUpperCase() ?? 'ALL',
      count: sources.length,
      sources: sources.map((source) => ({
        id: source.id,
        countryCode: source.countryCode,
        name: source.name,
        sourceType: source.sourceType,
        baseUrl: source.baseUrl,
        apiAvailable: source.apiAvailable,
        chunkCount: source.chunkCount,
        lastSyncedAt: source.lastSyncedAt,
        licenseTerms: source.licenseTerms,
      })),
      format: 'json' as const,
      metadata: {
        connectorCountries: LEGAL_SOURCE_COUNTRY_CODES,
      } satisfies Prisma.InputJsonObject,
    };
  }

  /**
   * Seed per-practice-area landmark authorities into the DB and OpenSearch.
   * Idempotent — skips authorities already present by citation.
   */
  async seedPracticeAreaAuthorities(): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const seed of PRACTICE_AREA_AUTHORITY_SEEDS) {
      const existing = await this.prisma.legalAuthority.findFirst({
        where: { citation: seed.citation, countryCode: seed.countryCode },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const authority = await this.prisma.legalAuthority.create({
        data: {
          title: seed.title,
          citation: seed.citation,
          authorityType: seed.authorityType,
          sourceName: seed.sourceName,
          countryCode: seed.countryCode,
          jurisdiction: seed.jurisdiction,
          practiceAreas: seed.practiceAreas as string[],
          topics: [] as string[],
          summary: seed.summary,
          holding: seed.holding,
          sourceUrl: seed.sourceUrl ?? null,
          embeddingStatus: 'PENDING',
        },
      });

      if (this.openSearch?.isEnabled) {
        await this.openSearch.indexAuthority({
          id: authority.id,
          title: authority.title,
          citation: authority.citation,
          fullText: null,
          summary: authority.summary,
          holding: authority.holding,
          sourceName: authority.sourceName,
          countryCode: authority.countryCode,
          jurisdiction: authority.jurisdiction,
          authorityType: authority.authorityType,
          practiceAreas: seed.practiceAreas,
          sourceUrl: authority.sourceUrl,
        });
      }

      seeded++;
    }

    return { seeded, skipped };
  }

  /**
   * Ingest the curated per-practice-area case-law corpus into LegalAuthority and
   * LegalAuthorityRecord. Idempotent (upserts by citation). Called by the admin
   * endpoint POST /legal-sources/ingest-curated-case-law.
   */
  async ingestCuratedCaseLaw(
    options: { reconcile?: boolean } = {},
  ): Promise<{ ingested: number; skipped: number; errors: number }> {
    const { loadIndiaCaselawCorpus } = await import('./load-india-caselaw-corpus');
    const corpus = loadIndiaCaselawCorpus();
    let ingested = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of corpus) {
      try {
        // PDF index entries without a verified reporter/neutral citation are
        // retained in the JSON review queue but never promoted into live legal
        // research or drafting.
        if (entry.extractionConfidence === 'needs_review' || !entry.reviewedByHuman) {
          skipped++;
          continue;
        }
        const existing = await this.prisma.legalAuthority.findFirst({
          where: {
            countryCode: entry.countryCode,
            OR: [
              ...(entry.citation ? [{ citation: { equals: entry.citation, mode: 'insensitive' as const } }] : []),
              ...(entry.neutralCitation
                ? [{ neutralCitation: { equals: entry.neutralCitation, mode: 'insensitive' as const } }]
                : []),
              { title: { equals: entry.title, mode: 'insensitive' as const } },
            ],
          },
          select: { id: true, summary: true, holding: true, fullText: true },
        });
        const fullText = entry.keyParagraphs?.join('\n\n').slice(0, 3000) ?? null;
        const updateData = {
          title: entry.title,
          citation: entry.citation || null,
          neutralCitation: entry.neutralCitation ?? null,
          sourceName: entry.sourceName,
          jurisdiction: entry.jurisdiction,
          court: entry.court,
          courtLevel: entry.courtLevel,
          decisionDate: entry.decisionDate ? new Date(entry.decisionDate) : null,
          practiceAreas: entry.practiceAreas,
          draftKinds: entry.draftKinds,
          topics: entry.topics,
          summary: entry.summary,
          holding: entry.holding ?? null,
          fullText,
          sourceUrl: entry.sourceUrl ?? null,
          treatmentStatus: entry.treatmentStatus,
          reviewedByHuman: entry.reviewedByHuman,
        };

        if (existing) {
          const changed =
            existing.summary !== updateData.summary ||
            existing.holding !== updateData.holding ||
            existing.fullText !== updateData.fullText;
          await this.prisma.legalAuthority.update({
            where: { id: existing.id },
            data: {
              ...updateData,
              ...(options.reconcile && changed ? { embeddingStatus: 'PENDING' } : {}),
            },
          });
        } else {
          await this.prisma.legalAuthority.create({
          data: {
            authorityType: 'CASE_LAW',
            countryCode: entry.countryCode,
            ...updateData,
            embeddingStatus: 'PENDING',
          },
        });
          ingested++;
        }

        // Register both created and reconciled authorities for citation checks.
        await this.prisma.legalAuthorityRecord.upsert({
          where: { id: `india-corpus-${entry.id}` },
          update: {
            title: entry.title,
            citation: entry.citation || null,
            neutralCitation: entry.neutralCitation ?? null,
            currentLawStatus: entry.treatmentStatus,
            reviewedByHuman: entry.reviewedByHuman,
            summary: entry.summary,
            sourceUrl: entry.sourceUrl ?? null,
          },
          create: {
            id: `india-corpus-${entry.id}`,
            jurisdiction: entry.jurisdiction,
            authorityType: 'CASE',
            title: entry.title,
            citation: entry.citation || null,
            neutralCitation: entry.neutralCitation ?? null,
            court: entry.court ?? null,
            sourceName: entry.sourceName,
            sourceUrl: entry.sourceUrl ?? null,
            official: entry.reviewedByHuman,
            reliabilityRank: 1,
            summary: entry.summary,
            currentLawStatus: entry.treatmentStatus,
            reviewedByHuman: entry.reviewedByHuman,
            practiceArea: entry.practiceAreas?.[0] ?? null,
            draftKinds: entry.draftKinds ?? [],
            autoDiscovered: false,
          },
        });

      } catch (err) {
        this.logger.warn(
          `Failed to ingest curated case law "${entry.citation}": ${err instanceof Error ? err.message : String(err)}`,
        );
        errors++;
      }
    }

    return { ingested, skipped, errors };
  }

  async seedStatuteSections(countryCode?: string) {
    return this.statuteIngest.seedPrioritySections(countryCode);
  }

  async ingestStatuteAct(countryCode: string, actId: string) {
    return this.statuteIngest.ingestAct(countryCode, actId);
  }

  async syncTier1Statutes(countryCode?: string) {
    return this.statuteIngest.syncTier1Statutes(countryCode);
  }

  async ingestAllManifestActs(countryCode = 'IN', forceReindex = false) {
    return this.statuteIngest.ingestAllManifestActs(countryCode, { forceReindex });
  }

  async ingestAllUsFederal(forceReindex = false) {
    return this.statuteIngest.ingestAllUsFederal({ forceReindex });
  }

  async ingestAllUsStateManifestActs(forceReindex = false) {
    return this.statuteIngest.ingestAllUsStateManifestActs({ forceReindex });
  }

  async getStatuteIngestStatus(countryCode?: string) {
    return this.statuteIngest.getIngestStatus(countryCode);
  }

  async getIngestJob(jobId: string) {
    const job = await this.prisma.agentJob.findUnique({ where: { id: jobId } });
    if (!job || job.queue !== QUEUE_NAMES.LEGAL_INGEST) {
      throw new NotFoundException('Ingest job not found');
    }

    const payload =
      job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
        ? (job.payload as Record<string, unknown>)
        : {};

    return {
      id: job.id,
      status: job.status,
      jobType: job.jobType,
      error: job.error,
      result: job.result,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      countryCode:
        typeof payload.countryCode === 'string' ? payload.countryCode : undefined,
    };
  }

  async enqueueStatuteIngest(countryCode: string, jobType = LEGAL_INGEST_JOB_TYPES.TIER1_STATUTE_SYNC) {
    return this.jobsService.enqueueLegalIngestJob({
      countryCode: countryCode.toUpperCase(),
      jobType,
    });
  }

  listIndiaLegalAbbreviations(category?: IndiaAbbreviationCategory) {
    return listIndiaAbbreviations(category);
  }

  private async getIndexedSectionCountsByAct(countryCode: string): Promise<Map<string, number>> {
    const code = countryCode.toUpperCase();
    const prefix = `statute-${code.toLowerCase()}-`;
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: code,
        authorityType: 'STATUTE_SECTION',
        id: { startsWith: prefix },
      },
      select: { id: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      const actId = parseActIdFromAuthorityId(row.id, code);
      if (!actId) continue;
      counts.set(actId, (counts.get(actId) ?? 0) + 1);
    }
    return counts;
  }

  async listStatuteRegistry(countryCode: string) {
    const code = countryCode.toUpperCase();
    const indexedByAct = await this.getIndexedSectionCountsByAct(code);

    const registryActs = ALL_STATUTES.filter((s) => s.countryCode === code);
    const registryIds = new Set(registryActs.map((s) => s.id));
    const manifestActs =
      code === 'KE' && keManifestExists()
        ? loadKeSourcesManifest().acts.filter((entry) => !registryIds.has(entry.actId))
        : [];

    const toRow = (s: {
      id: string;
      shortName: string;
      fullName: string;
      countryCode: string;
      acronyms: string[];
      jurisdiction?: string;
      sectionCount?: number;
      practiceAreas?: string[];
    }) => {
      const structure = code === 'IN' ? getActStructure(s.id) : undefined;
      return {
        id: s.id,
        shortName: s.shortName,
        fullName: s.fullName,
        countryCode: s.countryCode,
        acronyms: s.acronyms,
        jurisdiction: s.jurisdiction ?? null,
        sectionCount: s.sectionCount ?? null,
        cataloguedSectionCount: resolveCataloguedSectionCount(
          s.id,
          code,
          s.sectionCount,
        ),
        indexedSectionCount: indexedByAct.get(s.id) ?? 0,
        hasCorpusStructure: !!structure,
        prioritySections:
          PRIORITY_SECTIONS_BY_ACT.get(`${code}:${s.id}`) ?? [],
        practiceAreas: s.practiceAreas ?? [],
      };
    };

    return [
      ...registryActs.map(toRow),
      ...manifestActs.map((entry) => toRow(resolveKeActEntry(entry.actId)!)),
    ].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }

  async listActSections(
    actId: string,
    countryCode: string,
    options: { offset?: number; limit?: number; q?: string } = {},
  ) {
    const code = countryCode.toUpperCase();
    const statute =
      code === 'KE' ? resolveKeActEntry(actId) : findStatuteById(actId);
    if (!statute || statute.countryCode !== code) {
      throw new NotFoundException(`Act ${actId} not found for ${code}`);
    }

    const offset = Math.max(options.offset ?? 0, 0);
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
    const q = (options.q ?? '').trim().toLowerCase();

    let allSectionIds: string[] = [];
    if (code === 'IN') {
      const structure = getActStructure(actId);
      if (structure) {
        allSectionIds = collectProvisionIdsFromStructure(structure);
      }
    }

    if (allSectionIds.length === 0) {
      const prefix = `statute-${code.toLowerCase()}-${actId}-s`;
      const rows = await this.prisma.legalAuthority.findMany({
        where: {
          countryCode: code,
          authorityType: 'STATUTE_SECTION',
          id: { startsWith: prefix },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      allSectionIds = rows
        .map((row) => row.id.match(/-s([^/]+)$/)?.[1] ?? '')
        .filter(Boolean);
    }

    let filtered = allSectionIds;
    if (q) {
      const idMatches = new Set(
        allSectionIds.filter((id) => id.toLowerCase().includes(q)),
      );
      const titleMatches = await this.prisma.legalAuthority.findMany({
        where: {
          countryCode: code,
          authorityType: 'STATUTE_SECTION',
          id: { startsWith: `statute-${code.toLowerCase()}-${actId}-s` },
          title: { contains: q, mode: 'insensitive' },
        },
        select: { id: true },
      });
      for (const row of titleMatches) {
        const section = row.id.match(/-s([^/]+)$/)?.[1];
        if (section) idMatches.add(section);
      }
      filtered = allSectionIds.filter((id) => idMatches.has(id));
    }

    const total = filtered.length;
    const pageIds = filtered.slice(offset, offset + limit);
    const authorityIds = pageIds.map((section) =>
      buildSectionAuthorityId(code, actId, section),
    );
    const authorities = authorityIds.length
      ? await this.prisma.legalAuthority.findMany({
          where: { id: { in: authorityIds } },
          select: { id: true, title: true },
        })
      : [];
    const authorityById = new Map(authorities.map((row) => [row.id, row]));

    return {
      actId,
      countryCode: code,
      total,
      offset,
      limit,
      sections: pageIds.map((section) => {
        const legalAuthorityId = buildSectionAuthorityId(code, actId, section);
        const authority = authorityById.get(legalAuthorityId);
        return {
          section,
          title: authority?.title ?? null,
          indexed: !!authority,
          legalAuthorityId: authority?.id ?? null,
        };
      }),
    };
  }

  async searchAuthorities(query: string, countryCode: string) {
    const normalized = query.trim();
    if (!normalized) {
      return { query: normalized, hybrid: [], statuteSections: [] };
    }

    const code = countryCode.toUpperCase();
    const [hybrid, statuteSections] = await Promise.all([
      this.hybridSearch.search(normalized, { countryCode: code, limit: 12 }),
      this.bareActLookup.lookupSection(normalized, code),
    ]);

    return {
      query: normalized,
      countryCode: code,
      hybrid,
      statuteSections,
    };
  }

  /** Ingest one Kenya judgment (full text + embeddings). Idempotent by FRBR work URI. */
  async ingestKenyaJudgmentHit(
    hit: KenyaLawSearchHit,
    opts: { forceReindex?: boolean; fetchFullText?: boolean } = {},
  ): Promise<{ authorityId: string; chunksStored: number; skipped: boolean }> {
    const authorityId = buildKenyaCaseAuthorityId(hit.id);
    const fetchFullText = opts.fetchFullText ?? true;

    if (!opts.forceReindex) {
      const existing = await this.prisma.legalAuthority.findUnique({
        where: { id: authorityId },
        select: { id: true, embeddingStatus: true },
      });
      if (existing?.embeddingStatus === 'COMPLETED') {
        return { authorityId, chunksStored: 0, skipped: true };
      }
    }

    let fullText = hit.summary ?? '';
    let title = hit.title;
    let citation = hit.citation;
    let court = hit.court;
    let judges = hit.judges;

    if (fetchFullText) {
      const body = await this.kenyaLawJudgments.fetchJudgmentBody(hit.sourceUrl);
      if (body) {
        fullText = body.fullText;
        title = body.title || title;
        citation = body.citation ?? citation;
        court = body.court ?? court;
        if (body.judges.length > 0) judges = body.judges;
      }
    }

    if (fullText.trim().length < 80) {
      const fallback = [title, citation ?? '', hit.caseNumber ?? '', hit.summary ?? '']
        .filter(Boolean)
        .join('\n\n');
      if (fallback.trim().length >= 40) {
        fullText = fallback;
      }
    }

    if (!fullText.trim()) {
      throw new Error(`No judgment text for ${hit.sourceUrl}`);
    }

    const summary = fullText.slice(0, 600);
    const snippetOnly = fullText.trim().length < 80;
    await this.prisma.legalAuthority.upsert({
      where: { id: authorityId },
      create: {
        id: authorityId,
        countryCode: 'KE',
        title,
        citation,
        neutralCitation: citation,
        sourceName: 'Kenya Law',
        sourceUrl: hit.sourceUrl,
        summary,
        fullText: snippetOnly ? null : fullText,
        jurisdiction: court ?? undefined,
        court: court ?? undefined,
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        topics: [
          hit.workFrbrUri,
          ...(judges.length ? [`judges:${judges.join(',')}`] : []),
          ...(snippetOnly ? ['snippet_only'] : []),
        ],
        practiceAreas: [],
        decisionDate: hit.decisionDate ?? undefined,
      },
      update: {
        title,
        citation,
        neutralCitation: citation,
        summary,
        fullText: snippetOnly ? null : fullText,
        sourceUrl: hit.sourceUrl,
        jurisdiction: court ?? undefined,
        court: court ?? undefined,
        decisionDate: hit.decisionDate ?? undefined,
        topics: [
          hit.workFrbrUri,
          ...(judges.length ? [`judges:${judges.join(',')}`] : []),
          ...(snippetOnly ? ['snippet_only'] : []),
        ],
      },
    });

    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += 1200) {
      chunks.push(fullText.slice(i, i + 1200));
    }

    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY' as const,
        sourceId: authorityId,
        chunkIndex,
        content,
        countryCode: 'KE',
        jurisdiction: court ?? undefined,
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });

    return { authorityId, chunksStored: stored.stored, skipped: false };
  }

  /** Sync Kenya case law from RSS feed + topical search queries. */
  async syncKenyaCaseLaw(opts: {
    queries?: string[];
    feedLimit?: number;
    resultsPerQuery?: number;
    forceReindex?: boolean;
  } = {}): Promise<{
    processed: number;
    ingested: number;
    skipped: number;
    errors: string[];
  }> {
    const defaultQueries = [
      'employment unfair dismissal',
      'constitutional petition',
      'contract breach damages',
      'land dispute title',
      'judicial review',
      'criminal appeal',
      'matrimonial property',
      'banking recovery',
    ];
    const queries = opts.queries ?? defaultQueries;
    const feedLimit = opts.feedLimit ?? 100;
    const resultsPerQuery = opts.resultsPerQuery ?? 8;

    const seen = new Set<string>();
    const hits: KenyaLawSearchHit[] = [];

    for (const hit of await this.kenyaLawJudgments.fetchRecentFromFeed(feedLimit)) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }

    for (const query of queries) {
      for (const hit of await this.kenyaLawJudgments.searchJudgments(query, resultsPerQuery)) {
        if (seen.has(hit.id)) continue;
        seen.add(hit.id);
        hits.push(hit);
      }
    }

    let ingested = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const hit of hits) {
      try {
        const result = await this.ingestKenyaJudgmentHit(hit, {
          forceReindex: opts.forceReindex,
        });
        if (result.skipped) {
          skipped += 1;
        } else {
          ingested += 1;
        }
      } catch (err) {
        errors.push(`${hit.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await this.prisma.legalSource.updateMany({
      where: { countryCode: 'KE', name: 'Kenya Law' },
      data: { lastSyncedAt: new Date() },
    });

    return { processed: hits.length, ingested, skipped, errors };
  }

  /** Ingest one e-SCR judgment from AWS Open Data metadata. Idempotent by stable path id. */
  async ingestEscrJudgmentHit(
    hit: EscrSearchHit,
    opts: { forceReindex?: boolean; fetchFullText?: boolean } = {},
  ): Promise<{ authorityId: string; chunksStored: number; skipped: boolean }> {
    if (!isCompleteEscrCaseHit(hit)) {
      throw new Error(`Incomplete e-SCR citation metadata for hit ${hit.id}`);
    }
    const authorityId = buildEscrAuthorityId(hit.id);
    const fetchFullText = opts.fetchFullText ?? true;

    if (!opts.forceReindex) {
      const existing = await this.prisma.legalAuthority.findUnique({
        where: { id: authorityId },
        select: { id: true, embeddingStatus: true },
      });
      if (existing?.embeddingStatus === 'COMPLETED') {
        return { authorityId, chunksStored: 0, skipped: true };
      }
    }

    let fullText = hit.summary ?? '';
    let title = hit.title;
    let citation = hit.citation;
    let neutralCitation = hit.neutralCitation;
    let judges = hit.judges;
    let decisionDate = hit.decisionDate;
    let treatmentHints: string[] = [];

    if (fetchFullText) {
      const body = await this.escr.fetchJudgmentBody(hit);
      if (body) {
        fullText = body.fullText;
        title = body.title || title;
        citation = body.citation ?? citation;
        neutralCitation = body.neutralCitation ?? neutralCitation;
        judges = body.judges.length > 0 ? body.judges : judges;
        decisionDate = body.decisionDate ?? decisionDate;
        treatmentHints = body.treatmentHints;
      }
    }

    if (fullText.trim().length < 80) {
      const fallback = [title, citation ?? '', neutralCitation ?? '', hit.summary ?? '']
        .filter(Boolean)
        .join('\n\n');
      if (fallback.trim().length >= 40) fullText = fallback;
    }
    if (!fullText.trim()) {
      throw new Error(`No judgment text for e-SCR hit ${hit.id}`);
    }

    const summary = fullText.slice(0, 600);
    await this.prisma.legalAuthority.upsert({
      where: { id: authorityId },
      create: {
        id: authorityId,
        countryCode: 'IN',
        title,
        citation,
        neutralCitation,
        sourceName: 'e-SCR',
        sourceUrl: hit.sourceUrl,
        summary,
        jurisdiction: 'IN',
        court: hit.court ?? 'Supreme Court of India',
        courtLevel: 'supreme',
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        topics: [
          hit.metadataPath,
          ...(judges.length ? [`judges:${judges.join(',')}`] : []),
          ...treatmentHints.map((t) => `treatment-hint:${t}`),
        ],
        practiceAreas: [],
        decisionDate: decisionDate ?? undefined,
        reviewedByHuman: false,
      },
      update: {
        title,
        citation,
        neutralCitation,
        summary,
        sourceUrl: hit.sourceUrl,
        court: hit.court ?? 'Supreme Court of India',
        decisionDate: decisionDate ?? undefined,
      },
    });

    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += 1200) {
      chunks.push(fullText.slice(i, i + 1200));
    }

    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY' as const,
        sourceId: authorityId,
        chunkIndex,
        content,
        countryCode: 'IN',
        jurisdiction: hit.court ?? undefined,
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });

    await this.authorityRegistry.registerFromLegalAuthority(authorityId);
    await this.treatmentParser.persistForAuthority(authorityId, fullText);

    return { authorityId, chunksStored: stored.stored, skipped: false };
  }

  /** Bulk sync Supreme Court judgments from e-SCR AWS Open Data. */
  async syncIndiaEscrCaseLaw(opts: {
    years?: number[];
    maxPerYear?: number;
    queries?: string[];
    forceReindex?: boolean;
  } = {}): Promise<{ processed: number; ingested: number; skipped: number; errors: string[] }> {
    const currentYear = new Date().getFullYear();
    const years = opts.years ?? [currentYear, currentYear - 1, currentYear - 2];
    const maxPerYear = opts.maxPerYear ?? 500;
    const seen = new Set<string>();
    const hits: EscrSearchHit[] = [];

    for (const year of years) {
      const files = await this.escr.listMetadataFiles(year);
      for (const file of files.slice(0, maxPerYear)) {
        const hit = await this.escr.fetchMetadata(file, year);
        if (!hit || seen.has(hit.id)) continue;
        seen.add(hit.id);
        hits.push(hit);
      }
    }

    for (const query of opts.queries ?? []) {
      for (const hit of await this.escr.searchJudgments(query, 10)) {
        if (seen.has(hit.id)) continue;
        seen.add(hit.id);
        hits.push(hit);
      }
    }

    let ingested = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const hit of hits) {
      try {
        const result = await this.ingestEscrJudgmentHit(hit, {
          forceReindex: opts.forceReindex,
        });
        if (result.skipped) skipped += 1;
        else ingested += 1;
      } catch (err) {
        errors.push(`${hit.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await this.prisma.legalSource.updateMany({
      where: { countryCode: 'IN', name: 'e-SCR' },
      data: { lastSyncedAt: new Date() },
    });

    return { processed: hits.length, ingested, skipped, errors };
  }

  /** Queue admissible live e-SCR hits for durable full-text ingest and embedding. */
  scheduleEscrPersist(hits: EscrSearchHit[]): void {
    if (hits.length === 0) return;
    void Promise.allSettled(
      hits.map((hit) =>
        this.ingestEscrJudgmentHit(hit, { fetchFullText: true }).catch((err) => {
          this.logger.debug(
            `e-SCR live persist skip ${hit.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          throw err;
        }),
      ),
    );
  }

  /** Persist an India Kanoon hit into LegalAuthority + embeddings (async-safe, idempotent). */
  async ingestIndiaKanoonHit(
    result: IndiaKanoonResult,
    opts: { forceReindex?: boolean; minScore?: number; fetchFullText?: boolean } = {},
  ): Promise<{ authorityId: string; chunksStored: number; skipped: boolean }> {
    const authorityId = result.id.startsWith('ik-') ? result.id : `ik-${result.id}`;
    const fetchFullText = opts.fetchFullText ?? true;

    if (!opts.forceReindex) {
      const existing = await this.prisma.legalAuthority.findUnique({
        where: { id: authorityId },
        select: { id: true, embeddingStatus: true },
      });
      if (existing?.embeddingStatus === 'COMPLETED') {
        return { authorityId, chunksStored: 0, skipped: true };
      }
    }

    let fullText = result.fullText ?? result.summary ?? '';
    if (fetchFullText && (!fullText || fullText.length < 200) && this.indiaKanoon.isConfigured()) {
      const enriched = await this.indiaKanoon.search({
        query: result.citation ?? result.title,
        limit: 1,
        fetchFullText: true,
      });
      if (enriched[0]?.fullText) fullText = enriched[0].fullText;
    }

    if (fullText.trim().length < 40) {
      fullText = [result.title, result.summary ?? '', result.citation ?? ''].filter(Boolean).join('\n');
    }

    await this.prisma.legalAuthority.upsert({
      where: { id: authorityId },
      create: {
        id: authorityId,
        countryCode: 'IN',
        title: result.title,
        citation: result.citation,
        sourceName: 'Indian Kanoon',
        sourceUrl: result.sourceUrl,
        summary: (result.summary ?? fullText).slice(0, 600),
        fullText: fullText.length > 600 ? fullText : undefined,
        jurisdiction: result.court ?? 'India',
        court: result.court ?? undefined,
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        topics: result.treatmentHint ? [`treatment-hint:${result.treatmentHint}`] : [],
        practiceAreas: [],
        decisionDate: result.decisionDate ?? undefined,
      },
      update: {
        title: result.title,
        citation: result.citation,
        summary: (result.summary ?? fullText).slice(0, 600),
        fullText: fullText.length > 600 ? fullText : undefined,
        sourceUrl: result.sourceUrl,
        jurisdiction: result.court ?? 'India',
        court: result.court ?? undefined,
        decisionDate: result.decisionDate ?? undefined,
      },
    });

    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += 1200) {
      chunks.push(fullText.slice(i, i + 1200));
    }

    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY' as const,
        sourceId: authorityId,
        chunkIndex,
        content,
        countryCode: 'IN',
        jurisdiction: result.court ?? undefined,
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });

    await this.authorityRegistry.registerFromLegalAuthority(authorityId);
    if (fullText.length > 200) {
      await this.treatmentParser.persistForAuthority(authorityId, fullText);
    }

    return { authorityId, chunksStored: stored.stored, skipped: false };
  }

  /** Queue async persistence for India Kanoon connector hits (non-blocking). */
  scheduleIndiaKanoonPersist(results: IndiaKanoonResult[]): void {
    if (results.length === 0) return;
    void this.persistIndiaKanoonHits(results).catch((err) => {
      this.logger.warn(`India Kanoon persist batch failed: ${String(err)}`);
    });
  }

  /** Queue async persistence for Kenya Law judgment hits (non-blocking). */
  scheduleKenyaPersist(hits: KenyaLawSearchHit[]): void {
    if (hits.length === 0) return;
    void this.persistKenyaJudgmentHits(hits).catch((err) => {
      this.logger.warn(`Kenya Law persist batch failed: ${String(err)}`);
    });
  }

  async persistKenyaJudgmentHits(
    hits: KenyaLawSearchHit[],
  ): Promise<{ ingested: number; skipped: number }> {
    let ingested = 0;
    let skipped = 0;
    for (const hit of hits) {
      try {
        const row = await this.ingestKenyaJudgmentHit(hit, { fetchFullText: true });
        if (row.skipped) skipped += 1;
        else ingested += 1;
      } catch (err) {
        this.logger.debug(
          `KE persist skip ${hit.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { ingested, skipped };
  }

  async persistIndiaKanoonHits(
    results: IndiaKanoonResult[],
  ): Promise<{ ingested: number; skipped: number }> {
    let ingested = 0;
    let skipped = 0;
    for (const result of results) {
      try {
        const row = await this.ingestIndiaKanoonHit(result);
        if (row.skipped) skipped += 1;
        else ingested += 1;
      } catch (err) {
        this.logger.debug(
          `IK persist skip ${result.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { ingested, skipped };
  }

  /** Ingest licensed SCC/Manupatra/Taxmann hit when API credentials are configured. */
  async ingestLicensedCaseLawHit(
    hit: LicensedCaseLawHit,
    opts: { forceReindex?: boolean } = {},
  ): Promise<{ authorityId: string; chunksStored: number; skipped: boolean }> {
    const authorityId = buildLicensedAuthorityId(hit.id);

    if (!opts.forceReindex) {
      const existing = await this.prisma.legalAuthority.findUnique({
        where: { id: authorityId },
        select: { embeddingStatus: true },
      });
      if (existing?.embeddingStatus === 'COMPLETED') {
        return { authorityId, chunksStored: 0, skipped: true };
      }
    }

    const fullText =
      hit.fullText ??
      [hit.title, hit.summary ?? '', hit.citation ?? ''].filter(Boolean).join('\n\n');
    if (!fullText.trim()) {
      throw new Error(`No text for licensed hit ${hit.id}`);
    }

    const sourceName =
      hit.provider === 'scc'
        ? 'SCC Online'
        : hit.provider === 'manupatra'
          ? 'Manupatra'
          : 'Taxmann';

    await this.prisma.legalAuthority.upsert({
      where: { id: authorityId },
      create: {
        id: authorityId,
        countryCode: 'IN',
        title: hit.title,
        citation: hit.citation,
        neutralCitation: hit.neutralCitation,
        sourceName,
        sourceUrl: hit.sourceUrl,
        sourceLicense: 'Licensed — verify redistribution terms',
        summary: (hit.summary ?? fullText).slice(0, 600),
        fullText: fullText.length > 600 ? fullText : undefined,
        jurisdiction: 'IN',
        court: hit.court ?? undefined,
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        topics: [`provider:${hit.provider}`],
        practiceAreas: hit.practiceAreas,
      },
      update: {
        title: hit.title,
        citation: hit.citation,
        neutralCitation: hit.neutralCitation,
        summary: (hit.summary ?? fullText).slice(0, 600),
        fullText: fullText.length > 600 ? fullText : undefined,
        practiceAreas: hit.practiceAreas,
      },
    });

    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += 1200) {
      chunks.push(fullText.slice(i, i + 1200));
    }

    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY' as const,
        sourceId: authorityId,
        chunkIndex,
        content,
        countryCode: 'IN',
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });

    await this.authorityRegistry.register({
      jurisdiction: 'IN',
      title: hit.title,
      citation: hit.citation,
      neutralCitation: hit.neutralCitation,
      court: hit.court,
      sourceName,
      sourceUrl: hit.sourceUrl,
      summary: hit.summary,
      practiceArea: hit.practiceAreas[0] ?? null,
      official: true,
      reliabilityRank: 1,
      autoDiscovered: false,
    });

    return { authorityId, chunksStored: stored.stored, skipped: false };
  }

  async syncLicensedCaseLaw(opts: {
    practiceAreas?: string[];
    queries?: string[];
    limitPerQuery?: number;
  } = {}): Promise<{ processed: number; ingested: number; skipped: number; errors: string[] }> {
    if (!this.licensedCaseLaw.isConfigured()) {
      return { processed: 0, ingested: 0, skipped: 0, errors: ['Licensed API not configured'] };
    }

    const defaultQueries = [
      'anticipatory bail',
      'negotiable instruments section 138',
      'maintenance crpc 125',
      'consumer deficiency service',
      'insolvency moratorium ibc',
    ];
    const queries = opts.queries ?? defaultQueries;
    const seen = new Set<string>();
    const hits: LicensedCaseLawHit[] = [];

    for (const query of queries) {
      for (const area of opts.practiceAreas ?? [undefined]) {
        for (const hit of await this.licensedCaseLaw.search({
          query,
          practiceArea: area,
          limit: opts.limitPerQuery ?? 10,
        })) {
          if (seen.has(hit.id)) continue;
          seen.add(hit.id);
          hits.push(hit);
        }
      }
    }

    let ingested = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const hit of hits) {
      try {
        const result = await this.ingestLicensedCaseLawHit(hit);
        if (result.skipped) skipped += 1;
        else ingested += 1;
      } catch (err) {
        errors.push(`${hit.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { processed: hits.length, ingested, skipped, errors };
  }
}
