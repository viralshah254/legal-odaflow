import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { DraftFinetuneExportService } from './draft-finetune-export.service';
import {
  getOpenAiApiMode,
  resolveOpenAiAuthHeaders,
} from '@/ai/openai-transport';

const MIN_ROWS_PER_SECTION = 500;
const MIN_NEW_ROWS_FOR_RETRAIN = 100;

/**
 * Azure OpenAI fine-tuning pipeline for drafting models.
 *
 * Flow:
 *   1. Export consented JSONL via DraftFinetuneExportService
 *   2. Upload + create fine-tuning job on Azure (when OPENAI_API_MODE=azure)
 *   3. Poll job status; on success register AiModelAlias for A/B rollout
 *
 * Gated by TRAINING_ALLOW_FINE_TUNING=true and data-volume thresholds.
 */
@Injectable()
export class AzureFineTuneService {
  private readonly logger = new Logger(AzureFineTuneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: DraftFinetuneExportService,
    private readonly config: ConfigService,
  ) {}

  /** Monthly check for sections ready to fine-tune. */
  @Cron('0 4 1 * *') // 04:00 UTC on the 1st of each month
  async runMonthlyCycle(): Promise<void> {
    if (!this.isEnabled()) return;
    this.logger.log('Azure fine-tune: starting monthly cycle');

    const candidates = await this.findEligibleSections();
    for (const c of candidates) {
      await this.startFineTuneJob(c).catch((err) => {
        this.logger.error(
          `Fine-tune failed for ${c.documentKind}/${c.sectionType}: ${String(err)}`,
        );
      });
    }
  }

  isEnabled(): boolean {
    return (
      this.config.get<string>('TRAINING_ALLOW_FINE_TUNING', 'false') === 'true' &&
      process.env.DISABLE_AZURE_FINETUNE !== '1'
    );
  }

