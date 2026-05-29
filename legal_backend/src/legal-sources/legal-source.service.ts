import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  LEGAL_SOURCE_CONNECTOR_SEEDS,
  LEGAL_SOURCE_COUNTRY_CODES,
} from './legal-source.seed';

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

@Injectable()
export class LegalSourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
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
}
