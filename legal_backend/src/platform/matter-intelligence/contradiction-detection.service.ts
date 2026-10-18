import { Injectable, Logger, Optional } from '@nestjs/common';
import { MatterContradiction, MatterFactV2 } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { LlmCompletionService } from '@/ai/llm-completion.service';

@Injectable()
export class ContradictionDetectionService {
  private readonly logger = new Logger(ContradictionDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  async detectContradictions(
    matterId: string,
    tenantId: string,
  ): Promise<MatterContradiction[]> {
    const facts = await this.prisma.matterFactV2.findMany({
      where: { matterId, tenantId },
    });

    const detected: MatterContradiction[] = [];

    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const a = facts[i];
        const b = facts[j];

        const contradiction = this.analyzeContradiction(a, b);
        if (!contradiction) continue;

        const existing = await this.prisma.matterContradiction.findFirst({
          where: {
            matterId,
            OR: [
              { factAId: a.id, factBId: b.id },
              { factAId: b.id, factBId: a.id },
            ],
          },
        });
        if (existing) continue;

        const record = await this.prisma.matterContradiction.create({
          data: {
            matterId,
            tenantId,
            factAId: a.id,
            factBId: b.id,
            contradictionType: contradiction.type,
            severity: contradiction.severity,
            description: contradiction.description,
          },
        });
        detected.push(record);
      }
    }

    // LLM-augmented detection for cases that heuristics miss
    if (this.llm && facts.length >= 2 && facts.length <= 30) {
      const llmContradictions = await this.detectWithLlm(matterId, tenantId, facts, detected);
      detected.push(...llmContradictions);
    }

