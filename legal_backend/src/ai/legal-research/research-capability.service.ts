import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { EscrConnector } from '@/legal-sources/connectors/escr.connector';
import { IndiaKanoonConnector } from '@/legal-sources/connectors/india-kanoon.connector';
import { LicensedCaseLawConnector } from '@/legal-sources/connectors/licensed-case-law.connector';
import { TavilySearchConnector } from '@/legal-sources/connectors/tavily-search.connector';
import { KenyaLawConnector } from '@/legal-sources/connectors/kenya-law.connector';
import { KenyaLawJudgmentConnector } from '@/legal-sources/connectors/kenya-law-judgment.connector';
import { LawsAfricaConnector } from '@/legal-sources/connectors/laws-africa.connector';
import { indiaManifestExists, loadIndiaSourcesManifest } from '@/legal-sources/india-manifest.loader';
import { LegalSourceService } from '@/legal-sources/legal-source.service';
import type {
  ResearchCapability,
  ResearchCapabilitySnapshot,
  ResearchSourceCapability,
} from './research-planning.types';

const ALL_CAPABILITIES: ResearchCapability[] = [
  'CASE_LAW',
  'STATUTES',
  'CURRENT_LAW',
  'LIVE_WEB',
  'TREATMENT',
];

@Injectable()
export class ResearchCapabilityService {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly legalSources?: LegalSourceService,
    @Optional() private readonly indiaKanoon?: IndiaKanoonConnector,
    @Optional() private readonly escr?: EscrConnector,
    @Optional() private readonly licensed?: LicensedCaseLawConnector,
    @Optional() private readonly courtListener?: CourtListenerConnector,
    @Optional() private readonly tavily?: TavilySearchConnector,
    @Optional() private readonly kenyaLaw?: KenyaLawConnector,
    @Optional() private readonly kenyaLawJudgments?: KenyaLawJudgmentConnector,
    @Optional() private readonly lawsAfrica?: LawsAfricaConnector,
  ) {}

  async snapshot(jurisdiction?: string): Promise<ResearchCapabilitySnapshot> {
    const normalizedJurisdiction = jurisdiction?.trim().toUpperCase() || 'UNKNOWN';
    const sources: ResearchSourceCapability[] = [];
    const limitations: string[] = [];
    let metadataFailed = false;

    await this.addConfiguredCorpusSources(normalizedJurisdiction, sources, limitations).catch(() => {
      metadataFailed = true;
      limitations.push('Configured corpus metadata could not be read; corpus capabilities are unavailable.');
    });

    if (normalizedJurisdiction === 'IN') {
      try {
        const manifest = loadIndiaSourcesManifest();
        const available = indiaManifestExists() && manifest.acts.length > 0 && manifest.version > 0;
        sources.push({
          id: 'india-statute-manifest',
          kind: 'corpus',
          jurisdiction: 'IN',
          capabilities: ['STATUTES'],
          available,
          edition: String(manifest.version),
          reason: available ? undefined : 'Manifest missing, empty, or unversioned',
        });
      } catch {
        metadataFailed = true;
        sources.push({
          id: 'india-statute-manifest',
          kind: 'corpus',
          jurisdiction: 'IN',
          capabilities: ['STATUTES'],
          available: false,
          reason: 'Manifest metadata unreadable',
        });
      }
      this.addConnector(sources, 'india-kanoon', 'IN', ['CASE_LAW', 'CURRENT_LAW'], this.indiaKanoon);
      this.addConnector(sources, 'e-scr', 'IN', ['CASE_LAW', 'CURRENT_LAW'], this.escr);
      this.addConnector(
        sources,
        'licensed-case-law',
        'IN',
        ['CASE_LAW', 'CURRENT_LAW', 'TREATMENT'],
        this.licensed,
      );
    } else if (normalizedJurisdiction === 'US') {
      this.addConnector(
        sources,
        'court-listener',
        'US',
        ['CASE_LAW', 'CURRENT_LAW', 'TREATMENT'],
        this.courtListener,
      );
    } else if (normalizedJurisdiction === 'KE') {
      this.addPublicConnector(
        sources,
        'kenya-law-legislation',
        'KE',
        ['STATUTES', 'CURRENT_LAW'],
        Boolean(this.kenyaLaw),
      );
      this.addPublicConnector(
        sources,
        'kenya-law-judgments',
        'KE',
        ['CASE_LAW', 'CURRENT_LAW'],
        Boolean(this.kenyaLawJudgments),
      );
      this.addPublicConnector(
        sources,
        'laws-africa-ke',
        'KE',
        ['STATUTES', 'CURRENT_LAW'],
        this.lawsAfrica?.isEnabled() === true,
        'Laws.Africa API token is not configured',
      );
    } else if (normalizedJurisdiction === 'GB') {
      // There is no licensed GB connector. Judgments and legislation are reached
      // through their official publishers via grounded web retrieval, which is
      // still a real primary source — not a reasoning-only fallback.
      let officialWebAvailable = false;
      try {
        officialWebAvailable = this.tavily?.isConfigured() === true;
      } catch {
        officialWebAvailable = false;
      }
      this.addPublicConnector(
        sources,
        'find-case-law-gb',
        'GB',
        ['CASE_LAW', 'CURRENT_LAW'],
        officialWebAvailable,
        'Grounded web retrieval is not configured, so judgments cannot be reached',
      );
      this.addPublicConnector(
        sources,
        'legislation-gov-uk',
        'GB',
        ['STATUTES', 'CURRENT_LAW'],
        officialWebAvailable,
        'Grounded web retrieval is not configured, so legislation cannot be reached',
      );
    }

    if (normalizedJurisdiction === 'IN') {
      this.addConnector(sources, 'india-official-web', 'IN', ['CASE_LAW', 'STATUTES', 'CURRENT_LAW'], this.tavily);
    }

    this.addConnector(sources, 'tavily', normalizedJurisdiction, ['LIVE_WEB', 'CURRENT_LAW'], this.tavily);

    const availableCapabilities = ALL_CAPABILITIES.filter((capability) =>
      sources.some((source) => source.available && source.capabilities.includes(capability)),
    );
    const unavailableCapabilities = ALL_CAPABILITIES.filter(
      (capability) => !availableCapabilities.includes(capability),
    );
    if (sources.length === 0) limitations.push('No capability metadata exists for this jurisdiction.');
    for (const capability of unavailableCapabilities) {
      limitations.push(`${capability} is unavailable or could not be verified.`);
    }
    const availableSources = sources.filter((source) => source.available);
    const connectorAvailability = Object.fromEntries(
      sources
        .filter((source) => source.kind === 'connector')
        .map((source) => [source.id, source.available]),
    );
    const officialSourceAccess = availableSources.some((source) =>
      /(?:e-scr|statute-manifest|registry|kenya-law)/.test(source.id),
    );
    const fullTextSupport = availableSources.some((source) =>
      /(?:india-kanoon|e-scr|licensed-case-law|court-listener|kenya-law|laws-africa)/.test(source.id),
    );
    const treatmentGraphAvailable = availableSources.some(
      (source) => source.capabilities.includes('TREATMENT') && source.kind === 'connector',
    );

    return {
      generatedAt: new Date().toISOString(),
      jurisdiction: normalizedJurisdiction,
      sources,
      availableCapabilities,
      unavailableCapabilities,
      failClosed: metadataFailed || sources.length === 0 || availableCapabilities.length === 0,
      confidenceCeiling:
        metadataFailed || sources.length === 0 || availableCapabilities.length === 0
          ? 'NONE'
          : !availableCapabilities.includes('CURRENT_LAW') ||
              !availableCapabilities.includes('TREATMENT') ||
              !fullTextSupport
            ? 'MEDIUM'
            : 'HIGH',
      coveredJurisdictions:
        availableSources.length > 0 ? [...new Set(availableSources.map((source) => source.jurisdiction))] : [],
      courtCoverage:
        normalizedJurisdiction === 'IN' && availableSources.some((source) => source.capabilities.includes('CASE_LAW'))
          ? [
              { court: 'Supreme Court of India', complete: false },
              { court: 'Indian High Courts', complete: false },
            ]
          : normalizedJurisdiction === 'US' &&
              availableSources.some((source) => source.capabilities.includes('CASE_LAW'))
            ? [{ court: 'United States federal and configured state courts', complete: false }]
            : normalizedJurisdiction === 'KE' &&
                availableSources.some((source) => source.capabilities.includes('CASE_LAW'))
              ? [
                  { court: 'Supreme Court of Kenya', complete: false },
                  { court: 'Court of Appeal of Kenya', complete: false },
                  { court: 'High Court and specialised superior courts of Kenya', complete: false },
                ]
              : normalizedJurisdiction === 'GB' &&
                  availableSources.some((source) => source.capabilities.includes('CASE_LAW'))
                ? [
                    { court: 'UK Supreme Court', complete: false },
                    { court: 'Court of Appeal (England & Wales)', complete: false },
                    { court: 'High Court (England & Wales)', complete: false },
                  ]
            : [],
      statuteEditions: availableSources
        .filter((source) => source.capabilities.includes('STATUTES') && source.edition)
        .map((source) => ({
          corpusId: source.id,
          edition: source.edition as string,
          asOfDate: source.lastVerified,
        })),
      treatmentGraphAvailable,
      pinpointSupport: false,
      officialSourceAccess,
      fullTextSupport,
      ocrSupport: false,
      languageSupport: normalizedJurisdiction === 'KE' ? ['en', 'sw'] : ['en'],
      connectorAvailability,
      limitations,
    };
  }

  private async addConfiguredCorpusSources(
    jurisdiction: string,
    output: ResearchSourceCapability[],
    limitations: string[],
  ): Promise<void> {
    if (!this.legalSources) {
      limitations.push('Legal source registry is unavailable; registry-backed corpus sources are disabled.');
      return;
    }
    const rows = await this.legalSources.list({ countryCode: jurisdiction, enabled: true });
    for (const row of rows) {
      const sourceType = String(row.sourceType ?? '').toLowerCase();
      const capabilities: ResearchCapability[] = [];
      if (/case|judg|precedent/.test(sourceType)) capabilities.push('CASE_LAW');
      if (/statute|legislation|regulation|code|act/.test(sourceType)) capabilities.push('STATUTES');
      if (capabilities.length === 0) continue;
      output.push({
        id: `registry:${row.id}`,
        kind: 'corpus',
        jurisdiction,
        capabilities,
        available: row.enabled === true,
        reason: row.enabled === true ? undefined : 'Source disabled in registry',
      });
    }
  }

  private addConnector(
    output: ResearchSourceCapability[],
    id: string,
    jurisdiction: string,
    capabilities: ResearchCapability[],
    connector?: { isConfigured(): boolean },
  ): void {
    let available = false;
    let reason: string | undefined;
    const connectorsEnabled =
      this.config.get<string>('LEGAL_RESEARCH_LIVE_CONNECTORS_ENABLED', 'true') === 'true';
    try {
      available = connectorsEnabled && connector?.isConfigured() === true;
      if (!connectorsEnabled) reason = 'Live connectors disabled by configuration';
      else if (!available) reason = connector ? 'Connector is not configured' : 'Connector is not registered';
    } catch {
      reason = 'Connector configuration check failed';
    }
    output.push({ id, kind: 'connector', jurisdiction, capabilities, available, reason });
  }

  private addPublicConnector(
    output: ResearchSourceCapability[],
    id: string,
    jurisdiction: string,
    capabilities: ResearchCapability[],
    registeredAndAvailable: boolean,
    unavailableReason = 'Connector is not registered',
  ): void {
    const connectorsEnabled =
      this.config.get<string>('LEGAL_RESEARCH_LIVE_CONNECTORS_ENABLED', 'true') === 'true';
    output.push({
      id,
      kind: 'connector',
      jurisdiction,
      capabilities,
      available: connectorsEnabled && registeredAndAvailable,
      reason: !connectorsEnabled
        ? 'Live connectors disabled by configuration'
        : registeredAndAvailable
          ? undefined
          : unavailableReason,
    });
  }
}
