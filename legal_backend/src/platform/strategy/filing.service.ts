import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { FilingRecord } from '@prisma/client'

export interface CreateFilingDto {
  filingType: 'court_filing' | 'regulatory' | 'electronic' | 'physical'
  court?: string
  caseNumber?: string
  documentIds?: string[]
  eSignatureIds?: string[]
  filingFeeAmount?: number
  filingFeeStatus?: 'unpaid' | 'paid' | 'waived'
  draftWorkspaceId?: string
}

@Injectable()
export class FilingService {
  constructor(private readonly prisma: PrismaService) {}

  async createFiling(tenantId: string, matterId: string, dto: CreateFilingDto): Promise<FilingRecord> {
    return this.prisma.filingRecord.create({
      data: {
        tenantId,
        matterId,
        filingType: dto.filingType,
        court: dto.court ?? null,
        caseNumber: dto.caseNumber ?? null,
        draftWorkspaceId: dto.draftWorkspaceId ?? null,
        documentIds: dto.documentIds ?? [],
        eSignatureIds: dto.eSignatureIds ?? [],
        filingFeeAmount: dto.filingFeeAmount ?? null,
        filingFeeStatus: dto.filingFeeStatus ?? null,
        filingStatus: 'preparing',
      },
    })
  }

  async checkReadiness(filingId: string, tenantId: string): Promise<{ ready: boolean; blockers: string[] }> {
    const filing = await this.getFiling(filingId, tenantId)

    const blockers: string[] = []

    if (!filing.documentIds || filing.documentIds.length === 0) {
      blockers.push('No documents attached to filing')
    }

    if (filing.filingFeeStatus === 'unpaid' && (filing.filingFeeAmount ?? 0) > 0) {
      blockers.push(`Filing fee of ${filing.filingFeeAmount} is unpaid`)
    }

    if (filing.filingType === 'electronic' && (!filing.eSignatureIds || filing.eSignatureIds.length === 0)) {
      blockers.push('Electronic filing requires at least one e-signature')
    }

    if (!filing.court && filing.filingType === 'court_filing') {
      blockers.push('Court name is required for court filings')
    }

    return { ready: blockers.length === 0, blockers }
  }

  async submitFiling(filingId: string, tenantId: string): Promise<FilingRecord> {
    await this.getFiling(filingId, tenantId)

    return this.prisma.filingRecord.update({
      where: { id: filingId },
      data: { filingStatus: 'submitted', filingDate: new Date() },
    })
  }

  async recordAcceptance(filingId: string, tenantId: string, receiptNumber: string): Promise<FilingRecord> {
    await this.getFiling(filingId, tenantId)

    return this.prisma.filingRecord.update({
      where: { id: filingId },
      data: { filingStatus: 'accepted', receiptNumber, acceptedAt: new Date() },
    })
  }

  async recordRejection(filingId: string, tenantId: string, reason: string): Promise<FilingRecord> {
    await this.getFiling(filingId, tenantId)

    return this.prisma.filingRecord.update({
      where: { id: filingId },
      data: { filingStatus: 'rejected', rejectedReason: reason },
    })
  }

  async listFilings(matterId: string, tenantId: string): Promise<FilingRecord[]> {
    return this.prisma.filingRecord.findMany({
      where: { matterId, tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  private async getFiling(id: string, tenantId: string): Promise<FilingRecord> {
    const filing = await this.prisma.filingRecord.findFirst({ where: { id, tenantId } })
    if (!filing) throw new NotFoundException('Filing record not found')
    return filing
  }
}
