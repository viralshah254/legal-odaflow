import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildDateRange } from './admin-ai-observability.util';
import {
  ActivityCategory,
  ActivitySource,
  categorizeSource,
  categorizeTaskType,
  decodeActivityId,
  encodeActivityId,
  previewText,
  taskTypesForCategory,
} from './admin-user-activity.util';

export interface AdminUserActivityFilters {
  from?: string;
  to?: string;
  userId?: string;
  tenantId?: string;
  category?: ActivityCategory;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AdminUserActivityRow {
  id: string;
  source: ActivitySource;
  category: ActivityCategory;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  tenantName: string | null;
  taskType: string | null;
  mode: string | null;
  promptPreview: string;
  createdAt: Date;
}

export interface AdminUserActivityDetail extends AdminUserActivityRow {
  prompt: string;
  output: string | null;
  copilotThread?: { role: string; content: string; createdAt: Date }[];
  metadata?: {
    jurisdiction?: string | null;
    matterId?: string | null;
    status?: string | null;
    citations?: unknown;
    title?: string | null;
    kind?: string | null;
  };
}

@Injectable()
export class AdminUserActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async listActivity(filters: AdminUserActivityFilters = {}) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const fetchSize = limit + offset;
    const category = filters.category;

    const includeAi =
      !category || category === 'research' || category === 'drafting' ||
      category === 'search' || category === 'other' || category === 'copilot';
    const includeCopilot = !category || category === 'copilot';
    const includeIssueChecker = !category || category === 'search';
    const includeCourtDraft = !category || category === 'drafting';

    const [aiResult, copilotResult, issueResult, draftResult] =
      await Promise.all([
        includeAi
          ? this.fetchAiOutputs(filters, fetchSize)
          : Promise.resolve({ items: [] as AdminUserActivityRow[], total: 0 }),
        includeCopilot
          ? this.fetchCopilotMessages(filters, fetchSize)
          : Promise.resolve({ items: [] as AdminUserActivityRow[], total: 0 }),
        includeIssueChecker
          ? this.fetchIssueChecker(filters, fetchSize)
          : Promise.resolve({ items: [] as AdminUserActivityRow[], total: 0 }),
        includeCourtDraft
          ? this.fetchCourtDrafts(filters, fetchSize)
          : Promise.resolve({ items: [] as AdminUserActivityRow[], total: 0 }),
      ]);

