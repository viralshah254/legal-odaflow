import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import { LEGAL_INGEST_JOB_TYPES } from '@/jobs/jobs.constants';
import type { LegalIngestJobPayload } from '@/jobs/jobs.types';
import { configureKenyaLawRateLimit } from './connectors/kenya-law-rate-limit';
import { KenyaLawCatalogConnector } from './connectors/kenya-law-catalog.connector';
import { LawsAfricaConnector } from './connectors/laws-africa.connector';
import { KenyaGazetteConnector } from './connectors/kenya-gazette.connector';
import { KenyaOfficialCollectionsConnector } from './connectors/kenya-official-collections.connector';
import {
  KenyaExtendedCorpusService,
  type KenyaExtendedCollection,
} from './kenya-extended-corpus.service';
import { KenyaSourcePolicyService } from './kenya-source-policy.service';
import { keManifestExists, keManifestPath, loadKeSourcesManifest } from './ke-manifest.loader';
import type { KeManifestActEntry, KeSourcesManifest } from './ke-manifest.types';
import { expressionDate } from './ke-frbr.util';
import { StatuteIngestService } from './statute-ingest.service';
import { LegalSourceService } from './legal-source.service';
import { LegalCorpusRegistryService } from './legal-corpus-registry.service';

export interface KenyaOpsStatus {
  manifest: {
    exists: boolean;
    entryCount: number;
    source: KeSourcesManifest['source'] | null;
    builtAt: string | null;
  };
  coverage: {
    manifestEntries: number;
    actsWithSections: number;
    actsMissing: number;
    meetsTier1Threshold: number;
  };
  judgments: {
    judgmentRows: number;
    judgmentEmbedComplete: number;
    topCourts: Array<{ court: string; count: number }>;
  };
  ingestCursor: number;
  policies: Array<{
    sourceKey: string;
    displayName: string;
    enabled: boolean;
    productionApproved: boolean;
    emergencyDisabledAt: string | null;
    lastReviewedAt: string | null;
  }>;
  lastKenyaLawSync: string | null;
  lastCaseLawSyncAt: string | null;
}

const KENYA_LAW_POLICY = 'KENYA_LAW';
const DEFAULT_BATCH_SIZE = 5;

export interface KeManifestChangeSyncResult {
  source: KeSourcesManifest['source'];
  previousEntryCount: number;
  nextEntryCount: number;
  newWorks: number;
  updatedWorks: number;
  reingested: number;
  supersededExpressions: number;
  errors: string[];
  outPath: string;
}

@Injectable()
export class KenyaIngestOpsService {
  private readonly logger = new Logger(KenyaIngestOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly sourcePolicies: KenyaSourcePolicyService,
    private readonly statuteIngest: StatuteIngestService,
    private readonly legalSourceService: LegalSourceService,
    private readonly kenyaCatalog: KenyaLawCatalogConnector,
    private readonly lawsAfrica: LawsAfricaConnector,
    private readonly gazetteConnector: KenyaGazetteConnector,
    private readonly officialCollections: KenyaOfficialCollectionsConnector,
    private readonly legalCorpusRegistry: LegalCorpusRegistryService,
  ) {}

