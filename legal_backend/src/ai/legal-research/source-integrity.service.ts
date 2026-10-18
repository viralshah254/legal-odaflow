import type { SourceProvenance } from '@/legal-search/legal-retrieval.types';

export type IntegrityState = 'PASS' | 'FAIL' | 'INDETERMINATE';

export interface SourceIntegrityAssessment {
  state: IntegrityState;
  intact: boolean;
  reasons: string[];
}

/**
 * Pure, deterministic source-integrity policy. Unknown integrity is never
 * converted into a pass; callers deciding admission must fail closed.
 */
export class SourceIntegrityService {
  assess(provenance?: SourceProvenance): SourceIntegrityAssessment {
    if (!provenance) {
      return {
        state: 'INDETERMINATE',
        intact: false,
        reasons: ['Source provenance is missing.'],
      };
    }

    const failures: string[] = [];
    const unknowns: string[] = [];
    if (!provenance.provider.trim()) failures.push('Source provider is missing.');
    if (!this.isIsoDate(provenance.retrievedAt)) failures.push('Retrieval timestamp is invalid.');
    if (provenance.completeness === 'UNKNOWN') unknowns.push('Document completeness is unknown.');
    if (provenance.extractionMethod === 'UNKNOWN') unknowns.push('Extraction method is unknown.');
    if (provenance.authoritativeStatus === 'UNKNOWN') {
      unknowns.push('Authoritative source status is unknown.');
    }
    if (!provenance.documentHash) unknowns.push('A document content hash is unavailable.');
    if ((provenance.missingPages?.length ?? 0) > 0) {
      failures.push(`Document is missing page${provenance.missingPages?.length === 1 ? '' : 's'} ${provenance.missingPages?.join(', ')}.`);
    }
    if (provenance.paragraphNumberingIntegrity === 'CORRUPT') {
      failures.push('Paragraph numbering is corrupt.');
    } else if (provenance.paragraphNumberingIntegrity === 'UNKNOWN') {
      unknowns.push('Paragraph-number integrity is unknown.');
    }
    if (provenance.dispositionComplete === false) {
      failures.push('The judgment disposition is incomplete.');
    }

    if (provenance.extractionMethod === 'OCR') {
      if (!provenance.ocr?.used) failures.push('OCR extraction lacks OCR integrity metadata.');
      if (provenance.ocr?.confidence === undefined) {
        unknowns.push('OCR confidence is unavailable.');
      } else if (provenance.ocr.confidence < 0.85) {
        failures.push('OCR confidence is below the 0.85 integrity threshold.');
      }
      if (
        provenance.ocr?.pageCoverage !== undefined &&
        (provenance.ocr.pageCoverage < 0 || provenance.ocr.pageCoverage > 1)
      ) {
        failures.push('OCR page coverage must be between 0 and 1.');
      }
    }

    const language = provenance.language;
    if (language?.translated) {
      if (!language.sourceLanguage || !language.targetLanguage) {
        failures.push('Translated text lacks source or target language metadata.');
      }
      if (!language.method || language.method === 'UNKNOWN') {
        unknowns.push('Translation method is unknown.');
      }
      if (language.method === 'MACHINE' && !language.humanReviewed) {
        unknowns.push('Machine translation has not been human reviewed.');
      }
    }

    if (failures.length > 0) return { state: 'FAIL', intact: false, reasons: failures };
    if (unknowns.length > 0) {
      return { state: 'INDETERMINATE', intact: false, reasons: unknowns };
    }
    return { state: 'PASS', intact: true, reasons: [] };
  }

  private isIsoDate(value: string): boolean {
    return Boolean(value) && !Number.isNaN(Date.parse(value));
  }
}