    const merged = [
      ...aiResult.items,
      ...copilotResult.items,
      ...issueResult.items,
      ...draftResult.items,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total =
      aiResult.total +
      copilotResult.total +
      issueResult.total +
      draftResult.total;

    return {
      items: merged.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  }

  async getActivityDetail(activityId: string): Promise<AdminUserActivityDetail> {
    const decoded = decodeActivityId(decodeURIComponent(activityId));
    if (!decoded) {
      throw new NotFoundException('Activity not found');
    }

    switch (decoded.source) {
      case 'ai_output':
        return this.detailAiOutput(decoded.rawId);
      case 'copilot':
        return this.detailCopilot(decoded.rawId);
      case 'issue_checker':
        return this.detailIssueChecker(decoded.rawId);
      case 'court_draft':
        return this.detailCourtDraft(decoded.rawId);
      default:
        throw new NotFoundException('Activity not found');
    }
  }

  // ── Fetchers ────────────────────────────────────────────────────────────

  private async fetchAiOutputs(
    filters: AdminUserActivityFilters,
    take: number,
  ): Promise<{ items: AdminUserActivityRow[]; total: number }> {
    const createdAt = buildDateRange(filters);
    const where: Prisma.AIOutputWhereInput = {
      userId: filters.userId || undefined,
      tenantId: filters.tenantId || undefined,
      createdAt,
    };

    if (filters.q?.trim()) {
      where.inputQuery = { contains: filters.q.trim(), mode: 'insensitive' };
    }

    if (filters.category === 'copilot') {
      where.mode = { contains: 'COPILOT', mode: 'insensitive' };
    } else if (filters.category === 'other') {
      where.AND = [
        {
          taskType: {
            notIn: [
              ...(taskTypesForCategory('research') ?? []),
              ...(taskTypesForCategory('drafting') ?? []),
              ...(taskTypesForCategory('search') ?? []),
            ],
          },
        },
        {
          NOT: {
            mode: { contains: 'COPILOT', mode: 'insensitive' },
          },
        },
      ];
    } else if (filters.category) {
      const types = taskTypesForCategory(filters.category);
      if (types) {
        // Include RESEARCH_* prefix via OR for research
        if (filters.category === 'research') {
          where.OR = [
            { taskType: { in: types } },
            { taskType: { startsWith: 'RESEARCH_' } },
          ];
        } else if (filters.category === 'drafting') {
          // DRAFT_* includes DRAFT_INTENT_SEARCH (a search task) — exclude those
          const searchTypes = taskTypesForCategory('search') ?? [];
          where.AND = [
            {
              OR: [
                { taskType: { in: types } },
                { taskType: { startsWith: 'DRAFT_' } },
              ],
            },
            { taskType: { notIn: searchTypes } },
          ];
        } else {
          where.taskType = { in: types };
        }
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.aIOutput.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          taskType: true,
          mode: true,
          inputQuery: true,
          createdAt: true,
          userId: true,
          tenantId: true,
          user: { select: { name: true, email: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.aIOutput.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: encodeActivityId('ai_output', r.id),
        source: 'ai_output' as const,
        category: categorizeTaskType(r.taskType, r.mode),
        userId: r.userId,
        userName: r.user?.name ?? null,
        userEmail: r.user?.email ?? null,
        tenantName: r.tenant?.name ?? null,
        taskType: r.taskType,
        mode: r.mode,
        promptPreview: previewText(r.inputQuery),
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  private async fetchCopilotMessages(
    filters: AdminUserActivityFilters,
    take: number,
  ): Promise<{ items: AdminUserActivityRow[]; total: number }> {
    const createdAt = buildDateRange(filters);
    const where: Prisma.CopilotMessageWhereInput = {
      role: 'user',
      createdAt,
      session: {
        userId: filters.userId || undefined,
        tenantId: filters.tenantId || undefined,
      },
    };

    if (filters.q?.trim()) {
      where.content = { contains: filters.q.trim(), mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.copilotMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          content: true,
          createdAt: true,
          session: {
            select: {
              userId: true,
              tenantId: true,
              user: { select: { name: true, email: true } },
              deliverableType: true,
            },
          },
        },
      }),
      this.prisma.copilotMessage.count({ where }),
    ]);

    // Resolve tenant names in batch
    const tenantIds = [
      ...new Set(rows.map((r) => r.session.tenantId).filter(Boolean)),
    ];
    const tenants =
      tenantIds.length > 0
        ? await this.prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : [];
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    return {
      items: rows.map((r) => ({
        id: encodeActivityId('copilot', r.id),
        source: 'copilot' as const,
        category: 'copilot' as const,
        userId: r.session.userId,
        userName: r.session.user?.name ?? null,
        userEmail: r.session.user?.email ?? null,
        tenantName: tenantMap.get(r.session.tenantId) ?? null,
        taskType: r.session.deliverableType ?? 'COPILOT',
        mode: 'LAWYER_COPILOT',
        promptPreview: previewText(r.content),
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  private async fetchIssueChecker(
    filters: AdminUserActivityFilters,
    take: number,
  ): Promise<{ items: AdminUserActivityRow[]; total: number }> {
    // IssueCheckerSearchLog has no tenantId
    if (filters.tenantId) {
      return { items: [], total: 0 };
    }

    const createdAt = buildDateRange(filters);
    const where: Prisma.IssueCheckerSearchLogWhereInput = {
      userId: filters.userId || undefined,
      createdAt,
    };

    if (filters.q?.trim()) {
      where.facts = { contains: filters.q.trim(), mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.issueCheckerSearchLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.issueCheckerSearchLog.count({ where }),
    ]);

    const userIds = [
      ...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)),
    ];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((r) => {
        const user = r.userId ? userMap.get(r.userId) : null;
        return {
          id: encodeActivityId('issue_checker', r.id),
          source: 'issue_checker' as const,
          category: categorizeSource('issue_checker'),
          userId: r.userId,
          userName: user?.name ?? null,
          userEmail: user?.email ?? null,
          tenantName: null,
          taskType: 'ISSUE_CHECKER',
          mode: r.mode,
          promptPreview: previewText(r.facts),
          createdAt: r.createdAt,
        };
      }),
      total,
    };
  }

  private async fetchCourtDrafts(
    filters: AdminUserActivityFilters,
    take: number,
  ): Promise<{ items: AdminUserActivityRow[]; total: number }> {
    const createdAt = buildDateRange(filters);
    const where: Prisma.CourtDraftRecordWhereInput = {
      userId: filters.userId || undefined,
      tenantId: filters.tenantId || undefined,
      createdAt,
    };

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { caseDetails: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.courtDraftRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          caseDetails: true,
          kind: true,
          createdAt: true,
          userId: true,
          tenantId: true,
          user: { select: { name: true, email: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.courtDraftRecord.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: encodeActivityId('court_draft', r.id),
        source: 'court_draft' as const,
        category: 'drafting' as const,
        userId: r.userId,
        userName: r.user?.name ?? null,
        userEmail: r.user?.email ?? null,
        tenantName: r.tenant?.name ?? null,
        taskType: r.kind,
        mode: 'COURT_DRAFT',
        promptPreview: previewText(r.caseDetails || r.title),
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  // ── Detail loaders ──────────────────────────────────────────────────────

  private async detailAiOutput(id: string): Promise<AdminUserActivityDetail> {
    const r = await this.prisma.aIOutput.findUnique({
      where: { id },
      select: {
        id: true,
        taskType: true,
        mode: true,
        inputQuery: true,
        outputMarkdown: true,
        createdAt: true,
        userId: true,
        tenantId: true,
        matterId: true,
        jurisdiction: true,
        citations: true,
        user: { select: { name: true, email: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!r) throw new NotFoundException('Activity not found');

    return {
      id: encodeActivityId('ai_output', r.id),
      source: 'ai_output',
      category: categorizeTaskType(r.taskType, r.mode),
      userId: r.userId,
      userName: r.user?.name ?? null,
      userEmail: r.user?.email ?? null,
      tenantName: r.tenant?.name ?? null,
      taskType: r.taskType,
      mode: r.mode,
      promptPreview: previewText(r.inputQuery),
      createdAt: r.createdAt,
      prompt: r.inputQuery ?? '',
      output: r.outputMarkdown,
      metadata: {
        jurisdiction: r.jurisdiction,
        matterId: r.matterId,
        citations: r.citations,
      },
    };
  }

  private async detailCopilot(messageId: string): Promise<AdminUserActivityDetail> {
    const msg = await this.prisma.copilotMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sessionId: true,
        session: {
          select: {
            userId: true,
            tenantId: true,
            deliverableType: true,
            user: { select: { name: true, email: true } },
            messages: {
              orderBy: { createdAt: 'asc' },
              select: { role: true, content: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!msg) throw new NotFoundException('Activity not found');

    const tenant = msg.session.tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: msg.session.tenantId },
          select: { name: true },
        })
      : null;

    // Next assistant reply after this user message (if any)
    const thread = msg.session.messages;
    const idx = thread.findIndex(
      (m) =>
        m.role === 'user' &&
        m.content === msg.content &&
        m.createdAt.getTime() === msg.createdAt.getTime(),
    );
    let output: string | null = null;
    if (idx >= 0) {
      const next = thread.slice(idx + 1).find((m) => m.role === 'assistant');
      output = next?.content ?? null;
    }

    return {
      id: encodeActivityId('copilot', msg.id),
      source: 'copilot',
      category: 'copilot',
      userId: msg.session.userId,
      userName: msg.session.user?.name ?? null,
      userEmail: msg.session.user?.email ?? null,
      tenantName: tenant?.name ?? null,
      taskType: msg.session.deliverableType ?? 'COPILOT',
      mode: 'LAWYER_COPILOT',
      promptPreview: previewText(msg.content),
      createdAt: msg.createdAt,
      prompt: msg.content,
      output,
      copilotThread: thread,
    };
  }

  private async detailIssueChecker(id: string): Promise<AdminUserActivityDetail> {
    const r = await this.prisma.issueCheckerSearchLog.findUnique({
      where: { id },
    });
    if (!r) throw new NotFoundException('Activity not found');

    const user = r.userId
      ? await this.prisma.user.findUnique({
          where: { id: r.userId },
          select: { name: true, email: true },
        })
      : null;

    return {
      id: encodeActivityId('issue_checker', r.id),
      source: 'issue_checker',
      category: 'search',
      userId: r.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      tenantName: null,
      taskType: 'ISSUE_CHECKER',
      mode: r.mode,
      promptPreview: previewText(r.facts),
      createdAt: r.createdAt,
      prompt: r.facts,
      output: null,
      metadata: {
        jurisdiction: r.jurisdiction,
        status: r.issueType,
      },
    };
  }

  private async detailCourtDraft(id: string): Promise<AdminUserActivityDetail> {
    const r = await this.prisma.courtDraftRecord.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        caseDetails: true,
        draftText: true,
        kind: true,
        jurisdiction: true,
        matterId: true,
        status: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, email: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!r) throw new NotFoundException('Activity not found');

    const prompt = [r.title, r.caseDetails].filter(Boolean).join('\n\n');

    return {
      id: encodeActivityId('court_draft', r.id),
      source: 'court_draft',
      category: 'drafting',
      userId: r.userId,
      userName: r.user?.name ?? null,
      userEmail: r.user?.email ?? null,
      tenantName: r.tenant?.name ?? null,
      taskType: r.kind,
      mode: 'COURT_DRAFT',
      promptPreview: previewText(r.caseDetails || r.title),
      createdAt: r.createdAt,
      prompt,
      output: r.draftText,
      metadata: {
        jurisdiction: r.jurisdiction,
        matterId: r.matterId,
        status: r.status,
        title: r.title,
        kind: r.kind,
      },
    };
  }
}
