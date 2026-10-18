import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import {
  findGooglePlacesCountry,
  listGooglePlacesCountryCodes,
  parseGooglePlacesSourceSummary,
} from './google-places/cities.config';
import { resolveGooglePlacesLocation } from './google-places/location-resolver';
import {
  type GooglePlacesScrapeProgress,
  emptyGooglePlacesProgress,
  isGooglePlacesRunCancelled,
  parseGooglePlacesProgress,
  totalGooglePlacesBatches,
  type GooglePlacesScrapeMode,
} from './google-places/scrape-progress';
import { CreateLawyerProspectDto } from './dto/create-lawyer-prospect.dto';
import { formatPersonName, splitFullName } from './prospect-prefill.util';
import { getCountryConfig } from '@/config/countries';

const CSV_HEADERS = [
  'id',
  'full_name',
  'first_name',
  'last_name',
  'organisation',
  'practice_areas',
  'city',
  'state',
  'country',
  'phone',
  'alternate_phone',
  'whatsapp',
  'whatsapp_confidence',
  'email',
  'email_confidence',
  'website',
  'profile_url',
  'bar_enrollment_number',
  'bar_council_state',
  'lawyer_verified',
  'verified_at',
  'source',
  'scraped_at',
] as const;

const IN_MOBILE_RE = /^[6-9]\d{9}$/;

/**
 * Normalize a single raw phone string to E.164 for India.
 * Returns null if no valid 10-digit mobile is found.
 */
function normalizeIndiaPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip labels (Mob:, Tel:, WhatsApp:, etc.)
  const cleaned = raw.replace(/(?:mob(?:ile)?|tel|phone|ph|fax|whatsapp|wa|contact|call|res|off(?:ice)?)\s*[:\-]?\s*/gi, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;

  let body = digits;
  if (body.startsWith('91') && body.length === 12) body = body.slice(2);
  else if (body.startsWith('0') && body.length === 11) body = body.slice(1);

  if (body.length !== 10) return null;
  if (!IN_MOBILE_RE.test(body)) return null;
  return `+91${body}`;
}

/**
 * Split a raw phone field on common delimiters, return up to two
 * normalized India E.164 mobile numbers [primary, alternate].
 */
function splitAndNormalizeIndiaPhones(raw: string | null | undefined): [string | null, string | null] {
  if (!raw) return [null, null];
  const parts = raw.split(/\/|,|;|\bor\b|\&/i).map(p => p.trim()).filter(Boolean);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const n = normalizeIndiaPhone(part);
    if (n && !seen.has(n)) { seen.add(n); found.push(n); }
    if (found.length >= 2) break;
  }
  return [found[0] ?? null, found[1] ?? null];
}

