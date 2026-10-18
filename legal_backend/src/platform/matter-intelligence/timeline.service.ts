import { Injectable } from '@nestjs/common';
import { MatterDeadline, MatterFactV2, MatterTimelineEvent } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

export interface AddTimelineEventDto {
  eventDate: Date;
  eventType: string;
  title: string;
  description?: string;
  significance?: string;
  factIds?: string[];
  documentIds?: string[];
  source?: string;
}

const DEADLINE_KEYWORDS = [
  { pattern: /within\s+(\d+)\s+days?/i, type: 'notice_period' },
  { pattern: /by\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i, type: 'contractual' },
  { pattern: /statute\s+of\s+limitations/i, type: 'statute_of_limitations' },
  { pattern: /filing\s+deadline/i, type: 'court_filing' },
  { pattern: /response\s+due/i, type: 'response_due' },
  { pattern: /discovery\s+(deadline|cutoff|closes?)/i, type: 'discovery' },
  { pattern: /limitation\s+period/i, type: 'statute_of_limitations' },
  { pattern: /due\s+date/i, type: 'contractual' },
  { pattern: /must\s+be\s+filed\s+within\s+(\d+)\s+days?/i, type: 'court_filing' },
  { pattern: /notice\s+period\s+of\s+(\d+)\s+days?/i, type: 'notice_period' },
];

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async addEvent(
    matterId: string,
    tenantId: string,
    dto: AddTimelineEventDto,
  ): Promise<MatterTimelineEvent> {
    return this.prisma.matterTimelineEvent.create({
      data: {
        matterId,
        tenantId,
        eventDate: dto.eventDate,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description,
        significance: dto.significance ?? 'normal',
        factIds: dto.factIds ?? [],
        documentIds: dto.documentIds ?? [],
        source: dto.source ?? 'user',
      },
    });
  }

  async getTimeline(
    matterId: string,
    tenantId: string,
  ): Promise<MatterTimelineEvent[]> {
    return this.prisma.matterTimelineEvent.findMany({
      where: { matterId, tenantId },
      orderBy: { eventDate: 'asc' },
    });
  }

  async extractDeadlines(
    matterId: string,
    tenantId: string,
    facts: MatterFactV2[],
  ): Promise<MatterDeadline[]> {
    const created: MatterDeadline[] = [];

    for (const fact of facts) {
      for (const { pattern, type } of DEADLINE_KEYWORDS) {
        const match = fact.text.match(pattern);
        if (!match) continue;

        const dueDate = this.inferDueDate(fact.text, match, fact.dateOccurred);
        if (!dueDate) continue;

        const alreadyExists = await this.prisma.matterDeadline.findFirst({
          where: {
            matterId,
            tenantId,
            title: { contains: match[0].slice(0, 50) },
          },
        });
        if (alreadyExists) continue;

        const warningDate = new Date(dueDate);
        warningDate.setDate(warningDate.getDate() - 7);

        const deadline = await this.prisma.matterDeadline.create({
          data: {
            matterId,
            tenantId,
            title: `Deadline from fact: ${match[0].slice(0, 80)}`,
            deadlineType: type,
            dueDate,
            warningDate,
            sourceRef: `fact:${fact.id}`,
            ruleText: fact.text.slice(0, 500),
            autoDetected: true,
          },
        });
        created.push(deadline);
      }
    }

    return created;
  }

  async getDeadlines(
    matterId: string,
    tenantId: string,
  ): Promise<MatterDeadline[]> {
    return this.prisma.matterDeadline.findMany({
      where: { matterId, tenantId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateDeadlineStatus(
    deadlineId: string,
    matterId: string,
    tenantId: string,
    status: string,
  ): Promise<MatterDeadline> {
    const deadline = await this.prisma.matterDeadline.findFirst({
      where: { id: deadlineId, matterId, tenantId },
    });
    if (!deadline) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Deadline ${deadlineId} not found`,
        404,
      );
    }

    return this.prisma.matterDeadline.update({
      where: { id: deadlineId },
      data: {
        status,
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    });
  }

  private inferDueDate(
    text: string,
    match: RegExpMatchArray,
    baseDate: Date | null,
  ): Date | null {
    // Try to extract explicit date from text
    const explicitDate = text.match(
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    );
    if (explicitDate) {
      const parsed = new Date(explicitDate[0]);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Try "within N days" pattern
    const daysMatch = match[0].match(/(\d+)\s+days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const base = baseDate ?? new Date();
      const due = new Date(base);
      due.setDate(due.getDate() + days);
      return due;
    }

    return null;
  }
}
