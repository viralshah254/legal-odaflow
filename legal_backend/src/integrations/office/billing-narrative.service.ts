import { Injectable, NotFoundException } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BillingNarrativeService {
  constructor(
    private readonly llm: LlmCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  async generateForMatter(tenantId: string, matterId: string): Promise<{ narrative: string }> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: {
        id: true,
        title: true,
        practiceArea: true,
        factsSummary: true,
        status: true,
      },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [timeEntries, timelineEvents, tasks] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { tenantId, matterId, date: { gte: since } },
        orderBy: { date: 'desc' },
        take: 40,
        select: {
          date: true,
          minutes: true,
          narrative: true,
          billable: true,
          status: true,
        },
      }),
      this.prisma.matterTimelineEvent.findMany({
        where: { tenantId, matterId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { eventType: true, title: true, description: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { tenantId, matterId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { title: true, status: true, createdAt: true },
      }),
    ]);

    const activitySummary = {
      matter,
      timeEntries: timeEntries.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        minutes: e.minutes,
        narrative: e.narrative,
        billable: e.billable,
      })),
      timelineEvents: timelineEvents.map((e) => ({
        type: e.eventType,
        title: e.title,
        description: e.description?.slice(0, 300),
        date: e.createdAt.toISOString().slice(0, 10),
      })),
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        updated: t.createdAt.toISOString().slice(0, 10),
      })),
    };

    const result = await this.llm.complete({
      modelName: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a legal billing specialist. Write invoice-ready billing narratives for law firm clients.
Rules:
- 2-4 sentences, professional tone
- Describe legal work performed, not internal process jargon
- Be specific where activity data allows; avoid inventing facts not in the data
- Suitable for a client-facing invoice description block
Return ONLY the narrative text, no headings or bullet lists.`,
        },
        {
          role: 'user',
          content: `Generate a billing narrative for this matter based on recent activity:\n\n${JSON.stringify(activitySummary, null, 2)}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.25,
    });

    return { narrative: result.content.trim() };
  }
}
