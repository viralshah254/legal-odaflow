import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import { DeadlineRule, MatterDeadline, MatterFactV2 } from '@prisma/client';

const WEEKEND_DAYS = new Set([0, 6]); // Sunday = 0, Saturday = 6

/**
 * Holiday calendars loaded from DB at runtime; these hardcoded entries serve as
 * emergency fallback only. Use HolidayCalendar DB table for production.
 */
const HOLIDAY_FALLBACK: Record<string, Set<string>> = {
  IN: new Set(['2026-01-26', '2026-08-15', '2026-10-02', '2026-11-05', '2026-12-25']),
  US: new Set(['2026-01-01', '2026-07-04', '2026-11-26', '2026-12-25']),
  UK: new Set(['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-12-25', '2026-12-28']),
};

@Injectable()
export class DeadlineEngineService {
  private readonly logger = new Logger(DeadlineEngineService.name);
  private holidayCache = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async findRules(
    jurisdiction: string,
    matterType: string,
    deadlineType?: string,
  ): Promise<DeadlineRule[]> {
    return this.prisma.deadlineRule.findMany({
      where: {
        jurisdiction,
        matterType,
        status: 'active',
        ...(deadlineType ? { deadlineType } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { deadlineType: 'asc' },
    });
  }

  /**
   * Load holidays from DB or fall back to static entries.
   * Caches by jurisdiction for the lifetime of the service instance.
   */
  private async getHolidays(jurisdiction: string): Promise<Set<string>> {
    if (this.holidayCache.has(jurisdiction)) {
      return this.holidayCache.get(jurisdiction)!;
    }

    const year = new Date().getFullYear();
    const dbHolidays = await this.prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT date FROM "HolidayCalendar"
      WHERE jurisdiction = ${jurisdiction}
      AND EXTRACT(YEAR FROM date) IN (${year}, ${year + 1})
    `.catch(() => []) as Array<{ date: Date }>;

    const dateSet = dbHolidays.length > 0
      ? new Set(dbHolidays.map((h) => h.date.toISOString().slice(0, 10)))
      : HOLIDAY_FALLBACK[jurisdiction] ?? new Set<string>();

    this.holidayCache.set(jurisdiction, dateSet);
    return dateSet;
  }

  calculateDeadline(
    rule: DeadlineRule,
    triggerDate: Date,
    options?: { holidayCalendar?: string },
  ): Date {
    const jur = options?.holidayCalendar ?? rule.jurisdiction;
    const holidays = this.holidayCache.get(jur) ?? HOLIDAY_FALLBACK[jur] ?? new Set<string>();

    let result = new Date(triggerDate);
    let daysAdded = 0;

    while (daysAdded < rule.offsetDays) {
      result.setDate(result.getDate() + 1);

      if (rule.workingDaysOnly) {
        const dayOfWeek = result.getDay();
        const dateStr = result.toISOString().slice(0, 10);
        if (WEEKEND_DAYS.has(dayOfWeek) || holidays.has(dateStr)) {
          continue;
        }
      }

      daysAdded++;
    }

    return result;
  }

  async detectDeadlinesFromFacts(
    matterId: string,
    tenantId: string,
    facts: MatterFactV2[],
  ): Promise<MatterDeadline[]> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true, matterType: true, jurisdiction: true },
    });

    if (!matter) {
      throw new NotFoundException(`Matter ${matterId} not found`);
    }

    const jurisdiction = (matter.jurisdiction as string | null) ?? 'IN';
    const matterType = (matter.matterType as string | null) ?? 'general';

    const rules = await this.findRules(jurisdiction, matterType);

    const createdDeadlines: MatterDeadline[] = [];

    for (const rule of rules) {
      const triggerFact = this.findTriggerFact(facts, rule.baseTrigger);
      if (!triggerFact?.dateOccurred) {
        continue;
      }

      const dueDate = this.calculateDeadline(rule, triggerFact.dateOccurred);
      const warningDate = new Date(dueDate);
      warningDate.setDate(warningDate.getDate() - 14);

      const existing = await this.prisma.matterDeadline.findFirst({
        where: {
          matterId,
          tenantId,
          deadlineType: rule.deadlineType,
          autoDetected: true,
        },
      });

      if (existing) {
        const updated = await this.prisma.matterDeadline.update({
          where: { id: existing.id },
          data: { dueDate, warningDate, sourceRef: rule.sourceRef, ruleText: rule.ruleText },
        });
        createdDeadlines.push(updated);
      } else {
        const created = await this.prisma.matterDeadline.create({
          data: {
            matterId,
            tenantId,
            title: `${rule.deadlineType.replace(/_/g, ' ')} deadline`,
            deadlineType: rule.deadlineType,
            dueDate,
            warningDate,
            sourceRef: rule.sourceRef,
            ruleText: rule.ruleText,
            autoDetected: true,
            status: 'open',
          },
        });
        createdDeadlines.push(created);
      }
    }

    this.logger.log(`Detected ${createdDeadlines.length} deadlines for matter ${matterId}`);
    return createdDeadlines;
  }

  async getAllDeadlines(
    tenantId: string,
    filters?: {
      matterId?: string;
      status?: string;
      dueBefore?: Date;
    },
  ): Promise<MatterDeadline[]> {
    return this.prisma.matterDeadline.findMany({
      where: {
        tenantId,
        ...(filters?.matterId ? { matterId: filters.matterId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.dueBefore ? { dueDate: { lte: filters.dueBefore } } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async sendWarnings(tenantId: string): Promise<number> {
    const now = new Date();
    // Warn at 3, 7, and 14 days before due
    const warningWindows = [3, 7, 14];
    const maxWindow = new Date(now);
    maxWindow.setDate(maxWindow.getDate() + 14);

    const upcoming = await this.prisma.matterDeadline.findMany({
      where: {
        tenantId,
        status: 'open',
        dueDate: { lte: maxWindow },
        warningDate: { lte: now },
      },
    });

    let notified = 0;

    for (const deadline of upcoming) {
      const daysUntilDue = Math.ceil(
        (deadline.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Find the best matching warning window label
      const warningLabel = warningWindows.reduce((best, w) =>
        Math.abs(w - daysUntilDue) < Math.abs(best - daysUntilDue) ? w : best,
      );

      // Find matter assignees via MatterAccess (Matter has no direct assignedLawyerId)
      const primaryAccess = await this.prisma.matterAccess.findFirst({
        where: { matterId: deadline.matterId, accessLevel: { in: ['EDIT', 'MANAGE', 'OWNER'] } },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      }).catch(() => null);

      if (primaryAccess?.userId) {
        // Create a notification record
        const notification = await this.prisma.notification.create({
          data: {
            userId: primaryAccess.userId,
            tenantId,
            type: 'DEADLINE_WARNING',
            title: `Deadline in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
            body: `"${deadline.title}" is due on ${deadline.dueDate.toLocaleDateString()}`,
            isRead: false,
            metadata: {
              deadlineId: deadline.id,
              matterId: deadline.matterId,
              dueDate: deadline.dueDate.toISOString(),
              daysUntilDue,
            } as any,
          },
        });

