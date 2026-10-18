import { Injectable, Logger, Optional } from '@nestjs/common';
import { LegalMemoryRecord } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { LlmCompletionService } from '@/ai/llm-completion.service';

/**
 * The 6 canonical memory scopes in the Umbrella Legal Memory architecture.
 *
 * personal_preference  – Individual lawyer preferences (formatting, style, citations preferred)
 * client_context       – Persistent facts about a client across all their matters
 * matter_history       – Events, decisions, and facts within a specific matter
 * firm_precedent       – Approved templates, winning arguments, firm-standard clauses
 * jurisdiction_law     – Jurisdiction-specific rules, court preferences, procedural norms
 * research_cache       – Synthesised research memos, authority summaries (short TTL)
 */
export const LEGAL_MEMORY_SCOPES = {
  PERSONAL_PREFERENCE: 'personal_preference',
  CLIENT_CONTEXT: 'client_context',
  MATTER_HISTORY: 'matter_history',
  FIRM_PRECEDENT: 'firm_precedent',
  JURISDICTION_LAW: 'jurisdiction_law',
  RESEARCH_CACHE: 'research_cache',
} as const;

export type LegalMemoryScope = typeof LEGAL_MEMORY_SCOPES[keyof typeof LEGAL_MEMORY_SCOPES];

export interface AddMemoryRecordDto {
  scope: string;
  matterId?: string;
  userId?: string;
  recordType: string;
  title: string;
  content: string;
  jurisdiction?: string;
  court?: string;
  matterType?: string;
  tags?: string[];
  confidence?: number;
  sourceRef?: string;
  expiresAt?: Date;
}

export interface RetrieveQuery {
  scope: string | string[];
  jurisdiction?: string;
  court?: string;
  matterType?: string;
  recordType?: string;
  tags?: string[];
  text?: string;
  limit?: number;
}

export interface ListRecordsFilter {
  scope?: string;
  recordType?: string;
  approved?: boolean;
  matterId?: string;
}

