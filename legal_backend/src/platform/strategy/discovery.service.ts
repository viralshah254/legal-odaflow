import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { DiscoveryWorkspace } from '@prisma/client'

export interface CreateDiscoveryWorkspaceDto {
  workspaceType: 'document_review' | 'interrogatories' | 'depositions' | 'requests_for_admission' | 'inspection'
  deadline?: Date | string
  documentsToReview?: number
}

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(
    tenantId: string,
    matterId: string,
    dto: CreateDiscoveryWorkspaceDto,
  ): Promise<DiscoveryWorkspace> {
    return this.prisma.discoveryWorkspace.create({
      data: {
        tenantId,
        matterId,
        workspaceType: dto.workspaceType,
        status: 'open',
        documentsToReview: dto.documentsToReview ?? 0,
        documentsReviewed: 0,
        relevantDocs: [],
        privilegedDocs: [],
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    })
  }

  async reviewDocument(
    workspaceId: string,
    documentId: string,
    tenantId: string,
    relevance: 'relevant' | 'not_relevant' | 'privileged',
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId, tenantId)

    const relevantDocs = [...(workspace.relevantDocs ?? [])]
    const privilegedDocs = [...(workspace.privilegedDocs ?? [])]

    if (relevance === 'relevant' && !relevantDocs.includes(documentId)) {
      relevantDocs.push(documentId)
    } else if (relevance === 'privileged' && !privilegedDocs.includes(documentId)) {
      privilegedDocs.push(documentId)
    }

    const reviewed = workspace.documentsReviewed + 1
    const total = workspace.documentsToReview

    await this.prisma.discoveryWorkspace.update({
      where: { id: workspaceId },
      data: {
        relevantDocs,
        privilegedDocs,
        documentsReviewed: reviewed,
        status: total > 0 && reviewed >= total ? 'responded' : 'in_progress',
      },
    })
  }

  async generateResponses(workspaceId: string, tenantId: string): Promise<DiscoveryWorkspace> {
    const workspace = await this.getWorkspace(workspaceId, tenantId)

    const responses = {
      generatedAt: new Date().toISOString(),
      workspaceType: workspace.workspaceType,
      relevantDocCount: workspace.relevantDocs.length,
      privilegedDocCount: workspace.privilegedDocs.length,
      responseDrafts: workspace.relevantDocs.map((docId) => ({
        documentId: docId,
        response: 'Responsive document identified. Subject to applicable privileges.',
        status: 'draft',
      })),
      privilegeLog: workspace.privilegedDocs.map((docId) => ({
        documentId: docId,
        basis: 'Attorney-client privilege / work product doctrine',
      })),
    }

    return this.prisma.discoveryWorkspace.update({
      where: { id: workspaceId },
      data: { responsesJson: responses, status: 'responded', productionDate: new Date() },
    })
  }

  async getWorkspace(id: string, tenantId: string): Promise<DiscoveryWorkspace> {
    const ws = await this.prisma.discoveryWorkspace.findFirst({ where: { id, tenantId } })
    if (!ws) throw new NotFoundException('Discovery workspace not found')
    return ws
  }

  async listWorkspaces(matterId: string, tenantId: string): Promise<DiscoveryWorkspace[]> {
    return this.prisma.discoveryWorkspace.findMany({
      where: { matterId, tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
