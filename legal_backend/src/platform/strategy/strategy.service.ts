import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { LlmCompletionService } from '@/ai/llm-completion.service'
import type { LegalStrategy } from '@prisma/client'

export interface BuildStrategyDto {
  strategyType: 'litigation' | 'negotiation' | 'regulatory' | 'transactional' | 'defensive'
  objective: string
  title?: string
  workflowId?: string
}

interface StrategyOutput {
  approach: string
  keyArguments: Array<{ argument: string; authority: string; strength: string; ordinal: number }>
  risks: Array<{ risk: string; likelihood: string; mitigation: string }>
  alternatives: Array<{ alternative: string; pros: string[]; cons: string[] }>
  openQuestions: string[]
}

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  async buildStrategy(
    tenantId: string,
    matterId: string,
    dto: BuildStrategyDto,
  ): Promise<LegalStrategy> {
    const [facts, issues, contradictions] = await Promise.all([
      this.prisma.matterFactV2.findMany({ where: { matterId }, take: 20 }),
      this.prisma.matterIssueV2.findMany({ where: { matterId }, take: 10 }),
      this.prisma.matterContradiction.findMany({ where: { matterId }, take: 5 }).catch(() => []),
    ])

    const factTexts = facts.map((f) => (f as any).text ?? (f as any).content ?? '').filter(Boolean)
    const issueTexts = issues.map((i) => (i as any).issueText ?? (i as any).title ?? '').filter(Boolean)

    let strategyOutput: StrategyOutput

    if (this.llm && (factTexts.length > 0 || issueTexts.length > 0)) {
      strategyOutput = await this.generateAiStrategy(dto, factTexts, issueTexts, contradictions as any[])
    } else {
      strategyOutput = this.buildTemplateStrategy(dto, factTexts, issueTexts)
    }

    return this.prisma.legalStrategy.create({
      data: {
        tenantId,
        matterId,
        workflowId: dto.workflowId ?? null,
        strategyType: dto.strategyType,
        title: dto.title ?? `${dto.strategyType} strategy — ${dto.objective.slice(0, 60)}`,
        objective: dto.objective,
        approach: strategyOutput.approach,
        keyArguments: strategyOutput.keyArguments as any,
        risks: strategyOutput.risks as any,
        alternatives: strategyOutput.alternatives as any,
        openQuestions: strategyOutput.openQuestions,
        status: 'draft',
      },
    })
  }

  private async generateAiStrategy(
    dto: BuildStrategyDto,
    facts: string[],
    issues: string[],
    contradictions: Array<{ description: string; severity: string }>,
  ): Promise<StrategyOutput> {
    const systemPrompt = `You are a senior litigation strategist. Generate a comprehensive legal strategy.
Output JSON with this structure:
{
  "approach": "overall strategic approach narrative (2-3 paragraphs)",
  "keyArguments": [{ "argument": "...", "authority": "cite or empty", "strength": "strong|medium|weak", "ordinal": 0 }],
  "risks": [{ "risk": "...", "likelihood": "high|medium|low", "mitigation": "..." }],
  "alternatives": [{ "alternative": "...", "pros": ["..."], "cons": ["..."] }],
  "openQuestions": ["..."]
}
Provide 3-5 key arguments, 3-4 risks, 2-3 alternatives, and 2-3 open questions.`

    const userPrompt = `STRATEGY TYPE: ${dto.strategyType}
OBJECTIVE: ${dto.objective}

FACTS (${facts.length}):
${facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join('\n')}

ISSUES (${issues.length}):
${issues.slice(0, 5).map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

${contradictions.length > 0 ? `CONTRADICTIONS TO ADDRESS:\n${contradictions.slice(0, 3).map((c) => `- [${c.severity}] ${c.description}`).join('\n')}` : ''}

Generate the legal strategy.`

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 2000,
      })

      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')

      const parsed = JSON.parse(jsonMatch[0]) as StrategyOutput
      return parsed
    } catch (err) {
      this.logger.warn(`AI strategy generation failed: ${String(err)}`)
      return this.buildTemplateStrategy(dto, facts, issues)
    }
  }

  private buildTemplateStrategy(
    dto: BuildStrategyDto,
    facts: string[],
    issues: string[],
  ): StrategyOutput {
    return {
      approach: `Based on ${facts.length} facts and ${issues.length} issues identified, a ${dto.strategyType} approach is recommended for: ${dto.objective}`,
      keyArguments: issues.map((issue, idx) => ({
        argument: `Address: ${issue}`,
        authority: '',
        strength: 'medium',
        ordinal: idx,
      })),
      risks: [
        { risk: 'Adverse ruling on key legal issue', likelihood: 'medium', mitigation: 'Prepare alternative arguments' },
        { risk: 'Evidence gap', likelihood: 'low', mitigation: 'Conduct targeted discovery' },
      ],
      alternatives: [
        { alternative: 'Settle early', pros: ['Cost savings', 'Certainty'], cons: ['May not obtain full relief'] },
        { alternative: 'Pursue full litigation', pros: ['Maximum recovery'], cons: ['Time and cost'] },
      ],
      openQuestions: ['What is the strength of available evidence?', 'Are there precedents in this jurisdiction?'],
    }
  }

  async refineStrategy(strategyId: string, tenantId: string, feedback: string): Promise<LegalStrategy> {
    const existing = await this.getStrategy(strategyId, tenantId)

    if (this.llm) {
      return this.regenerateWithFeedback(existing, feedback)
    }

    const updatedOpenQuestions = [
      ...((existing.openQuestions as string[]) ?? []),
      `Feedback: ${feedback}`,
    ]

    return this.prisma.legalStrategy.update({
      where: { id: strategyId },
      data: { openQuestions: updatedOpenQuestions, status: 'draft', updatedAt: new Date() },
    })
  }

  private async regenerateWithFeedback(strategy: LegalStrategy, feedback: string): Promise<LegalStrategy> {
    const systemPrompt = `You are a senior litigation strategist refining an existing legal strategy based on feedback.
Return only the refined strategy JSON in the same format as the original.`

    const userPrompt = `ORIGINAL STRATEGY:
Objective: ${strategy.objective}
Approach: ${strategy.approach}
Key Arguments: ${JSON.stringify(strategy.keyArguments, null, 2)}

FEEDBACK TO INCORPORATE: ${feedback}

Refine the strategy incorporating this feedback. Return full updated JSON.`

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 1500,
      })

      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')

      const updated = JSON.parse(jsonMatch[0]) as StrategyOutput

      return this.prisma.legalStrategy.update({
        where: { id: strategy.id },
        data: {
          approach: updated.approach ?? strategy.approach,
          keyArguments: updated.keyArguments as any ?? strategy.keyArguments,
          risks: updated.risks as any ?? strategy.risks,
          alternatives: updated.alternatives as any ?? strategy.alternatives,
          openQuestions: updated.openQuestions ?? strategy.openQuestions as string[],
          status: 'draft',
          updatedAt: new Date(),
        },
      })
    } catch (err) {
      this.logger.warn(`Strategy refinement AI failed: ${String(err)}`)
      const updatedOpenQuestions = [...((strategy.openQuestions as string[]) ?? []), `Feedback: ${feedback}`]
      return this.prisma.legalStrategy.update({
        where: { id: strategy.id },
        data: { openQuestions: updatedOpenQuestions, status: 'draft', updatedAt: new Date() },
      })
    }
  }

  async approveStrategy(strategyId: string, tenantId: string, approvedBy: string): Promise<LegalStrategy> {
    await this.getStrategy(strategyId, tenantId)

    return this.prisma.legalStrategy.update({
      where: { id: strategyId },
      data: { status: 'approved', reviewedBy: approvedBy },
    })
  }

  async getStrategies(matterId: string, tenantId: string): Promise<LegalStrategy[]> {
    return this.prisma.legalStrategy.findMany({
      where: { matterId, tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getStrategy(id: string, tenantId: string): Promise<LegalStrategy> {
    const strategy = await this.prisma.legalStrategy.findFirst({ where: { id, tenantId } })
    if (!strategy) throw new NotFoundException('Strategy not found')
    return strategy
  }
}
