import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SecurityReviewScheduler {
  private readonly logger = new Logger(SecurityReviewScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every Monday at 3am.
   * Flags inactive PARTNER_ADMINs for SOC 2 access review evidence.
   */
  @Cron('0 3 * * 1')
  async runWeeklyAccessReview() {
    this.logger.log('SOC 2 access review: starting weekly scan');

    const findings: {
      type: string;
      userId: string;
      tenantId: string;
      detail: string;
    }[] = [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find PARTNER_ADMIN TenantUsers whose user account hasn't been updated in 30 days
    const inactiveAdmins = await this.prisma.tenantUser
      .findMany({
        where: {
          role: 'PARTNER_ADMIN',
          status: 'ACTIVE',
          user: { updatedAt: { lt: thirtyDaysAgo }, isActive: true },
        },
        select: {
          userId: true,
          tenantId: true,
          user: { select: { email: true, updatedAt: true } },
        },
        take: 100,
      })
      .catch(() => []);

    for (const tu of inactiveAdmins) {
      findings.push({
        type: 'INACTIVE_ADMIN',
        userId: tu.userId,
        tenantId: tu.tenantId,
        detail: `PARTNER_ADMIN last active ${tu.user.updatedAt?.toISOString() ?? 'unknown'}`,
      });
    }

    // Detect stale refresh tokens (older than 90 days)
    const staleTokenCount = await this.prisma.refreshToken
      .count({ where: { expiresAt: { lt: ninetyDaysAgo } } })
      .catch(() => 0);

    if (staleTokenCount > 0) {
      this.logger.warn(`SOC 2: ${staleTokenCount} expired refresh tokens detected`);
    }

    // Log findings to audit log
    for (const finding of findings) {
      await this.prisma.auditLog
        .create({
          data: {
            userId: 'system',
            tenantId: finding.tenantId,
            action: `SOC2_ACCESS_REVIEW_FINDING:${finding.type}`,
            entityType: 'User',
            entityId: finding.userId,
            metadata: { detail: finding.detail, reviewType: 'WEEKLY_AUTO' },
          },
        })
        .catch(() => {});
    }

    // Store last access review timestamp in firm settings
    if (findings.length > 0) {
      const tenantIds = [...new Set(findings.map((f) => f.tenantId))];
      for (const tenantId of tenantIds) {
        const existing = await this.prisma.firmProfile
          .findUnique({ where: { tenantId } })
          .catch(() => null);
        if (existing) {
          const current = (existing.settings as Record<string, unknown>) ?? {};
          await this.prisma.firmProfile
            .update({
              where: { tenantId },
              data: {
                settings: {
                  ...current,
                  lastAccessReviewAt: new Date().toISOString(),
                  lastAccessReviewFindings: findings.filter((f) => f.tenantId === tenantId).length,
                } as Parameters<typeof this.prisma.firmProfile.update>[0]['data']['settings'],
              },
            })
            .catch(() => {});
        }
      }
    }

    this.logger.log(
      `SOC 2 access review complete: ${findings.length} findings across ${[...new Set(findings.map((f) => f.tenantId))].length} tenants`,
    );
  }
}
