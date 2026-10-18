import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationSyncScheduler {
  private readonly logger = new Logger(IntegrationSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncConnectedIntegrations() {
    const connections = await this.prisma.integrationConnection.findMany({
      where: { status: 'CONNECTED' },
      select: { tenantId: true, provider: true, config: true },
    });

    let synced = 0;
    for (const connection of connections) {
      const config =
        connection.config && typeof connection.config === 'object'
          ? (connection.config as Record<string, unknown>)
          : {};
      const mode = typeof config.mode === 'string' ? config.mode : 'unknown';

      if (mode === 'development_stub') {
        this.logger.debug(
          `Skipping scheduled sync for stub connection ${connection.provider} (tenant ${connection.tenantId})`,
        );
        continue;
      }

      try {
        await this.integrationsService.triggerSync(
          connection.tenantId,
          connection.provider,
        );
        synced += 1;
      } catch (error) {
        this.logger.warn(
          `Scheduled sync failed for ${connection.provider} (tenant ${connection.tenantId}): ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    if (synced > 0) {
      this.logger.log(`Integration sync cron completed: ${synced} connection(s) synced`);
    }
  }
}
