import { hydrateOfficialDocument } from './connectors/official-document';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { LegalAwareChunkerService } from './legal-aware-chunker.service';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import {
  findStatuteById,
  findStatuteByManifestActId,
  formatSectionCitation,
  getIngestPriorityStatutes,
  getStatutesForCountry,
} from '@/legal-search/statute-registry';
import { IndiaCodeConnector } from './connectors/india-code.connector';
import { IndiaKanoonConnector } from './connectors/india-kanoon.connector';
import { IndiaManifestConnector } from './connectors/india-manifest.connector';
import { LegislativeDeptConnector } from './connectors/legislative-dept.connector';
import { NcrbSankalanConnector } from './connectors/ncrb-sankalan.connector';
import { LegislationGovUkConnector } from './connectors/legislation-gov-uk.connector';
import { KenyaLawConnector } from './connectors/kenya-law.connector';
import { LawsAfricaConnector } from './connectors/laws-africa.connector';
import { expressionDate, frbrUriFromKenyaLawUrl } from './ke-frbr.util';
import { loadKeSourcesManifest, findKeManifestAct, resolveKeActEntry } from './ke-manifest.loader';
import { loadGbSourcesManifest } from './gb-manifest.loader';
import type { KeManifestActEntry } from './ke-manifest.types';
import { UsCodeConnector } from './connectors/us-code.connector';
import { OpenSearchAdapterService } from './search/opensearch-adapter.service';
import { PRIORITY_STATUTE_SECTIONS } from './statute-sections.seed';
import { findManifestAct } from './india-manifest.loader';
import { loadIndiaSourcesManifest } from './india-manifest.loader';
import { getActStructure } from './act-structure.loader';
import type { StatuteSectionFetchResult } from './connectors/us-code.connector';
import type { StatuteEntry } from '@/legal-search/statute-registry/types';
import { UsStateConnector } from './connectors/us-state.connector';
import { EcfRConnector } from './connectors/ecfr.connector';
import { UsLmConnector } from './connectors/uslm.connector';
import { loadAllUsStateManifests } from './us-manifest.loader';
import {
  CFR_TITLE_NUMBERS,
  USC_TITLE_NUMBERS,
} from '@/legal-search/statute-registry/us.statutes.federal-bulk';
import {
  detectRepealStatus,
  isHeadingOnlySection,
  isUsableActSection,
  sectionQualityScore,
} from './parsers/india-act-text.parser';
import { LegalCorpusRegistryService } from './legal-corpus-registry.service';
import { KenyaSourcePolicyService } from './kenya-source-policy.service';
import {
  authorityLevelForKenyaDocument,
  type KenyaDocumentType,
} from './kenya-corpus.types';
import { parseAknProvisionTree } from './parsers/akn-provision-tree.parser';

/** Acts with successful PDF manifest ingest — skip hand-written seed overwrite. */
const MANIFEST_INGEST_ACT_IDS = new Set([
  'bnss',
  'bns',
  'bsa',
  'constitution',
  'crpc',
  'ipc',
  // Personal law acts sourced from Your Lordships mirror (tier-2)
  'hindu-marriage',
  'hindu-adoption',
  'hindu-succession',
  'muslim-dissolution',
  'muslim-marriages-registration',
  'muslim-women-divorce',
  'limitation-act',
  'negotiable-instruments',
]);

export interface IngestSectionInput {
  actId: string;
  countryCode: string;
  section: string;
  title: string;
  summary: string;
  fullText: string;
  sourceName: string;
  sourceUrl?: string;
  practiceAreas?: string[];
  topics?: string[];
  isRepealed?: boolean;
  repealNotes?: string;
}

export interface StatuteIngestResult {
  countryCode: string;
  actId?: string;
  sectionsUpserted: number;
  chunksStored: number;
  connectorHits: number;
  skippedUnchanged?: number;
  errors: string[];
}

export interface ResolvedStatuteSection {
  actId: string;
  countryCode: string;
  section: string;
  title: string;
  summary: string;
  fullText: string;
  sourceName: string;
  sourceUrl?: string;
  fromCache: boolean;
  fromNetwork: boolean;
  /** Number of sections batch-cached alongside the requested one */
  sectionsCached?: number;
}