@Injectable()
export class LegalMemoryService {
  private readonly logger = new Logger(LegalMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  async addRecord(
    tenantId: string,
    dto: AddMemoryRecordDto,
  ): Promise<LegalMemoryRecord> {
    return this.prisma.legalMemoryRecord.create({
      data: {
        tenantId,
        scope: dto.scope,
        matterId: dto.matterId,
        userId: dto.userId,
        recordType: dto.recordType,
        title: dto.title,
        content: dto.content,
        jurisdiction: dto.jurisdiction,
        court: dto.court,
        matterType: dto.matterType,
        tags: dto.tags ?? [],
        confidence: dto.confidence ?? 0.7,
        sourceRef: dto.sourceRef,
        expiresAt: dto.expiresAt,
      },
    });
  }

  async retrieve(
    tenantId: string,
    query: RetrieveQuery,
  ): Promise<LegalMemoryRecord[]> {
    const scopes = Array.isArray(query.scope) ? query.scope : [query.scope];

    const now = new Date();
    const records = await this.prisma.legalMemoryRecord.findMany({
      where: {
        AND: [
          {
            tenantId,
            scope: { in: scopes },
            ...(query.jurisdiction && { jurisdiction: query.jurisdiction }),
            ...(query.court && { court: query.court }),
            ...(query.matterType && { matterType: query.matterType }),
            ...(query.recordType && { recordType: query.recordType }),
            ...(query.tags && query.tags.length > 0 && { tags: { hasSome: query.tags } }),
          },
          // expiresAt null or in future
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          // optional text search
          ...(query.text
            ? [
                {
                  OR: [
                    { title: { contains: query.text, mode: 'insensitive' as const } },
                    { content: { contains: query.text, mode: 'insensitive' as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ confidence: 'desc' }, { usageCount: 'desc' }],
      take: query.limit ?? 20,
    });

    return records;
  }

  async incrementUsage(recordId: string, tenantId: string): Promise<void> {
    await this.findRecordOrThrow(recordId, tenantId);
    await this.prisma.legalMemoryRecord.update({
      where: { id: recordId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async approveRecord(
    recordId: string,
    tenantId: string,
    approvedBy: string,
  ): Promise<LegalMemoryRecord> {
    await this.findRecordOrThrow(recordId, tenantId);
    return this.prisma.legalMemoryRecord.update({
      where: { id: recordId },
      data: {
        approved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async listRecords(
    tenantId: string,
    filters: ListRecordsFilter,
  ): Promise<LegalMemoryRecord[]> {
    return this.prisma.legalMemoryRecord.findMany({
      where: {
        tenantId,
        ...(filters.scope && { scope: filters.scope }),
        ...(filters.recordType && { recordType: filters.recordType }),
        ...(filters.approved !== undefined && { approved: filters.approved }),
        ...(filters.matterId && { matterId: filters.matterId }),
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async deleteRecord(recordId: string, tenantId: string): Promise<void> {
    await this.findRecordOrThrow(recordId, tenantId);
    await this.prisma.legalMemoryRecord.delete({ where: { id: recordId } });
  }

  /**
   * Query across multiple scopes with priority order:
   * matter_history > client_context > firm_precedent > jurisdiction_law > research_cache > personal_preference
   */
  async retrieveForDraftingContext(
    tenantId: string,
    options: {
      matterId?: string;
      jurisdiction?: string;
      court?: string;
      matterType?: string;
      userId?: string;
      limit?: number;
    },
  ): Promise<{ scope: LegalMemoryScope; records: LegalMemoryRecord[] }[]> {
    const scopeQueries: Array<{ scope: LegalMemoryScope; filter: Record<string, unknown> }> = [
      {
        scope: 'matter_history',
        filter: options.matterId ? { matterId: options.matterId } : { matterId: null },
      },
      {
        scope: 'client_context',
        filter: {},
      },
      {
        scope: 'firm_precedent',
        filter: options.matterType ? { matterType: options.matterType } : {},
      },
      {
        scope: 'jurisdiction_law',
        filter: {
          ...(options.jurisdiction ? { jurisdiction: options.jurisdiction } : {}),
          ...(options.court ? { court: options.court } : {}),
        },
      },
      {
        scope: 'research_cache',
        filter: {
          ...(options.jurisdiction ? { jurisdiction: options.jurisdiction } : {}),
        },
      },
      {
        scope: 'personal_preference',
        filter: options.userId ? { userId: options.userId } : {},
      },
    ];

    const now = new Date();
    const results: { scope: LegalMemoryScope; records: LegalMemoryRecord[] }[] = [];

    for (const { scope, filter } of scopeQueries) {
      const records = await this.prisma.legalMemoryRecord.findMany({
        where: {
          tenantId,
          scope,
          ...filter,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ confidence: 'desc' }, { usageCount: 'desc' }],
        take: Math.ceil((options.limit ?? 30) / scopeQueries.length),
      });

      if (records.length > 0) {
        results.push({ scope, records });
      }
    }

    return results;
  }

  /**
   * Auto-extract memory records from a completed matter research result using LLM.
   * Creates firm_precedent and jurisdiction_law records from successful outcomes.
   */
  async extractFromResearchResult(
    tenantId: string,
    matterId: string,
    researchSummary: string,
    jurisdiction: string,
    matterType?: string,
  ): Promise<number> {
    if (!this.llm) return 0;

    const systemPrompt = `You are extracting reusable legal knowledge from a research memo.
Extract facts worth remembering for future similar matters.
Categorize each into: "firm_precedent" (winning arguments, strategies) or "jurisdiction_law" (court rules, procedural norms).

Respond ONLY with a JSON array:
[{ "scope": "firm_precedent"|"jurisdiction_law", "title": "...", "content": "...", "tags": ["..."] }]

Max 5 items. Only include high-value, reusable information.`;

    const userPrompt = `JURISDICTION: ${jurisdiction}
MATTER TYPE: ${matterType ?? 'general'}
RESEARCH MEMO:
${researchSummary.slice(0, 4000)}`;

    try {
      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 1000,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return 0;

      const items = JSON.parse(jsonMatch[0]) as Array<{
        scope: string;
        title: string;
        content: string;
        tags?: string[];
      }>;

      let created = 0;
      for (const item of items.slice(0, 5)) {
        if (!item.title || !item.content) continue;
        await this.addRecord(tenantId, {
          scope: item.scope as LegalMemoryScope,
          matterId,
          recordType: 'research_extract',
          title: item.title,
          content: item.content,
          jurisdiction,
          matterType,
          tags: item.tags ?? [],
          confidence: 0.75,
          expiresAt: item.scope === 'research_cache'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            : undefined,
        });
        created++;
      }

      this.logger.log(`Extracted ${created} memory records from research result for matter ${matterId}`);
      return created;
    } catch (err) {
      this.logger.warn(`Memory extraction failed: ${String(err)}`);
      return 0;
    }
  }

  private async findRecordOrThrow(
    recordId: string,
    tenantId: string,
  ): Promise<LegalMemoryRecord> {
    const record = await this.prisma.legalMemoryRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Legal memory record ${recordId} not found`,
        404,
      );
    }
    return record;
  }
}
