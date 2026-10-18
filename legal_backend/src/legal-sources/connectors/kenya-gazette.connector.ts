import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { KenyaSourcePolicyService } from '../kenya-source-policy.service';
import {
  isKenyaLawRetryableStatus,
  kenyaLawFetchHeaders,
  kenyaLawThrottleBackoff,
  kenyaLawRateLimit,
} from './kenya-law-rate-limit';

export interface KenyaGazetteCatalogEntry {
  title: string;
  sourceUrl: string;
  gazetteNumber?: string;
  gazetteDate?: Date;
}

export interface KenyaGazetteFile {
  entry: KenyaGazetteCatalogEntry;
  content: Buffer;
  mediaType: string;
  sha256: string;
}

@Injectable()
export class KenyaGazetteConnector {
  private static readonly ALLOWED_HOST = 'new.kenyalaw.org';

  constructor(private readonly sourcePolicy: KenyaSourcePolicyService) {}

  async listArchivePage(
    url = 'https://new.kenyalaw.org/gazettes/',
    options: { production?: boolean } = {},
  ): Promise<KenyaGazetteCatalogEntry[]> {
    const response = await this.fetchAllowed(url, options);
    const html = await response.text();
    return parseKenyaGazetteArchivePage(html, url);
  }

  async fetchGazetteFile(
    entry: KenyaGazetteCatalogEntry,
    options: { production?: boolean } = {},
  ): Promise<KenyaGazetteFile> {
    const response = await this.fetchAllowed(entry.sourceUrl, options);
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      entry,
      content: bytes,
      mediaType: response.headers.get('content-type') ?? 'application/octet-stream',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  private async fetchAllowed(
    urlValue: string,
    options: { production?: boolean },
  ): Promise<Response> {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' || url.hostname !== KenyaGazetteConnector.ALLOWED_HOST) {
      throw new Error(`Rejected non-Kenya-Law Gazette URL: ${urlValue}`);
    }
    const policy = await this.sourcePolicy.assertFetchAllowed('KENYA_GAZETTE', options);
    const startedAt = new Date();
    let lastError: unknown;

    for (let attempt = 1; attempt <= policy.retryBudget; attempt += 1) {
      try {
        await kenyaLawRateLimit();
        const response = await fetch(url, {
          headers: kenyaLawFetchHeaders(),
          signal: AbortSignal.timeout(60_000),
          redirect: 'error',
        });
        if (isKenyaLawRetryableStatus(response.status) && attempt < policy.retryBudget) {
          await this.sourcePolicy.recordFetch({
            sourcePolicyId: policy.id,
            url: url.toString(),
            startedAt,
            completedAt: new Date(),
            responseStatus: response.status,
            attempt,
            outcome: 'RETRY',
          });
          await kenyaLawThrottleBackoff(response.status, attempt);
          continue;
        }
        await this.sourcePolicy.recordFetch({
          sourcePolicyId: policy.id,
          url: url.toString(),
          startedAt,
          completedAt: new Date(),
          responseStatus: response.status,
          attempt,
          outcome: response.ok ? 'SUCCESS' : 'FAILED',
        });
        if (!response.ok) {
          throw new Error(`Kenya Gazette fetch returned ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < policy.retryBudget) {
          await kenyaLawThrottleBackoff(503, attempt);
        }
      }
    }

    await this.sourcePolicy.recordFetch({
      sourcePolicyId: policy.id,
      url: url.toString(),
      startedAt,
      completedAt: new Date(),
      attempt: policy.retryBudget,
      outcome: 'FAILED',
      errorCode: lastError instanceof Error ? lastError.name : 'UNKNOWN',
    });
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

export function parseKenyaGazetteArchivePage(
  html: string,
  baseUrl: string,
): KenyaGazetteCatalogEntry[] {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();
  const entries: KenyaGazetteCatalogEntry[] = [];

  for (const link of links) {
    const title = stripTags(link[2]);
    if (!/\b(?:Kenya\s+)?Gazette\b/i.test(title)) continue;
    const sourceUrl = new URL(link[1], baseUrl).toString();
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    entries.push({
      title,
      sourceUrl,
      gazetteNumber:
        title.match(/\b(?:Gazette\s+)?(?:No\.?|Number)\s*([A-Z0-9/-]+)/i)?.[1],
      gazetteDate: parseDate(title),
    });
  }
  return entries;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDate(value: string): Date | undefined {
  const match = value.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i,
  );
  if (!match) return undefined;
  const date = new Date(`${match[1]} ${match[2]} ${match[3]} UTC`);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}