  async findEligibleSections(): Promise<
    Array<{ documentKind: string; sectionType: string; rowCount: number }>
  > {
    const rows = await (this.prisma as any).draftSectionFeedback.groupBy({
      by: ['documentKind', 'sectionType'],
      where: {
        rating: { in: ['accepted', 'minor_edit'] },
        editRatio: { gte: 0.7 },
      },
      _count: { id: true },
    }).catch(() => []);

    const eligible: Array<{ documentKind: string; sectionType: string; rowCount: number }> = [];
    for (const row of rows) {
      const count = row._count?.id ?? 0;
      if (count < MIN_ROWS_PER_SECTION) continue;

      const lastJob = await (this.prisma as any).azureFineTuneJob.findFirst({
        where: {
          documentKind: row.documentKind,
          sectionType: row.sectionType,
          status: { in: ['succeeded', 'running', 'pending'] },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null);

      if (lastJob?.status === 'running' || lastJob?.status === 'pending') continue;
      if (lastJob?.status === 'succeeded') {
        const since = lastJob.completedAt ?? lastJob.createdAt;
        const newCount = await (this.prisma as any).draftSectionFeedback.count({
          where: {
            documentKind: row.documentKind,
            sectionType: row.sectionType,
            rating: { in: ['accepted', 'minor_edit'] },
            editRatio: { gte: 0.7 },
            createdAt: { gte: since },
          },
        }).catch(() => 0);
        if (newCount < MIN_NEW_ROWS_FOR_RETRAIN) continue;
      }

      if (await this.hasRisingErrorRate(row.documentKind, row.sectionType)) {
        this.logger.warn(
          `Skipping fine-tune for ${row.documentKind}/${row.sectionType}: rising error categories`,
        );
        continue;
      }

      eligible.push({
        documentKind: row.documentKind,
        sectionType: row.sectionType,
        rowCount: count,
      });
    }
    return eligible;
  }

  async startFineTuneJob(opts: {
    documentKind: string;
    sectionType: string;
    baseModel?: string;
  }): Promise<{ jobId: string; azureJobId?: string }> {
    if (!this.isEnabled()) {
      throw new Error('Fine-tuning is disabled (set TRAINING_ALLOW_FINE_TUNING=true)');
    }

    const baseModel =
      opts.baseModel ??
      this.config.get<string>('AI_MID_MODEL', 'gpt-5.6-terra');

    const { jsonl, rowCount } = await this.exportService.exportJsonl({
      documentKind: opts.documentKind,
      sectionType: opts.sectionType,
      minEditRatio: 0.7,
      limit: 10000,
    });

    if (rowCount < MIN_ROWS_PER_SECTION) {
      throw new Error(
        `Need ≥${MIN_ROWS_PER_SECTION} rows; got ${rowCount} for ${opts.documentKind}/${opts.sectionType}`,
      );
    }

    const record = await (this.prisma as any).azureFineTuneJob.create({
      data: {
        documentKind: opts.documentKind,
        sectionType: opts.sectionType,
        baseModel,
        status: 'pending',
        rowCount,
      },
    });

    if (getOpenAiApiMode(this.config) !== 'azure') {
      await (this.prisma as any).azureFineTuneJob.update({
        where: { id: record.id },
        data: {
          status: 'exported',
          errorMessage: 'OPENAI_API_MODE is not azure — JSONL ready for manual upload',
        },
      });
      this.logger.log(
        `Fine-tune dataset exported (${rowCount} rows) for ${opts.documentKind}/${opts.sectionType} — upload manually`,
      );
      return { jobId: record.id };
    }

    try {
      const azureJobId = await this.createAzureFineTuneJob(jsonl, baseModel);
      await (this.prisma as any).azureFineTuneJob.update({
        where: { id: record.id },
        data: { azureJobId, status: 'running' },
      });
      return { jobId: record.id, azureJobId };
    } catch (err) {
      await (this.prisma as any).azureFineTuneJob.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  @Cron('0 */6 * * *')
  async pollRunningJobs(): Promise<void> {
    if (!this.isEnabled()) return;

    const running = await (this.prisma as any).azureFineTuneJob.findMany({
      where: { status: 'running', azureJobId: { not: null } },
      take: 20,
    }).catch(() => []);

    for (const job of running) {
      await this.pollOne(job).catch((err) => {
        this.logger.warn(`Poll failed for ${job.id}: ${String(err)}`);
      });
    }
  }

  async registerDeployment(jobId: string, deploymentName: string): Promise<void> {
    const job = await (this.prisma as any).azureFineTuneJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error(`Fine-tune job ${jobId} not found`);

    const alias = `drafting:${job.documentKind}:${job.sectionType}`;
    const model = await this.prisma.aiModel.findFirst({
      where: {
        OR: [
          { providerModelId: deploymentName },
          { providerModelId: job.fineTunedModel ?? '' },
          { providerModelId: job.baseModel },
        ],
        enabled: true,
      },
      select: { id: true },
    });

    if (model) {
      await this.prisma.aiModelAlias.upsert({
        where: { alias },
        create: { alias, aiModelId: model.id, taskType: job.sectionType },
        update: { aiModelId: model.id, enabled: true },
      });
    }

    await (this.prisma as any).azureFineTuneJob.update({
      where: { id: jobId },
      data: {
        deploymentName,
        modelAlias: alias,
        status: 'succeeded',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Registered fine-tuned deployment ${deploymentName} as alias ${alias}`);
  }

  private azureBaseUrl(): string {
    const endpoint = (this.config.get<string>('AZURE_OPENAI_ENDPOINT', '') ?? '')
      .trim()
      .replace(/\/$/, '');
    return `${endpoint}/openai`;
  }

  private azureApiVersion(): string {
    return (
      (this.config.get<string>('AZURE_OPENAI_API_VERSION', '2024-10-21') ?? '2024-10-21').trim() ||
      '2024-10-21'
    );
  }

  private async pollOne(job: {
    id: string;
    azureJobId: string;
    documentKind: string;
    sectionType: string;
    baseModel: string;
  }): Promise<void> {
    const url = `${this.azureBaseUrl()}/fine_tuning/jobs/${job.azureJobId}?api-version=${encodeURIComponent(this.azureApiVersion())}`;
    const res = await fetch(url, {
      headers: resolveOpenAiAuthHeaders(this.config),
    });
    if (!res.ok) {
      throw new Error(`Azure fine-tune status failed: ${await res.text()}`);
    }
    const body = (await res.json()) as {
      status?: string;
      fine_tuned_model?: string;
      error?: { message?: string };
    };

    if (body.status === 'succeeded' && body.fine_tuned_model) {
      await (this.prisma as any).azureFineTuneJob.update({
        where: { id: job.id },
        data: {
          status: 'succeeded',
          fineTunedModel: body.fine_tuned_model,
          completedAt: new Date(),
        },
      });
      await this.registerDeployment(job.id, body.fine_tuned_model).catch(() => {});
    } else if (body.status === 'failed' || body.status === 'cancelled') {
      await (this.prisma as any).azureFineTuneJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: body.error?.message ?? body.status,
          completedAt: new Date(),
        },
      });
    }
  }

  private async createAzureFineTuneJob(jsonl: string, baseModel: string): Promise<string> {
    const uploadUrl = `${this.azureBaseUrl()}/files?api-version=${encodeURIComponent(this.azureApiVersion())}`;
    const form = new FormData();
    form.append('purpose', 'fine-tune');
    form.append(
      'file',
      new Blob([jsonl], { type: 'application/jsonl' }),
      `draft-finetune-${Date.now()}.jsonl`,
    );

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: resolveOpenAiAuthHeaders(this.config),
      body: form,
    });
    if (!uploadRes.ok) {
      throw new Error(`Azure file upload failed: ${await uploadRes.text()}`);
    }
    const uploaded = (await uploadRes.json()) as { id: string };

    const jobUrl = `${this.azureBaseUrl()}/fine_tuning/jobs?api-version=${encodeURIComponent(this.azureApiVersion())}`;
    const jobRes = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        ...resolveOpenAiAuthHeaders(this.config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_file: uploaded.id,
        model: baseModel,
      }),
    });
    if (!jobRes.ok) {
      throw new Error(`Azure fine-tune create failed: ${await jobRes.text()}`);
    }
    const created = (await jobRes.json()) as { id: string };
    return created.id;
  }

  private async hasRisingErrorRate(documentKind: string, sectionType: string): Promise<boolean> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await (this.prisma as any).draftSectionFeedback.findMany({
      where: {
        documentKind,
        sectionType,
        createdAt: { gte: since },
        rating: { in: ['major_edit', 'rejected'] },
      },
      select: { editCategories: true },
      take: 200,
    }).catch(() => []);

    if (recent.length < 20) return false;
    let errorCats = 0;
    for (const row of recent) {
      const cats: string[] = row.editCategories ?? [];
      if (cats.includes('wrong_law') || cats.includes('factual_error')) errorCats++;
    }
    return errorCats / recent.length > 0.4;
  }
}
