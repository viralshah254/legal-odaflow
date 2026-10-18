import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { ConsumerToLawyerLead } from '@prisma/client'

export interface CreateLeadDto {
  matter?: string
  jurisdiction?: string
  urgency?: 'normal' | 'urgent' | 'emergency'
}

@Injectable()
export class ConsumerLawyerHandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(consumerId: string, dto: CreateLeadDto): Promise<ConsumerToLawyerLead> {
    return this.prisma.consumerToLawyerLead.create({
      data: {
        consumerId,
        matter: dto.matter ?? null,
        jurisdiction: dto.jurisdiction ?? null,
        urgency: dto.urgency ?? 'normal',
        leadSource: 'platform',
        status: 'pending',
      },
    })
  }

  async matchLawyer(
    leadId: string,
    lawyerId: string,
    tenantId?: string,
  ): Promise<ConsumerToLawyerLead> {
    const lead = await this.getLead(leadId)

    return this.prisma.consumerToLawyerLead.update({
      where: { id: leadId },
      data: {
        lawyerId,
        tenantId: tenantId ?? null,
        status: 'matched',
        matchedAt: new Date(),
      },
    })
  }

  async acceptLead(leadId: string, lawyerId: string): Promise<ConsumerToLawyerLead> {
    const lead = await this.getLead(leadId)

    if (lead.lawyerId !== lawyerId) {
      throw new NotFoundException('Lead not assigned to this lawyer')
    }

    return this.prisma.consumerToLawyerLead.update({
      where: { id: leadId },
      data: { status: 'accepted' },
    })
  }

  async convertLead(leadId: string, matterId: string): Promise<ConsumerToLawyerLead> {
    await this.getLead(leadId)

    return this.prisma.consumerToLawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'converted',
        convertedAt: new Date(),
        notes: `Converted to matter: ${matterId}`,
      },
    })
  }

  async getLeads(userId: string, role: 'consumer' | 'lawyer'): Promise<ConsumerToLawyerLead[]> {
    return this.prisma.consumerToLawyerLead.findMany({
      where: role === 'consumer' ? { consumerId: userId } : { lawyerId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  private async getLead(id: string): Promise<ConsumerToLawyerLead> {
    const lead = await this.prisma.consumerToLawyerLead.findFirst({ where: { id } })
    if (!lead) throw new NotFoundException('Lead not found')
    return lead
  }
}
