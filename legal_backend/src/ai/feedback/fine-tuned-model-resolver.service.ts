import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DRAFT_MODEL_ALIASES } from '@/ai/unified-drafting/contracts/model-aliases';

/**
 * Resolves fine-tuned Azure deployments registered as AiModelAlias
 * under `drafting:{documentKind}:{sectionType}` for A/B rollout.
 * Verifier models are never replaced (independent verification rule).
 */
@Injectable()
export class FineTunedModelResolverService {
  private readonly logger = new Logger(FineTunedModelResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a fine-tuned drafter model id when an enabled alias exists;
   * otherwise returns the provided fallback (typically LEGAL_DRAFTER / Terra).
   */
  async resolveDrafterModel(
    documentKind: string,
    sectionType: string,
    fallback: string = DRAFT_MODEL_ALIASES.LEGAL_DRAFTER,
  ): Promise<string> {
    const alias = `drafting:${documentKind}:${sectionType}`;
    try {
      const row = await this.prisma.aiModelAlias.findFirst({
        where: { alias, enabled: true },
        include: { model: { select: { providerModelId: true, enabled: true } } },
      });
      if (row?.model?.enabled && row.model.providerModelId) {
        this.logger.debug(`Using fine-tuned drafter ${row.model.providerModelId} for ${alias}`);
        return row.model.providerModelId;
      }
    } catch {
      // table may not exist yet in some envs
    }
    return fallback;
  }
}
