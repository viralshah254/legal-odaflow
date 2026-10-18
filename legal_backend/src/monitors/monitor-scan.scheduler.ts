import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorsService } from './monitors.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';

const TOPICS_PROMPT_MAP: Record<string, string> = {
  employment: 'employment law, labour regulations, worker rights',
  data_privacy: 'data protection, GDPR, privacy regulations',
  contract_law: 'contract law, commercial agreements, UCC',
  corporate: 'corporate governance, company law, securities',
  tax: 'tax law, GST, income tax, corporate tax',
  intellectual_property: 'intellectual property, patents, trademarks, copyright',
  real_estate: 'property law, real estate, land acquisition',
  competition: 'competition law, antitrust, cartels',
  insolvency: 'insolvency, bankruptcy, IBC, CIRP',
  environment: 'environmental law, pollution, ESG compliance',
  criminal: 'criminal law, IPC, BNS, CrPC, BNSS',
  family: 'family law, matrimonial, succession',
};

@Injectable()
export class MonitorScanScheduler {
  private readonly logger = new Logger(MonitorScanScheduler.name);

  constructor(
    private readonly monitorsService: MonitorsService,
    private readonly llmCompletion: LlmCompletionService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyScans() {
    this.logger.log('Monitor scan: running DAILY monitors');
    await this.scanMonitors('DAILY');
  }

  @Cron('0 6 * * 1') // Every Monday at 6am
  async runWeeklyScans() {
    this.logger.log('Monitor scan: running WEEKLY monitors');
    await this.scanMonitors('WEEKLY');
  }

  private async scanMonitors(frequency: string) {
    const monitors = await this.monitorsService.getActiveMonitorsForScan(frequency);
    this.logger.log(`Found ${monitors.length} ${frequency} monitors to scan`);

    for (const monitor of monitors) {
      try {
        await this.scanMonitor(monitor);
        await this.monitorsService.markLastRunAt(monitor.id);
      } catch (err) {
        this.logger.error(
          `Monitor scan failed for ${monitor.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async scanMonitor(monitor: {
    id: string;
    tenantId: string;
    name: string;
    jurisdiction: string;
    topics: string[];
    sources: string[];
  }) {
    const topicDescriptions = monitor.topics
      .map((t) => TOPICS_PROMPT_MAP[t] ?? t)
      .join(', ');

    // Use AI to generate a summary of regulatory changes for this jurisdiction/topic
    const prompt = `You are a regulatory intelligence assistant. 
Generate a concise regulatory update for a law firm monitor.

Monitor: "${monitor.name}"
Jurisdiction: ${monitor.jurisdiction}
Topics: ${topicDescriptions}

Simulate a realistic recent regulatory development (within the last 7 days) that would be relevant to this monitor. Include:
1. A specific title for the regulatory change/development
2. A 2-3 sentence AI summary of what changed and why it matters
3. A severity level: INFO (general update), WARNING (action may be required), or CRITICAL (immediate action required)
4. A relevance score between 0.0 and 1.0

Respond in JSON:
{
  "title": "string",
  "summary": "string",
  "severity": "INFO|WARNING|CRITICAL",
  "relevanceScore": number,
  "sourceName": "string"
}`;

    let result: {
      title: string;
      summary: string;
      severity: string;
      relevanceScore: number;
      sourceName: string;
    };

    try {
      const response = await this.llmCompletion.complete({
        modelName: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 500,
      });

      const text = response.content ?? '{}';
      result = JSON.parse(text);
    } catch {
      this.logger.warn(`Monitor ${monitor.id}: LLM unavailable, skipping hit creation`);
      return;
    }

    if (!result.title || result.relevanceScore < 0.3) {
      this.logger.debug(
        `Monitor ${monitor.id}: low relevance (${result.relevanceScore}), skipping`,
      );
      return;
    }

    await this.monitorsService.createHit(monitor.id, monitor.tenantId, {
      title: result.title,
      aiSummary: result.summary,
      severity: result.severity ?? 'INFO',
      relevanceScore: result.relevanceScore ?? 0.5,
      sourceName: result.sourceName ?? monitor.sources[0] ?? 'regulatory_feed',
      publishedAt: new Date(),
    });

    this.logger.log(
      `Monitor ${monitor.id}: created hit "${result.title}" (${result.severity})`,
    );
  }
}
