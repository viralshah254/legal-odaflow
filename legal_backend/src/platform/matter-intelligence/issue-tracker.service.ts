import { Injectable, Logger, Optional } from '@nestjs/common';
import { MatterIssueV2, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { LlmCompletionService } from '@/ai/llm-completion.service';

export interface CreateIssueDto {
  title: string;
  description?: string;
  issueType: string;
  issueCode?: string;
  priority?: string;
}

export interface IssueElement {
  elementId: string;
  elementText: string;
  satisfactionStatus?: 'unsatisfied' | 'partially_satisfied' | 'satisfied';
  evidenceIds?: string[];
}

export interface IssueStatusSummary {
  satisfied: number;
  partial: number;
  unsatisfied: number;
  overall: 'strong' | 'partial' | 'weak';
}

@Injectable()
export class IssueTrackerService {
  private readonly logger = new Logger(IssueTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  async createIssue(
    matterId: string,
    tenantId: string,
    dto: CreateIssueDto,
  ): Promise<MatterIssueV2> {
    return this.prisma.matterIssueV2.create({
      data: {
        matterId,
        tenantId,
        title: dto.title,
        description: dto.description,
        issueType: dto.issueType,
        issueCode: dto.issueCode,
        priority: dto.priority ?? 'medium',
        elements: [],
      },
    });
  }

  async mapElements(
    issueId: string,
    matterId: string,
    tenantId: string,
    elements: IssueElement[],
  ): Promise<MatterIssueV2> {
    await this.findIssueOrThrow(issueId, matterId, tenantId);

    const elementData: IssueElement[] = elements.map((e) => ({
      elementId: e.elementId,
      elementText: e.elementText,
      satisfactionStatus: e.satisfactionStatus ?? 'unsatisfied',
      evidenceIds: e.evidenceIds ?? [],
    }));

    return this.prisma.matterIssueV2.update({
      where: { id: issueId },
      data: { elements: elementData as unknown as Prisma.InputJsonValue },
    });
  }

  async updateElementSatisfaction(
    issueId: string,
    elementId: string,
    tenantId: string,
    satisfactionStatus: 'unsatisfied' | 'partially_satisfied' | 'satisfied',
    evidenceIds: string[],
  ): Promise<MatterIssueV2> {
    const issue = await this.prisma.matterIssueV2.findFirst({
      where: { id: issueId, tenantId },
    });
    if (!issue) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Issue ${issueId} not found`, 404);
    }

    const elements = (issue.elements as unknown as IssueElement[]) ?? [];
    const updated = elements.map((e) =>
      e.elementId === elementId
        ? { ...e, satisfactionStatus, evidenceIds }
        : e,
    );

    if (!elements.some((e) => e.elementId === elementId)) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Element ${elementId} not found in issue ${issueId}`,
        404,
      );
    }

    return this.prisma.matterIssueV2.update({
      where: { id: issueId },
      data: { elements: updated as unknown as Prisma.InputJsonValue },
    });
  }

  async getIssues(matterId: string, tenantId: string): Promise<MatterIssueV2[]> {
    return this.prisma.matterIssueV2.findMany({
      where: { matterId, tenantId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getIssueStatus(
    issueId: string,
    matterId: string,
    tenantId: string,
  ): Promise<IssueStatusSummary> {
    const issue = await this.findIssueOrThrow(issueId, matterId, tenantId);
    const elements = (issue.elements as unknown as IssueElement[]) ?? [];

    let satisfied = 0;
    let partial = 0;
    let unsatisfied = 0;

    for (const el of elements) {
      if (el.satisfactionStatus === 'satisfied') satisfied++;
      else if (el.satisfactionStatus === 'partially_satisfied') partial++;
      else unsatisfied++;
    }

    const total = elements.length;
    let overall: 'strong' | 'partial' | 'weak' = 'weak';
    if (total > 0) {
      const ratio = (satisfied + partial * 0.5) / total;
      if (ratio >= 0.7) overall = 'strong';
      else if (ratio >= 0.4) overall = 'partial';
    }

    return { satisfied, partial, unsatisfied, overall };
  }

  /**
   * Auto-map legal elements of an issue to MatterFacts and evidence using LLM.
   * Creates structured IssueElement → MatterFact → Evidence linkages.
   */
  async autoMapElementsToFacts(
    issueId: string,
    matterId: string,
    tenantId: string,
  ): Promise<MatterIssueV2> {
    const [issue, facts] = await Promise.all([
      this.findIssueOrThrow(issueId, matterId, tenantId),
      this.prisma.matterFactV2.findMany({ where: { matterId, tenantId }, take: 25 }),
    ]);

    const existingElements = (issue.elements as unknown as IssueElement[]) ?? [];
    if (existingElements.length === 0) return issue;

    if (!this.llm || facts.length === 0) return issue;

    const factList = facts
      .map((f, i) => `[${f.id}] (${f.factType}) ${f.text}`)
      .join('\n');

    const elementList = existingElements
      .map((e, i) => `[${i + 1}] ${e.elementId}: ${e.elementText}`)
      .join('\n');

    const systemPrompt = `You are a legal analyst mapping legal elements to supporting facts.
For each legal element, identify which facts support it and rate the satisfaction level.

Respond ONLY with a JSON array:
[{ "elementId": "...", "supportingFactIds": ["factId1", "factId2"], "satisfactionStatus": "satisfied|partially_satisfied|unsatisfied", "reasoning": "..." }]

Base satisfaction on:
- satisfied: Multiple strong facts directly prove this element
- partially_satisfied: Some relevant facts but gaps exist
- unsatisfied: No facts support this element`;

    const userPrompt = `ISSUE: ${issue.title}
ISSUE TYPE: ${(issue as any).issueType ?? 'general'}

LEGAL ELEMENTS TO MAP:
${elementList}

AVAILABLE FACTS:
${factList}

Map each element to the facts that best support it.`;

    try {
      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 1500,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return issue;

      const mappings = JSON.parse(jsonMatch[0]) as Array<{
        elementId: string;
        supportingFactIds: string[];
        satisfactionStatus: 'satisfied' | 'partially_satisfied' | 'unsatisfied';
        reasoning: string;
      }>;

      const validFactIds = new Set(facts.map((f) => f.id));

      const updatedElements: IssueElement[] = existingElements.map((el) => {
        const mapping = mappings.find((m) => m.elementId === el.elementId);
        if (!mapping) return el;

        const validEvidenceIds = mapping.supportingFactIds.filter((id) => validFactIds.has(id));

        return {
          ...el,
          satisfactionStatus: mapping.satisfactionStatus,
          evidenceIds: validEvidenceIds,
          reasoning: mapping.reasoning,
        };
      });

      const updated = await this.prisma.matterIssueV2.update({
        where: { id: issueId },
        data: { elements: updatedElements as unknown as Prisma.InputJsonValue },
      });

      this.logger.log(`Auto-mapped ${mappings.length} elements to facts for issue ${issueId}`);
      return updated;
    } catch (err) {
      this.logger.warn(`Auto element mapping failed for issue ${issueId}: ${String(err)}`);
      return issue;
    }
  }

  /**
   * Decompose an issue into legal elements using LLM based on the issue type.
   * E.g., "fraud" → elements: [Representation, Falsity, Knowledge, Reliance, Damages]
   */
  async decomposeIntoElements(
    issueId: string,
    matterId: string,
    tenantId: string,
  ): Promise<MatterIssueV2> {
    const issue = await this.findIssueOrThrow(issueId, matterId, tenantId);

    if (!this.llm) return issue;

    const systemPrompt = `You are a legal analyst decomposing a legal claim or issue into its essential elements.
For each element, provide the legal requirement that must be proven.

Respond ONLY with a JSON array:
[{ "elementId": "elem_1", "elementText": "...", "description": "...", "legalBasis": "..." }]

Max 8 elements.`;

    const userPrompt = `ISSUE TITLE: ${issue.title}
ISSUE TYPE: ${(issue as any).issueType ?? 'general'}
DESCRIPTION: ${(issue as any).description ?? ''}

Decompose this legal issue into its essential elements.`;

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
      if (!jsonMatch) return issue;

      const elements = JSON.parse(jsonMatch[0]) as Array<{
        elementId: string;
        elementText: string;
        description?: string;
        legalBasis?: string;
      }>;

      const issueElements: IssueElement[] = elements.map((e) => ({
        elementId: e.elementId,
        elementText: e.elementText,
        satisfactionStatus: 'unsatisfied',
        evidenceIds: [],
        description: e.description,
        legalBasis: e.legalBasis,
      }));

      return this.prisma.matterIssueV2.update({
        where: { id: issueId },
        data: { elements: issueElements as unknown as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.warn(`Issue decomposition failed for ${issueId}: ${String(err)}`);
      return issue;
    }
  }

  private async findIssueOrThrow(
    issueId: string,
    matterId: string,
    tenantId: string,
  ): Promise<MatterIssueV2> {
    const issue = await this.prisma.matterIssueV2.findFirst({
      where: { id: issueId, matterId, tenantId },
    });
    if (!issue) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Issue ${issueId} not found`, 404);
    }
    return issue;
  }
}
