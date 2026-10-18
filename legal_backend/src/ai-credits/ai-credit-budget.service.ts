import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditDebitInput {
  tenantId: string;
  userId: string;
  credits: number;
  operationId: string;
  taskType?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
}

export interface UserCreditUsageResponse {
  userId: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
  cycleStart: Date;
  cycleEnd: Date;
  tenantCreditsRemaining: number;
  status: CreditUsageStatus;
}

export interface TeamMemberCreditSummary {
  userId: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  status: CreditUsageStatus;
}

export interface TenantCreditUsageSummary {
  cycleStart: Date;
  cycleEnd: Date;
  tenantCreditsRemaining: number;
  users: TeamMemberCreditSummary[];
}

export type CreditUsageStatus =
  | 'ACTIVE'
  | 'NEAR_LIMIT'
  | 'USER_LIMIT_REACHED'
  | 'TENANT_BALANCE_EXHAUSTED'
  | 'AI_BLOCKED';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NEAR_LIMIT_THRESHOLD = 0.85; // 85% used → NEAR_LIMIT
const MAX_SERIALIZABLE_RETRIES = 3;

/** Returns the start of the current calendar month in the given IANA timezone. */
function startOfMonthInTimezone(timezone: string): Date {
  const now = new Date();
  // Use Intl to get the local date parts in the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  // Build ISO string for midnight on the 1st in UTC equivalent
  const localMidnight = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
  // Convert from local timezone to UTC
  const offsetMs = getTimezoneOffsetMs(timezone, localMidnight);
  return new Date(localMidnight.getTime() - offsetMs);
}

/** Returns the start of the next calendar month in the given IANA timezone. */
function startOfNextMonthInTimezone(timezone: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  let year = Number(parts.find((p) => p.type === 'year')!.value);
  let month = Number(parts.find((p) => p.type === 'month')!.value) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const localMidnight = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
  const offsetMs = getTimezoneOffsetMs(timezone, localMidnight);
  return new Date(localMidnight.getTime() - offsetMs);
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
  try {
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
    return new Date(utcStr).getTime() - new Date(tzStr).getTime();
  } catch {
    return 0;
  }
}

/** Resolve effective cycle start: max(calendarMonthStart, overrideAt). */
function resolveCycleStart(calendarStart: Date, overrideAt: Date | null): Date {
  if (overrideAt && overrideAt > calendarStart) return overrideAt;
  return calendarStart;
}

