import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parseActTextIntoSections,
  parseConstitutionTextIntoSections,
} from '../parsers/india-act-text.parser';
import {
  findManifestAct,
  resolveMirrorPdfUrl,
  resolvePrimaryPdfUrl,
} from '../india-manifest.loader';
import { extractPdfText, fetchPdfBuffer, hashText } from './india-pdf.util';
import type { StatuteSectionFetchResult } from './us-code.connector';

@Injectable()
export class NcrbSankalanConnector {
  private readonly logger = new Logger(NcrbSankalanConnector.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_NCRB_CONNECTOR', 'true') === 'true';
  }

  async fetchActSections(actId: string): Promise<StatuteSectionFetchResult[]> {
    if (!this.isEnabled()) return [];

    const entry = findManifestAct(actId);
    if (!entry || entry.sourceAuthority !== 'ncrb') {
      return [];
    }

    const url = resolvePrimaryPdfUrl(entry);
    if (!url) return [];

    return this.fetchAndParse(url, actId, 'NCRB Sankalan');
  }

  async fetchAndParse(
    url: string,
    actId: string,
    sourceName: string,
  ): Promise<StatuteSectionFetchResult[]> {
    try {
      const { buffer } = await fetchPdfBuffer(url);
      const rawText = await extractPdfText(buffer);
      const sections = parseActTextIntoSections(rawText);

      return sections.map((section) => ({
        section: section.section,
        title: section.title,
        summary: section.fullText.slice(0, 400),
        fullText: section.fullText,
        sourceUrl: url,
        sourceName,
        contentHash: hashText(section.fullText),
        isRepealed: section.isRepealed,
        repealNotes: section.repealNotes,
      }));
    } catch (err) {
      this.logger.error(`NCRB fetch failed for ${actId}`, err);
      return [];
    }
  }

  async fetchMirrorIfValidated(actId: string): Promise<StatuteSectionFetchResult[]> {
    const mirrorUrl = resolveMirrorPdfUrl(actId);
    if (!mirrorUrl) return [];
    return this.fetchAndParse(mirrorUrl, actId, 'Your Lordships (mirror)');
  }

  /**
   * Fetch the Your Lordships mirror for an act and cross-validate per-section
   * content hashes against primary-source sections (when available).
   *
   * Returns:
   *   - `validated: true`  — mirror text matches primary for all overlapping sections
   *   - `validated: false` — divergences detected; mirror should not be sole source
   *   - `validated: null`  — no primary available for comparison
   */
  async crossValidateMirror(
    actId: string,
    primarySections: StatuteSectionFetchResult[],
  ): Promise<{
    validated: boolean | null;
    matchedSections: number;
    divergedSections: number;
    mirrorSections: number;
  }> {
    const mirrorSections = await this.fetchMirrorIfValidated(actId);
    if (mirrorSections.length === 0) {
      return { validated: null, matchedSections: 0, divergedSections: 0, mirrorSections: 0 };
    }

    if (primarySections.length === 0) {
      return {
        validated: null,
        matchedSections: 0,
        divergedSections: 0,
        mirrorSections: mirrorSections.length,
      };
    }

    const primaryBySection = new Map(primarySections.map((s) => [s.section, s]));
    let matched = 0;
    let diverged = 0;

    for (const mirrorSection of mirrorSections) {
      const primary = primaryBySection.get(mirrorSection.section);
      if (!primary) continue;

      if (mirrorSection.contentHash && primary.contentHash) {
        if (mirrorSection.contentHash === primary.contentHash) {
          matched += 1;
        } else {
          diverged += 1;
          this.logger.warn(
            `Mirror divergence for ${actId} s.${mirrorSection.section}: ` +
              `mirror hash ${mirrorSection.contentHash?.slice(0, 8)} ≠ primary ${primary.contentHash?.slice(0, 8)}`,
          );
        }
      } else {
        // Fall back to text similarity when hashes are absent
        const mirrorSnip = mirrorSection.fullText.slice(0, 200).toLowerCase();
        const primarySnip = primary.fullText.slice(0, 200).toLowerCase();
        const commonChars = [...mirrorSnip].filter((c) => primarySnip.includes(c)).length;
        const similarity = commonChars / Math.max(mirrorSnip.length, primarySnip.length);
        if (similarity >= 0.85) {
          matched += 1;
        } else {
          diverged += 1;
        }
      }
    }

    const validated = diverged === 0 && matched > 0;
    return { validated, matchedSections: matched, divergedSections: diverged, mirrorSections: mirrorSections.length };
  }
}