export function hasCaseTitleContamination(
  section: Pick<IngestSectionInput, 'title' | 'fullText'>,
): boolean {
  const opening = `${section.title}\n${section.fullText}`.slice(0, 800);
  if (/^\s*IN THE (?:SUPREME|HIGH|DISTRICT|SESSIONS|CIVIL|CRIMINAL)\s+COURT/im.test(opening)) {
    return true;
  }
  const firstBodyLine = section.fullText.split('\n').find((line) => line.trim()) ?? '';
  const caseTitlePattern =
    /^\s*[\p{L}][\p{L}\s.'&()-]{1,80}\s+(?:v\.?|vs\.?|versus)\s+[\p{L}]/iu;
  const hasCaseTitle =
    caseTitlePattern.test(section.title) || caseTitlePattern.test(firstBodyLine);
  const hasCaseMetadata =
    /\b(?:petitioner|respondent|appellant|judgment|coram|civil appeal|criminal appeal|SCC|AIR\s+\d{4})\b/i.test(
      opening,
    );
  return hasCaseTitle && hasCaseMetadata;
}

export function shouldPreserveExistingStatuteText(
  existing: Pick<IngestSectionInput, 'title' | 'fullText'>,
  incoming: Pick<IngestSectionInput, 'section' | 'title' | 'fullText' | 'isRepealed'>,
): boolean {
  const existingSection = {
    section: incoming.section,
    title: existing.title,
    fullText: existing.fullText,
  };
  const incomingSection = {
    section: incoming.section,
    title: incoming.title,
    fullText: incoming.fullText,
    isRepealed: incoming.isRepealed,
  };
  return (
    isUsableActSection(existingSection) &&
    (isHeadingOnlySection(incomingSection) ||
      (incoming.fullText.length < existing.fullText.length * 0.25 &&
        sectionQualityScore(incomingSection) < sectionQualityScore(existingSection)))
  );
}

@Injectable()
export class StatuteIngestService {
  private readonly logger = new Logger(StatuteIngestService.name);
  /** Parsed act PDF cache — avoids re-fetching NCRB/PRS PDFs on every section lookup. */
  private readonly actSectionCache = new Map<
    string,
    { sections: StatuteSectionFetchResult[]; fetchedAt: number }
  >();
  private static readonly ACT_CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly indiaCode: IndiaCodeConnector,
    private readonly indiaManifest: IndiaManifestConnector,
    private readonly legislativeDept: LegislativeDeptConnector,
    private readonly ncrb: NcrbSankalanConnector,
    private readonly indiaKanoon: IndiaKanoonConnector,
    private readonly usCode: UsCodeConnector,
    private readonly usState: UsStateConnector,
    private readonly ecfr: EcfRConnector,
    private readonly uslm: UsLmConnector,
    private readonly kenyaLaw: KenyaLawConnector,
    private readonly lawsAfrica: LawsAfricaConnector,
    private readonly legislationGovUk: LegislationGovUkConnector,
    private readonly legalCorpusRegistry: LegalCorpusRegistryService,
    private readonly kenyaSourcePolicy: KenyaSourcePolicyService,
    @Optional() private readonly openSearch?: OpenSearchAdapterService,
    private readonly legalChunker: LegalAwareChunkerService = new LegalAwareChunkerService(),
  ) {}

  buildSectionId(countryCode: string, actId: string, section: string): string {
    return `statute-${countryCode.toLowerCase()}-${actId}-s${section.replace(/\s+/g, '')}`;
  }

  buildCitation(actId: string, section: string): string {
    const statute = findStatuteById(actId);
    if (!statute) {
      return `${actId.toUpperCase()} s.${section}`;
    }
    return formatSectionCitation(statute, section);
  }

  private applyStatuteRepealDefaults(
    statute: StatuteEntry,
    section: Pick<StatuteSectionFetchResult, 'isRepealed' | 'repealNotes'>,
  ): { isRepealed?: boolean; repealNotes?: string } {
    if (section.isRepealed) {
      return { isRepealed: true, repealNotes: section.repealNotes };
    }
    if (statute.status === 'superseded' || statute.status === 'repealed') {
      const successor = statute.repealedBy
        ? findStatuteById(statute.repealedBy)?.shortName ?? statute.repealedBy
        : 'current law';
      return {
        isRepealed: true,
        repealNotes:
          section.repealNotes ??
          `This act is ${statute.status}. See ${successor}${statute.repealYear ? ` (${statute.repealYear})` : ''}.`,
      };
    }
    return { isRepealed: section.isRepealed, repealNotes: section.repealNotes };
  }

  /** Whether an act has a manifest entry (eligible for on-demand fetch). */
  isActInManifest(actId: string, countryCode = 'IN'): boolean {
    if (countryCode.toUpperCase() !== 'IN') return false;
    const statute = findStatuteById(actId);
    const manifestActId = statute?.externalId?.startsWith('manifest/')
      ? statute.externalId.replace('manifest/', '')
      : actId;
    return Boolean(findManifestAct(manifestActId));
  }

  /**
   * Batch-upsert all parsed sections from an act PDF (write-through cache).
   * Returns count of sections upserted (non-skipped).
   */
  async batchUpsertActSections(
    actId: string,
    countryCode: string,
    sections: StatuteSectionFetchResult[],
    opts: {
      sourceUrl?: string;
      manifestActId?: string;
      forceReindex?: boolean;
      deferEmbeddings?: boolean;
    } = {},
  ): Promise<{ upserted: number; skipped: number; total: number }> {
    const code = countryCode.toUpperCase();
    const statute = findStatuteById(actId);
    let upserted = 0;
    let skipped = 0;

    // Fast path for KE recovery: batched authority upserts, no per-section embed round-trips.
    if (opts.forceReindex && opts.deferEmbeddings && sections.length > 0) {
      const BATCH = 75;
      for (let offset = 0; offset < sections.length; offset += BATCH) {
        const chunk = sections.slice(offset, offset + BATCH);
        const ops = [];
        for (const section of chunk) {
          const sectionInput: IngestSectionInput = {
            actId,
            countryCode: code,
            section: section.section,
            title: section.title,
            summary: section.summary,
            fullText: section.fullText,
            sourceName: section.sourceName ?? 'Kenya Law',
            sourceUrl: section.sourceUrl ?? opts.sourceUrl ?? statute?.sourceUrl,
            topics: [actId, ...(statute?.acronyms ?? []), `section-${section.section}`],
            isRepealed: section.isRepealed,
            repealNotes: section.repealNotes,
          };
          if (hasCaseTitleContamination(sectionInput)) {
            this.logger.warn(
              `Skipping contaminated section ${actId} s.${section.section}`,
            );
            continue;
          }
          const citation = this.buildCitation(actId, section.section);
          const id = this.buildSectionId(code, actId, section.section);
          const topics = [
            ...(sectionInput.topics ?? []),
            actId,
            `section-${section.section}`,
            ...(statute?.acronyms ?? []),
          ];
          ops.push(
            this.prisma.legalAuthority.upsert({
              where: { id },
              create: {
                id,
                countryCode: code,
                authorityType: 'STATUTE_SECTION',
                title: sectionInput.title,
                citation,
                sourceName: sectionInput.sourceName,
                sourceUrl: sectionInput.sourceUrl ?? null,
                summary: sectionInput.summary,
                fullText: sectionInput.fullText,
                topics,
                practiceAreas: statute?.practiceAreas ?? [],
                embeddingStatus: 'PENDING',
                isRepealed: sectionInput.isRepealed ?? false,
                repealNotes: sectionInput.repealNotes ?? null,
              },
              update: {
                title: sectionInput.title,
                citation,
                summary: sectionInput.summary,
                fullText: sectionInput.fullText,
                sourceUrl: sectionInput.sourceUrl ?? null,
                topics,
                practiceAreas: statute?.practiceAreas ?? [],
                isRepealed: sectionInput.isRepealed ?? false,
                repealNotes: sectionInput.repealNotes ?? null,
                embeddingStatus: 'PENDING',
              },
            }),
          );
        }
        if (ops.length > 0) {
          await this.prisma.$transaction(ops);
          upserted += ops.length;
        }
      }
    } else {
      for (const section of sections) {
        const sectionInput: IngestSectionInput = {
          actId,
          countryCode: code,
          section: section.section,
          title: section.title,
          summary: section.summary,
          fullText: section.fullText,
          sourceName: section.sourceName ?? 'India manifest (primary PDF)',
          sourceUrl: section.sourceUrl ?? opts.sourceUrl ?? statute?.sourceUrl,
          topics: [actId, ...(statute?.acronyms ?? []), `section-${section.section}`],
          isRepealed: section.isRepealed,
          repealNotes: section.repealNotes,
        };
        try {
          if (opts.forceReindex) {
            await this.upsertSection(sectionInput, {
              deferEmbedding: opts.deferEmbeddings,
            });
            upserted += 1;
          } else {
            const result = await this.upsertSectionIfChanged(sectionInput, {
              deferEmbedding: opts.deferEmbeddings,
            });
            if (result.skipped) {
              skipped += 1;
            } else {
              upserted += 1;
            }
          }
        } catch (err) {
          this.logger.warn(
            `batchUpsertActSections ${actId} s.${section.section}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    const pdfSourceUrl = opts.sourceUrl ?? sections[0]?.sourceUrl ?? statute?.sourceUrl ?? '';
    const pdfSha256 = createHash('sha256')
      .update(sections.map((s) => s.fullText).join('\n'))
      .digest('hex');

    await this.prisma.statuteActCache.upsert({
      where: { id: actId },
      create: {
        id: actId,
        countryCode: code,
        pdfSha256,
        pdfSourceUrl,
        sectionCount: sections.length,
        parsedAt: new Date(),
        lastVerified: new Date(),
        manifestActId: opts.manifestActId ?? actId,
      },
      update: {
        pdfSha256,
        pdfSourceUrl,
        sectionCount: sections.length,
        parsedAt: new Date(),
        lastVerified: new Date(),
        manifestActId: opts.manifestActId ?? actId,
      },
    });

    return { upserted, skipped, total: sections.length };
  }

  async upsertSection(
    input: IngestSectionInput,
    opts: { deferEmbedding?: boolean } = {},
  ): Promise<{ id: string; chunksStored: number }> {
    const statute = findStatuteById(input.actId);
    const citation = this.buildCitation(input.actId, input.section);
    const id = this.buildSectionId(input.countryCode, input.actId, input.section);
    if (hasCaseTitleContamination(input)) {
      throw new Error(`Rejected case-title contamination in statute section ${input.actId} s.${input.section}`);
    }
    const existing = await this.prisma.legalAuthority.findUnique({
      where: { id },
      select: { title: true, fullText: true },
    });
    if (
      existing?.fullText &&
      shouldPreserveExistingStatuteText(
        { title: existing.title, fullText: existing.fullText },
        input,
      )
    ) {
      this.logger.warn(`Preserving substantive existing text for ${input.actId} s.${input.section}`);
      return { id, chunksStored: 0 };
    }
    const topics = [
      ...(input.topics ?? []),
      input.actId,
      `section-${input.section}`,
      ...(statute?.acronyms ?? []),
    ];

    const authority = await this.prisma.legalAuthority.upsert({
      where: { id },
      create: {
        id,
        countryCode: input.countryCode.toUpperCase(),
        authorityType: 'STATUTE_SECTION',
        title: input.title,
        citation,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl ?? statute?.sourceUrl ?? null,
        summary: input.summary,
        fullText: input.fullText,
        topics,
        practiceAreas: input.practiceAreas ?? statute?.practiceAreas ?? [],
        embeddingStatus: 'PENDING',
        isRepealed: input.isRepealed ?? false,
        repealNotes: input.repealNotes ?? null,
      },
      update: {
        title: input.title,
        citation,
        summary: input.summary,
        fullText: input.fullText,
        sourceUrl: input.sourceUrl ?? statute?.sourceUrl ?? null,
        topics,
        practiceAreas: input.practiceAreas ?? statute?.practiceAreas ?? [],
        isRepealed: input.isRepealed ?? false,
        repealNotes: input.repealNotes ?? null,
        embeddingStatus: 'PENDING',
      },
    });

    if (opts.deferEmbedding) {
      return { id: authority.id, chunksStored: 0 };
    }

    const chunks = this.chunkText(
      [input.title, citation, input.summary, input.fullText].filter(Boolean).join('\n\n'),
    );
    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY',
        sourceId: authority.id,
        chunkIndex,
        content,
        countryCode: input.countryCode.toUpperCase(),
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );

    await this.prisma.legalAuthority.update({
      where: { id: authority.id },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });

    if (this.openSearch?.isEnabled) {
      await this.openSearch.indexAuthority({
        id: authority.id,
        title: authority.title,
        citation: authority.citation,
        fullText: authority.fullText,
        summary: authority.summary,
        holding: authority.holding,
        sourceName: authority.sourceName,
        countryCode: authority.countryCode,
        jurisdiction: authority.jurisdiction,
        authorityType: authority.authorityType,
        practiceAreas: (authority.practiceAreas as string[]) ?? [],
        sourceUrl: authority.sourceUrl,
      });
    }

    return { id: authority.id, chunksStored: stored.stored };
  }

  async upsertSectionIfChanged(
    input: IngestSectionInput,
    opts: { deferEmbedding?: boolean } = {},
  ): Promise<{ id: string; chunksStored: number; skipped: boolean }> {
    const id = this.buildSectionId(input.countryCode, input.actId, input.section);
    const contentHash = this.embeddingService.hashContent(input.fullText);

    const existing = await this.prisma.legalAuthority.findUnique({
      where: { id },
      select: { title: true, fullText: true },
    });

    if (existing?.fullText) {
      if (
        shouldPreserveExistingStatuteText(
          { title: existing.title, fullText: existing.fullText },
          input,
        )
      ) {
        return { id, chunksStored: 0, skipped: true };
      }
      const existingHash = this.embeddingService.hashContent(existing.fullText);
      if (existingHash === contentHash) {
        return { id, chunksStored: 0, skipped: true };
      }
    }

    const upserted = await this.upsertSection(input, opts);
    return { ...upserted, skipped: false };
  }

  /**
   * Resolve a single statute section: DB first, then fetch the full act PDF from
   * official sources (NCRB / PRS / India Code manifest) and upsert the section.
   * Used by Section Finder for any BNS/BNSS/BSA/IPC/CrPC/IEA section number.
   */
  async resolveSectionOnDemand(
    actId: string,
    section: string,
    countryCode = 'IN',
  ): Promise<ResolvedStatuteSection | null> {
    const code = countryCode.toUpperCase();
    let statute = findStatuteById(actId);
    if (!statute && code === 'KE') {
      statute = resolveKeActEntry(actId);
    }
    if (!statute || statute.countryCode !== code) {
      return null;
    }

    const manifestActId = statute.externalId?.startsWith('manifest/')
      ? statute.externalId.replace('manifest/', '')
      : actId;

    const id = this.buildSectionId(code, actId, section);
    const existing = await this.prisma.legalAuthority.findUnique({ where: { id } });
    if (existing?.fullText) {
      // Bad corpus metadata: refresh from official manifest when DB says repealed but text is live.
      if (existing.isRepealed && code === 'IN' && findManifestAct(manifestActId)) {
        const refreshed = await this.refreshSectionIfMetadataConflict(
          actId,
          section,
          code,
          manifestActId,
          statute,
        );
        if (refreshed) return refreshed;
      }
      return {
        actId,
        countryCode: code,
        section,
        title: existing.title,
        summary: existing.summary ?? existing.fullText.slice(0, 400),
        fullText: existing.fullText,
        sourceName: existing.sourceName ?? statute.shortName,
        sourceUrl: existing.sourceUrl ?? statute.sourceUrl ?? undefined,
        fromCache: true,
        fromNetwork: false,
      };
    }

    if (code !== 'IN' || !findManifestAct(manifestActId)) {
      if (code === 'US') {
        return this.resolveUsSectionOnDemand(statute, section);
      }
      if (code === 'KE') {
        return this.resolveKeSectionOnDemand(statute, section);
      }
      return null;
    }

    try {
      const sections = await this.loadActSectionsCached(manifestActId, actId);
      const match = this.findSectionInList(sections, section);
      if (!match) {
        this.logger.warn(`Section ${actId} s.${section} not found in manifest (${sections.length} sections parsed)`);
        return null;
      }

      const batch = await this.batchUpsertActSections(actId, code, sections, {
        sourceUrl: match.sourceUrl ?? statute.sourceUrl,
        manifestActId,
      });

      return {
        actId,
        countryCode: code,
        section: match.section,
        title: match.title,
        summary: match.summary,
        fullText: match.fullText,
        sourceName: match.sourceName ?? 'India manifest (primary PDF)',
        sourceUrl: match.sourceUrl ?? statute.sourceUrl ?? undefined,
        fromCache: false,
        fromNetwork: true,
        sectionsCached: batch.total,
      };
    } catch (err) {
      this.logger.error(
        `On-demand section resolve failed for ${actId} s.${section}`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  /** When DB marks a section repealed but official PDF text is operative, refresh metadata. */
  private async refreshSectionIfMetadataConflict(
    actId: string,
    section: string,
    countryCode: string,
    manifestActId: string,
    statute: StatuteEntry,
  ): Promise<ResolvedStatuteSection | null> {
    try {
      const sections = await this.loadActSectionsCached(manifestActId, actId);
      const match = this.findSectionInList(sections, section);
      if (!match?.fullText) return null;
      const repeal = detectRepealStatus(match.fullText);
      if (repeal.isRepealed) return null;

      await this.prisma.legalAuthority.update({
        where: { id: this.buildSectionId(countryCode, actId, section) },
        data: {
          fullText: match.fullText,
          summary: match.summary,
          isRepealed: false,
          repealNotes: null,
          updatedAt: new Date(),
        },
      });
      this.logger.warn(
        `Corpus metadata conflict: ${actId} s.${section} was marked repealed but official text is live — refreshed`,
      );
      return {
        actId,
        countryCode,
        section: match.section,
        title: match.title,
        summary: match.summary,
        fullText: match.fullText,
        sourceName: match.sourceName ?? 'India manifest (primary PDF)',
        sourceUrl: match.sourceUrl ?? statute.sourceUrl ?? undefined,
        fromCache: false,
        fromNetwork: true,
      };
    } catch (err) {
      this.logger.debug(
        `Metadata conflict refresh skipped for ${actId} s.${section}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async resolveUsSectionOnDemand(
    statute: StatuteEntry,
    section: string,
  ): Promise<ResolvedStatuteSection | null> {
    const actId = statute.id;
    const code = 'US';
    let fetched: StatuteSectionFetchResult | null = null;

    if (statute.externalId?.startsWith('usc-title-')) {
      const titleNum = parseInt(statute.externalId.replace('usc-title-', ''), 10);
      fetched = await this.uslm.fetchSection(titleNum, section);
    } else if (statute.externalId?.match(/^usc-\d+/)) {
      const parts = statute.externalId.replace('usc-', '').split('-');
      const titleNum = parseInt(parts[0], 10);
      fetched = await this.uslm.fetchSection(titleNum, section);
    } else if (statute.externalId?.match(/^cfr-\d+/i)) {
      const titleNum = parseInt(statute.externalId.replace(/^cfr-/i, ''), 10);
      fetched = await this.ecfr.fetchSection(titleNum, section);
    }

    if (!fetched) return null;

    const repeal = this.applyStatuteRepealDefaults(statute, fetched);
    await this.upsertSection({
      actId,
      countryCode: code,
      section: fetched.section,
      title: fetched.title,
      summary: fetched.summary,
      fullText: fetched.fullText,
      sourceName: fetched.sourceName ?? 'US federal corpus',
      sourceUrl: fetched.sourceUrl ?? statute.sourceUrl,
      topics: [actId, ...(statute.acronyms ?? [])],
      isRepealed: repeal.isRepealed,
      repealNotes: repeal.repealNotes,
    });

    return {
      actId,
      countryCode: code,
      section: fetched.section,
      title: fetched.title,
      summary: fetched.summary,
      fullText: fetched.fullText,
      sourceName: fetched.sourceName ?? statute.shortName,
      sourceUrl: fetched.sourceUrl ?? statute.sourceUrl ?? undefined,
      fromCache: false,
      fromNetwork: true,
    };
  }

  private async resolveKeOfficialAlternative(statute: StatuteEntry, section: string, entry: import('./ke-manifest.types').KeManifestActEntry): Promise<ResolvedStatuteSection | null> {
    for (const url of entry.alternatePublicUrls ?? []) {
      const document = await hydrateOfficialDocument({ url, country: 'KE', title: statute.fullName });
      const passage = document?.sourcePassages?.find(passage => passage.paragraph === `Section ${section}`);
      if (!passage) continue;
      return { actId: statute.id, countryCode: 'KE', section, title: `${statute.fullName} s.${section}`,
        summary: passage.text.slice(0, 600), fullText: passage.text,
        sourceName: entry.alternateSourceNote ?? 'Kenya official ministry publication',
        sourceUrl: `${document?.sourceUrl ?? url}${passage.page ? `#page=${passage.page}` : ''}`,
        fromCache: false, fromNetwork: true,
      };
    }
    return null;
  }

  private async resolveKeSectionOnDemand(
    statute: StatuteEntry,
    section: string,
  ): Promise<ResolvedStatuteSection | null> {
    const actId = statute.id;
    const code = 'KE';
    const manifestEntry = findKeManifestAct(actId);
    if (!manifestEntry) {
      this.logger.warn(`Kenya manifest entry missing for ${actId}`);
      return null;
    }

    try {
      await this.ingestKeManifestAct(manifestEntry);
    } catch (err) {
      this.logger.error(
        `Kenya on-demand act ingest failed for ${actId}`,
        err instanceof Error ? err.message : String(err),
      );
      return this.resolveKeOfficialAlternative(statute, section, manifestEntry);
    }

    const id = this.buildSectionId(code, actId, section);
    const existing = await this.prisma.legalAuthority.findUnique({ where: { id } });
    if (!existing?.fullText) {
      const alternative = await this.resolveKeOfficialAlternative(statute, section, manifestEntry);
      if (alternative) return alternative;
      const match = await this.prisma.legalAuthority.findFirst({
        where: {
          countryCode: code,
          authorityType: 'STATUTE_SECTION',
          id: { startsWith: `statute-ke-${actId}-s` },
          OR: [
            { citation: { contains: section, mode: 'insensitive' } },
            { title: { contains: `Section ${section}`, mode: 'insensitive' } },
          ],
        },
      });
      if (!match?.fullText) {
        this.logger.warn(`Kenya section ${actId} s.${section} not found after ingest`);
        return null;
      }
      return {
        actId,
        countryCode: code,
        section,
        title: match.title,
        summary: match.summary ?? match.fullText.slice(0, 400),
        fullText: match.fullText,
        sourceName: match.sourceName ?? 'Kenya Law',
        sourceUrl: match.sourceUrl ?? manifestEntry.publicUrl,
        fromCache: false,
        fromNetwork: true,
      };
    }

    return {
      actId,
      countryCode: code,
      section,
      title: existing.title,
      summary: existing.summary ?? existing.fullText.slice(0, 400),
      fullText: existing.fullText,
      sourceName: existing.sourceName ?? 'Kenya Law',
      sourceUrl: existing.sourceUrl ?? manifestEntry.publicUrl,
      fromCache: false,
      fromNetwork: true,
    };
  }

  private normalizeSectionKey(section: string): string {
    return section.toUpperCase().replace(/^0+(?=\d)/, '').replace(/\s+/g, '');
  }

  private findSectionInList(
    sections: StatuteSectionFetchResult[],
    targetSection: string,
  ): StatuteSectionFetchResult | undefined {
    const key = this.normalizeSectionKey(targetSection);
    const exact = sections.find(
      (s) => this.normalizeSectionKey(s.section) === key,
    );
    if (exact) return exact;

    return sections.find((s) => {
      const sk = this.normalizeSectionKey(s.section);
      return sk.startsWith(`${key}(`) || sk.startsWith(`${key}-`);
    });
  }

  private async loadActSectionsCached(
    manifestActId: string,
    registryActId?: string,
  ): Promise<StatuteSectionFetchResult[]> {
    const cached = this.actSectionCache.get(manifestActId);
    if (cached && Date.now() - cached.fetchedAt < StatuteIngestService.ACT_CACHE_TTL_MS) {
      return cached.sections;
    }

    const actId = registryActId ?? manifestActId;
    const actCache = await this.prisma.statuteActCache.findUnique({ where: { id: actId } });
    if (actCache) {
      const dbCount = await this.prisma.legalAuthority.count({
        where: {
          countryCode: 'IN',
          id: { startsWith: `statute-in-${actId}-` },
        },
      });
      if (dbCount >= actCache.sectionCount && actCache.sectionCount > 0) {
        this.logger.log(
          `Act ${actId} already cached in DB (${dbCount}/${actCache.sectionCount} sections) — skipping PDF fetch`,
        );
        return this.sectionsFromDb(actId);
      }
    }

    this.logger.log(`Fetching manifest PDF sections for ${manifestActId}…`);
    const sections = await this.indiaManifest.fetchActSections(manifestActId);
    this.actSectionCache.set(manifestActId, { sections, fetchedAt: Date.now() });
    this.logger.log(`Cached ${sections.length} sections for ${manifestActId}`);
    return sections;
  }

  private async sectionsFromDb(actId: string): Promise<StatuteSectionFetchResult[]> {
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'IN',
        id: { startsWith: `statute-in-${actId}-` },
      },
    });
    return rows.map((row) => {
      const sectionMatch = row.id.match(/-s([^/]+)$/);
      const section = sectionMatch?.[1] ?? row.citation?.replace(/.*s\./, '') ?? '0';
      return {
        section,
        title: row.title,
        summary: row.summary ?? row.fullText?.slice(0, 400) ?? '',
        fullText: row.fullText ?? row.summary ?? '',
        sourceUrl: row.sourceUrl ?? undefined,
        sourceName: row.sourceName,
        isRepealed: row.isRepealed,
        repealNotes: row.repealNotes ?? undefined,
      };
    });
  }

  async seedPrioritySections(countryCode?: string): Promise<StatuteIngestResult> {
    const result: StatuteIngestResult = {
      countryCode: countryCode?.toUpperCase() ?? 'ALL',
      sectionsUpserted: 0,
      chunksStored: 0,
      connectorHits: 0,
      errors: [],
    };

    const seeds = countryCode
      ? PRIORITY_STATUTE_SECTIONS.filter((s) => s.countryCode === countryCode.toUpperCase())
      : PRIORITY_STATUTE_SECTIONS;

    for (const seed of seeds) {
      if (MANIFEST_INGEST_ACT_IDS.has(seed.actId)) {
        const existingCount = await this.prisma.legalAuthority.count({
          where: {
            countryCode: seed.countryCode.toUpperCase(),
            id: { startsWith: `statute-${seed.countryCode.toLowerCase()}-${seed.actId}-` },
          },
        });
        if (existingCount > 10) {
          continue;
        }
      }

      try {
        const { chunksStored } = await this.upsertSection(seed);
        result.sectionsUpserted += 1;
        result.chunksStored += chunksStored;
      } catch (err) {
        result.errors.push(`${seed.actId} s.${seed.section}: ${String(err)}`);
      }
    }

    return result;
  }

  async ingestAct(
    countryCode: string,
    actId: string,
    opts: {
      forceReindex?: boolean;
      bulkMode?: boolean;
      deferEmbeddings?: boolean;
      sectionDepth?: 'index' | 'full';
      fullTextStates?: string[];
    } = {},
  ): Promise<StatuteIngestResult> {
    const code = countryCode.toUpperCase();
    const result: StatuteIngestResult = {
      countryCode: code,
      actId: actId,
      sectionsUpserted: 0,
      chunksStored: 0,
      connectorHits: 0,
      errors: [],
    };

    const statute =
      code === 'IN'
        ? findStatuteByManifestActId(actId, code) ?? findStatuteById(actId)
        : findStatuteById(actId);
    if (!statute || statute.countryCode !== code) {
      result.errors.push(`Unknown act ${actId} for country ${code}`);
      return result;
    }
    const registryActId = statute.id;
    result.actId = registryActId;

    // When registry externalId is 'manifest/<manifestActId>', use the manifest actId
    // for lookups (registry id may differ, e.g. registry 'pocso' → manifest 'pocso-act-2012').
    const manifestActId = statute.externalId?.startsWith('manifest/')
      ? statute.externalId.replace('manifest/', '')
      : findManifestAct(actId)
        ? actId
        : registryActId;

    try {
      if (code === 'IN' && findManifestAct(manifestActId)) {
        this.logger.log(
          `Fetching manifest sections for ${registryActId} (manifest id: ${manifestActId})…`,
        );
        const manifestSections = await this.indiaManifest.fetchActSections(manifestActId);
        result.connectorHits = manifestSections.length;
        this.logger.log(
          `Parsed ${manifestSections.length} sections for ${registryActId}; upserting embeddings…`,
        );

        if (manifestSections.length > 0) {
          let skippedUnchanged = 0;
          for (let i = 0; i < manifestSections.length; i++) {
            const section = manifestSections[i];
            if (i > 0 && i % 25 === 0) {
              this.logger.log(
                `${registryActId}: ${i}/${manifestSections.length} sections processed…`,
              );
            }
            const repeal = this.applyStatuteRepealDefaults(statute, section);
            const sectionInput = {
              actId: registryActId,
              countryCode: code,
              section: section.section,
              title: section.title,
              summary: section.summary,
              fullText: section.fullText,
              sourceName: section.sourceName ?? 'India manifest (primary PDF)',
              sourceUrl: section.sourceUrl ?? statute.sourceUrl,
              topics: [registryActId, ...(statute.acronyms ?? [])],
              isRepealed: repeal.isRepealed,
              repealNotes: repeal.repealNotes,
            };
            try {
              if (opts.forceReindex) {
                const { chunksStored } = await this.upsertSection(sectionInput, {
                  deferEmbedding: opts.deferEmbeddings,
                });
                result.sectionsUpserted += 1;
                result.chunksStored += chunksStored;
              } else {
                const upsert = await this.upsertSectionIfChanged(sectionInput, {
                  deferEmbedding: opts.deferEmbeddings,
                });
                if (upsert.skipped) {
                  skippedUnchanged += 1;
                } else {
                  result.sectionsUpserted += 1;
                  result.chunksStored += upsert.chunksStored;
                }
              }
            } catch (err) {
              result.errors.push(`Manifest section ${section.section}: ${String(err)}`);
            }
          }
          result.skippedUnchanged = opts.forceReindex ? 0 : skippedUnchanged;

          if (registryActId === 'constitution') {
            await this.ingestConstitutionSupplementary(code);
          }

          return result;
        }
      }

      if (code === 'IN' && statute.externalId && this.indiaCode.isEnabled()) {
        const prioritySections = opts.forceReindex
          ? undefined
          : this.indiaCode.resolvePrioritySections(registryActId, { priorityOnly: false });
        const sections = await this.indiaCode.fetchActSections(statute.externalId, {
          prioritySections,
        });
        result.connectorHits = sections.length;

        if (sections.length > 0) {
          let skippedUnchanged = 0;
          for (const section of sections) {
            const repeal = this.applyStatuteRepealDefaults(statute, section);
            const sectionInput = {
              actId: registryActId,
              countryCode: code,
              section: section.section,
              title: section.title,
              summary: section.summary,
              fullText: section.fullText,
              sourceName: 'India Code',
              sourceUrl: section.sourceUrl ?? statute.sourceUrl,
              topics: [registryActId, ...(statute.acronyms ?? [])],
              isRepealed: repeal.isRepealed,
              repealNotes: repeal.repealNotes,
            };
            try {
              if (opts.forceReindex) {
                const { chunksStored } = await this.upsertSection(sectionInput);
                result.sectionsUpserted += 1;
                result.chunksStored += chunksStored;
              } else {
                const upsert = await this.upsertSectionIfChanged(sectionInput);
                if (upsert.skipped) {
                  skippedUnchanged += 1;
                } else {
                  result.sectionsUpserted += 1;
                  result.chunksStored += upsert.chunksStored;
                }
              }
            } catch (err) {
              result.errors.push(`India Code section ${section.section}: ${String(err)}`);
            }
          }
          result.skippedUnchanged = opts.forceReindex ? 0 : skippedUnchanged;
          return result;
        }
      }

      if (code === 'IN' && this.indiaKanoon.isConfigured()) {
        const query = `${statute.fullName} bare act section`;
        const hits = await this.indiaKanoon.search({ query, limit: 10 });
        result.connectorHits = hits.length;
        for (const hit of hits) {
          if (!hit.summary && !hit.title) continue;
          try {
            const sectionGuess = this.extractSectionFromTitle(hit.title);
            const { chunksStored } = await this.upsertSection({
              actId: registryActId,
              countryCode: code,
              section: sectionGuess ?? '0',
              title: hit.title,
              summary: hit.summary ?? hit.title,
              fullText: hit.summary ?? hit.title,
              sourceName: 'Indian Kanoon',
              sourceUrl: hit.sourceUrl,
              topics: [registryActId, ...(statute.acronyms ?? [])],
            });
            result.sectionsUpserted += 1;
            result.chunksStored += chunksStored;
          } catch (err) {
            result.errors.push(`Kanoon hit ${hit.id}: ${String(err)}`);
          }
        }
      } else if (code === 'GB' && statute.externalId) {
        const sections = await this.legislationGovUk.fetchActSections(statute.externalId);
        result.connectorHits = sections.length;
        for (const section of sections.slice(0, 50)) {
          try {
            const { chunksStored } = await this.upsertSection({
              actId,
              countryCode: code,
              section: section.section,
              title: section.title,
              summary: section.summary,
              fullText: section.fullText,
              sourceName: 'legislation.gov.uk',
              sourceUrl: section.sourceUrl,
            });
            result.sectionsUpserted += 1;
            result.chunksStored += chunksStored;
          } catch (err) {
            result.errors.push(`GB section ${section.section}: ${String(err)}`);
          }
        }
      } else if (code === 'KE') {
        const sections = await this.fetchKeActSections(statute, opts.bulkMode ?? false);
        result.connectorHits = sections.length;
        const withRepeal = sections.map((section) => {
          const repeal = this.applyStatuteRepealDefaults(statute, section);
          return {
            ...section,
            sourceName: section.sourceName ?? 'Laws.Africa / Kenya Law',
            sourceUrl: section.sourceUrl ?? statute.sourceUrl,
            isRepealed: repeal.isRepealed,
            repealNotes: repeal.repealNotes,
          };
        });
        const batch = await this.batchUpsertActSections(registryActId, code, withRepeal, {
          sourceUrl: statute.sourceUrl,
          forceReindex: opts.forceReindex,
          deferEmbeddings: opts.deferEmbeddings,
        });
        result.sectionsUpserted = batch.upserted;
        result.skippedUnchanged = batch.skipped;
        result.chunksStored = opts.deferEmbeddings ? 0 : batch.upserted;
      } else if (code === 'US' && statute.externalId) {
        const bulk = opts.bulkMode ?? false;
        const sectionCap = bulk ? 0 : 50;
        let sections: StatuteSectionFetchResult[] = [];
        if (statute.externalId.startsWith('usc-title-') && this.uslm.isEnabled()) {
          const titleNum = parseInt(statute.externalId.replace('usc-title-', ''), 10);
          sections = await this.uslm.fetchTitleSections(titleNum, {
            maxSections: sectionCap,
          });
        } else if (statute.externalId.startsWith('cfr-') && this.ecfr.isEnabled()) {
          sections = await this.ecfr.fetchActSections(statute.externalId, {
            maxSections: sectionCap,
          });
        } else if (statute.jurisdiction) {
          sections = await this.usState.fetchActSections(statute.jurisdiction, registryActId, {
            maxSections: sectionCap,
            sectionDepth: opts.sectionDepth,
            fullTextStates: opts.fullTextStates,
          });
        } else {
          sections = await this.usCode.fetchActSections(statute.externalId, {
            maxSections: sectionCap,
          });
        }
        result.connectorHits = sections.length;
        const toUpsert = bulk ? sections : sections.slice(0, 50);
        let skippedUnchanged = 0;
        for (let i = 0; i < toUpsert.length; i++) {
          const section = toUpsert[i];
          if (bulk && i > 0 && i % 25 === 0) {
            this.logger.log(
              `${registryActId}: ${i}/${toUpsert.length} sections processed…`,
            );
          }
          try {
            const repeal = this.applyStatuteRepealDefaults(statute, section);
            const sectionInput = {
              actId: registryActId,
              countryCode: code,
              section: section.section,
              title: section.title,
              summary: section.summary,
              fullText: section.fullText,
              sourceName: section.sourceName ?? 'Cornell LII',
              sourceUrl: section.sourceUrl,
              isRepealed: repeal.isRepealed,
              repealNotes: repeal.repealNotes,
            };
            if (bulk && !opts.forceReindex) {
              const upsert = await this.upsertSectionIfChanged(sectionInput);
              if (upsert.skipped) {
                skippedUnchanged += 1;
              } else {
                result.sectionsUpserted += 1;
                result.chunksStored += upsert.chunksStored;
              }
            } else {
              const { chunksStored } = await this.upsertSection(sectionInput);
              result.sectionsUpserted += 1;
              result.chunksStored += chunksStored;
            }
          } catch (err) {
            result.errors.push(`US section ${section.section}: ${String(err)}`);
          }
        }
        result.skippedUnchanged = opts.forceReindex ? 0 : skippedUnchanged;
      }
    } catch (err) {
      result.errors.push(String(err));
    }

    return result;
  }

  async syncTier1Statutes(countryCode?: string): Promise<StatuteIngestResult[]> {
    const countries = countryCode
      ? [countryCode.toUpperCase()]
      : (['IN', 'US', 'KE', 'GB'] as const);

    const results: StatuteIngestResult[] = [];

    for (const code of countries) {
      const seedResult = await this.seedPrioritySections(code);
      results.push(seedResult);

      const priorityActs = getIngestPriorityStatutes(code, 2);
      for (const act of priorityActs) {
        const actResult = await this.ingestAct(code, act.id);
        results.push(actResult);
      }
    }

    return results;
  }

  /**
   * Bulk ingest all USC titles (USLM) and CFR titles (eCFR full XML).
   */
  async ingestAllUsFederal(
    opts: { forceReindex?: boolean; minExistingSectionsToSkip?: number } = {},
  ): Promise<StatuteIngestResult[]> {
    const minSkip = opts.minExistingSectionsToSkip ?? 5;
    const results: StatuteIngestResult[] = [];

    for (const titleNum of USC_TITLE_NUMBERS) {
      const actId = `usc-title-${titleNum}`;
      if (!opts.forceReindex) {
        const existingCount = await this.prisma.legalAuthority.count({
          where: {
            countryCode: 'US',
            id: { startsWith: `statute-us-${actId}-` },
          },
        });
        if (existingCount >= minSkip) {
          results.push({
            countryCode: 'US',
            actId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: existingCount,
            skippedUnchanged: existingCount,
            errors: [],
          });
          continue;
        }
      }
      try {
        this.logger.log(`Starting bulk USC ingest ${actId}…`);
        const actResult = await this.ingestAct('US', actId, {
          forceReindex: opts.forceReindex,
          bulkMode: true,
        });
        results.push(actResult);
        this.logger.log(
          `Finished ${actId} — sections=${actResult.sectionsUpserted}, skipped=${actResult.skippedUnchanged ?? 0}, errors=${actResult.errors.length}`,
        );
      } catch (err) {
        results.push({
          countryCode: 'US',
          actId,
          sectionsUpserted: 0,
          chunksStored: 0,
          connectorHits: 0,
          errors: [`${actId}: ${String(err)}`],
        });
      }
    }

    for (const titleNum of CFR_TITLE_NUMBERS) {
      const actId = `cfr-title-${titleNum}`;
      if (!opts.forceReindex) {
        const existingCount = await this.prisma.legalAuthority.count({
          where: {
            countryCode: 'US',
            id: { startsWith: `statute-us-${actId}-` },
          },
        });
        if (existingCount >= minSkip) {
          results.push({
            countryCode: 'US',
            actId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: existingCount,
            skippedUnchanged: existingCount,
            errors: [],
          });
          continue;
        }
      }
      try {
        this.logger.log(`Starting bulk CFR ingest ${actId}…`);
        const actResult = await this.ingestAct('US', actId, {
          forceReindex: opts.forceReindex,
          bulkMode: true,
        });
        results.push(actResult);
        this.logger.log(
          `Finished ${actId} — sections=${actResult.sectionsUpserted}, skipped=${actResult.skippedUnchanged ?? 0}, errors=${actResult.errors.length}`,
        );
      } catch (err) {
        results.push({
          countryCode: 'US',
          actId,
          sectionsUpserted: 0,
          chunksStored: 0,
          connectorHits: 0,
          errors: [`${actId}: ${String(err)}`],
        });
      }
    }

    return results;
  }

  /**
   * Ingest every act listed in corpus/us/states/*.manifest.json.
   */
  async ingestAllUsStateManifestActs(
    opts: {
      forceReindex?: boolean;
      minExistingSectionsToSkip?: number;
      sectionDepth?: 'index' | 'full';
      fullTextStates?: string[];
      stateFilter?: string[];
    } = {},
  ): Promise<StatuteIngestResult[]> {
    const code = 'US';
    const minSkip = opts.minExistingSectionsToSkip ?? 5;
    const results: StatuteIngestResult[] = [];
    const manifests = loadAllUsStateManifests();
    for (const stateManifest of manifests) {
      if (
        opts.stateFilter?.length &&
        !opts.stateFilter.includes(stateManifest.stateCode.toUpperCase())
      ) {
        continue;
      }
      for (const entry of stateManifest.acts) {
        const registryActId = findStatuteById(entry.actId)?.id ?? entry.actId;
        if (!opts.forceReindex) {
          const existingCount = await this.prisma.legalAuthority.count({
            where: {
              countryCode: code,
              id: { startsWith: `statute-${code.toLowerCase()}-${registryActId}-` },
            },
          });
          if (existingCount >= minSkip) {
            results.push({
              countryCode: code,
              actId: registryActId,
              sectionsUpserted: 0,
              chunksStored: 0,
              connectorHits: existingCount,
              skippedUnchanged: existingCount,
              errors: [],
            });
            continue;
          }
        }
        try {
          const actResult = await this.ingestAct(code, registryActId, {
            forceReindex: opts.forceReindex,
            bulkMode: true,
            sectionDepth: opts.sectionDepth,
            fullTextStates: opts.fullTextStates,
          });
          results.push(actResult);
        } catch (err) {
          results.push({
            countryCode: code,
            actId: registryActId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: 0,
            errors: [`${registryActId}: ${String(err)}`],
          });
        }
      }
    }
    return results;
  }

  private async fetchKeActSections(
    statute: StatuteEntry,
    bulkMode: boolean,
  ): Promise<StatuteSectionFetchResult[]> {
    const frbrUri =
      statute.frbrUri ??
      frbrUriFromKenyaLawUrl(statute.sourceUrl ?? '') ??
      undefined;
    const cap = bulkMode ? 0 : 500;

    if (frbrUri && this.lawsAfrica.isEnabled()) {
      const sections = await this.lawsAfrica.fetchActSections(frbrUri);
      if (sections.length > 0) {
        return cap > 0 ? sections.slice(0, cap) : sections;
      }
    }

    if (frbrUri && this.lawsAfrica.isEnabled()) {
      this.logger.warn(
        `Laws.Africa returned 0 sections for ${statute.id}; falling back to Kenya Law HTML`,
      );
    }

    if (statute.sourceUrl) {
      const sections = await this.kenyaLaw.fetchActSections(statute.sourceUrl);
      if (sections.length > 0) {
        return cap > 0 ? sections.slice(0, cap) : sections;
      }
      const pdfDoc = await this.kenyaLaw.fetchActDocumentFromSourcePdf(statute.sourceUrl);
      const pdfSections = pdfDoc?.sections ?? [];
      return cap > 0 ? pdfSections.slice(0, cap) : pdfSections;
    }

    return [];
  }

  async ingestKeManifestAct(
    entry: KeManifestActEntry,
    opts: {
      forceReindex?: boolean;
      deferEmbeddings?: boolean;
      /** Skip LegalCorpusExpression/provision tree (text + LegalAuthority only). */
      textOnly?: boolean;
    } = {},
  ): Promise<StatuteIngestResult> {
    const result: StatuteIngestResult = {
      countryCode: 'KE',
      actId: entry.actId,
      sectionsUpserted: 0,
      chunksStored: 0,
      connectorHits: 0,
      errors: [],
    };

    try {
      await this.kenyaSourcePolicy.seedDefaults();
      let sourceDocument:
        | Awaited<ReturnType<LawsAfricaConnector['fetchActDocument']>>
        | Awaited<ReturnType<KenyaLawConnector['fetchActDocument']>>
        | Awaited<ReturnType<KenyaLawConnector['fetchActDocumentFromSourcePdf']>> = null;
      let sourcePolicyKey = 'KENYA_LAW';
      let extractionMethod: 'XML' | 'HTML' | 'PDF_TEXT' | 'OCR' = 'HTML';
      if (this.lawsAfrica.isEnabled()) {
        sourceDocument = await this.lawsAfrica.fetchActDocument(entry.expressionFrbrUri);
        if (sourceDocument) {
          sourcePolicyKey = 'LAWS_AFRICA_KE';
          extractionMethod = 'XML';
        }
      }
      if (!sourceDocument || sourceDocument.sections.length === 0) {
        sourceDocument = await this.kenyaLaw.fetchActDocument(entry.publicUrl);
        sourcePolicyKey = 'KENYA_LAW';
        extractionMethod = 'HTML';
      }
      if (!sourceDocument || sourceDocument.sections.length === 0) {
        const pdfDoc = await this.kenyaLaw.fetchActDocumentFromSourcePdf(entry.publicUrl);
        if (pdfDoc && pdfDoc.sections.length > 0) {
          sourceDocument = pdfDoc;
          sourcePolicyKey = 'KENYA_LAW';
          extractionMethod = pdfDoc.extractionMethod === 'OCR' ? 'OCR' : 'PDF_TEXT';
        }
      }

      const sections = sourceDocument?.sections ?? [];
      result.connectorHits = sections.length;
      if (sections.length === 0) {
        result.errors.push(`No sections fetched for ${entry.actId}`);
        return result;
      }

      const textOnly = opts.textOnly === true;
      if (!textOnly) {
        const normalizedText = sections
          .map((section) => `${section.title}\n${section.fullText}`)
          .join('\n\n');
        const documentType = kenyaDocumentType(entry);
        const parsedExpressionDate = parseKenyaExpressionDate(
          entry.expressionDate ?? expressionDate(entry.expressionFrbrUri),
        );
        const structuredProvisions =
          sourceDocument &&
          (sourceDocument.mediaType === 'text/html' ||
            sourceDocument.mediaType === 'application/akn+xml' ||
            sourceDocument.mediaType?.includes('xml'))
            ? parseAknProvisionTree(sourceDocument.originalContent)
            : [];
        const pdfSourceUrl =
          extractionMethod === 'PDF_TEXT' || extractionMethod === 'OCR'
            ? `${entry.publicUrl.replace(/\/+$/, '')}/source.pdf`
            : entry.publicUrl;
        const canonical = await this.legalCorpusRegistry.ingestKenyaExpression({
          workUri: entry.workFrbrUri,
          expressionUri: entry.expressionFrbrUri,
          expressionDate: parsedExpressionDate,
          title: entry.title,
          actNumber: entry.number,
          year: entry.year ? Number(entry.year) : undefined,
          documentType,
          authorityLevel:
            sourcePolicyKey === 'KENYA_LAW'
              ? authorityLevelForKenyaDocument(documentType)
              : 'SECONDARY',
          status: 'UNKNOWN',
          officialSource: sourcePolicyKey === 'KENYA_LAW',
          sourceUrl: pdfSourceUrl,
          sourceName:
            extractionMethod === 'PDF_TEXT' || extractionMethod === 'OCR'
              ? 'Kenya Law (source.pdf)'
              : sourcePolicyKey === 'KENYA_LAW'
                ? 'Kenya Law'
                : 'Laws.Africa / Kenya Law',
          sourcePolicyKey,
          parserVersion:
            extractionMethod === 'PDF_TEXT' || extractionMethod === 'OCR'
              ? 'ke-pdf-v1'
              : 'ke-akn-v2',
          extractionMethod,
          verificationStatus: sourceDocument?.complete ? 'PENDING' : 'QUARANTINED',
          originalContent: sourceDocument
            ? Buffer.from(sourceDocument.originalContent, 'utf8')
            : undefined,
          originalMediaType: sourceDocument?.mediaType,
          normalizedText,
          searchText: normalizedText,
          citationSafeText: normalizedText,
          provisions:
            structuredProvisions.length > 0
              ? structuredProvisions
              : sections.map((section, index) => ({
                  provisionKey: `section:${section.section}`,
                  provisionType:
                    documentType === 'CONSTITUTION' ? 'ARTICLE' : 'SECTION',
                  label: section.section,
                  heading: section.title,
                  ordinal: index,
                  text: section.fullText,
                  citationSafeText: section.fullText,
                  sourceAnchor: section.sourceUrl,
                })),
          metadata: {
            actId: entry.actId,
            nature: entry.nature,
            complete: sourceDocument?.complete ?? false,
          },
        });

        const batch = await this.batchUpsertActSections(entry.actId, 'KE', sections, {
          sourceUrl: entry.publicUrl,
          manifestActId: entry.actId,
          forceReindex: opts.forceReindex,
          deferEmbeddings: opts.deferEmbeddings,
        });
        const canonicalSections = await this.prisma.legalCorpusProvision.findMany({
          where: {
            expressionId: canonical.expressionId,
            label: { in: sections.map((section) => section.section) },
          },
          select: { id: true, label: true },
        });
        const provisionByLabel = new Map(
          canonicalSections.map((provision) => [provision.label, provision.id]),
        );
        for (const section of sections) {
          const corpusProvisionId = provisionByLabel.get(section.section);
          if (!corpusProvisionId) continue;
          await this.prisma.legalAuthority.updateMany({
            where: {
              id: this.buildSectionId('KE', entry.actId, section.section),
              corpusProvisionId: null,
            },
            data: { corpusProvisionId },
          });
        }

        result.sectionsUpserted = batch.upserted;
        result.skippedUnchanged = batch.skipped;
        result.chunksStored = batch.upserted;
      } else {
        const batch = await this.batchUpsertActSections(entry.actId, 'KE', sections, {
          sourceUrl: entry.publicUrl,
          manifestActId: entry.actId,
          forceReindex: opts.forceReindex ?? true,
          deferEmbeddings: true,
        });
        result.sectionsUpserted = batch.upserted;
        result.skippedUnchanged = batch.skipped;
        result.chunksStored = 0;
      }
    } catch (err) {
      result.errors.push(`${entry.actId}: ${String(err)}`);
    }

    return result;
  }

  /**
   * Ingest every act listed in corpus/in/sources.manifest.json into LegalAuthority.
   * Skips acts that already have a substantial section count unless forceReindex is set.
   */
  async ingestAllManifestActs(
    countryCode = 'IN',
    opts: { forceReindex?: boolean; minExistingSectionsToSkip?: number } = {},
  ): Promise<StatuteIngestResult[]> {
    const code = countryCode.toUpperCase();
    const minSkip = opts.minExistingSectionsToSkip ?? 5;

    if (code === 'US') {
      const federal = await this.ingestAllUsFederal(opts);
      const state = await this.ingestAllUsStateManifestActs(opts);
      return [...federal, ...state];
    }

    if (code === 'KE') {
      const manifest = loadKeSourcesManifest();
      const results: StatuteIngestResult[] = [];

      for (const entry of manifest.acts) {
        if (!opts.forceReindex) {
          const existingExpression = await this.prisma.legalCorpusExpression.findUnique({
            where: { expressionUri: entry.expressionFrbrUri },
            select: {
              id: true,
              _count: { select: { provisions: true } },
            },
          });
          if (
            existingExpression &&
            existingExpression._count.provisions >= minSkip
          ) {
            results.push({
              countryCode: code,
              actId: entry.actId,
              sectionsUpserted: 0,
              chunksStored: 0,
              connectorHits: existingExpression._count.provisions,
              skippedUnchanged: existingExpression._count.provisions,
              errors: [],
            });
            continue;
          }
        }

        try {
          results.push(await this.ingestKeManifestAct(entry, opts));
        } catch (err) {
          results.push({
            countryCode: code,
            actId: entry.actId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: 0,
            errors: [`${entry.actId}: ${String(err)}`],
          });
        }
      }

      return results;
    }

    if (code === 'GB') {
      const manifest = loadGbSourcesManifest();
      const results: StatuteIngestResult[] = [];

      for (const entry of manifest.acts) {
        if (!opts.forceReindex) {
          const existingCount = await this.prisma.legalAuthority.count({
            where: {
              countryCode: code,
              id: { startsWith: `statute-gb-${entry.actId}-` },
            },
          });
          if (existingCount >= minSkip) {
            results.push({
              countryCode: code,
              actId: entry.actId,
              sectionsUpserted: 0,
              chunksStored: 0,
              connectorHits: existingCount,
              skippedUnchanged: existingCount,
              errors: [],
            });
            continue;
          }
        }

        try {
          results.push(await this.ingestAct(code, entry.actId, opts));
        } catch (err) {
          results.push({
            countryCode: code,
            actId: entry.actId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: 0,
            errors: [`${entry.actId}: ${String(err)}`],
          });
        }
      }

      return results;
    }

    if (code !== 'IN') {
      return [];
    }

    const manifest = loadIndiaSourcesManifest();
    const results: StatuteIngestResult[] = [];

    for (const entry of manifest.acts) {
      const manifestActId = entry.actId;
      const registryActId =
        findStatuteByManifestActId(manifestActId, code)?.id ?? manifestActId;

      if (!opts.forceReindex) {
        const existingCount = await this.prisma.legalAuthority.count({
          where: {
            countryCode: code,
            id: { startsWith: `statute-${code.toLowerCase()}-${registryActId}-` },
          },
        });
        if (existingCount >= minSkip) {
          results.push({
            countryCode: code,
            actId: registryActId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: existingCount,
            skippedUnchanged: existingCount,
            errors: [],
          });
          continue;
        }
      }

      try {
        const actResult = await this.ingestAct(code, registryActId, {
          forceReindex: opts.forceReindex,
        });
        results.push(actResult);
      } catch (err) {
        results.push({
          countryCode: code,
          actId: registryActId,
          sectionsUpserted: 0,
          chunksStored: 0,
          connectorHits: 0,
          errors: [`${registryActId}: ${String(err)}`],
        });
      }
    }

    return results;
  }

  async getIngestStatus(countryCode?: string) {
    const code = countryCode?.toUpperCase();
    const where = code
      ? { countryCode: code, authorityType: 'STATUTE_SECTION' as const }
      : { authorityType: 'STATUTE_SECTION' as const };

    const grouped = await this.prisma.legalAuthority.groupBy({
      by: ['countryCode'],
      where,
      _count: { id: true },
    });

    if (code !== 'IN' && code !== 'KE') {
      return { summary: grouped, acts: [] };
    }

    if (code === 'KE') {
      const manifest = loadKeSourcesManifest();
      const prefix = 'statute-ke-';
      const rows = await this.prisma.legalAuthority.findMany({
        where: {
          countryCode: 'KE',
          authorityType: 'STATUTE_SECTION',
          id: { startsWith: prefix },
        },
        select: { id: true, sourceName: true, sourceUrl: true, updatedAt: true },
      });

      const countByAct = new Map<string, number>();
      const latestByAct = new Map<
        string,
        { updatedAt: Date; sourceName: string | null; sourceUrl: string | null }
      >();

      for (const row of rows) {
        const rest = row.id.slice(prefix.length);
        const match = rest.match(/^(.+)-s(.+)$/);
        const actId = match?.[1];
        if (!actId) continue;

        countByAct.set(actId, (countByAct.get(actId) ?? 0) + 1);
        const existing = latestByAct.get(actId);
        if (!existing || row.updatedAt > existing.updatedAt) {
          latestByAct.set(actId, {
            updatedAt: row.updatedAt,
            sourceName: row.sourceName,
            sourceUrl: row.sourceUrl,
          });
        }
      }

      const acts = manifest.acts.map((entry) => {
        const count = countByAct.get(entry.actId) ?? 0;
        const latest = latestByAct.get(entry.actId);
        return {
          actId: entry.actId,
          sectionCount: count,
          cataloguedSectionCount: null,
          lastIngestAt: latest?.updatedAt?.toISOString() ?? null,
          sourceName: latest?.sourceName ?? null,
          sourceUrl: latest?.sourceUrl ?? entry.publicUrl ?? null,
          manifestSource: manifest.source,
          meetsTier1Threshold: count >= 20,
        };
      });

      return { summary: grouped, acts };
    }

    const prefix = 'statute-in-';
    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'IN',
        authorityType: 'STATUTE_SECTION',
        id: { startsWith: prefix },
      },
      select: {
        id: true,
        sourceName: true,
        sourceUrl: true,
        updatedAt: true,
      },
    });

    const countByAct = new Map<string, number>();
    const latestByAct = new Map<
      string,
      { updatedAt: Date; sourceName: string | null; sourceUrl: string | null }
    >();

    for (const row of rows) {
      const rest = row.id.slice(prefix.length);
      const match = rest.match(/^(.+)-s(.+)$/);
      const actId = match?.[1];
      if (!actId) continue;

      countByAct.set(actId, (countByAct.get(actId) ?? 0) + 1);
      const existing = latestByAct.get(actId);
      if (!existing || row.updatedAt > existing.updatedAt) {
        latestByAct.set(actId, {
          updatedAt: row.updatedAt,
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl,
        });
      }
    }

    const acts = getStatutesForCountry('IN').map((statute) => {
      const actId = statute.id;
      const count = countByAct.get(actId) ?? 0;
      const latest = latestByAct.get(actId);
      const manifest = findManifestAct(actId);
      const structure = getActStructure(actId);
      const cataloguedSectionCount =
        structure?.sectionCount ?? statute.sectionCount ?? null;

      return {
        actId,
        sectionCount: count,
        cataloguedSectionCount,
        lastIngestAt: latest?.updatedAt?.toISOString() ?? null,
        sourceName: latest?.sourceName ?? null,
        sourceUrl: latest?.sourceUrl ?? manifest?.primaryPdfUrl ?? null,
        manifestSource: manifest?.sourceAuthority ?? null,
        meetsTier1Threshold: count >= (actId === 'constitution' ? 50 : 20),
      };
    });

    return { summary: grouped, acts };
  }

  private async ingestConstitutionSupplementary(countryCode: string): Promise<void> {
    const entry = findManifestAct('constitution');
    for (const supp of entry?.supplementaryAuthorities ?? []) {
      const id = `statute-${countryCode.toLowerCase()}-${supp.id}`;
      await this.prisma.legalAuthority.upsert({
        where: { id },
        create: {
          id,
          countryCode,
          authorityType: 'NOTIFICATION',
          title: supp.title,
          citation: supp.amendment ?? supp.title,
          sourceName: supp.sourceName,
          sourceUrl: supp.sourceUrl,
          summary: supp.summary,
          fullText: supp.fullText ?? supp.summary,
          topics: ['constitution', supp.id, '106th-amendment'],
          practiceAreas: ['constitutional'],
          embeddingStatus: 'PENDING',
        },
        update: {
          title: supp.title,
          summary: supp.summary,
          fullText: supp.fullText ?? supp.summary,
          sourceUrl: supp.sourceUrl,
        },
      });
    }
  }

  private extractSectionFromTitle(title: string): string | undefined {
    const match = title.match(/\b(?:section|s\.?|sec\.?)\s*(\d+[A-Za-z]?)\b/i);
    return match?.[1];
  }

  /**
   * Splits legal text along structural boundaries (sections, sub-sections,
   * schedules, paragraphs) rather than fixed character counts.
   * Falls back to sentence-boundary splitting when no structure is detected.
   */
  private chunkText(text: string, _chunkSize = 1200): string[] {
    return this.legalChunker.chunkToStrings(text);
  }
}

function kenyaDocumentType(entry: KeManifestActEntry): KenyaDocumentType {
  switch (entry.nature) {
    case 'constitution':
      return 'CONSTITUTION';
    case 'legal_notice':
      return 'LEGAL_NOTICE';
    case 'gazette_notice':
      return 'GAZETTE_NOTICE';
    case 'corrigenda':
      return 'OTHER';
    default:
      return 'ACT';
  }
}

function parseKenyaExpressionDate(value: string | undefined): Date | undefined {
  if (!value || value === '0000-00-00') return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}
