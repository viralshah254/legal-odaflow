import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface MeCounts {
  unreadNotifications: number;
  openLeads: number;
  tasksDueToday: number;
  tasksOverdue: number;
  queueDepth: number;
  pendingApprovals: number;
  kycGaps: number;
  openAlerts: number;
  unbilledTime: number;
}

const OPEN_TASK_STATUSES = ['TODO', 'IN_PROGRESS'];
const CLOSED_LEAD_STATUSES = ['CONVERTED', 'CLOSED', 'DECLINED', 'REJECTED'];
const KYC_GAP_STATUSES = ['PENDING', 'REJECTED', 'EXPIRED', 'MISSING'];
const UNBILLED_TIME_STATUSES = ['DRAFT', 'SUBMITTED'];

@Injectable()
export class MeCountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate "things that need doing" for the active tenant/user in a single
   * batched query set. Powers sidebar badges and the dashboard.
   */
  async getCounts(tenantId: string, userId: string): Promise<MeCounts> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Tasks the current user can act on (assigned to them or unassigned).
    const actionableTask = {
      tenantId,
      status: { in: OPEN_TASK_STATUSES },
      OR: [{ assigneeId: userId }, { assigneeId: null }],
    };

    const [
      unreadNotifications,
      openLeads,
      tasksDueToday,
      tasksOverdue,
      queueDepth,
      pendingApprovals,
      kycGaps,
      unacknowledgedAlerts,
      kycClientsWithGaps,
      pendingAssistance,
      unbilledTime,
    ] = await Promise.all([
      this.prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      }),
      this.prisma.lawyerLead.count({
        where: { tenantId, status: { notIn: CLOSED_LEAD_STATUSES } },
      }),
      this.prisma.task.count({
        where: { ...actionableTask, dueDate: { gte: startOfDay, lte: endOfDay } },
      }),
      this.prisma.task.count({
        where: { ...actionableTask, dueDate: { lt: startOfDay } },
      }),
      this.prisma.task.count({
        where: { tenantId, status: 'TODO', assigneeId: null },
      }),
      this.prisma.timeEntry.count({
        where: { tenantId, status: 'SUBMITTED' },
      }),
      this.prisma.kycDocument.count({
        where: { tenantId, status: { in: KYC_GAP_STATUSES } },
      }),
      this.prisma.alert.count({
        where: {
          tenantId,
          status: { notIn: ['ACKNOWLEDGED', 'COMPLETED', 'SKIPPED'] },
        },
      }),
      this.prisma.kycDocument
        .groupBy({
          by: ['clientId'],
          where: { tenantId, status: { in: KYC_GAP_STATUSES } },
        })
        .then((rows) => rows.length),
      this.prisma.assistanceRequest.count({
        where: { tenantId, status: 'OPEN' },
      }),
      this.prisma.timeEntry.count({
        where: { tenantId, billable: true, status: { in: UNBILLED_TIME_STATUSES } },
      }),
    ]);

    return {
      unreadNotifications,
      openLeads,
      tasksDueToday,
      tasksOverdue,
      queueDepth,
      pendingApprovals,
      kycGaps,
      openAlerts: unacknowledgedAlerts + kycClientsWithGaps + pendingAssistance,
      unbilledTime,
    };
  }
}
