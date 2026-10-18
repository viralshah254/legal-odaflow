import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import { CalendarService } from '@/calendar/calendar.service';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateCourtCaseDto,
  CreateCourtFilingDto,
  CreateCourtHearingDto,
  CreateDocketEntryDto,
  EcourtsLookupDto,
  UpdateCourtCaseDto,
  UsDocketSyncDto,
} from './dto/court.dto';

@Injectable()
export class CourtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly configService: ConfigService,
    private readonly courtListener: CourtListenerConnector,
    private readonly calendarService: CalendarService,
    private readonly jobsService: JobsService,
  ) {}

  async getCourtCaseForMatter(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    const courtCase = await this.prisma.courtCase.findFirst({
      where: { tenantId, matterId },
      include: {
        hearings: { orderBy: { scheduledAt: 'asc' } },
        filings: { orderBy: { createdAt: 'desc' } },
        docketEntries: { orderBy: { entryDate: 'desc' } },
      },
    });

    if (!courtCase) {
      throw new NotFoundException('Court case not found for this matter');
    }

    return courtCase;
  }

  async createCourtCaseForMatter(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateCourtCaseDto,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    const existing = await this.prisma.courtCase.findFirst({
      where: { tenantId, matterId },
    });

    if (existing) {
      throw new BadRequestException('Court case already exists for this matter');
    }

    return this.prisma.courtCase.create({
      data: {
        tenantId,
        matterId,
        countryCode: dto.countryCode.toUpperCase(),
        courtName: dto.courtName,
        caseNumber: dto.caseNumber,
        cnrNumber: dto.cnrNumber,
        externalId: dto.externalId,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listHearings(tenantId: string, courtCaseId: string) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.courtHearing.findMany({
      where: { courtCaseId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createHearing(
    tenantId: string,
    courtCaseId: string,
    dto: CreateCourtHearingDto,
  ) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.courtHearing.create({
      data: {
        courtCaseId,
        scheduledAt: new Date(dto.scheduledAt),
        hearingType: dto.hearingType,
        location: dto.location,
        notes: dto.notes,
        status: dto.status ?? 'SCHEDULED',
      },
    });
  }

  async listFilings(tenantId: string, courtCaseId: string) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.courtFiling.findMany({
      where: { courtCaseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFiling(
    tenantId: string,
    courtCaseId: string,
    dto: CreateCourtFilingDto,
  ) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.courtFiling.create({
      data: {
        courtCaseId,
        filingType: dto.filingType,
        title: dto.title,
        filedAt: dto.filedAt ? new Date(dto.filedAt) : null,
        documentId: dto.documentId,
        status: dto.status ?? 'DRAFT',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listDocketEntries(tenantId: string, courtCaseId: string) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.docketEntry.findMany({
      where: { courtCaseId },
      orderBy: { entryDate: 'desc' },
    });
  }

  async createDocketEntry(
    tenantId: string,
    courtCaseId: string,
    dto: CreateDocketEntryDto,
  ) {
    await this.ensureCourtCase(tenantId, courtCaseId);

    return this.prisma.docketEntry.create({
      data: {
        courtCaseId,
        entryDate: new Date(dto.entryDate),
        description: dto.description,
        source: dto.source,
        externalId: dto.externalId,
      },
    });
  }

  async ecourtsLookup(dto: EcourtsLookupDto) {
    const cnr = dto.cnrNumber.trim().toUpperCase();
    const apiUrl = this.configService.get<string>('ECOURTS_API_URL', '').trim();

    if (apiUrl) {
      const url = new URL(apiUrl);
      url.searchParams.set('cnr', cnr);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `eCourts API returned ${response.status}`,
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const result = {
        provider: 'ecourts-india-live',
        cnrNumber: cnr,
        ...payload,
      };
      await this.syncHearingsToCalendar(dto, result);
      return result;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new ServiceUnavailableException(
        'eCourts integration is not configured. Set ECOURTS_API_URL for production lookups.',
      );
    }

    const stubResult = {
      provider: 'ecourts-india-stub',
      cnrNumber: cnr,
      status: 'FOUND',
      caseTitle: `Civil Suit — CNR ${cnr}`,
      courtName: 'District Court (Stub)',
      caseType: 'CS',
      filingDate: '2024-01-15',
      nextHearingDate: '2026-06-15',
      caseStatus: 'Pending',
      parties: {
        petitioner: 'Petitioner (Stub)',
        respondent: 'Respondent (Stub)',
      },
      hearings: [
        {
          date: '2025-03-10',
          purpose: 'Admission',
          judge: 'Hon. Judge (Stub)',
        },
        {
          date: '2026-06-15',
          purpose: 'Evidence',
          judge: 'Hon. Judge (Stub)',
        },
      ],
      disclaimer:
        'Stub eCourts response for development. Set ECOURTS_API_URL for production data.',
    };
    await this.syncHearingsToCalendar(dto, stubResult);
    return stubResult;
  }

  async usDocketSync(tenantId: string, dto: UsDocketSyncDto) {
    if (!dto.matterId && !dto.courtCaseId) {
      throw new BadRequestException('matterId or courtCaseId is required');
    }

    const courtCase = dto.courtCaseId
      ? await this.ensureCourtCase(tenantId, dto.courtCaseId)
      : await this.prisma.courtCase.findFirst({
          where: { tenantId, matterId: dto.matterId },
        });

    if (!courtCase) {
      throw new NotFoundException('Court case not found');
    }

    const metadata =
      courtCase.metadata && typeof courtCase.metadata === 'object'
        ? (courtCase.metadata as Record<string, unknown>)
        : {};

    const docketNumber =
      (metadata.docketNumber as string | undefined) ??
      courtCase.caseNumber ??
      courtCase.externalId ??
      'STUB-DOCKET-001';

    const liveEntries = await this.fetchCourtListenerDocketEntries(docketNumber);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (liveEntries.length === 0) {
      if (isProduction) {
        if (!this.courtListener.isConfigured()) {
          throw new ServiceUnavailableException(
            'US docket sync requires CourtListener API configuration in production',
          );
        }
        throw new NotFoundException(
          `No docket entries found for docket number ${docketNumber}`,
        );
      }
    }

    const entries =
      liveEntries.length > 0
        ? liveEntries
        : [
            {
              entryDate: new Date('2025-11-01'),
              description: `Complaint filed — Docket ${docketNumber}`,
              source: 'us-docket-stub',
              externalId: `${docketNumber}-001`,
            },
            {
              entryDate: new Date('2026-01-20'),
              description: 'Answer filed by defendant',
              source: 'us-docket-stub',
              externalId: `${docketNumber}-002`,
            },
            {
              entryDate: new Date('2026-04-05'),
              description: 'Scheduling order issued',
              source: 'us-docket-stub',
              externalId: `${docketNumber}-003`,
            },
          ];

    const created = await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.docketEntry.create({
          data: {
            courtCaseId: courtCase.id,
            ...entry,
          },
        }),
      ),
    );

    await this.prisma.courtCase.update({
      where: { id: courtCase.id },
      data: {
        metadata: {
          ...metadata,
          lastUsDocketSyncAt: new Date().toISOString(),
          docketNumber,
        } as Prisma.InputJsonValue,
      },
    });

    await this.syncDocketEntriesToCalendar(
      tenantId,
      courtCase.matterId,
      created,
    );
    await this.enqueueDeadlineAgent(tenantId, courtCase.matterId, dto.matterId ? undefined : courtCase.id);

    return {
      courtCaseId: courtCase.id,
      matterId: courtCase.matterId,
      docketNumber,
      provider: liveEntries.length > 0 ? 'courtlistener' : 'us-docket-stub',
      syncedEntries: created.length,
      entries: created,
    };
  }

  private async syncHearingsToCalendar(
    dto: EcourtsLookupDto,
    payload: Record<string, unknown>,
  ) {
    if (!dto.tenantId || !dto.matterId) return;

    const hearings = payload.hearings;
    if (!Array.isArray(hearings)) return;

    for (const hearing of hearings) {
      if (!hearing || typeof hearing !== 'object') continue;
      const row = hearing as Record<string, unknown>;
      const dateStr = (row.date ?? row.hearingDate ?? row.nextHearingDate) as string | undefined;
      if (!dateStr) continue;

      const start = new Date(dateStr);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) continue;

      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const purpose = String(row.purpose ?? row.hearingType ?? 'Court hearing');
      await this.calendarService.create(dto.tenantId, {
        matterId: dto.matterId,
        title: `Hearing: ${purpose} (CNR ${dto.cnrNumber})`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    }

    if (dto.userId) {
      await this.enqueueDeadlineAgent(dto.tenantId, dto.matterId);
    }
  }

  private async syncDocketEntriesToCalendar(
    tenantId: string,
    matterId: string,
    entries: Array<{ entryDate: Date; description: string }>,
  ) {
    for (const entry of entries) {
      const start = entry.entryDate;
      if (start.getTime() < Date.now()) continue;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await this.calendarService.create(tenantId, {
        matterId,
        title: `Docket: ${entry.description.slice(0, 120)}`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    }
  }

  private async enqueueDeadlineAgent(
    tenantId: string,
    matterId: string,
    courtCaseId?: string,
  ) {
    try {
      const matter = await this.prisma.matter.findFirst({
        where: { id: matterId, tenantId },
        select: { id: true },
      });
      if (!matter) return;

      const membership = await this.prisma.tenantUser.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });
      if (!membership) return;

      await this.jobsService.enqueueAgentJob({
        tenantId,
        userId: membership.userId,
        agentId: 'deadline',
        jobType: 'court_deadline_scan',
        params: { matterId, courtCaseId },
      });
    } catch {
      /* non-fatal */
    }
  }

  private async fetchCourtListenerDocketEntries(docketNumber: string): Promise<
    Array<{
      entryDate: Date;
      description: string;
      source: string;
      externalId: string;
    }>
  > {
    if (!this.courtListener.isConfigured()) {
      return [];
    }

    const token =
      this.configService.get<string>('COURTLISTENER_TOKEN', '').trim() ||
      this.configService.get<string>('COURTLISTENER_API_TOKEN', '').trim();

    const url = new URL('https://www.courtlistener.com/api/rest/v4/dockets/');
    url.searchParams.set('docket_number', docketNumber);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as {
        results?: Array<{
          id?: number;
          docket_number?: string;
          case_name?: string;
          date_filed?: string;
        }>;
      };

      const docket = payload.results?.[0];
      if (!docket?.id) {
        return [];
      }

      const entriesUrl = new URL(
        `https://www.courtlistener.com/api/rest/v4/docket-entries/`,
      );
      entriesUrl.searchParams.set('docket', String(docket.id));

      const entriesResponse = await fetch(entriesUrl.toString(), {
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/json',
        },
      });

      if (!entriesResponse.ok) {
        if (docket.date_filed) {
          return [
            {
              entryDate: new Date(docket.date_filed),
              description: docket.case_name ?? `Docket ${docketNumber}`,
              source: 'courtlistener',
              externalId: `cl-docket-${docket.id}`,
            },
          ];
        }
        return [];
      }

      const entriesPayload = (await entriesResponse.json()) as {
        results?: Array<{
          id?: number;
          date_filed?: string;
          description?: string;
        }>;
      };

      return (entriesPayload.results ?? []).slice(0, 25).map((entry) => ({
        entryDate: entry.date_filed ? new Date(entry.date_filed) : new Date(),
        description: entry.description ?? 'Docket entry',
        source: 'courtlistener',
        externalId: `cl-entry-${entry.id ?? docket.id}`,
      }));
    } catch {
      return [];
    }
  }

  private async ensureCourtCase(tenantId: string, courtCaseId: string) {
    const courtCase = await this.prisma.courtCase.findFirst({
      where: { id: courtCaseId, tenantId },
    });

    if (!courtCase) {
      throw new NotFoundException('Court case not found');
    }

    return courtCase;
  }

  private async ensureMatterAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    } catch {
      throw new ForbiddenException('Matter access denied');
    }
  }
}
