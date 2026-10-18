import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { HearingPrep } from '@prisma/client'

export interface CreateHearingPrepDto {
  hearingDate: Date | string
  hearingType: 'trial' | 'motion' | 'evidence' | 'settlement' | 'appeal' | 'arbitration' | 'mediation'
  court?: string
  judge?: string
}

export interface WitnessInput {
  name: string
  role: string
  topics: string[]
  notes?: string
}

export interface ExhibitInput {
  label: string
  title: string
  documentId?: string
  description: string
}

@Injectable()
export class HearingPrepService {
  constructor(private readonly prisma: PrismaService) {}

  async createHearingPrep(tenantId: string, matterId: string, dto: CreateHearingPrepDto): Promise<HearingPrep> {
    return this.prisma.hearingPrep.create({
      data: {
        tenantId,
        matterId,
        hearingDate: new Date(dto.hearingDate),
        hearingType: dto.hearingType,
        court: dto.court ?? null,
        judge: dto.judge ?? null,
        status: 'planning',
        witnessListJson: [],
        exhibitListJson: [],
        anticipatedObjections: [],
      },
    })
  }

  async generateArguments(prepId: string, tenantId: string): Promise<HearingPrep> {
    const prep = await this.getPrep(prepId, tenantId)

    const [facts, issues] = await Promise.all([
      this.prisma.matterFactV2.findMany({ where: { matterId: prep.matterId }, take: 15 }),
      this.prisma.matterIssueV2.findMany({ where: { matterId: prep.matterId }, take: 8 }),
    ])

    const argumentsJson = {
      mainTheme: `${prep.hearingType} hearing arguments`,
      keyPoints: issues.map((i) => ({ point: (i as any).issueText ?? '', authority: '', strength: 'medium' })),
      supportingFacts: facts.slice(0, 5).map((f) => (f as any).content ?? ''),
    }

    const anticipatedObjections = [
      { objection: 'Relevance', counter: 'Directly material to the central issue' },
      { objection: 'Hearsay', counter: 'Falls within recognized exception' },
    ]

    return this.prisma.hearingPrep.update({
      where: { id: prepId },
      data: {
        argumentsJson,
        openingStatement: `We are here today regarding ${prep.hearingType} in matter ${prep.matterId}. The evidence will show…`,
        anticipatedObjections,
        status: 'in_progress',
      },
    })
  }

  async addWitness(prepId: string, tenantId: string, witness: WitnessInput): Promise<HearingPrep> {
    const prep = await this.getPrep(prepId, tenantId)

    const list = ((prep.witnessListJson as unknown[]) ?? []) as WitnessInput[]
    list.push(witness)

    return this.prisma.hearingPrep.update({
      where: { id: prepId },
      data: { witnessListJson: list as any },
    })
  }

  async addExhibit(prepId: string, tenantId: string, exhibit: ExhibitInput): Promise<HearingPrep> {
    const prep = await this.getPrep(prepId, tenantId)

    const list = ((prep.exhibitListJson as unknown[]) ?? []) as ExhibitInput[]
    list.push(exhibit)

    return this.prisma.hearingPrep.update({
      where: { id: prepId },
      data: { exhibitListJson: list as any },
    })
  }

  async getPrep(prepId: string, tenantId: string): Promise<HearingPrep> {
    const prep = await this.prisma.hearingPrep.findFirst({ where: { id: prepId, tenantId } })
    if (!prep) throw new NotFoundException('Hearing prep not found')
    return prep
  }

  async listPreps(matterId: string, tenantId: string): Promise<HearingPrep[]> {
    return this.prisma.hearingPrep.findMany({
      where: { matterId, tenantId },
      orderBy: { hearingDate: 'asc' },
    })
  }
}