function normalizeManualProspectPhone(
  rawPhone: string,
  countryCode: string,
): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  if (countryCode.toUpperCase() === 'IN') {
    const [primary] = splitAndNormalizeIndiaPhones(trimmed);
    return primary;
  }

  if (/^\+\d{8,15}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

const OUTREACH_STATUSES = [
  'NEW',
  'CONTACTED',
  'REPLIED',
  'CONVERTED',
  'DO_NOT_CONTACT',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export interface ProspectUpsertInput {
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  organisation?: string | null;
  practiceAreas?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  whatsapp?: string | null;
  whatsappConfidence?: string | null;
  email?: string | null;
  emailConfidence?: string | null;
  website?: string | null;
  profileUrl?: string | null;
  barEnrollmentNumber?: string | null;
  barCouncilState?: string | null;
  lawyerVerified?: boolean;
  verifiedAt?: Date | null;
  source: string;
  dedupeKey?: string;
  scrapedAt?: Date;
}

function dedupeKey(fullName: string, organisation?: string | null, city?: string | null) {
  const raw = [fullName, organisation ?? '', city ?? '']
    .map((v) => v.trim().toLowerCase())
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function escapeCsv(value: string | null | undefined): string {
  const s = value ?? '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type LawyerProspectSortField =
  | 'fullName'
  | 'city'
  | 'source'
  | 'outreachStatus'
  | 'createdAt'
  | 'phone'
  | 'organisation';

const LAWYER_PROSPECT_SORT_FIELDS = new Set<LawyerProspectSortField>([
  'fullName',
  'city',
  'source',
  'outreachStatus',
  'createdAt',
  'phone',
  'organisation',
]);

type LawyerProspectListQuery = {
  country?: string;
  state?: string;
  city?: string;
  source?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWhatsapp?: boolean;
  whatsappConfidence?: string;
  lawyerVerified?: boolean;
  outreachStatus?: string;
  isTest?: boolean;
  q?: string;
  sortBy?: string;
  sortDir?: string;
  limit?: number;
  offset?: number;
};

@Injectable()
export class LawyerProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  private buildListWhere(
    query: Omit<LawyerProspectListQuery, 'limit' | 'offset'>,
  ): Prisma.LawyerProspectWhereInput {
    return {
      country: query.country || undefined,
      state: query.state ? { contains: query.state, mode: 'insensitive' } : undefined,
      city: query.city ? { contains: query.city, mode: 'insensitive' } : undefined,
      source: query.source ? { contains: query.source, mode: 'insensitive' } : undefined,
      outreachStatus: query.outreachStatus || undefined,
      isTest: query.isTest === true ? true : query.isTest === false ? false : undefined,
      lawyerVerified: query.lawyerVerified === true ? true : query.lawyerVerified === false ? false : undefined,
      email: query.hasEmail === true ? { not: null } : query.hasEmail === false ? null : undefined,
      phone: query.hasPhone === true ? { not: null } : query.hasPhone === false ? null : undefined,
      whatsapp:
        query.hasWhatsapp === true
          ? { not: null }
          : query.hasWhatsapp === false
            ? null
            : undefined,
      whatsappConfidence: query.whatsappConfidence || undefined,
      OR: query.q
        ? [
            { fullName: { contains: query.q, mode: 'insensitive' } },
            { organisation: { contains: query.q, mode: 'insensitive' } },
            { city: { contains: query.q, mode: 'insensitive' } },
            { state: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private buildListOrderBy(
    query: Pick<LawyerProspectListQuery, 'sortBy' | 'sortDir'>,
  ): Prisma.LawyerProspectOrderByWithRelationInput {
    const dir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const field = (query.sortBy ?? 'createdAt') as LawyerProspectSortField;
    const sortBy = LAWYER_PROSPECT_SORT_FIELDS.has(field) ? field : 'createdAt';
    return { [sortBy]: dir };
  }

  async list(query: LawyerProspectListQuery) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    const where = this.buildListWhere(query);
    const orderBy = this.buildListOrderBy(query);

    const [items, total] = await Promise.all([
      this.prisma.lawyerProspect.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.lawyerProspect.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getStats(query: Omit<LawyerProspectListQuery, 'limit' | 'offset'> = {}) {
    const baseWhere = this.buildListWhere(query);
    const [
      total,
      withEmail,
      withWhatsappHigh,
      withWhatsappVerified,
      withPhone,
      barAndWhatsappVerified,
      lastImport,
      byCountry,
      bySource,
    ] = await Promise.all([
      this.prisma.lawyerProspect.count({ where: baseWhere }),
      this.prisma.lawyerProspect.count({
        where: { ...baseWhere, email: { not: null } },
      }),
      this.prisma.lawyerProspect.count({
        where: { ...baseWhere, whatsappConfidence: 'high' },
      }),
      this.prisma.lawyerProspect.count({
        where: { ...baseWhere, whatsappConfidence: 'verified' },
      }),
      this.prisma.lawyerProspect.count({
        where: { ...baseWhere, phone: { not: null } },
      }),
      this.prisma.lawyerProspect.count({
        where: {
          ...baseWhere,
          lawyerVerified: true,
          whatsappConfidence: 'verified',
        },
      }),
      this.prisma.prospectImportRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.lawyerProspect.groupBy({
        by: ['country'],
        _count: { id: true },
        where: { country: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      }),
      this.prisma.lawyerProspect.groupBy({
        by: ['source'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      }),
    ]);

    return {
      total,
      withEmail,
      withPhone,
      withWhatsappHigh,
      withWhatsappVerified,
      barAndWhatsappVerified,
      emailCoveragePct: total ? Math.round((withEmail / total) * 100) : 0,
      phoneCoveragePct: total ? Math.round((withPhone / total) * 100) : 0,
      whatsappHighCoveragePct: total
        ? Math.round((withWhatsappHigh / total) * 100)
        : 0,
      whatsappVerifiedCoveragePct: total
        ? Math.round((withWhatsappVerified / total) * 100)
        : 0,
      barAndWhatsappVerifiedPct: total
        ? Math.round((barAndWhatsappVerified / total) * 100)
        : 0,
      lastImportRun: lastImport,
      byCountry: byCountry.map((r) => ({
        country: r.country,
        count: r._count.id,
      })),
      bySource: bySource.map((r) => ({
        source: r.source,
        count: r._count.id,
      })),
    };
  }

  async getCitiesForCountry(country?: string): Promise<{ city: string; count: number }[]> {
    const rows = await this.prisma.lawyerProspect.groupBy({
      by: ['city'],
      where: {
        city: { not: null },
        ...(country ? { country: { contains: country, mode: 'insensitive' } } : {}),
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 100,
    });
    return rows
      .filter((r) => r.city)
      .map((r) => ({ city: r.city as string, count: r._count.id }));
  }

  async exportCsv(query: {
    country?: string;
    state?: string;
    city?: string;
    source?: string;
    hasEmail?: boolean;
    hasPhone?: boolean;
    hasWhatsapp?: boolean;
    whatsappConfidence?: string;
    lawyerVerified?: boolean;
    outreachStatus?: string;
    q?: string;
  }) {
    const { items } = await this.list({
      ...query,
      limit: 10000,
      offset: 0,
    });

    const lines = [CSV_HEADERS.join(',')];
    for (const p of items) {
      lines.push(
        [
          p.dedupeKey,
          p.fullName,
          p.firstName,
          p.lastName,
          p.organisation,
          p.practiceAreas,
          p.city,
          p.state,
          p.country,
          p.phone,
          (p as any).alternatePhone,
          p.whatsapp,
          p.whatsappConfidence,
          p.email,
          p.emailConfidence,
          p.website,
          p.profileUrl,
          p.barEnrollmentNumber,
          p.barCouncilState,
          p.lawyerVerified ? 'true' : 'false',
          p.verifiedAt?.toISOString() ?? '',
          p.source,
          p.scrapedAt?.toISOString() ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      );
    }

    const body = lines.join('\n');
    return new StreamableFile(Buffer.from(body, 'utf-8'), {
      type: 'text/csv',
      disposition: `attachment; filename="lawyer-prospects-${Date.now()}.csv"`,
    });
  }

  async getImportRun(id: string) {
    let run = await this.prisma.prospectImportRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException('Import run not found');
    }

    if (
      (run.status === 'RUNNING' || run.status === 'CANCELLING') &&
      run.sourceSummary?.startsWith('google_places:')
    ) {
      const healed =
        run.status === 'CANCELLING'
          ? await this.healStaleGooglePlacesCancel(run)
          : await this.healStaleGooglePlacesRun(run);
      if (healed) {
        run = healed;
      }
    }

    return run;
  }

  /** Force-close CANCELLING runs when the finalize worker never finished. */
  private async healStaleGooglePlacesCancel(run: {
    id: string;
    status: string;
    insertedCount: number;
    updatedCount: number;
    progressJson: Prisma.JsonValue | null;
  }) {
    const progress = parseGooglePlacesProgress(run.progressJson);
    const cancelAt = progress.cancelRequestedAt
      ? new Date(progress.cancelRequestedAt).getTime()
      : Date.now() - 4 * 60 * 1000;
    const staleMs = Date.now() - cancelAt;
    const STALE_CANCEL_MS = 3 * 60 * 1000;

    if (staleMs < STALE_CANCEL_MS) {
      return null;
    }

    const progressNote =
      progress.placeIds.length > 0
        ? `Stop timed out before import finished. ${progress.placeIds.length} firms were discovered — start a new scrape to resume.`
        : 'Stopped by admin. No firms were discovered.';

    return this.prisma.prospectImportRun.update({
      where: { id: run.id },
      data: {
        status: 'CANCELLED',
        errorMessage: progressNote,
        finishedAt: new Date(),
      },
    });
  }

  /** Mark RUNNING Google Places jobs as failed when the worker stopped updating progress. */
  private async healStaleGooglePlacesRun(run: {
    id: string;
    status: string;
    sourceSummary: string | null;
    startedAt: Date;
    progressJson: Prisma.JsonValue | null;
  }) {
    const progress = parseGooglePlacesProgress(run.progressJson);
    const lastProgressAt = progress.lastProgressAt
      ? new Date(progress.lastProgressAt).getTime()
      : run.startedAt.getTime();
    const staleMs = Date.now() - lastProgressAt;
    const STALE_PROGRESS_MS = 15 * 60 * 1000;

    if (staleMs < STALE_PROGRESS_MS) {
      return null;
    }

    return this.prisma.prospectImportRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorMessage:
          'Scrape stopped responding (no progress for 15+ minutes). Start again to resume from the last checkpoint.',
        finishedAt: new Date(),
      },
    });
  }

  async startGooglePlacesScrape(
    countryCode: string,
    stateName: string,
    cityName: string,
    userId?: string,
    scrapeMode: GooglePlacesScrapeMode = 'full',
  ) {
    if (!findGooglePlacesCountry(countryCode)) {
      throw new BadRequestException(
        `Unsupported country: ${countryCode}. Supported: ${listGooglePlacesCountryCodes().join(', ')}`,
      );
    }

    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GOOGLE_PLACES_API_KEY is not configured');
    }

    const location = await resolveGooglePlacesLocation(
      apiKey,
      countryCode,
      stateName,
      cityName,
    );

    const sourceSummary = `google_places:${location.countryCode}:${location.state}:${location.city}`;

    const staleCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const progressStaleCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const running = await this.prisma.prospectImportRun.findFirst({
      where: {
        status: { in: ['RUNNING', 'CANCELLING'] },
        sourceSummary: { startsWith: 'google_places:' },
      },
    });
    if (running) {
      const progress = parseGooglePlacesProgress(running.progressJson);
      const lastProgressAt = progress.lastProgressAt
        ? new Date(progress.lastProgressAt)
        : running.startedAt;
      const isStale =
        running.startedAt < staleCutoff || lastProgressAt < progressStaleCutoff;

      if (running.status === 'CANCELLING') {
        const cancelAt = progress.cancelRequestedAt
          ? new Date(progress.cancelRequestedAt).getTime()
          : 0;
        if (Date.now() - cancelAt > 3 * 60 * 1000) {
          await this.prisma.prospectImportRun.update({
            where: { id: running.id },
            data: {
              status: 'CANCELLED',
              errorMessage: 'Stop timed out (stale CANCELLING run cleared)',
              finishedAt: new Date(),
            },
          });
        } else {
          throw new ConflictException(
            `A Google Places scrape is stopping (run ${running.id})`,
          );
        }
      } else if (isStale) {
        await this.prisma.prospectImportRun.update({
          where: { id: running.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Scrape timed out (stale RUNNING run cleared)',
            finishedAt: new Date(),
          },
        });
      } else {
        throw new ConflictException(
          `A Google Places scrape is already running (run ${running.id})`,
        );
      }
    }

    const resumable = await this.prisma.prospectImportRun.findFirst({
      where: {
        sourceSummary,
        status: 'FAILED',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (resumable) {
      const progress = parseGooglePlacesProgress(resumable.progressJson);
      const totalBatches = totalGooglePlacesBatches(
        progress.placeIds.length,
        progress.batchSize,
      );
      const hasRemaining =
        progress.placeIds.length > 0 &&
        progress.completedBatchIndexes.length < totalBatches;

      if (hasRemaining) {
        await this.prisma.prospectImportRun.update({
          where: { id: resumable.id },
          data: {
            status: 'RUNNING',
            errorMessage: null,
            finishedAt: null,
          },
        });

        await this.jobsService!.enqueueGooglePlacesScrape({
          runId: resumable.id,
          countryCode: location.countryCode,
          state: location.state,
          city: location.city,
          scrapeMode: progress.scrapeMode ?? 'full',
        });

        if (userId) {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'LAWYER_PROSPECTS_GOOGLE_PLACES_SCRAPE',
              entityType: 'ProspectImportRun',
              entityId: resumable.id,
              metadata: {
                country: location.countryCode,
                state: location.state,
                city: location.city,
                resumed: true,
                completedBatches: progress.completedBatchIndexes.length,
                totalBatches,
              },
            },
          });
        }

        return { runId: resumable.id, status: 'RUNNING', resumed: true };
      }
    }

    const batchLabel = `google-places-${location.city.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const run = await this.prisma.prospectImportRun.create({
      data: {
        batchLabel,
        sourceSummary,
        status: 'RUNNING',
        progressJson: {
          ...emptyGooglePlacesProgress(scrapeMode),
          locationLat: location.lat,
          locationLng: location.lng,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.jobsService!.enqueueGooglePlacesScrape({
      runId: run.id,
      countryCode: location.countryCode,
      state: location.state,
      city: location.city,
      scrapeMode,
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECTS_GOOGLE_PLACES_SCRAPE',
          entityType: 'ProspectImportRun',
          entityId: run.id,
          metadata: {
            country: location.countryCode,
            state: location.state,
            city: location.city,
            batchLabel,
          },
        },
      });
    }

    return { runId: run.id, status: run.status };
  }

  async getGooglePlacesProgress(runId: string): Promise<GooglePlacesScrapeProgress> {
    const run = await this.prisma.prospectImportRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException('Import run not found');
    }
    return parseGooglePlacesProgress(run.progressJson);
  }

  async saveGooglePlacesProgress(runId: string, progress: GooglePlacesScrapeProgress) {
    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        progressJson: {
          ...progress,
          lastProgressAt: progress.lastProgressAt ?? new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async upsertGooglePlacesBatch(
    runId: string,
    records: ProspectUpsertInput[],
    options?: { enrichmentOnly?: boolean },
  ) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
      const result = options?.enrichmentOnly
        ? await this.enrichProspectRecord(record, runId)
        : await this.upsertProspectRecord(record, runId);
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else skipped++;
    }

    const run = await this.prisma.prospectImportRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException('Import run not found');
    }

    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        insertedCount: run.insertedCount + inserted,
        updatedCount: run.updatedCount + updated,
        skippedCount: run.skippedCount + skipped,
        rowCount: run.rowCount + records.length,
      },
    });

    return { inserted, updated, skipped };
  }

  async finalizeGooglePlacesImport(runId: string) {
    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
      },
    });
  }

  async completeGooglePlacesImport(runId: string, records: ProspectUpsertInput[]) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
      const result = await this.upsertProspectRecord(record, runId);
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else skipped++;
    }

    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        rowCount: records.length,
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        finishedAt: new Date(),
      },
    });

    return { inserted, updated, skipped, rowCount: records.length };
  }

  async markImportRunFailed(runId: string, errorMessage: string) {
    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async getImportRunForFinalize(runId: string) {
    const run = await this.prisma.prospectImportRun.findUnique({ where: { id: runId } });
    if (!run?.sourceSummary) {
      throw new NotFoundException('Import run not found');
    }
    const location = parseGooglePlacesSourceSummary(run.sourceSummary);
    if (!location) {
      throw new BadRequestException('Import run is not a Google Places scrape');
    }
    return {
      runId: run.id,
      countryCode: location.countryCode,
      state: location.state,
      city: location.city,
    };
  }

  async isGooglePlacesCancelRequested(runId: string): Promise<boolean> {
    const progress = await this.getGooglePlacesProgress(runId);
    return isGooglePlacesRunCancelled(progress);
  }

  async cancelGooglePlacesScrape(runId: string, userId?: string) {
    const run = await this.prisma.prospectImportRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException('Import run not found');
    }
    if (!run.sourceSummary?.startsWith('google_places:')) {
      throw new BadRequestException('Only Google Places import runs can be cancelled');
    }
    if (run.status !== 'RUNNING' && run.status !== 'CANCELLING') {
      throw new BadRequestException(`Import run is not active (status: ${run.status})`);
    }

    const location = parseGooglePlacesSourceSummary(run.sourceSummary);
    if (!location) {
      throw new BadRequestException('Invalid Google Places import run location');
    }

    const progress = parseGooglePlacesProgress(run.progressJson);
    await this.saveGooglePlacesProgress(runId, {
      ...progress,
      cancelRequestedAt: new Date().toISOString(),
    });

    await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: { status: 'CANCELLING' },
    });

    await this.jobsService!.cancelGooglePlacesScrapeJobs(runId);
    await this.jobsService!.enqueueGooglePlacesFinalize({
      runId,
      countryCode: location.countryCode,
      state: location.state,
      city: location.city,
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECTS_GOOGLE_PLACES_CANCEL',
          entityType: 'ProspectImportRun',
          entityId: runId,
          metadata: {
            country: location.countryCode,
            state: location.state,
            city: location.city,
            placeIdsDiscovered: progress.placeIds.length,
          },
        },
      });
    }

    return { runId, status: 'CANCELLING' as const };
  }

  async finalizeCancelledGooglePlacesImport(
    runId: string,
    message?: string,
  ) {
    const run = await this.prisma.prospectImportRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException('Import run not found');
    }

    const summary =
      message ??
      `Stopped by admin. Saved ${run.insertedCount} new and ${run.updatedCount} updated prospects.`;

    const updated = await this.prisma.prospectImportRun.update({
      where: { id: runId },
      data: {
        status: 'CANCELLED',
        errorMessage: summary,
        finishedAt: new Date(),
      },
    });

    return {
      runId,
      status: 'CANCELLED' as const,
      insertedCount: updated.insertedCount,
      updatedCount: updated.updatedCount,
    };
  }

  private async upsertProspectRecord(
    input: ProspectUpsertInput,
    importRunId: string,
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const fullName = input.fullName?.trim();
    if (!fullName) return 'skipped';

    const key =
      input.dedupeKey?.trim() ||
      dedupeKey(fullName, input.organisation, input.city);

    const country = input.country ?? null;
    let phone: string | null = input.phone ?? null;
    let alternatePhone: string | null = input.alternatePhone ?? null;
    if (country?.toUpperCase() === 'IN') {
      const [primary, alternate] = splitAndNormalizeIndiaPhones(phone);
      phone = primary;
      alternatePhone =
        (input.alternatePhone ? normalizeIndiaPhone(input.alternatePhone) : null) ??
        alternate;
    }

    const whatsapp = input.whatsapp ?? phone;
    const whatsappConfidence =
      input.whatsappConfidence ??
      (phone && country?.toUpperCase() === 'IN' ? 'high' : null);

    const scrapedAt = input.scrapedAt ?? new Date();
    const data: Prisma.LawyerProspectCreateInput = {
      fullName,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      organisation: input.organisation ?? null,
      practiceAreas: input.practiceAreas ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country,
      phone,
      alternatePhone,
      whatsapp,
      whatsappConfidence,
      email: input.email ?? null,
      emailConfidence: input.emailConfidence ?? null,
      website: input.website ?? null,
      profileUrl: input.profileUrl ?? null,
      barEnrollmentNumber: input.barEnrollmentNumber ?? null,
      barCouncilState: input.barCouncilState ?? null,
      lawyerVerified: input.lawyerVerified ?? false,
      verifiedAt: input.verifiedAt ?? null,
      source: input.source,
      dedupeKey: key,
      scrapedAt,
      importRun: { connect: { id: importRunId } },
    };

    const existing = await this.prisma.lawyerProspect.findUnique({
      where: { dedupeKey: key },
    });

    if (existing) {
      await this.prisma.lawyerProspect.update({
        where: { dedupeKey: key },
        data: {
          ...data,
          importRun: { connect: { id: importRunId } },
        },
      });
      return 'updated';
    }

    await this.prisma.lawyerProspect.create({ data });
    return 'inserted';
  }

  /** Enrichment mode: update existing prospects missing phone/website only — no new inserts. */
  private async enrichProspectRecord(
    input: ProspectUpsertInput,
    importRunId: string,
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const fullName = input.fullName?.trim();
    if (!fullName) return 'skipped';

    const key =
      input.dedupeKey?.trim() ||
      dedupeKey(fullName, input.organisation, input.city);

    const existing = await this.prisma.lawyerProspect.findUnique({
      where: { dedupeKey: key },
    });
    if (!existing) return 'skipped';
    if (existing.phone && existing.website) return 'skipped';

    const country = input.country ?? existing.country;
    let phone = input.phone ?? existing.phone;
    if (country?.toUpperCase() === 'IN' && input.phone) {
      const [primary] = splitAndNormalizeIndiaPhones(input.phone);
      phone = primary;
    }

    await this.prisma.lawyerProspect.update({
      where: { dedupeKey: key },
      data: {
        phone: phone ?? existing.phone,
        website: input.website ?? existing.website,
        profileUrl: input.profileUrl ?? existing.profileUrl,
        whatsapp: phone ?? existing.whatsapp,
        whatsappConfidence:
          phone && country?.toUpperCase() === 'IN' ? 'high' : existing.whatsappConfidence,
        importRun: { connect: { id: importRunId } },
      },
    });
    return 'updated';
  }

  async importCsv(
    buffer: Buffer,
    batchLabel: string,
    sourceSummary?: string,
    userId?: string,
  ) {
    const rows = parseCsvBuffer(buffer);
    if (!rows.length) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    const run = await this.prisma.prospectImportRun.create({
      data: {
        batchLabel: batchLabel || 'csv-import',
        sourceSummary: sourceSummary ?? 'admin-upload',
        status: 'RUNNING',
      },
    });

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const fullName =
        (row.full_name || '').trim() ||
        `${(row.first_name || '').trim()} ${(row.last_name || '').trim()}`.trim();
      if (!fullName) {
        skipped++;
        continue;
      }

      const lawyerVerified =
        row.lawyer_verified === 'true' ||
        row.lawyer_verified === '1' ||
        row.lawyer_verified === 'yes';
      const verifiedAtRaw = row.verified_at?.trim();
      const verifiedAt = verifiedAtRaw ? new Date(verifiedAtRaw) : lawyerVerified ? new Date() : null;
      const scrapedAt = row.scraped_at ? new Date(row.scraped_at) : new Date();

      const result = await this.upsertProspectRecord(
        {
          fullName,
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          organisation: row.organisation || null,
          practiceAreas: row.practice_areas || null,
          city: row.city || null,
          state: row.state || null,
          country: row.country || null,
          phone: row.phone || null,
          alternatePhone: row.alternate_phone || null,
          whatsapp: row.whatsapp || null,
          whatsappConfidence: row.whatsapp_confidence || null,
          email: row.email || null,
          emailConfidence: row.email_confidence || null,
          website: row.website || null,
          profileUrl: row.profile_url || null,
          barEnrollmentNumber: row.bar_enrollment_number || null,
          barCouncilState: row.bar_council_state || null,
          lawyerVerified,
          verifiedAt: verifiedAt && !Number.isNaN(verifiedAt.getTime()) ? verifiedAt : null,
          source: row.source || 'import',
          dedupeKey: (row.id || '').trim() || undefined,
          scrapedAt: Number.isNaN(scrapedAt.getTime()) ? new Date() : scrapedAt,
        },
        run.id,
      );

      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else skipped++;
    }

    await this.prisma.prospectImportRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        rowCount: rows.length,
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        finishedAt: new Date(),
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECTS_IMPORT',
          entityType: 'ProspectImportRun',
          entityId: run.id,
          metadata: { inserted, updated, skipped, batchLabel },
        },
      });
    }

    return { runId: run.id, inserted, updated, skipped, rowCount: rows.length };
  }

  async createManualProspect(dto: CreateLawyerProspectDto, userId?: string) {
    if (
      dto.practiceType === 'FIRM' &&
      (!dto.organisation || dto.organisation.trim().length < 2)
    ) {
      throw new BadRequestException('organisation is required for law firm prospects');
    }

    const fullName = formatPersonName(dto.fullName);
    if (fullName.length < 2) {
      throw new BadRequestException('fullName is required');
    }

    const { firstName, lastName } = splitFullName(fullName);
    const organisation =
      dto.practiceType === 'FIRM' ? dto.organisation!.trim() : null;
    const state = (dto.state ?? 'Gujarat').trim();
    const city = (dto.city ?? 'Ahmedabad').trim();
    const countryCode = (dto.countryCode ?? 'IN').trim().toUpperCase();
    let countryConfig;
    try {
      countryConfig = getCountryConfig(countryCode);
    } catch {
      throw new BadRequestException(`Unsupported country code: ${countryCode}`);
    }
    const country = countryConfig.name;
    const email = dto.email.trim().toLowerCase();
    const key = dedupeKey(fullName, organisation, city);

    const primaryPhone = normalizeManualProspectPhone(dto.phone, countryCode);
    if (!primaryPhone) {
      throw new BadRequestException('A valid phone number is required');
    }

    const whatsappConfidence =
      countryCode === 'IN' ? 'high' : null;

    const existingByEmail = await this.prisma.lawyerProspect.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingByEmail) {
      const dedupeConflict = await this.prisma.lawyerProspect.findUnique({
        where: { dedupeKey: key },
      });
      if (dedupeConflict && dedupeConflict.id !== existingByEmail.id) {
        throw new ConflictException(
          'A prospect with this name, organisation, and city already exists under a different email',
        );
      }

      const updated = await this.prisma.lawyerProspect.update({
        where: { id: existingByEmail.id },
        data: {
          fullName,
          firstName,
          lastName,
          organisation,
          city,
          state,
          country,
          phone: primaryPhone,
          alternatePhone: null,
          whatsapp: primaryPhone,
          whatsappConfidence,
          email,
          emailConfidence: 'manual',
          source: 'manual',
          dedupeKey: key,
        },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'LAWYER_PROSPECT_MANUAL_UPSERT',
            entityType: 'LawyerProspect',
            entityId: updated.id,
            metadata: { action: 'updated', email },
          },
        });
      }

      return { prospect: updated, action: 'updated' as const };
    }

    const dedupeConflict = await this.prisma.lawyerProspect.findUnique({
      where: { dedupeKey: key },
    });
    if (dedupeConflict) {
      throw new ConflictException(
        'A prospect with this name, organisation, and city already exists',
      );
    }

    const run = await this.prisma.prospectImportRun.create({
      data: {
        batchLabel: `manual-${Date.now()}`,
        sourceSummary: 'admin-manual-form',
        status: 'COMPLETED',
        rowCount: 1,
        insertedCount: 1,
        finishedAt: new Date(),
      },
    });

    const result = await this.upsertProspectRecord(
      {
        fullName,
        firstName,
        lastName,
        organisation,
        city,
        state,
        country,
        phone: primaryPhone,
        email,
        emailConfidence: 'manual',
        source: 'manual',
        dedupeKey: key,
      },
      run.id,
    );

    const prospect = await this.prisma.lawyerProspect.findUnique({
      where: { dedupeKey: key },
    });
    if (!prospect) {
      throw new BadRequestException('Failed to create prospect');
    }

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECT_MANUAL_UPSERT',
          entityType: 'LawyerProspect',
          entityId: prospect.id,
          metadata: { action: result, email },
        },
      });
    }

    return { prospect, action: result === 'updated' ? ('updated' as const) : ('inserted' as const) };
  }

  async updateOutreachStatus(id: string, outreachStatus: string, userId?: string) {
    if (!OUTREACH_STATUSES.includes(outreachStatus as OutreachStatus)) {
      throw new BadRequestException(`Invalid outreach status: ${outreachStatus}`);
    }

    const updated = await this.prisma.lawyerProspect.update({
      where: { id },
      data: { outreachStatus },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECT_OUTREACH_UPDATE',
          entityType: 'LawyerProspect',
          entityId: id,
          metadata: { outreachStatus },
        },
      });
    }

    return updated;
  }

  async deleteProspect(id: string, userId?: string) {
    const existing = await this.prisma.lawyerProspect.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Lawyer prospect not found');
    }

    await this.prisma.lawyerProspect.delete({ where: { id } });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LAWYER_PROSPECT_DELETE',
          entityType: 'LawyerProspect',
          entityId: id,
          metadata: {
            fullName: existing.fullName,
            source: existing.source,
            phone: existing.phone,
          },
        },
      });
    }

    return { deleted: true, id };
  }
}
