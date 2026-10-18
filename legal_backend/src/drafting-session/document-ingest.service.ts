import { BadRequestException, Injectable } from '@nestjs/common';
import { AzureOcrService } from '@/ocr/azure-ocr.service';

export type IngestSourceFormat = 'docx' | 'pdf' | 'txt' | 'md';

export interface DocumentIngestResult {
  html: string;
  plainText: string;
  sourceFormat: IngestSourceFormat;
  mimeType: string;
}

@Injectable()
export class DocumentIngestService {
  constructor(private readonly azureOcr: AzureOcrService) {}

  detectFormat(mime: string, fileName: string): {
    isPdf: boolean;
    isDocx: boolean;
    isText: boolean;
  } {
    const ext = (fileName ?? '').toLowerCase();
    return {
      isPdf: mime === 'application/pdf' || ext.endsWith('.pdf'),
      isDocx:
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/msword' ||
        ext.endsWith('.docx') ||
        ext.endsWith('.doc'),
      isText:
        mime === 'text/plain' ||
        mime === 'text/markdown' ||
        ext.endsWith('.txt') ||
        ext.endsWith('.md'),
    };
  }

  async ingestBuffer(
    buffer: Buffer,
    mime: string,
    fileName: string,
  ): Promise<DocumentIngestResult> {
    const { isPdf, isDocx, isText } = this.detectFormat(mime, fileName);

    if (isText) {
      const plainText = buffer.toString('utf8');
      return {
        html: this.textToHtml(plainText),
        plainText,
        sourceFormat: fileName.toLowerCase().endsWith('.md') ? 'md' : 'txt',
        mimeType: mime || 'text/plain',
      };
    }

    if (isDocx) {
      const mammoth = await import('mammoth');
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const textResult = await mammoth.extractRawText({ buffer });
      const html = htmlResult.value?.trim() || this.textToHtml(textResult.value ?? '');
      const plainText = textResult.value ?? '';
      if (!plainText.trim()) {
        throw new BadRequestException('Could not extract content from the Word document.');
      }
      return {
        html,
        plainText,
        sourceFormat: 'docx',
        mimeType: mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }

    if (isPdf) {
      let plainText = '';
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        plainText = pdfData.text ?? '';
      } catch {
        plainText = '';
      }

      if (!plainText.trim()) {
        try {
          plainText = await this.azureOcr.extractTextFromBuffer(buffer, 'application/pdf');
        } catch {
          plainText = '';
        }
      }

      if (!plainText.trim()) {
        throw new BadRequestException(
          'Could not extract text from the PDF. Upload a text-based PDF or DOCX, or paste content manually.',
        );
      }

      return {
        html: this.textToHtml(plainText),
        plainText,
        sourceFormat: 'pdf',
        mimeType: mime || 'application/pdf',
      };
    }

    throw new BadRequestException('Unsupported file type. Upload DOCX, PDF, TXT, or MD.');
  }

  private textToHtml(text: string): string {
    return text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${this.escapeHtml(block.replace(/\n/g, ' '))}</p>`)
      .join('\n');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
