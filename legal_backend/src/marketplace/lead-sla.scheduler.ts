import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';

const SLA_HOURS: Record<string, number> = {
  HIGH: 4,
  MEDIUM: 24,
  LOW: 48,
};

@Injectable()
export class LeadSlaScheduler {
  private readonly logger = new Logger(LeadSlaScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async escalateOverdueLeads() {
    const openLeads = await this.prisma.lawyerLead.findMany({
      where: {
        status: { in: ['NEW', 'OPEN'] },
        tenantId: { not: null },
      },
      take: 200,
    });

    const now = Date.now();
    let escalated = 0;

    for (const lead of openLeads) {
      if (!lead.tenantId) {
        continue;
      }

      const slaHours = SLA_HOURS[lead.urgency] ?? SLA_HOURS.MEDIUM;
      const ageMs = now - lead.createdAt.getTime();
      if (ageMs < slaHours * 60 * 60 * 1000) {
        continue;
      }

      if (lead.summary?.includes('slaEscalated:true')) {
        continue;
      }

      const updatedSummary = [lead.summary ?? '', 'slaEscalated:true'].filter(Boolean).join('\n');

      await this.prisma.lawyerLead.update({
        where: { id: lead.id },
        data: {
          status: 'OPEN',
          urgency: lead.urgency === 'LOW' ? 'MEDIUM' : 'HIGH',
          summary: updatedSummary,
        },
      });

      const admins = await this.prisma.tenantUser.findMany({
        where: {
          tenantId: lead.tenantId,
          status: 'ACTIVE',
          role: { in: ['FIRM_ADMIN', 'PARTNER'] },
        },
        select: { userId: true },
        take: 10,
      });

      for (const admin of admins) {
        await this.notifications.createAndDispatch({
          tenantId: lead.tenantId,
          userId: admin.userId,
          title: 'Lead SLA escalation',
          body: `Lead for ${lead.issueType} (${lead.countryCode}) exceeded ${slaHours}h response window.`,
          type: 'LEAD_SLA_ESCALATION',
          metadata: { leadId: lead.id, urgency: lead.urgency },
        });
      }

      escalated += 1;
    }

    if (escalated > 0) {
      this.logger.log(`Escalated ${escalated} marketplace lead(s) for SLA breach`);
    }
  }
}
