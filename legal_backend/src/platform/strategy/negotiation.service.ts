import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { NegotiationSession } from '@prisma/client'

export interface CreateNegotiationSessionDto {
  sessionType: 'mediation' | 'negotiation' | 'settlement' | 'arbitration'
  ourPosition?: Record<string, unknown>
  targetSettlement?: Record<string, unknown>
  walkAwayPoint?: Record<string, unknown>
  notes?: string
}

export interface Proposal {
  party: string
  terms: Record<string, unknown>
  notes?: string
}

@Injectable()
export class NegotiationService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    tenantId: string,
    matterId: string,
    dto: CreateNegotiationSessionDto,
  ): Promise<NegotiationSession> {
    return this.prisma.negotiationSession.create({
      data: {
        tenantId,
        matterId,
        sessionType: dto.sessionType,
        status: 'open',
        ourPosition: (dto.ourPosition ?? null) as any,
        targetSettlement: (dto.targetSettlement ?? null) as any,
        walkAwayPoint: (dto.walkAwayPoint ?? null) as any,
        notes: dto.notes ?? null,
        proposalsJson: [],
      },
    })
  }

  async addProposal(
    sessionId: string,
    tenantId: string,
    proposal: Proposal,
  ): Promise<NegotiationSession> {
    const session = await this.getSession(sessionId, tenantId)

    const proposals = ((session.proposalsJson as unknown[]) ?? []) as Proposal[]
    proposals.push({ ...proposal, timestamp: new Date().toISOString() } as any)

    return this.prisma.negotiationSession.update({
      where: { id: sessionId },
      data: { proposalsJson: proposals as any, currentOffer: proposal.terms as any, status: 'in_progress' },
    })
  }

  async recordCounterProposal(
    sessionId: string,
    tenantId: string,
    counter: Record<string, unknown>,
  ): Promise<NegotiationSession> {
    const session = await this.getSession(sessionId, tenantId)

    const proposals = ((session.proposalsJson as unknown[]) ?? []) as unknown[]
    proposals.push({ party: 'counterparty', terms: counter, timestamp: new Date().toISOString() })

    return this.prisma.negotiationSession.update({
      where: { id: sessionId },
      data: {
        proposalsJson: proposals as any,
        theirPosition: counter as any,
        status: 'in_progress',
      },
    })
  }

  async analyzeGap(
    sessionId: string,
    tenantId: string,
  ): Promise<{ gap: Record<string, unknown>; pathToSettlement: string[] }> {
    const session = await this.getSession(sessionId, tenantId)

    const ourPos = (session.ourPosition as Record<string, unknown>) ?? {}
    const theirPos = (session.theirPosition as Record<string, unknown>) ?? {}

    const gap: Record<string, unknown> = {}
    const allKeys = new Set([...Object.keys(ourPos), ...Object.keys(theirPos)])

    for (const key of allKeys) {
      if (JSON.stringify(ourPos[key]) !== JSON.stringify(theirPos[key])) {
        gap[key] = { ours: ourPos[key], theirs: theirPos[key] }
      }
    }

    const gapKeys = Object.keys(gap)

    const pathToSettlement =
      gapKeys.length === 0
        ? ['Positions aligned — draft settlement agreement']
        : [
            `Resolve ${gapKeys.length} open point(s): ${gapKeys.join(', ')}`,
            'Schedule follow-up session within 7 days',
            'Consider mediator proposal on contested items',
            'Draft heads of agreement once gap is closed',
          ]

    return { gap, pathToSettlement }
  }

  async recordSettlement(
    sessionId: string,
    tenantId: string,
    agreedTerms: Record<string, unknown>,
  ): Promise<NegotiationSession> {
    await this.getSession(sessionId, tenantId)

    return this.prisma.negotiationSession.update({
      where: { id: sessionId },
      data: {
        agreedTerms: agreedTerms as any,
        status: 'settlement_reached',
        settlementDate: new Date(),
      },
    })
  }

  async getSessions(matterId: string, tenantId: string): Promise<NegotiationSession[]> {
    return this.prisma.negotiationSession.findMany({
      where: { matterId, tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  private async getSession(id: string, tenantId: string): Promise<NegotiationSession> {
    const session = await this.prisma.negotiationSession.findFirst({ where: { id, tenantId } })
    if (!session) throw new NotFoundException('Negotiation session not found')
    return session
  }
}
