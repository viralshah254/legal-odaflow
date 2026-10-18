import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { IndiaKanoonConnector } from './connectors/india-kanoon.connector';
import { EscrConnector } from './connectors/escr.connector';
import { LicensedCaseLawConnector } from './connectors/licensed-case-law.connector';
import { loadIndiaCaselawCorpus } from './load-india-caselaw-corpus';

export interface ResearchReadinessReport {
  countryCode: string;
  researchReady: boolean;
  caseLawSources: Array<{
    id: string;
    configured: boolean;
    available: boolean;
    reason?: string;
  }>;
  corpus: {
    caseLawRowCount: number;
    embeddedCaseLawCount: number;
    curatedManifestEntries: number;
    curatedManifestAvailable: boolean;
  };
  limitations: string[];
}

@Injectable()
export class ResearchReadinessService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly indiaKanoon?: IndiaKanoonConnector,
    @Optional() private readonly escr?: EscrConnector,
    @Optional() private readonly licensed?: LicensedCaseLawConnector,
  ) {}

  async snapshot(countryCode = 'IN'): Promise<ResearchReadinessReport> {
    const code = countryCode.toUpperCase();
    const limitations: string[] = [];
    const caseLawSources: ResearchReadinessReport['caseLawSources'] = [];

    if (code === 'IN') {
      const ikConfigured = this.indiaKanoon?.isConfigured() === true;
      caseLawSources.push({
        id: 'india-kanoon',
        configured: ikConfigured,
        available: ikConfigured,
        reason: ikConfigured ? undefined : 'INDIA_KANOON_API_KEY missing',
      });

      const escrConfigured = this.escr?.isConfigured() === true;
      caseLawSources.push({
        id: 'e-scr',
        configured: escrConfigured,
        available: escrConfigured,
        reason: escrConfigured ? undefined : 'ESCR_CONNECTOR_DISABLED=true',
      });

      const licensedConfigured = this.licensed?.isConfigured() === true;
      caseLawSources.push({
        id: 'licensed-case-law',
        configured: licensedConfigured,
        available: licensedConfigured,
        reason: licensedConfigured ? undefined : 'No SCC/Manupatra/Taxmann API keys',
      });
    }

    const [caseLawRowCount, embeddedCaseLawCount] = await Promise.all([
      this.prisma.legalAuthority.count({
        where: { countryCode: code, authorityType: { in: ['CASE', 'CASE_LAW', 'JUDGMENT'] } },
      }),
      this.prisma.legalAuthority.count({
        where: {
          countryCode: code,
          authorityType: { in: ['CASE', 'CASE_LAW', 'JUDGMENT'] },
          embeddingStatus: { in: ['COMPLETED', 'INDEXED'] },
        },
      }),
    ]);

    let curatedManifestEntries = 0;
    let curatedManifestAvailable = false;
    if (code === 'IN') {
      try {
        const corpus = loadIndiaCaselawCorpus();
        curatedManifestAvailable = corpus.entries.length > 0;
        curatedManifestEntries = corpus.entries.length;
      } catch {
        limitations.push('India curated case-law corpus unreadable');
      }
    }

    if (caseLawRowCount === 0) {
      limitations.push('No CASE_LAW rows in LegalAuthority — run curated ingest and embeddings');
    } else if (embeddedCaseLawCount === 0) {
      limitations.push('Case-law rows exist but none are embedded — run embed:pending-caselaws');
    }

    const anyLiveSource = caseLawSources.some((s) => s.available);
    const corpusUsable = caseLawRowCount > 0 || curatedManifestAvailable;
    if (!anyLiveSource && !corpusUsable) {
      limitations.push('No live Indian case-law connector and no usable local corpus');
    }

    const researchReady = anyLiveSource || corpusUsable;

    return {
      countryCode: code,
      researchReady,
      caseLawSources,
      corpus: {
        caseLawRowCount,
        embeddedCaseLawCount,
        curatedManifestEntries,
        curatedManifestAvailable,
      },
      limitations,
    };
  }
}
