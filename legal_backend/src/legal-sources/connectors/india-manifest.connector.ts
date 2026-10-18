import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { findManifestAct, resolvePrimaryPdfUrl } from '../india-manifest.loader';
import { findStatuteByManifestActId } from '@/legal-search/statute-registry';
import { LegislativeDeptConnector } from './legislative-dept.connector';
import { NcrbSankalanConnector } from './ncrb-sankalan.connector';
import { IndiaCodeConnector } from './india-code.connector';
import type { StatuteSectionFetchResult } from './us-code.connector';

/** Resolves India manifest PDF URLs to parsed statute sections. */
@Injectable()
export class IndiaManifestConnector {
  private readonly logger = new Logger(IndiaManifestConnector.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly legislativeDept: LegislativeDeptConnector,
    private readonly ncrb: NcrbSankalanConnector,
    private readonly indiaCode: IndiaCodeConnector,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_INDIA_MANIFEST_CONNECTOR', 'true') === 'true';
  }

  async fetchActSections(actId: string): Promise<StatuteSectionFetchResult[]> {
    if (!this.isEnabled()) return [];

    const entry = findManifestAct(actId);
    if (!entry) return [];

    if (actId === 'constitution') {
      const { sections } = await this.legislativeDept.fetchConstitutionSections();
      return sections;
    }

    // Bundled local PDF is canonical — never fall back to mirrors when set.
    if (entry.localPdfPath) {
      const localSections = await this.legislativeDept.fetchManifestActSections(actId);
      if (localSections.length > 0) return localSections;
      this.logger.error(
        `Local PDF configured for ${actId} but parse returned 0 sections; not falling back to mirrors`,
      );
      return [];
    }

    if (entry.sourceAuthority === 'ncrb') {
      const primary = await this.ncrb.fetchActSections(actId);
      if (primary.length > 0) return primary;
    }

    // For acts sourced only from the Your Lordships mirror (personal law acts
    // not yet on India Code primary PDFs), fetch directly from the mirror URL.
    if (entry.sourceAuthority === 'yourlordships-mirror') {
      this.logger.log(`Fetching YL mirror for ${actId}…`);
      const mirrorUrl = entry.primaryPdfUrl;
      if (mirrorUrl) {
        const sections = await this.ncrb.fetchAndParse(
          mirrorUrl,
          actId,
          'Your Lordships (mirror, tier-2)',
        );
        if (sections.length > 0) {
          this.logger.log(`YL mirror returned ${sections.length} sections for ${actId}`);
          return sections;
        }
      }
      return [];
    }

    const manifestSections = await this.legislativeDept.fetchManifestActSections(actId);
    if (manifestSections.length > 0) return manifestSections;

    if (entry.externalId && this.indiaCode.isEnabled()) {
      const indiaCodeSections = await this.indiaCode.fetchActSections(entry.externalId);
      if (indiaCodeSections.length > 0) return indiaCodeSections;
    }

    const url = resolvePrimaryPdfUrl(entry);
    if (url) {
      this.logger.warn(`Primary fetch empty for ${actId}; attempting mirror`);
      const mirror = await this.ncrb.fetchMirrorIfValidated(actId);
      if (mirror.length > 0) return mirror;
    }

    const statute = findStatuteByManifestActId(actId);
    if (
      statute?.externalId &&
      !statute.externalId.startsWith('manifest/') &&
      this.indiaCode.isEnabled()
    ) {
      this.logger.log(`Manifest fetch empty for ${actId}; trying registry externalId`);
      const registrySections = await this.indiaCode.fetchActSections(statute.externalId);
      if (registrySections.length > 0) return registrySections;
    }

    return [];
  }
}
