import { Controller, Get, Post, Query, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperAdminGuard } from '@/admin/super-admin.guard';
import { LegalSourceService } from './legal-source.service';
import { SectionFinderService } from '@/legal-search/india-section-finder/section-finder.service';
import { UsSectionFinderService } from '@/legal-search/us-section-finder/us-section-finder.service';
import { KeSectionFinderService } from '@/legal-search/ke-section-finder/ke-section-finder.service';
import { SectionFinderResolveService } from './section-finder-resolve.service';
import { SectionFinderAiFallbackService } from '@/legal-search/section-finder-ai-fallback.service';
import type { MatterGraph, MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import { RbiRegulationIngestService } from './connectors/rbi-regulation-ingest.service';
import { KenyaIngestOpsService } from './kenya-ingest-ops.service';
import { LEGAL_INGEST_JOB_TYPES } from '@/jobs/jobs.constants';

@Controller('legal-sources')
export class LegalSourceController {
  constructor(
    private readonly legalSourceService: LegalSourceService,
    private readonly sectionFinderService: SectionFinderService,
    private readonly usSectionFinderService: UsSectionFinderService,
    private readonly keSectionFinderService: KeSectionFinderService,
    private readonly sectionFinderResolve: SectionFinderResolveService,
    private readonly sectionFinderAiFallback: SectionFinderAiFallbackService,
    private readonly prisma: PrismaService,
    private readonly rbiRegulationIngest: RbiRegulationIngestService,
    private readonly kenyaIngestOps: KenyaIngestOpsService,
  ) {}

  @Public()
  @Get()
  list(
    @Query('countryCode') countryCode?: string,
    @Query('enabled') enabled?: string,
  ) {
    return this.legalSourceService.list({
      countryCode,
      enabled: enabled === undefined ? undefined : enabled === 'true',
    });
  }

  @Post('sync')
  @UseGuards(SuperAdminGuard)
  sync(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.syncSources(countryCode);
  }

  @Get('export')
  @UseGuards(SuperAdminGuard)
  export(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.exportSources(countryCode);
  }

  /** POST /legal-sources/seed-authorities — seed per-practice-area landmark authorities */
  @Post('seed-authorities')
  @UseGuards(SuperAdminGuard)
  seedAuthorities() {
    return this.legalSourceService.seedPracticeAreaAuthorities();
  }

  /**
   * POST /legal-sources/ingest-curated-case-law
   * Ingest the curated per-practice-area case-law corpus into LegalAuthority and
   * LegalAuthorityRecord. Idempotent — safe to run multiple times. Admin only.
   */
  @Post('ingest-curated-case-law')
  @UseGuards(SuperAdminGuard)
  ingestCuratedCaseLaw() {
    return this.legalSourceService.ingestCuratedCaseLaw();
  }

  /** Fetch and idempotently embed the verified official RBI regulation manifest. */
  @Post('ingest-rbi-regulations')
  @UseGuards(SuperAdminGuard)
  ingestRbiRegulations(@Query('forceReindex') forceReindex?: string) {
    return this.rbiRegulationIngest.ingest({ forceReindex: forceReindex === 'true' });
  }

  /** POST /legal-sources/ingest-statutes — seed priority sections + sync tier-1 acts */
  @Post('ingest-statutes')
  @UseGuards(SuperAdminGuard)
  ingestStatutes(@Query('countryCode') countryCode?: string) {
    if (countryCode) {
      return this.legalSourceService.enqueueStatuteIngest(countryCode);
    }
    return this.legalSourceService.syncTier1Statutes();
  }

  /** POST /legal-sources/seed-statute-sections — inline seed of priority bare-act sections */
  @Post('seed-statute-sections')
  @UseGuards(SuperAdminGuard)
  seedStatuteSections(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.seedStatuteSections(countryCode);
  }

  @Get('ingest-status')
  @UseGuards(SuperAdminGuard)
  ingestStatus(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.getStatuteIngestStatus(countryCode);
  }

  @Get('ingest-jobs/:jobId')
  ingestJob(@Param('jobId') jobId: string) {
    return this.legalSourceService.getIngestJob(jobId);
  }

  @Get('search')
  searchAuthorities(
    @Query('q') query?: string,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.legalSourceService.searchAuthorities(query ?? '', countryCode ?? 'IN');
  }

  @Get('statute-registry')
  statuteRegistry(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.listStatuteRegistry(countryCode ?? 'IN');
  }

  @Get('statute-registry/:actId/sections')
  statuteRegistrySections(
    @Param('actId') actId: string,
    @Query('countryCode') countryCode?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.legalSourceService.listActSections(actId, countryCode ?? 'IN', {
      offset: offset ? parseInt(offset, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 100,
      q,
    });
  }

  @Public()
  @Get('india-abbreviations')
  indiaAbbreviations(@Query('category') category?: string) {
    const allowed = ['court', 'tribunal', 'statute', 'procedure', 'institution', 'general'] as const;
    const normalized = category?.toLowerCase();
    const filter = allowed.includes(normalized as (typeof allowed)[number])
      ? (normalized as (typeof allowed)[number])
      : undefined;
    return this.legalSourceService.listIndiaLegalAbbreviations(filter);
  }

  /**
   * GET /legal-sources/section-finder?q=420+IPC&countryCode=IN
   * Jurisdiction-aware section lookup (IN / US / KE).
   */
  @Public()
  @Get('section-finder')
  async sectionFinder(
    @Query('q') q: string,
    @Query('countryCode') countryCode = 'IN',
    @Query('locale') locale?: string,
    @Query('jurisdiction') jurisdiction?: string,
    @Query('authorityId') authorityId?: string,
    @Query('actId') actId?: string,
    @Query('section') section?: string,
    @Query('matterId') matterId?: string,
  ) {
    const code = countryCode.toUpperCase();
    let result:
      | Awaited<ReturnType<UsSectionFinderService['find']>>
      | Awaited<ReturnType<KeSectionFinderService['find']>>
      | Awaited<ReturnType<SectionFinderService['find']>>;
    if (code === 'US') {
      result = await this.usSectionFinderService.find({ q, countryCode: 'US', jurisdiction });
    } else if (code === 'KE') {
      result = await this.keSectionFinderService.find({
        q,
        countryCode: 'KE',
        actId,
        section,
      });
    } else if (code !== 'IN') {
      throw new BadRequestException(
        `Section Finder is not available for countryCode=${code}. Supported: IN, US, KE.`,
      );
    } else {
      const snapshot = matterId ? await this.loadMatterMiSnapshot(matterId) : null;
      result = await this.sectionFinderService.find({
        q,
        countryCode: 'IN',
        locale,
        authorityId,
        actId,
        section,
        matterId,
        matterProfile: snapshot?.matterProfile,
        matterGraph: snapshot?.matterGraph,
      });
    }

    const existingAi =
      'aiSuggestions' in result &&
      Array.isArray((result as { aiSuggestions?: unknown[] }).aiSuggestions) &&
      ((result as { aiSuggestions?: unknown[] }).aiSuggestions?.length ?? 0) > 0;
    if ((result.matches?.length ?? 0) === 0 && q?.trim() && !existingAi) {
      const ai = await this.sectionFinderAiFallback.suggest({
        query: q,
        countryCode: code,
      });
      return {
        ...result,
        aiSuggestions: ai.suggestions,
        aiSuggestionModel: ai.modelName,
        aiSuggestionsNote:
          'AI-suggested — not verified. Confirm via corpus/connector before treating as Verified.',
      };
    }
    return result;
  }

  private async loadMatterMiSnapshot(
    matterId: string,
  ): Promise<{ matterProfile?: MatterProfile; matterGraph?: MatterGraph } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ matterProfile: unknown; matterGraph: unknown }>
    >`
      SELECT "matterProfile", "matterGraph"
      FROM "Matter"
      WHERE id = ${matterId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      matterProfile: row.matterProfile as MatterProfile | undefined,
      matterGraph: row.matterGraph as MatterGraph | undefined,
    };
  }

  /**
   * GET /legal-sources/section-finder/suggest?q=42&limit=10
   * Debounced typeahead — DB + in-memory only, no network fetches.
   */
  @Public()
  @Get('section-finder/suggest')
  sectionFinderSuggest(
    @Query('q') q: string,
    @Query('countryCode') countryCode = 'IN',
    @Query('limit') limit = '10',
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);
    const code = countryCode.toUpperCase();
    if (code === 'US') {
      return this.usSectionFinderService.suggest(q, 'US', parsedLimit, jurisdiction);
    }
    if (code === 'KE') {
      return this.keSectionFinderService.suggest(q, 'KE', parsedLimit);
    }
    if (code !== 'IN') {
      throw new BadRequestException(
        `Section Finder suggest is not available for countryCode=${code}. Supported: IN, US, KE.`,
      );
    }
    return this.sectionFinderService.suggest(q, 'IN', parsedLimit);
  }

  /**
   * POST /legal-sources/section-finder/resolve-and-pin
   * Resolve a statute section for drafting pins. Uses Section Finder (incl. on-demand
   * ingest). When allowSoftPin=true and not found, returns an unverified soft pin.
   */
  @Post('section-finder/resolve-and-pin')
  resolveAndPin(
    @Body()
    body: {
      q?: string;
      countryCode?: string;
      actId?: string;
      section?: string;
      allowSoftPin?: boolean;
    },
  ) {
    return this.sectionFinderResolve.resolveAndPin({
      q: body.q ?? '',
      countryCode: body.countryCode ?? 'IN',
      actId: body.actId,
      section: body.section,
      allowSoftPin: body.allowSoftPin === true,
    });
  }

  /**
   * GET /legal-sources/section-finder/popular?countryCode=IN&limit=10
   * Global top searches for dynamic chips.
   */
  @Public()
  @Get('section-finder/popular')
  sectionFinderPopular(
    @Query('countryCode') countryCode = 'IN',
    @Query('limit') limit = '10',
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);
    const code = countryCode.toUpperCase();
    if (code === 'US') {
      return this.usSectionFinderService.getPopular('US', parsedLimit, jurisdiction);
    }
    if (code === 'KE') {
      return this.keSectionFinderService.getPopular('KE', parsedLimit);
    }
    if (code !== 'IN') {
      throw new BadRequestException(
        `Section Finder popular is not available for countryCode=${code}. Supported: IN, US, KE.`,
      );
    }
    return this.sectionFinderService.getPopular('IN', parsedLimit);
  }

  /**
   * GET /legal-sources/section-finder/acts?countryCode=IN
   * Act structure counts from bundled India Code PDFs.
   */
  @Public()
  @Get('section-finder/acts')
  sectionFinderActs(@Query('countryCode') countryCode = 'IN') {
    const code = countryCode.toUpperCase();
    if (code === 'US') {
      return this.usSectionFinderService.listActStructures();
    }
    if (code === 'KE') {
      return this.keSectionFinderService.listActStructures();
    }
    if (code !== 'IN') {
      throw new BadRequestException(
        `Section Finder acts list is not available for countryCode=${code}. Supported: IN, US, KE.`,
      );
    }
    return this.sectionFinderService.listActStructures('IN');
  }

  /**
   * GET /legal-sources/section-finder/list?countryCode=IN
   * Return all section finder entries for browsing / mobile caching.
   */
  @Public()
  @Get('section-finder/list')
  async sectionFinderList(@Query('countryCode') countryCode = 'IN') {
    const code = countryCode.toUpperCase();
    if (code === 'US') {
      return this.usSectionFinderService.list();
    }
    if (code === 'KE') {
      return this.keSectionFinderService.list();
    }
    if (code !== 'IN') {
      throw new BadRequestException(
        `Section Finder list is not available for countryCode=${code}. Supported: IN, US, KE.`,
      );
    }
    return this.sectionFinderService.list('IN');
  }

  /** POST /legal-sources/ingest-all-statutes?countryCode=IN — bulk ingest all manifest acts */
  @Post('ingest-all-statutes')
  ingestAllStatutes(
    @Query('countryCode') countryCode = 'IN',
    @Query('forceReindex') forceReindex?: string,
  ) {
    return this.legalSourceService.ingestAllManifestActs(
      countryCode,
      forceReindex === 'true',
    );
  }

  /** GET /legal-sources/kenya/ops/status — coverage, cursor, and source policy state. */
  @Get('kenya/ops/status')
  @UseGuards(SuperAdminGuard)
  kenyaOpsStatus() {
    return this.kenyaIngestOps.getOperationalStatus();
  }

  @Post('kenya/ops/pause')
  @UseGuards(SuperAdminGuard)
  kenyaPauseSource(@Query('sourceKey') sourceKey: string) {
    return this.kenyaIngestOps.pauseSource(sourceKey);
  }

  @Post('kenya/ops/resume')
  @UseGuards(SuperAdminGuard)
  kenyaResumeSource(@Query('sourceKey') sourceKey: string) {
    return this.kenyaIngestOps.resumeSource(sourceKey);
  }

  @Post('kenya/ops/enable-ingest')
  @UseGuards(SuperAdminGuard)
  kenyaEnableIngest(@Query('productionApproved') productionApproved?: string) {
    return this.kenyaIngestOps.enableKenyaLawIngest(productionApproved === 'true');
  }

  @Post('kenya/ops/enqueue/manifest-discovery')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueManifestDiscovery(
    @Query('includeSubsidiary') includeSubsidiary?: string,
    @Query('delayMs') delayMs?: string,
  ) {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_DISCOVERY, {
      includeSubsidiary: includeSubsidiary !== 'false',
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
    });
  }

  @Post('kenya/ops/enqueue/manifest-ingest')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueManifestIngest(
    @Query('cursor') cursor?: string,
    @Query('batchSize') batchSize?: string,
    @Query('delayMs') delayMs?: string,
    @Query('forceReindex') forceReindex?: string,
  ) {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_BATCH_INGEST, {
      manifestCursor: cursor ? parseInt(cursor, 10) : undefined,
      batchSize: batchSize ? parseInt(batchSize, 10) : undefined,
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
      forceReindex: forceReindex === 'true',
      chainNextBatch: true,
    });
  }

  @Post('kenya/ops/enqueue/change-sync')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueChangeSync(
    @Query('includeSubsidiary') includeSubsidiary?: string,
    @Query('delayMs') delayMs?: string,
    @Query('reingest') reingest?: string,
  ) {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_CHANGE_SYNC, {
      includeSubsidiary: includeSubsidiary !== 'false',
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
      forceReindex: reingest !== 'false',
    });
  }

  @Post('kenya/ops/enqueue/case-law-sync')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueCaseLawSync(
    @Query('feedLimit') feedLimit?: string,
    @Query('delayMs') delayMs?: string,
    @Query('forceReindex') forceReindex?: string,
  ) {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_CASE_LAW_SYNC, {
      feedLimit: feedLimit ? parseInt(feedLimit, 10) : undefined,
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
      forceReindex: forceReindex === 'true',
    });
  }

  @Post('kenya/ops/enqueue/gazette')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueGazetteDispatch() {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_GAZETTE_DISPATCH);
  }

  @Post('kenya/ops/enqueue/extended')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueExtendedDispatch(@Query('collection') collection: string) {
    return this.kenyaIngestOps.enqueueKenyaJob(
      LEGAL_INGEST_JOB_TYPES.KE_EXTENDED_COLLECTION_DISPATCH,
      { kenyaCollection: this.kenyaIngestOps.parseExtendedCollection(collection) },
    );
  }

  @Post('kenya/ops/enqueue/verify')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueVerify() {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_VERIFY_COVERAGE);
  }

  @Post('kenya/ops/enqueue/reembed')
  @UseGuards(SuperAdminGuard)
  kenyaEnqueueReembed(
    @Query('actId') actId: string,
    @Query('delayMs') delayMs?: string,
  ) {
    return this.kenyaIngestOps.enqueueKenyaJob(LEGAL_INGEST_JOB_TYPES.KE_REEMBED_ACT, {
      actId,
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
    });
  }
}
