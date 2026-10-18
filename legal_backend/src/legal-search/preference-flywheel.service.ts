import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TrainingDatasetsService } from '@/training-datasets/training-datasets.service';

@Injectable()
export class PreferenceFlywheelService {
  private readonly logger = new Logger(PreferenceFlywheelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingDatasets: TrainingDatasetsService,
  ) {}

  async captureFromAiOutput(params: {
    aiOutputId: string;
    userId: string;
    tenantId?: string;
    feedback?: 'helpful' | 'not_helpful' | 'edited';
    editedMarkdown?: string;
  }): Promise<void> {
    const output = await this.prisma.aIOutput.findUnique({
      where: { id: params.aiOutputId },
    });
    if (!output) return;

    const consent = await this.prisma.trainingConsent.findFirst({
      where: {
        OR: [{ userId: params.userId }, ...(params.tenantId ? [{ tenantId: params.tenantId }] : [])],
        consentStatus: 'GRANTED',
        canUseForPromptImprove: true,
      },
    });
    if (!consent) return;

    const original = output.outputMarkdown;
    const revised = params.editedMarkdown ?? original;
    const editDistance = this.normalizedEditDistance(original, revised);

    let dataset = await this.prisma.trainingDataset.findFirst({
      where: { name: 'umbrella-preference-flywheel' },
    });
    if (!dataset) {
      dataset = await this.trainingDatasets.createDataset({
        name: 'umbrella-preference-flywheel',
        datasetType: 'PREFERENCE_DPO',
        countryCode: 'IN',
        sourcePolicy: 'Lawyer feedback and edit-distance pairs for DPO and re-ranker hard negatives',
      });
    }

    await this.trainingDatasets.createItem({
      datasetId: dataset.id,
      sourceType: 'AI_OUTPUT_FEEDBACK',
      inputText: JSON.stringify({
        mode: output.mode,
        taskType: output.taskType,
        matterId: output.matterId,
        consumerCaseId: output.consumerCaseId,
      }),
      expectedOutput: revised,
      metadata: {
        aiOutputId: params.aiOutputId,
        feedback: params.feedback ?? 'edited',
        editDistance,
        originalLength: original.length,
        revisedLength: revised.length,
        negative: params.feedback === 'not_helpful',
      },
      consentId: consent.id,
    });
  }

  async captureMisRetrieval(params: {
    query: string;
    expectedAuthorityId?: string;
    retrievedAuthorityIds: string[];
    countryCode: string;
  }): Promise<void> {
    if (params.expectedAuthorityId && !params.retrievedAuthorityIds.includes(params.expectedAuthorityId)) {
      this.logger.debug(`Mis-retrieval logged for query: ${params.query}`);
      let dataset = await this.prisma.trainingDataset.findFirst({
        where: { name: 'umbrella-reranker-hard-negatives' },
      });
      if (!dataset) {
        dataset = await this.trainingDatasets.createDataset({
          name: 'umbrella-reranker-hard-negatives',
          datasetType: 'RERANKER_HARD_NEGATIVE',
          countryCode: params.countryCode,
          sourcePolicy: 'Hard negative (query, section) pairs from mis-retrieval logs',
        });
      }
      await this.trainingDatasets.createItem({
        datasetId: dataset.id,
        sourceType: 'MIS_RETRIEVAL',
        inputText: params.query,
        expectedOutput: params.expectedAuthorityId ?? '',
        metadata: {
          retrievedAuthorityIds: params.retrievedAuthorityIds,
          type: 'hard_negative',
        },
      });
    }
  }

  private normalizedEditDistance(a: string, b: string): number {
    if (a === b) return 0;
    const maxLen = Math.max(a.length, b.length, 1);
    let diff = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i += 1) {
      if (a[i] !== b[i]) diff += 1;
    }
    diff += Math.abs(a.length - b.length);
    return diff / maxLen;
  }
}
