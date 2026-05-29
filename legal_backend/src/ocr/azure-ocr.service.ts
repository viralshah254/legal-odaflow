import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AzureOcrService {
  private readonly logger = new Logger(AzureOcrService.name);

  constructor(private readonly configService: ConfigService) {}

  async extractTextFromUrl(fileUrl: string): Promise<string> {
    const endpoint = this.configService.get<string>('AZURE_OCR_ENDPOINT', '').trim();
    const apiKey = this.configService.get<string>('AZURE_OCR_API_KEY', '').trim();
    const model = this.configService
      .get<string>('AZURE_OCR_MODEL', 'prebuilt-read')
      .trim();

    if (!endpoint || !apiKey) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'AZURE_OCR_ENDPOINT and AZURE_OCR_API_KEY are required in production',
        );
      }
      return `[OCR mock] Configure AZURE_OCR_ENDPOINT and AZURE_OCR_API_KEY to enable extraction.\nSource: ${fileUrl}`;
    }

    const baseUrl = endpoint.replace(/\/$/, '');
    const analyzeUrl = `${baseUrl}/formrecognizer/documentModels/${model}:analyze?api-version=2024-02-29-preview`;

    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urlSource: fileUrl }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      throw new Error(`Azure OCR analyze request failed: ${errorText}`);
    }

    const operationLocation = analyzeResponse.headers.get('operation-location');
    if (!operationLocation) {
      throw new Error('Azure OCR analyze response missing operation-location header');
    }

    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const pollIntervalMs = 1_500;

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Azure OCR status request failed: ${errorText}`);
      }

      const payload = (await statusResponse.json()) as {
        status?: string;
        analyzeResult?: {
          content?: string;
          pages?: Array<{
            lines?: Array<{ content?: string }>;
          }>;
        };
      };

      const status = (payload.status ?? '').toLowerCase();
      if (status === 'succeeded') {
        const content = payload.analyzeResult?.content?.trim();
        if (content) {
          return content;
        }

        const lines =
          payload.analyzeResult?.pages
            ?.flatMap((page) => page.lines ?? [])
            .map((line) => line.content?.trim())
            .filter((line): line is string => Boolean(line)) ?? [];

        return lines.join('\n');
      }

      if (status === 'failed') {
        throw new Error('Azure OCR operation failed');
      }
    }

    this.logger.warn('Azure OCR timed out; returning empty extraction');
    return '';
  }
}
