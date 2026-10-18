import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AzureOcrService {
  private readonly logger = new Logger(AzureOcrService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Extract text from a file buffer using Azure Document Intelligence.
   * Sends the raw bytes directly — Azure does NOT support data: URIs as urlSource.
   */
  async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    const endpoint = this.configService.get<string>('AZURE_OCR_ENDPOINT', '').trim();
    const apiKey = this.configService.get<string>('AZURE_OCR_API_KEY', '').trim();
    const model = this.configService
      .get<string>('AZURE_OCR_MODEL', 'prebuilt-read')
      .trim();

    if (!endpoint || !apiKey) {
      this.logger.warn('Azure OCR not configured (AZURE_OCR_ENDPOINT / AZURE_OCR_API_KEY missing)');
      throw new ServiceUnavailableException(
        'OCR is not configured. Set AZURE_OCR_ENDPOINT and AZURE_OCR_API_KEY.',
      );
    }

    const baseUrl = endpoint.replace(/\/$/, '');
    // API path changed from /formrecognizer/ to /documentintelligence/ in version 2024-11-30
    const analyzeUrl = `${baseUrl}/documentintelligence/documentModels/${model}:analyze?api-version=2024-11-30`;

    this.logger.log(`Azure OCR: submitting ${buffer.length} bytes (${mimeType}) to ${model}`);

    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      this.logger.error(`Azure OCR analyze failed (${analyzeResponse.status}): ${errorText}`);
      throw new Error(`Azure OCR analyze request failed (${analyzeResponse.status}): ${errorText}`);
    }

    const operationLocation = analyzeResponse.headers.get('operation-location');
    if (!operationLocation) {
      throw new Error('Azure OCR analyze response missing operation-location header');
    }

    const startedAt = Date.now();
    const timeoutMs = 120_000;
    const pollIntervalMs = 2_000;

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Azure OCR status request failed: ${errorText}`);
      }

      const payload = (await statusResponse.json()) as {
        status?: string;
        analyzeResult?: {
          content?: string;
          pages?: Array<{ lines?: Array<{ content?: string }> }>;
        };
      };

      const status = (payload.status ?? '').toLowerCase();

      if (status === 'succeeded') {
        const content = payload.analyzeResult?.content?.trim();
        if (content) {
          this.logger.log(`Azure OCR: extracted ${content.length} chars`);
          return content;
        }

        const lines =
          payload.analyzeResult?.pages
            ?.flatMap((page) => page.lines ?? [])
            .map((line) => line.content?.trim())
            .filter((line): line is string => Boolean(line)) ?? [];

        const result = lines.join('\n');
        this.logger.log(`Azure OCR: extracted ${result.length} chars from page lines`);
        return result;
      }

      if (status === 'failed') {
        throw new Error('Azure OCR operation failed');
      }

      this.logger.debug(`Azure OCR status: ${status} (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    }

    this.logger.warn('Azure OCR timed out after 120s');
    throw new Error('Azure OCR timed out after 120s');
  }

  /**
   * @deprecated Use extractTextFromBuffer instead.
   * Kept for backward compatibility — strips the data: prefix and delegates.
   */
  async extractTextFromUrl(dataUri: string): Promise<string> {
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      return this.extractTextFromBuffer(buffer, mimeType);
    }
    // Genuine public URL — use urlSource (for future use)
    throw new Error('extractTextFromUrl: only data: URIs supported via this wrapper; use extractTextFromBuffer directly');
  }
}