    return detected;
  }

  /**
   * Use LLM to detect semantic contradictions that heuristics miss.
   */
  private async detectWithLlm(
    matterId: string,
    tenantId: string,
    facts: MatterFactV2[],
    alreadyDetected: MatterContradiction[],
  ): Promise<MatterContradiction[]> {
    const alreadyPairs = new Set(
      alreadyDetected.map((c) => `${c.factAId}|${c.factBId}`),
    );

    const factList = facts
      .slice(0, 20)
      .map((f, i) => `[${i + 1}] (${f.factType}) ${f.text}`)
      .join('\n');

    const systemPrompt = `You are a legal analyst reviewing a list of case facts for contradictions.
Identify fact pairs that contradict each other — including:
- Direct factual contradictions (A says X happened, B says X did not happen)
- Temporal impossibilities (same person in two places simultaneously)
- Document vs statement contradictions
- Hidden semantic contradictions (not obvious from negation words alone)

Respond ONLY with a JSON array of objects:
{ "factIndexA": 1, "factIndexB": 3, "type": "direct_contradiction|temporal_inconsistency|party_statement_vs_document|document_vs_document|semantic_contradiction", "severity": "critical|major|minor", "description": "..." }

Return at most 5 contradictions. Return [] if none found.`;

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `FACTS:\n${factList}` },
        ],
        temperature: 0.2,
        maxTokens: 1000,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]) as Array<{
        factIndexA: number;
        factIndexB: number;
        type: string;
        severity: string;
        description: string;
      }>;

      const newContradictions: MatterContradiction[] = [];

      for (const item of raw) {
        const a = facts[item.factIndexA - 1];
        const b = facts[item.factIndexB - 1];
        if (!a || !b) continue;

        const pairKey = `${a.id}|${b.id}`;
        const reversePairKey = `${b.id}|${a.id}`;
        if (alreadyPairs.has(pairKey) || alreadyPairs.has(reversePairKey)) continue;

        // Check DB
        const existing = await this.prisma.matterContradiction.findFirst({
          where: {
            matterId,
            OR: [
              { factAId: a.id, factBId: b.id },
              { factAId: b.id, factBId: a.id },
            ],
          },
        });
        if (existing) continue;

        const record = await this.prisma.matterContradiction.create({
          data: {
            matterId,
            tenantId,
            factAId: a.id,
            factBId: b.id,
            contradictionType: item.type,
            severity: item.severity,
            description: item.description,
            metadata: { detectedBy: 'llm' },
          },
        });
        newContradictions.push(record);
        alreadyPairs.add(pairKey);
      }

      return newContradictions;
    } catch (err) {
      this.logger.warn(`LLM contradiction detection failed: ${String(err)}`);
      return [];
    }
  }

  /**
   * Generate AI-suggested resolution for a contradiction.
   */
  async suggestResolution(contradictionId: string, tenantId: string): Promise<string> {
    const record = await this.prisma.matterContradiction.findFirst({
      where: { id: contradictionId, tenantId },
      include: { factA: true, factB: true },
    });

    if (!record) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Contradiction ${contradictionId} not found`, 404);
    }

    if (!this.llm) {
      return `Contradiction of type "${record.contradictionType}" between two facts. Manual review required.`;
    }

    const systemPrompt = `You are a senior legal analyst. Given two contradicting facts from a case, suggest:
1. Which fact is more likely to be accurate and why
2. What evidence would resolve the contradiction
3. How to handle this contradiction in legal proceedings

Be concise and practical. 3-4 sentences maximum.`;

    const userPrompt = `CONTRADICTION TYPE: ${record.contradictionType} (Severity: ${record.severity})
DESCRIPTION: ${record.description}

FACT A: ${(record.factA as any)?.text ?? 'Not available'}
FACT B: ${(record.factB as any)?.text ?? 'Not available'}

Suggest resolution.`;

    try {
      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 400,
      });
      return result.content;
    } catch {
      return `Contradiction of type "${record.contradictionType}". Please review both facts manually.`;
    }
  }

  async resolveContradiction(
    contradictionId: string,
    tenantId: string,
    resolution: string,
    resolvedBy: string,
  ): Promise<MatterContradiction> {
    const record = await this.prisma.matterContradiction.findFirst({
      where: { id: contradictionId, tenantId },
    });
    if (!record) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Contradiction ${contradictionId} not found`,
        404,
      );
    }

    return this.prisma.matterContradiction.update({
      where: { id: contradictionId },
      data: {
        resolutionStatus: 'user_resolved',
        resolution,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  async getContradictions(
    matterId: string,
    tenantId: string,
  ): Promise<MatterContradiction[]> {
    return this.prisma.matterContradiction.findMany({
      where: { matterId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private analyzeContradiction(
    a: MatterFactV2,
    b: MatterFactV2,
  ): { type: string; severity: string; description: string } | null {
    // 1. Status contradiction: ASSERTED vs JUDICIAL_FINDING on same subject
    if (
      (a.status === 'ASSERTED' && b.status === 'JUDICIAL_FINDING') ||
      (a.status === 'JUDICIAL_FINDING' && b.status === 'ASSERTED')
    ) {
      if (this.textsOverlapSignificantly(a.text, b.text)) {
        return {
          type: 'direct_contradiction',
          severity: 'critical',
          description: `Fact "${this.truncate(a.text)}" (${a.status}) contradicts judicial finding "${this.truncate(b.text)}".`,
        };
      }
    }

    // 2. Direct contradiction: negation patterns
    if (this.isDirectContradiction(a.text, b.text)) {
      return {
        type: 'direct_contradiction',
        severity: 'major',
        description: `Fact "${this.truncate(a.text)}" directly contradicts "${this.truncate(b.text)}".`,
      };
    }

    // 3. Temporal inconsistency: overlapping parties at same time
    if (
      a.dateOccurred &&
      b.dateOccurred &&
      a.parties.length > 0 &&
      b.parties.length > 0 &&
      this.datesOverlap(a.dateOccurred, b.dateOccurred) &&
      this.partiesOverlap(a.parties, b.parties) &&
      this.areTemporallyInconsistent(a.text, b.text)
    ) {
      return {
        type: 'temporal_inconsistency',
        severity: 'major',
        description: `Temporal inconsistency: party involved in two conflicting events on ${a.dateOccurred.toISOString().split('T')[0]}. "${this.truncate(a.text)}" vs "${this.truncate(b.text)}".`,
      };
    }

    // 4. Party statement vs document
    const aIsUserStatement = a.factType === 'user_statement';
    const bIsDocument = b.factType === 'extracted_from_document';
    const bIsUserStatement = b.factType === 'user_statement';
    const aIsDocument = a.factType === 'extracted_from_document';

    if (
      (aIsUserStatement && bIsDocument) ||
      (bIsUserStatement && aIsDocument)
    ) {
      if (this.isDirectContradiction(a.text, b.text)) {
        return {
          type: 'party_statement_vs_document',
          severity: 'major',
          description: `Party statement "${this.truncate(aIsUserStatement ? a.text : b.text)}" contradicts document fact "${this.truncate(aIsDocument ? a.text : b.text)}".`,
        };
      }
    }

    // 5. Document vs document
    if (aIsDocument && bIsDocument && this.isDirectContradiction(a.text, b.text)) {
      return {
        type: 'document_vs_document',
        severity: 'major',
        description: `Document-sourced fact "${this.truncate(a.text)}" contradicts document-sourced fact "${this.truncate(b.text)}".`,
      };
    }

    return null;
  }

  private isDirectContradiction(textA: string, textB: string): boolean {
    const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const a = normalize(textA);
    const b = normalize(textB);

    // Check for negation: "X did not Y" vs "X did Y"
    const negationPatterns = [
      /(\w+)\s+did\s+not\s+(\w+)/,
      /(\w+)\s+does\s+not\s+(\w+)/,
      /(\w+)\s+was\s+not\s+(\w+)/,
      /(\w+)\s+is\s+not\s+(\w+)/,
      /(\w+)\s+never\s+(\w+)/,
      /(\w+)\s+denied\s+(\w+)/,
    ];

    for (const pattern of negationPatterns) {
      const matchA = a.match(pattern);
      const matchB = b.match(pattern);
      if (matchA && !matchB && b.includes(matchA[1]) && b.includes(matchA[2])) return true;
      if (matchB && !matchA && a.includes(matchB[1]) && a.includes(matchB[2])) return true;
    }

    return false;
  }

  private textsOverlapSignificantly(a: string, b: string): boolean {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap >= 3;
  }

  private areTemporallyInconsistent(textA: string, textB: string): boolean {
    const locationWords = ['in', 'at', 'from', 'location', 'office', 'court', 'city', 'place'];
    const aHasLocation = locationWords.some((w) => textA.toLowerCase().includes(w));
    const bHasLocation = locationWords.some((w) => textB.toLowerCase().includes(w));
    return aHasLocation && bHasLocation;
  }

  private datesOverlap(a: Date, b: Date): boolean {
    const diffMs = Math.abs(a.getTime() - b.getTime());
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diffMs < oneDayMs;
  }

  private partiesOverlap(a: string[], b: string[]): boolean {
    return a.some((p) => b.includes(p));
  }

  private truncate(text: string, maxLen = 80): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
}
