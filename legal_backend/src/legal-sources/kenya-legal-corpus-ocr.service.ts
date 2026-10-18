import { Injectable } from '@nestjs/common';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
import type { KenyaGazettePageInput } from './kenya-gazette.service';

/**
 * Legal-corpus OCR is deliberately separate from tenant document OCR.
 * The provider currently returns text without calibrated page confidence, so
 * every result is marked below the automatic-law-update threshold.
 */
@Injectable()
export class KenyaLegalCorpusOcrService {
  constructor(private readonly azureOcr: AzureOcrService) {}

  async extractGazettePages(
    content: Buffer,
    mimeType = 'application/pdf',
  ): Promise<KenyaGazettePageInput[]> {
    const text = await this.azureOcr.extractTextFromBuffer(content, mimeType);
    const pageTexts = text
      .split(/\f|\n-{3,}\s*PAGE\s+\d+\s*-{3,}\n/gi)
      .map((page) => page.trim())
      .filter(Boolean);

    return (pageTexts.length > 0 ? pageTexts : [text]).map((page, index) => ({
      pageNumber: index + 1,
      text: page,
      extractionMethod: 'OCR',
      // Azure wrapper does not expose calibrated confidence. Fail closed.
      extractionConfidence: 0.75,
    }));
  }
}