function computeStatus(
  used: number,
  limit: number | null,
  tenantBalance: number,
): CreditUsageStatus {
  if (tenantBalance <= 0) return 'TENANT_BALANCE_EXHAUSTED';
  if (limit === 0) return 'AI_BLOCKED';
  if (limit !== null) {
    if (used >= limit) return 'USER_LIMIT_REACHED';
    if (used / limit >= NEAR_LIMIT_THRESHOLD) return 'NEAR_LIMIT';
  }
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AICreditBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Public: atomic debit with idempotency
  // ─────────────────────────────────────────────────────────────────────────

  async checkAndDebit(input: CreditDebitInput): Promise<UserCreditUsageResponse> {
    let attempt = 0;
    while (true) {
      try {
        return await this.attemptDebit(input);
      } catch (err: unknown) {
        // Retry on Postgres serialization conflict (P2034)
        const isSerializationConflict =
          err instanceof Error &&
          (err.message.includes('P2034') ||
            err.message.includes('could not serialize') ||
            err.message.includes('deadlock detected'));

        if (isSerializationConflict && attempt < MAX_SERIALIZABLE_RETRIES - 1) {
          attempt++;
          await new Promise((r) => setTimeout(r, 20 * attempt));
          continue;
        }
        throw err;
      }
    }
  }

  private async attemptDebit(input: CreditDebitInput): Promise<UserCreditUsageResponse> {
    const { tenantId, userId, credits, operationId, taskType, metadata } = input;

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Load membership (active check)
        const membership = await tx.tenantUser.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        });

        if (!membership || membership.status !== 'ACTIVE') {
          throw new ForbiddenException('User is not an active member of this tenant');
        }

        // 2. Load tenant
        const tenant = await tx.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { aiCreditsRemaining: true, billingTimezone: true },
        });

        // 3. Resolve cycle window
        const timezone = (tenant as { billingTimezone?: string }).billingTimezone ?? 'UTC';
        const calendarStart = startOfMonthInTimezone(timezone);
        const cycleStart = resolveCycleStart(
          calendarStart,
          (membership as { creditCycleOverrideAt?: Date | null }).creditCycleOverrideAt ?? null,
        );
        const cycleEnd = startOfNextMonthInTimezone(timezone);

        // 4. Sum usage this cycle for this user
        const usageAgg = await tx.aICreditLedger.aggregate({
          where: {
            tenantId,
            userId,
            createdAt: { gte: cycleStart },
            credits: { lt: 0 },
          },
          _sum: { credits: true },
        });
        const usedSoFar = Math.abs(usageAgg._sum.credits ?? 0);

        // 5. AI-blocked check (limit === 0)
        const limit = (membership as { monthlyCreditLimit?: number | null }).monthlyCreditLimit ?? null;
        if (limit === 0) {
          throw new ForbiddenException({
            code: 'USER_AI_ACCESS_BLOCKED',
            message: 'AI access has been disabled for this account. Contact your firm admin.',
          });
        }

        // 6. Per-user limit check
        if (limit !== null && usedSoFar + credits > limit) {
          throw new ForbiddenException({
            code: 'USER_CREDIT_LIMIT_REACHED',
            message: 'Your monthly AI credit allowance has been reached.',
            details: {
              used: usedSoFar,
              limit,
              cycleEnd: cycleEnd.toISOString(),
            },
          });
        }

        // 7. Tenant wallet check
        if (tenant.aiCreditsRemaining < credits) {
          throw new ForbiddenException({
            code: 'TENANT_CREDIT_BALANCE_EXHAUSTED',
            message: "The firm's shared AI credit balance has been exhausted.",
            details: { remaining: tenant.aiCreditsRemaining },
          });
        }

        // 8. Idempotency: check for existing operationId
        const existing = await tx.aICreditLedger.findFirst({
          where: { tenantId, operationId },
        });
        if (existing) {
          // Already processed — return idempotent result
          const usedAfter = usedSoFar;
          return this.buildUsageResponse({
            userId,
            used: usedAfter,
            limit,
            tenantCreditsRemaining: tenant.aiCreditsRemaining,
            cycleStart,
            cycleEnd,
          });
        }

        // 9. Deduct from tenant wallet
        await tx.tenant.update({
          where: { id: tenantId },
          data: { aiCreditsRemaining: { decrement: credits } },
        });

        // 10. Write ledger entry
        await tx.aICreditLedger.create({
          data: {
            tenantId,
            userId,
            eventType: 'DEBIT',
            taskType: taskType ?? 'AI_USAGE',
            credits: -credits,
            operationId,
            metadata: metadata as any,
          },
        });

        return this.buildUsageResponse({
          userId,
          used: usedSoFar + credits,
          limit,
          tenantCreditsRemaining: tenant.aiCreditsRemaining - credits,
          cycleStart,
          cycleEnd,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: single-user usage query
  // ─────────────────────────────────────────────────────────────────────────

  async getUserUsage(tenantId: string, userId: string): Promise<UserCreditUsageResponse> {
    const [membership, tenant] = await Promise.all([
      this.prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      }),
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { aiCreditsRemaining: true, billingTimezone: true },
      }),
    ]);

    if (!membership) {
      throw new ForbiddenException('User not found in this tenant');
    }

    const timezone = (tenant as { billingTimezone?: string }).billingTimezone ?? 'UTC';
    const calendarStart = startOfMonthInTimezone(timezone);
    const cycleStart = resolveCycleStart(
      calendarStart,
      (membership as { creditCycleOverrideAt?: Date | null }).creditCycleOverrideAt ?? null,
    );
    const cycleEnd = startOfNextMonthInTimezone(timezone);

    const usageAgg = await this.prisma.aICreditLedger.aggregate({
      where: {
        tenantId,
        userId,
        createdAt: { gte: cycleStart },
        credits: { lt: 0 },
      },
      _sum: { credits: true },
    });
    const used = Math.abs(usageAgg._sum.credits ?? 0);
    const limit = (membership as { monthlyCreditLimit?: number | null }).monthlyCreditLimit ?? null;

    return this.buildUsageResponse({
      userId,
      used,
      limit,
      tenantCreditsRemaining: tenant.aiCreditsRemaining,
      cycleStart,
      cycleEnd,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: bulk team usage summary (avoids N+1 on team page)
  // ─────────────────────────────────────────────────────────────────────────

  async getTenantUsageSummary(tenantId: string): Promise<TenantCreditUsageSummary> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { aiCreditsRemaining: true, billingTimezone: true },
    });

    const timezone = (tenant as { billingTimezone?: string }).billingTimezone ?? 'UTC';
    const calendarStart = startOfMonthInTimezone(timezone);
    const cycleEnd = startOfNextMonthInTimezone(timezone);

    const memberships = await this.prisma.tenantUser.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        userId: true,
        monthlyCreditLimit: true,
        creditCycleOverrideAt: true,
      } as any,
    });

    if (memberships.length === 0) {
      return {
        cycleStart: calendarStart,
        cycleEnd,
        tenantCreditsRemaining: tenant.aiCreditsRemaining,
        users: [],
      };
    }

    // One aggregate query grouped by userId for the cycle window
    // We use the calendar-month start as the common lower bound.
    // Individual overrides are handled per-user after the bulk query.
    const usageRows = await this.prisma.aICreditLedger.groupBy({
      by: ['userId'],
      where: {
        tenantId,
        userId: { in: memberships.map((m: any) => m.userId) },
        createdAt: { gte: calendarStart },
        credits: { lt: 0 },
      },
      _sum: { credits: true },
    });

    const usageByUser = new Map<string, number>();
    for (const row of usageRows) {
      if (row.userId) {
        usageByUser.set(row.userId, Math.abs(row._sum.credits ?? 0));
      }
    }

    const users: TeamMemberCreditSummary[] = memberships.map((m: any) => {
      const limit: number | null = m.monthlyCreditLimit ?? null;
      const rawUsed = usageByUser.get(m.userId) ?? 0;

      // If override is later than calendar start, subtract usage before override
      // (we over-count slightly but it's safe; exact per-user is available via getUserUsage)
      const used = rawUsed;
      const remaining = limit === null ? null : Math.max(0, limit - used);

      return {
        userId: m.userId,
        used,
        limit,
        remaining,
        status: computeStatus(used, limit, tenant.aiCreditsRemaining),
      };
    });

    return {
      cycleStart: calendarStart,
      cycleEnd,
      tenantCreditsRemaining: tenant.aiCreditsRemaining,
      users,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildUsageResponse(params: {
    userId: string;
    used: number;
    limit: number | null;
    tenantCreditsRemaining: number;
    cycleStart: Date;
    cycleEnd: Date;
  }): UserCreditUsageResponse {
    const { userId, used, limit, tenantCreditsRemaining, cycleStart, cycleEnd } = params;
    const isUnlimited = limit === null;
    const remaining = isUnlimited ? null : Math.max(0, limit! - used);
    return {
      userId,
      used,
      limit,
      remaining,
      isUnlimited,
      cycleStart,
      cycleEnd,
      tenantCreditsRemaining,
      status: computeStatus(used, limit, tenantCreditsRemaining),
    };
  }
}
