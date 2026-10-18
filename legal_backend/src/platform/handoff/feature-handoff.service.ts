import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

export interface HandoffRequest {
  fromUserId: string
  toUserId?: string
  toRole?: string
  handoffType: 'consumer_to_lawyer' | 'lawyer_to_specialist' | 'draft_for_review' | 'research_share' | 'matter_transfer'
  matterId?: string
  workflowId?: string
  summary: string
  documents: string[]
  urgency: 'normal' | 'urgent' | 'emergency'
  notes?: string
}

export interface HandoffRecord {
  id: string
  tenantId: string
  fromUserId: string
  toUserId?: string | null
  handoffType: string
  matterId?: string | null
  workflowId?: string | null
  summary: string
  documents: string[]
  urgency: string
  notes?: string | null
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'expired'
  acceptedAt?: Date | null
  completedAt?: Date | null
  expiresAt: Date
  createdAt: Date
}

const DEFAULT_EXPIRY_HOURS = 72

@Injectable()
export class FeatureHandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async createHandoff(tenantId: string, dto: HandoffRequest): Promise<HandoffRecord> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRY_HOURS)

    const record = await this.prisma.handoffRecord.create({
      data: {
        tenantId,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId ?? null,
        handoffType: dto.handoffType,
        matterId: dto.matterId ?? null,
        workflowId: dto.workflowId ?? null,
        summary: dto.summary,
        documents: dto.documents,
        urgency: dto.urgency,
        notes: dto.notes ?? null,
        status: 'pending',
        expiresAt,
      },
    })

    return this.mapRecord(record)
  }

  async acceptHandoff(id: string, tenantId: string, userId: string): Promise<HandoffRecord> {
    const existing = await this.findOrThrow(id, tenantId)

    if (existing.toUserId && existing.toUserId !== userId) {
      throw new ForbiddenException('This handoff is directed to a different user')
    }
    if (existing.status !== 'pending') {
      throw new ForbiddenException(`Handoff is already ${existing.status}`)
    }
    if (existing.expiresAt < new Date()) {
      throw new ForbiddenException('Handoff has expired')
    }

    const record = await this.prisma.handoffRecord.update({
      where: { id },
      data: { status: 'accepted', acceptedAt: new Date(), toUserId: userId },
    })

    return this.mapRecord(record)
  }

  async declineHandoff(id: string, tenantId: string, userId: string, reason?: string): Promise<HandoffRecord> {
    const existing = await this.findOrThrow(id, tenantId)

    if (existing.toUserId && existing.toUserId !== userId) {
      throw new ForbiddenException('This handoff is directed to a different user')
    }
    if (existing.status !== 'pending') {
      throw new ForbiddenException(`Handoff is already ${existing.status}`)
    }

    const record = await this.prisma.handoffRecord.update({
      where: { id },
      data: { status: 'declined', declineReason: reason ?? null },
    })

    return this.mapRecord(record)
  }

  async completeHandoff(id: string, tenantId: string): Promise<HandoffRecord> {
    await this.findOrThrow(id, tenantId)

    const record = await this.prisma.handoffRecord.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    })

    return this.mapRecord(record)
  }

  async getHandoffsForUser(userId: string, tenantId: string, role: 'sender' | 'receiver'): Promise<HandoffRecord[]> {
    const where =
      role === 'sender'
        ? { tenantId, fromUserId: userId }
        : { tenantId, toUserId: userId }

    const records = await this.prisma.handoffRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return records.map((r) => this.mapRecord(r))
  }

  private async findOrThrow(id: string, tenantId: string) {
    const record = await this.prisma.handoffRecord.findFirst({ where: { id, tenantId } })
    if (!record) throw new NotFoundException(`Handoff ${id} not found`)
    return record
  }

  private mapRecord(r: {
    id: string
    tenantId: string
    fromUserId: string
    toUserId: string | null
    handoffType: string
    matterId: string | null
    workflowId: string | null
    summary: string
    documents: string[]
    urgency: string
    notes: string | null
    status: string
    acceptedAt: Date | null
    completedAt: Date | null
    expiresAt: Date
    createdAt: Date
  }): HandoffRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      handoffType: r.handoffType,
      matterId: r.matterId,
      workflowId: r.workflowId,
      summary: r.summary,
      documents: r.documents,
      urgency: r.urgency,
      notes: r.notes,
      status: r.status as HandoffRecord['status'],
      acceptedAt: r.acceptedAt,
      completedAt: r.completedAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }
  }
}
