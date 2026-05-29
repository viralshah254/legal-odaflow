import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

const OPEN_TASK_STATUSES = ['TODO', 'IN_PROGRESS'];
const CRITICAL_PRIORITIES = ['HIGH', 'URGENT'];
const KYC_QUEUE_STATUSES = ['PENDING', 'MISSING', 'EXPIRED'];
const INTAKE_RECENT_DAYS = 90;
const QUEUE_LIMIT = 50;

type AgingBucketKey = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'over90';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFirmReport(tenantId: string) {
    const now = new Date();

    const [
      pipelineGroups,
      unpaidInvoices,
      trustAccounts,
      pendingTrustEntries,
      overdueTasks,
      pendingOutcomeAnalysesCount,
    ] = await Promise.all([
      this.prisma.matter.groupBy({
        by: ['stage', 'status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { not: 'PAID' },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          dueDate: true,
          status: true,
        },
      }),
      this.prisma.trustAccount.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          balance: true,
          currency: true,
        },
      }),
      this.prisma.trustLedgerEntry.count({
        where: {
          status: 'PENDING',
          account: { tenantId },
        },
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          status: { in: OPEN_TASK_STATUSES },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          assigneeId: true,
          title: true,
          dueDate: true,
          priority: true,
        },
      }),
      this.prisma.matterOutcomeAnalysis.count({
        where: {
          tenantId,
          status: 'NEEDS_REVIEW',
        },
      }),
    ]);

    const assigneeIds = [
      ...new Set(
        overdueTasks
          .map((task) => task.assigneeId)
          .filter((assigneeId): assigneeId is string => Boolean(assigneeId)),
      ),
    ];
    const assignees = assigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const assigneeById = new Map(assignees.map((user) => [user.id, user]));

    const overdueTasksByOwner = this.groupOverdueTasksByOwner(
      overdueTasks,
      assigneeById,
    );

    return {
      matterPipeline: {
        byStageAndStatus: pipelineGroups.map((group) => ({
          stage: group.stage ?? 'UNASSIGNED',
          status: group.status,
          count: group._count._all,
        })),
        total: pipelineGroups.reduce((sum, group) => sum + group._count._all, 0),
      },
      invoiceAging: this.buildInvoiceAgingBuckets(unpaidInvoices, now),
      trustBalances: {
        accounts: trustAccounts.map((account) => ({
          id: account.id,
          name: account.name,
          balance: Number(account.balance),
          currency: account.currency,
        })),
        totalBalance: trustAccounts.reduce(
          (sum, account) => sum + Number(account.balance),
          0,
        ),
        pendingApprovalCount: pendingTrustEntries,
      },
      overdueTasksByOwner,
      outcomeAnalysesPendingReview: pendingOutcomeAnalysesCount,
    };
  }

  async getWorkQueues(tenantId: string) {
    const now = new Date();
    const recentCutoff = new Date(now);
    recentCutoff.setDate(recentCutoff.getDate() - INTAKE_RECENT_DAYS);

    const [
      intakeMatters,
      kycDocuments,
      overdueInvoices,
      pendingTrustEntries,
      overdueCriticalTasks,
    ] = await Promise.all([
      this.prisma.matter.findMany({
        where: {
          tenantId,
          status: 'OPEN',
          createdAt: { gte: recentCutoff },
        },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: QUEUE_LIMIT,
      }),
      this.prisma.kycDocument.findMany({
        where: {
          tenantId,
          status: { in: KYC_QUEUE_STATUSES },
        },
        include: {
          client: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: QUEUE_LIMIT,
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { not: 'PAID' },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: 'asc' },
        take: QUEUE_LIMIT,
      }),
      this.prisma.trustLedgerEntry.findMany({
        where: {
          status: 'PENDING',
          account: { tenantId },
        },
        include: {
          account: { select: { id: true, name: true, currency: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: QUEUE_LIMIT,
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          status: { in: OPEN_TASK_STATUSES },
          priority: { in: CRITICAL_PRIORITIES },
          dueDate: { lt: now },
        },
        include: {
          matter: { select: { id: true, title: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: QUEUE_LIMIT,
      }),
    ]);

    const kycQueue = this.buildKycQueue(kycDocuments);
    const criticalAssigneeIds = [
      ...new Set(
        overdueCriticalTasks
          .map((task) => task.assigneeId)
          .filter((assigneeId): assigneeId is string => Boolean(assigneeId)),
      ),
    ];
    const criticalAssignees = criticalAssigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: criticalAssigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const criticalAssigneeById = new Map(
      criticalAssignees.map((user) => [user.id, user]),
    );

    return {
      intake: {
        count: intakeMatters.length,
        items: intakeMatters.map((matter) => ({
          id: matter.id,
          title: matter.title,
          practiceArea: matter.practiceArea,
          matterType: matter.matterType,
          stage: matter.stage,
          client: matter.client,
          createdAt: matter.createdAt,
        })),
      },
      kyc: {
        count: kycQueue.length,
        items: kycQueue,
      },
      billing: {
        count: overdueInvoices.length,
        items: overdueInvoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          status: invoice.status,
          clientId: invoice.clientId,
          daysOverdue: invoice.dueDate
            ? Math.max(
                0,
                Math.floor(
                  (now.getTime() - invoice.dueDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : null,
        })),
      },
      trustApproval: {
        count: pendingTrustEntries.length,
        items: pendingTrustEntries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: Number(entry.amount),
          description: entry.description,
          status: entry.status,
          createdAt: entry.createdAt,
          account: entry.account,
          matterId: entry.matterId,
        })),
      },
      overdueCriticalTasks: {
        count: overdueCriticalTasks.length,
        items: overdueCriticalTasks.map((task) => ({
          id: task.id,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          status: task.status,
          matter: task.matter,
          assignee: task.assigneeId
            ? criticalAssigneeById.get(task.assigneeId) ?? {
                id: task.assigneeId,
                name: null,
                email: null,
              }
            : null,
        })),
      },
    };
  }

  private buildInvoiceAgingBuckets(
    invoices: Array<{
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      dueDate: Date | null;
      status: string;
    }>,
    now: Date,
  ) {
    const buckets: Record<
      AgingBucketKey,
      { count: number; totalAmount: number; currencyTotals: Record<string, number> }
    > = {
      current: { count: 0, totalAmount: 0, currencyTotals: {} },
      days1to30: { count: 0, totalAmount: 0, currencyTotals: {} },
      days31to60: { count: 0, totalAmount: 0, currencyTotals: {} },
      days61to90: { count: 0, totalAmount: 0, currencyTotals: {} },
      over90: { count: 0, totalAmount: 0, currencyTotals: {} },
    };

    for (const invoice of invoices) {
      const amount = Number(invoice.amount);
      const bucket = this.resolveAgingBucket(invoice.dueDate, now);
      buckets[bucket].count += 1;
      buckets[bucket].totalAmount += amount;
      buckets[bucket].currencyTotals[invoice.currency] =
        (buckets[bucket].currencyTotals[invoice.currency] ?? 0) + amount;
    }

    return buckets;
  }

  private resolveAgingBucket(dueDate: Date | null, now: Date): AgingBucketKey {
    if (!dueDate || dueDate >= now) {
      return 'current';
    }

    const daysPastDue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysPastDue <= 30) {
      return 'days1to30';
    }
    if (daysPastDue <= 60) {
      return 'days31to60';
    }
    if (daysPastDue <= 90) {
      return 'days61to90';
    }
    return 'over90';
  }

  private groupOverdueTasksByOwner(
    tasks: Array<{
      id: string;
      assigneeId: string | null;
      title: string;
      dueDate: Date | null;
      priority: string;
    }>,
    assigneeById: Map<
      string,
      { id: string; name: string | null; email: string }
    >,
  ) {
    const grouped = new Map<
      string,
      {
        assigneeId: string | null;
        assignee: { id: string; name: string | null; email: string } | null;
        count: number;
        tasks: Array<{
          id: string;
          title: string;
          dueDate: Date | null;
          priority: string;
        }>;
      }
    >();

    for (const task of tasks) {
      const key = task.assigneeId ?? 'unassigned';
      const existing = grouped.get(key) ?? {
        assigneeId: task.assigneeId,
        assignee: task.assigneeId
          ? assigneeById.get(task.assigneeId) ?? {
              id: task.assigneeId,
              name: null,
              email: '',
            }
          : null,
        count: 0,
        tasks: [],
      };

      existing.count += 1;
      existing.tasks.push({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
      });
      grouped.set(key, existing);
    }

    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }

  private buildKycQueue(
    documents: Array<{
      id: string;
      clientId: string;
      documentType: string;
      status: string;
      fileName: string | null;
      createdAt: Date;
      client: { id: string; name: string; type: string };
    }>,
  ) {
    const byClient = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientType: string;
        pendingCount: number;
        documents: Array<{
          id: string;
          documentType: string;
          status: string;
          fileName: string | null;
          createdAt: Date;
        }>;
      }
    >();

    for (const document of documents) {
      const existing = byClient.get(document.clientId) ?? {
        clientId: document.client.id,
        clientName: document.client.name,
        clientType: document.client.type,
        pendingCount: 0,
        documents: [],
      };

      existing.pendingCount += 1;
      existing.documents.push({
        id: document.id,
        documentType: document.documentType,
        status: document.status,
        fileName: document.fileName,
        createdAt: document.createdAt,
      });
      byClient.set(document.clientId, existing);
    }

    return [...byClient.values()].sort((a, b) => b.pendingCount - a.pendingCount);
  }
}