        // Enqueue FCM push via notify.worker
        await this.jobsService.enqueueNotificationDispatch({
          userId: primaryAccess.userId,
          tenantId,
          notificationId: notification.id,
          jobType: 'DEADLINE_WARNING',
        }).catch(() => {});

        notified++;
      }

      // Update warning sent counter
      await this.prisma.matterDeadline.update({
        where: { id: deadline.id },
        data: { notificationsSent: { increment: 1 } },
      });

      this.logger.log(
        `Deadline warning sent for "${deadline.title}" — due in ${daysUntilDue} days`,
      );
    }

    return notified;
  }

  /**
   * Initialise holiday cache for a jurisdiction from the DB.
   * Called once at startup for each active jurisdiction.
   */
  async warmHolidayCache(jurisdictions: string[]): Promise<void> {
    for (const jur of jurisdictions) {
      await this.getHolidays(jur).catch(() => {});
    }
  }

  private findTriggerFact(
    facts: MatterFactV2[],
    baseTrigger: string,
  ): MatterFactV2 | undefined {
    const triggerToFactType: Record<string, string[]> = {
      cause_of_action_date: ['incident_date', 'cause_of_action', 'injury_date'],
      filing_date: ['filing_date', 'complaint_filed'],
      service_date: ['service_date', 'summons_served'],
      order_date: ['order_date', 'judgment_date'],
      last_act: ['last_transaction', 'last_payment', 'last_contact'],
    };

    const factTypes = triggerToFactType[baseTrigger] ?? [baseTrigger];
    return facts.find((f) => factTypes.includes(f.factType) && f.dateOccurred);
  }
}