  async getOperationalStatus(): Promise<KenyaOpsStatus> {
    await this.sourcePolicies.seedDefaults();
    const manifest = keManifestExists() ? loadKeSourcesManifest() : null;
    const ingestStatus = await this.statuteIngest.getIngestStatus('KE');
    const withSections = ingestStatus.acts.filter((act) => act.sectionCount > 0).length;
    const policies = await this.sourcePolicies.listPolicies();
    const kenyaSource = await this.prisma.legalSource.findFirst({
      where: { countryCode: 'KE', name: 'Kenya Law' },
      select: { lastSyncedAt: true },
    });

    const [judgmentRows, judgmentEmbedComplete, courtGroups] = await Promise.all([
      this.prisma.legalAuthority.count({
        where: { countryCode: 'KE', authorityType: 'CASE_LAW' },
      }),
      this.prisma.legalAuthority.count({
        where: {
          countryCode: 'KE',
          authorityType: 'CASE_LAW',
          embeddingStatus: 'COMPLETED',
        },
      }),
      this.prisma.legalAuthority.groupBy({
        by: ['court'],
        where: {
          countryCode: 'KE',
          authorityType: 'CASE_LAW',
          court: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      manifest: {
        exists: !!manifest,
        entryCount: manifest?.acts.length ?? 0,
        source: manifest?.source ?? null,
        builtAt: manifest?.builtAt ?? null,
      },
      coverage: {
        manifestEntries: ingestStatus.acts.length,
        actsWithSections: withSections,
        actsMissing: ingestStatus.acts.length - withSections,
        meetsTier1Threshold: ingestStatus.acts.filter((act) => act.meetsTier1Threshold).length,
      },
      judgments: {
        judgmentRows,
        judgmentEmbedComplete,
        topCourts: courtGroups.map((row) => ({
          court: row.court ?? 'Unknown',
          count: row._count.id,
        })),
      },
      ingestCursor: await this.sourcePolicies.getManifestIngestCursor(),
      policies: policies.map((policy) => ({
        sourceKey: policy.sourceKey,
        displayName: policy.displayName,
        enabled: policy.enabled,
        productionApproved: policy.productionApproved,
        emergencyDisabledAt: policy.emergencyDisabledAt?.toISOString() ?? null,
        lastReviewedAt: policy.lastReviewedAt?.toISOString() ?? null,
      })),
      lastKenyaLawSync: kenyaSource?.lastSyncedAt?.toISOString() ?? null,
      lastCaseLawSyncAt: kenyaSource?.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async pauseSource(sourceKey: string) {
    await this.sourcePolicies.setEnabled(sourceKey, false);
    return { sourceKey, enabled: false };
  }

  async resumeSource(sourceKey: string) {
    await this.sourcePolicies.setEnabled(sourceKey, true, { clearEmergency: true });
    return { sourceKey, enabled: true };
  }

  /** Enable Kenya Law fetch for ingest jobs (does not auto-approve production). */
  async enableKenyaLawIngest(productionApproved = false) {
    await this.sourcePolicies.setEnabled(KENYA_LAW_POLICY, true, {
      clearEmergency: true,
      productionApproved,
    });
    return {
      sourceKey: KENYA_LAW_POLICY,
      enabled: true,
      productionApproved,
    };
  }

  async enqueueKenyaJob(
    jobType: (typeof LEGAL_INGEST_JOB_TYPES)[keyof typeof LEGAL_INGEST_JOB_TYPES],
    payload: Omit<LegalIngestJobPayload, 'countryCode' | 'jobType'> = {},
  ) {
    return this.jobsService.enqueueLegalIngestJob({
      countryCode: 'KE',
      jobType,
      ...payload,
    });
  }

  async runManifestDiscovery(opts: { includeSubsidiary?: boolean; delayMs?: number } = {}) {
    await this.sourcePolicies.assertFetchAllowed(KENYA_LAW_POLICY);
    if (opts.delayMs !== undefined) {
      configureKenyaLawRateLimit(opts.delayMs);
    }

    let acts;
    let source: KeSourcesManifest['source'];
    if (this.lawsAfrica.isEnabled()) {
      acts = await this.lawsAfrica.buildManifestEntries('ke');
      source = 'laws.africa';
    } else {
      acts = await this.kenyaCatalog.buildManifestEntries({
        includeSubsidiary: opts.includeSubsidiary ?? true,
        delayMs: opts.delayMs,
      });
      source = 'kenyalaw.org';
    }

    const manifest: KeSourcesManifest = {
      countryCode: 'KE',
      source,
      builtAt: new Date().toISOString(),
      placeCode: 'ke',
      acts,
    };

    const outPath = keManifestPath();
    mkdirSync(resolve(outPath, '..'), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await this.sourcePolicies.setManifestIngestCursor(0);

    return {
      source,
      entryCount: acts.length,
      outPath,
    };
  }

  /**
   * Rediscover the Kenya Law catalog, merge into the manifest, and re-ingest works
   * whose point-in-time expression (@date) advanced or that are newly listed.
   */
  async runManifestChangeSync(
    opts: { includeSubsidiary?: boolean; delayMs?: number; reingest?: boolean } = {},
  ): Promise<KeManifestChangeSyncResult> {
    await this.sourcePolicies.assertFetchAllowed(KENYA_LAW_POLICY);
    if (opts.delayMs !== undefined) {
      configureKenyaLawRateLimit(opts.delayMs);
    }

    const previous = keManifestExists()
      ? loadKeSourcesManifest()
      : ({
          countryCode: 'KE' as const,
          source: 'kenyalaw.org' as const,
          builtAt: '',
          placeCode: 'ke',
          acts: [],
        } satisfies KeSourcesManifest);

    const previousByWork = new Map(previous.acts.map((entry) => [entry.workFrbrUri, entry]));

    let discovered: KeManifestActEntry[];
    let source: KeSourcesManifest['source'];
    if (this.lawsAfrica.isEnabled()) {
      discovered = await this.lawsAfrica.buildManifestEntries('ke');
      source = 'laws.africa';
    } else {
      discovered = await this.kenyaCatalog.buildManifestEntries({
        includeSubsidiary: opts.includeSubsidiary ?? true,
        delayMs: opts.delayMs,
      });
      source = 'kenyalaw.org';
    }

    const mergedByWork = new Map<string, KeManifestActEntry>();
    for (const entry of previous.acts) {
      mergedByWork.set(entry.workFrbrUri, entry);
    }
    for (const entry of discovered) {
      const existing = mergedByWork.get(entry.workFrbrUri);
      if (!existing) {
        mergedByWork.set(entry.workFrbrUri, entry);
        continue;
      }
      if (expressionDate(entry.expressionFrbrUri) >= expressionDate(existing.expressionFrbrUri)) {
        mergedByWork.set(entry.workFrbrUri, entry);
      }
    }

    const nextActs = [...mergedByWork.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    const manifest: KeSourcesManifest = {
      countryCode: 'KE',
      source,
      builtAt: new Date().toISOString(),
      placeCode: 'ke',
      acts: nextActs,
    };

    const outPath = keManifestPath();
    mkdirSync(resolve(outPath, '..'), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const newWorks: KeManifestActEntry[] = [];
    const updatedWorks: KeManifestActEntry[] = [];

    for (const entry of nextActs) {
      const prev = previousByWork.get(entry.workFrbrUri);
      if (!prev) {
        newWorks.push(entry);
        continue;
      }
      if (
        prev.expressionFrbrUri !== entry.expressionFrbrUri ||
        expressionDate(prev.expressionFrbrUri) < expressionDate(entry.expressionFrbrUri)
      ) {
        updatedWorks.push(entry);
      }
    }

    const result: KeManifestChangeSyncResult = {
      source,
      previousEntryCount: previous.acts.length,
      nextEntryCount: nextActs.length,
      newWorks: newWorks.length,
      updatedWorks: updatedWorks.length,
      reingested: 0,
      supersededExpressions: 0,
      errors: [],
      outPath,
    };

    if (opts.reingest === false) {
      return result;
    }

    for (const entry of [...newWorks, ...updatedWorks]) {
      try {
        if (updatedWorks.includes(entry)) {
          result.supersededExpressions +=
            await this.legalCorpusRegistry.markSupersededKenyaExpressions(
              entry.workFrbrUri,
              entry.expressionFrbrUri,
            );
        }
        const ingestResult = await this.statuteIngest.ingestKeManifestAct(entry, {
          forceReindex: updatedWorks.includes(entry),
        });
        if (ingestResult.sectionsUpserted > 0 || ingestResult.connectorHits > 0) {
          result.reingested += 1;
        }
        result.errors.push(...ingestResult.errors);
      } catch (err) {
        result.errors.push(`${entry.actId}: ${String(err)}`);
      }
    }

    this.logger.log(
      `Kenya manifest change sync: ${result.newWorks} new, ${result.updatedWorks} updated, ${result.reingested} re-ingested`,
    );

    return result;
  }

  async runManifestBatchIngest(payload: LegalIngestJobPayload) {
    await this.sourcePolicies.assertFetchAllowed(KENYA_LAW_POLICY);
    if (!keManifestExists()) {
      throw new BadRequestException(
        'corpus/ke/sources.manifest.json missing — run KE_MANIFEST_DISCOVERY first',
      );
    }

    if (payload.delayMs !== undefined) {
      configureKenyaLawRateLimit(payload.delayMs);
    }

    const manifest = loadKeSourcesManifest();
    const batchSize = Math.max(1, payload.batchSize ?? DEFAULT_BATCH_SIZE);
    const cursor =
      payload.manifestCursor ?? (await this.sourcePolicies.getManifestIngestCursor());
    const slice = manifest.acts.slice(cursor, cursor + batchSize);
    const results = [];

    for (const entry of slice) {
      try {
        results.push(
          await this.statuteIngest.ingestKeManifestAct(entry, {
            forceReindex: payload.forceReindex,
          }),
        );
      } catch (err) {
        results.push({
          countryCode: 'KE',
          actId: entry.actId,
          sectionsUpserted: 0,
          chunksStored: 0,
          connectorHits: 0,
          errors: [`${entry.actId}: ${String(err)}`],
        });
      }
    }

    const nextCursor = cursor + slice.length;
    const done = nextCursor >= manifest.acts.length;
    await this.sourcePolicies.setManifestIngestCursor(done ? 0 : nextCursor);

    let chainedJobId: string | undefined;
    if (!done && payload.chainNextBatch !== false) {
      const queued = await this.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_BATCH_INGEST, {
        manifestCursor: nextCursor,
        batchSize,
        delayMs: payload.delayMs,
        forceReindex: payload.forceReindex,
        chainNextBatch: true,
      });
      chainedJobId = queued.agentJobId;
    }

    return {
      cursor,
      nextCursor: done ? 0 : nextCursor,
      batchSize: slice.length,
      totalEntries: manifest.acts.length,
      done,
      chainedJobId,
      results,
    };
  }

  async runCaseLawSync(payload: LegalIngestJobPayload) {
    await this.sourcePolicies.assertFetchAllowed(KENYA_LAW_POLICY);
    if (payload.delayMs !== undefined) {
      configureKenyaLawRateLimit(payload.delayMs);
    }
    return this.legalSourceService.syncKenyaCaseLaw({
      feedLimit: payload.feedLimit,
      forceReindex: payload.forceReindex,
      queries: payload.queries,
      resultsPerQuery: payload.limit,
    });
  }

  async runGazetteDispatch() {
    await this.sourcePolicies.assertFetchAllowed('KENYA_GAZETTE');
    const entries = await this.gazetteConnector.listArchivePage();
    return {
      status: 'DISPATCHED' as const,
      discoveredIssues: entries.length,
      sample: entries.slice(0, 5).map((entry) => ({
        title: entry.title,
        sourceUrl: entry.sourceUrl,
        gazetteDate: entry.gazetteDate?.toISOString() ?? null,
      })),
      note: 'Gazette issue ingest runs via KenyaGazetteService.ingestIssue when PDFs are approved.',
    };
  }

  async runExtendedCollectionDispatch(collection: KenyaExtendedCollection) {
    const links = await this.officialCollections.discover(collection);
    return {
      status: 'DISPATCHED' as const,
      collection,
      discoveredLinks: links.length,
      sample: links.slice(0, 5),
      note: 'Use KenyaExtendedCorpusService.ingestText for approved documents.',
    };
  }

  async runVerifyCoverage() {
    const status = await this.getOperationalStatus();
    const meetsThreshold = status.coverage.manifestEntries >= 490;
    return {
      ...status.coverage,
      ingestCursor: status.ingestCursor,
      meetsManifestThreshold: meetsThreshold,
    };
  }

  async runReembedAct(actId: string, opts: { delayMs?: number } = {}) {
    await this.sourcePolicies.assertFetchAllowed(KENYA_LAW_POLICY);
    if (!keManifestExists()) {
      throw new BadRequestException('Kenya manifest missing');
    }
    if (opts.delayMs !== undefined) {
      configureKenyaLawRateLimit(opts.delayMs);
    }
    const entry = loadKeSourcesManifest().acts.find((act) => act.actId === actId);
    if (!entry) {
      throw new BadRequestException(`Act ${actId} not found in Kenya manifest`);
    }
    return this.statuteIngest.ingestKeManifestAct(entry, { forceReindex: true });
  }

  /** Exposed for worker routing — validates collection input. */
  parseExtendedCollection(value: string | undefined): KenyaExtendedCollection {
    const allowed: KenyaExtendedCollection[] = [
      'BILLS',
      'COUNTY_LAW',
      'TREATIES',
      'EAC_LAW',
      'REGULATOR',
    ];
    const normalized = value?.toUpperCase() as KenyaExtendedCollection | undefined;
    if (!normalized || !allowed.includes(normalized)) {
      throw new BadRequestException(
        `kenyaCollection must be one of: ${allowed.join(', ')}`,
      );
    }
    return normalized;
  }
}
