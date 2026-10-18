import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { JobsService } from '@/jobs/jobs.service';

interface LegalUpdateSource {
  id: string;
  jurisdiction: string;
  name: string;
  feedUrl: string;
  feedType: 'rss' | 'api' | 'scrape';
}

interface RawLegalUpdate {
  title: string;
  url: string;
  publishedAt: Date;
  content?: string;
  jurisdiction: string;
  source: string;
}

/**
 * Ingests legal updates from external sources (RSS feeds, APIs, scrapers),
 * classifies significance with LLM, links to affected documents/propositions,
 * and records the update for re-verification scheduling.
 */
@Injectable()
export class LegalUpdateIngestService {
  private readonly logger = new Logger(LegalUpdateIngestService.name);

  /**
   * Legal news/update sources for each jurisdiction.
   * In production these should be stored in DB (LegalUpdateSource table).
   */
  private readonly SOURCES: LegalUpdateSource[] = [
    {
      id: 'scc_india',
      jurisdiction: 'IN',
      name: 'Supreme Court of India',
      feedUrl: 'https://main.sci.gov.in/orders',
      feedType: 'scrape',
    },
    {
      id: 'moj_india',
      jurisdiction: 'IN',
      name: 'Ministry of Law and Justice',
      feedUrl: 'https://legislative.gov.in/recent-acts',
      feedType: 'scrape',
    },
    {
      id: 'courtlistener_us',
      jurisdiction: 'US',
      name: 'CourtListener (US Federal)',
      feedUrl: 'https://www.courtlistener.com/feed/opinions/',
      feedType: 'rss',
    },
    {
      id: 'kenya_law_rss',
      jurisdiction: 'KE',
      name: 'Kenya Law',
      feedUrl: 'https://new.kenyalaw.org/feeds/judgments.xml',
      feedType: 'rss',
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  /**
   * Entry point called by the LEGAL_CRAWL queue worker.
   * Fetches a source, processes updates, and returns count of new records.
   */
  async ingestSource(sourceId: string): Promise<{ processed: number; new: number }> {
    const source = this.SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      this.logger.warn(`Unknown legal update source: ${sourceId}`);
      return { processed: 0, new: 0 };
    }

    const rawUpdates = await this.fetchSourceUpdates(source);
    this.logger.log(`Source ${sourceId}: fetched ${rawUpdates.length} raw updates`);

    let newCount = 0;
    for (const update of rawUpdates) {
      const created = await this.processUpdate(update, source);
      if (created) newCount++;
    }

    return { processed: rawUpdates.length, new: newCount };
  }

  /**
   * Schedule ingestion for all active sources.
   */
  async scheduleAllSources(): Promise<void> {
    for (const source of this.SOURCES) {
      await this.jobsService.enqueueLegalCrawl({
        sourceId: source.id,
        sourceUrl: source.feedUrl,
        jurisdiction: source.jurisdiction,
      });
    }
    this.logger.log(`Scheduled ${this.SOURCES.length} legal update sources for crawl`);
  }

  private async fetchSourceUpdates(source: LegalUpdateSource): Promise<RawLegalUpdate[]> {
    if (source.feedType === 'rss') {
      return this.fetchRssFeed(source);
    }
    // scrape/api types — returns empty for now, to be filled when connectors are wired
    return [];
  }

  private async fetchRssFeed(source: LegalUpdateSource): Promise<RawLegalUpdate[]> {
    try {
      const response = await fetch(source.feedUrl, {
        headers: { 'User-Agent': 'Umbrella Legal Bot/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return [];

      const xml = await response.text();
      const items = this.parseRssItems(xml);

      return items.map((item) => ({
        title: item.title ?? 'Untitled',
        url: item.link ?? source.feedUrl,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        content: item.description,
        jurisdiction: source.jurisdiction,
        source: source.name,
      }));
    } catch (err) {
      this.logger.warn(`RSS fetch failed for ${source.id}: ${String(err)}`);
      return [];
    }
  }

  private parseRssItems(xml: string): Array<Record<string, string>> {
    const items: Array<Record<string, string>> = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const item: Record<string, string> = {};

      for (const field of ['title', 'link', 'pubDate', 'description', 'guid']) {
        const fieldMatch = itemXml.match(new RegExp(`<${field}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|<${field}[^>]*>([^<]*)<\\/${field}>`, 'i'));
        if (fieldMatch) {
          item[field] = (fieldMatch[1] ?? fieldMatch[2] ?? '').trim();
        }
      }

      if (item.title || item.link) {
        items.push(item);
      }

      if (items.length >= 50) break;
    }

    return items;
  }

  private async processUpdate(
    raw: RawLegalUpdate,
    source: LegalUpdateSource,
  ): Promise<boolean> {
    // Dedup by URL
    const existing = await this.prisma.legalUpdateRecord.findFirst({
      where: { sourceUrl: raw.url },
    });
    if (existing) return false;

    // Classify with LLM
    const { updateType, significance, summary, affectedIds } = await this.classifyUpdate(raw);

    // Persist
    await this.prisma.legalUpdateRecord.create({
      data: {
        jurisdiction: raw.jurisdiction,
        updateType,
        title: raw.title.slice(0, 500),
        summary,
        significance,
        sourceUrl: raw.url,
        affectedDocumentIds: affectedIds,
        affectedPropositionIds: [],
        status: 'pending',
        publishedAt: raw.publishedAt,
      },
    });

    this.logger.log(`New legal update: [${significance}] ${raw.title.slice(0, 80)}`);
    return true;
  }

  private async classifyUpdate(raw: RawLegalUpdate): Promise<{
    updateType: string;
    significance: string;
    summary: string;
    affectedIds: string[];
  }> {
    if (!this.llm) {
      return {
        updateType: 'new_case',
        significance: 'informational',
        summary: raw.content?.slice(0, 300) ?? raw.title,
        affectedIds: [],
      };
    }

    const systemPrompt = `You are a legal analyst classifying a legal update.
Classify into:
- updateType: "new_case" | "new_statute" | "amendment" | "repeal" | "new_rule" | "practice_direction" | "authority_treatment_change"
- significance: "informational" | "review" | "high" | "critical"
  - critical: landmark judgment, new constitution, repeal of major statute
  - high: significant precedent, major amendment
  - review: relevant update requiring case review
  - informational: routine update

Respond ONLY with JSON:
{ "updateType": "...", "significance": "...", "summary": "2-sentence summary" }`;

    const userPrompt = `JURISDICTION: ${raw.jurisdiction}
SOURCE: ${raw.source}
TITLE: ${raw.title}
CONTENT: ${(raw.content ?? '').slice(0, 1000)}`;

    try {
      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 200,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');

      const parsed = JSON.parse(jsonMatch[0]) as {
        updateType: string;
        significance: string;
        summary: string;
      };

      // Find affected document IDs by searching corpus
      const affectedIds = await this.findAffectedDocuments(raw.title, raw.jurisdiction);

      return {
        updateType: parsed.updateType ?? 'new_case',
        significance: parsed.significance ?? 'informational',
        summary: parsed.summary ?? raw.title,
        affectedIds,
      };
    } catch {
      return {
        updateType: 'new_case',
        significance: 'informational',
        summary: raw.title,
        affectedIds: [],
      };
    }
  }

  private async findAffectedDocuments(title: string, jurisdiction: string): Promise<string[]> {
    const keywords = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 5)
      .slice(0, 4);

    if (keywords.length === 0) return [];

    const docs = await this.prisma.legalSearchDocument.findMany({
      where: {
        jurisdiction,
        status: 'active',
        OR: keywords.map((k) => ({ title: { contains: k, mode: 'insensitive' as const } })),
      },
      select: { id: true },
      take: 10,
    });

    return docs.map((d) => d.id);
  }
}
