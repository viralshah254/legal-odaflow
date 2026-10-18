import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import type {
  LegalTaskPattern,
  ListTaskPatternsQuery,
  TaskPatternUsageEvent,
} from './task-patterns.types';
import { resolvePracticeAreaSlug, domainsForJurisdiction } from '@/config/taxonomy/platform-taxonomy';
import { SYSTEM_TASK_PATTERNS } from './task-patterns.catalog';

const USAGE_ACTION = 'TASK_PATTERN_USED';
const USAGE_ENTITY = 'LegalTaskPattern';

/** Phase 2 gate: >15% of AI sessions launched from patterns within 30 days. */
export const PHASE2_PATTERN_USAGE_GATE = 0.15;
export const PHASE2_WINDOW_DAYS = 30;

@Injectable()
export class TaskPatternsService {
  private readonly logger = new Logger(TaskPatternsService.name);
  private readonly usageCounts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(query: ListTaskPatternsQuery = {}): LegalTaskPattern[] {
    const jurisdiction = query.jurisdiction?.toUpperCase();
    const q = query.q?.trim().toLowerCase();
    const feature = query.targetFeature;
    const practice = query.practiceArea?.toLowerCase();

    let rows = SYSTEM_TASK_PATTERNS.filter((p) => p.scope === 'system');

    if (jurisdiction) {
      rows = rows.filter((p) => p.jurisdiction === jurisdiction);
    }
    if (feature) {
      rows = rows.filter((p) => p.targetFeature === feature);
    }
    if (practice) {
      const canonical = resolvePracticeAreaSlug(practice);
      rows = rows.filter(
        (p) =>
          p.domainSlug === canonical ||
          p.domainSlug === practice ||
          p.practiceAreas.some(
            (a) =>
              a.toLowerCase() === practice ||
              resolvePracticeAreaSlug(a) === canonical,
          ),
      );
    }
    if (q) {
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.body ?? p.description).toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        ...p,
        body: p.body ?? p.description,
        usageCount: this.usageCounts.get(p.id) ?? 0,
      })) as Array<LegalTaskPattern & { usageCount: number }>;
  }

  getById(id: string): (LegalTaskPattern & { usageCount: number }) | null {
    const pattern = SYSTEM_TASK_PATTERNS.find((p) => p.id === id || p.slug === id);
    if (!pattern) return null;
    return {
      ...pattern,
      body: pattern.body ?? pattern.description,
      usageCount: this.usageCounts.get(pattern.id) ?? 0,
    };
  }

  async recordUsage(event: TaskPatternUsageEvent): Promise<{ ok: true; usageCount: number }> {
    const current = this.usageCounts.get(event.patternId) ?? 0;
    const next = current + 1;
    this.usageCounts.set(event.patternId, next);
    this.logger.log(
      `Task pattern used: ${event.patternId} (${event.targetFeature}, ${event.jurisdiction})`,
    );

    await this.audit.logDomainEvent({
      userId: event.userId,
      tenantId: event.tenantId,
      action: USAGE_ACTION,
      entityType: USAGE_ENTITY,
      entityId: event.patternId,
      metadata: {
        targetFeature: event.targetFeature,
        jurisdiction: event.jurisdiction,
      },
    });

    await this.prisma.taskPatternUsage.create({
      data: {
        patternId: event.patternId,
        targetFeature: event.targetFeature,
        jurisdiction: event.jurisdiction,
        tenantId: event.tenantId,
        userId: event.userId,
      },
    });

    return { ok: true, usageCount: next };
  }

  practiceAreas(jurisdiction?: string): string[] {
    const code = jurisdiction?.toUpperCase() as 'IN' | 'US' | 'KE' | 'GB' | undefined;
    if (code && ['IN', 'US', 'KE', 'GB'].includes(code)) {
      return domainsForJurisdiction(code, undefined, 'professional').map((d) => d.slug);
    }
    return domainsForJurisdiction('IN', undefined, 'professional').map((d) => d.slug);
  }

  /** Usage analytics for Phase 2 gate evaluation. */
  async getUsageAnalytics(tenantId?: string, windowDays = PHASE2_WINDOW_DAYS) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const where = {
      action: USAGE_ACTION,
      entityType: USAGE_ENTITY,
      createdAt: { gte: since },
      ...(tenantId ? { tenantId } : {}),
    };

    const sessionWhere = {
      createdAt: { gte: since },
      ...(tenantId ? { tenantId } : {}),
    };

    const [patternUses, aiResearchRuns, aiDraftRuns] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({
        where: {
          ...sessionWhere,
          action: { contains: '/ai/research' },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...sessionWhere,
          OR: [
            { action: { contains: '/india-draft' } },
            { action: { contains: '/draft-intent' } },
            { action: { contains: '/us-draft' } },
          ],
        },
      }),
    ]);

    const totalAiSessions = aiResearchRuns + aiDraftRuns + patternUses;
    const patternShare = totalAiSessions > 0 ? patternUses / totalAiSessions : 0;

    const topPatterns = await this.prisma.auditLog.groupBy({
      by: ['entityId'],
      where,
      _count: { entityId: true },
      orderBy: { _count: { entityId: 'desc' } },
      take: 10,
    });

    return {
      windowDays,
      patternLaunches: patternUses,
      aiResearchRuns,
      aiDraftRuns,
      estimatedAiSessions: totalAiSessions,
      patternShareOfAiSessions: patternShare,
      phase2Gate: {
        target: PHASE2_PATTERN_USAGE_GATE,
        met: patternShare >= PHASE2_PATTERN_USAGE_GATE,
        description:
          'Phase 2 (firm patterns) unlocks when >15% of AI sessions launch from task patterns in 30 days.',
      },
      topPatterns: topPatterns.map((row) => ({
        patternId: row.entityId,
        count: row._count.entityId,
        title: SYSTEM_TASK_PATTERNS.find((p) => p.id === row.entityId)?.title ?? row.entityId,
      })),
      catalogSize: SYSTEM_TASK_PATTERNS.length,
    };
  }
}
