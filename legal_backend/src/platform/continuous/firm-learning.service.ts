import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

export interface RecordApprovedEditDto {
  workspaceType: string
  originalText: string
  editedText: string
  context: Record<string, unknown>
  editedBy: string
}

@Injectable()
export class FirmLearningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an approved attorney edit as a firm-scoped LegalMemoryRecord.
   * Stored as unapproved until syncToMemory is called.
   */
  async recordApprovedEdit(tenantId: string, dto: RecordApprovedEditDto): Promise<void> {
    await this.prisma.legalMemoryRecord.create({
      data: {
        tenantId,
        scope: 'firm',
        recordType: 'document_pattern',
        title: `Edit pattern: ${dto.workspaceType}`,
        content: JSON.stringify({
          workspaceType: dto.workspaceType,
          original: dto.originalText.slice(0, 500),
          edited: dto.editedText.slice(0, 500),
          diff: computeSimpleDiff(dto.originalText, dto.editedText),
          context: dto.context,
        }),
        tags: [dto.workspaceType, 'firm_edit'],
        approved: false,
        approvedBy: null,
        sourceRef: `editor:${dto.editedBy}`,
        confidence: 0.6,
      },
    })
  }

  /**
   * Analyzes recent unapproved edits for a tenant and extracts common patterns as insights.
   */
  async generateInsight(tenantId: string, sampleSize = 50): Promise<string[]> {
    const records = await this.prisma.legalMemoryRecord.findMany({
      where: {
        tenantId,
        scope: 'firm',
        recordType: 'document_pattern',
        approved: false,
      },
      orderBy: { createdAt: 'desc' },
      take: sampleSize,
    })

    if (records.length === 0) return []

    // Group edits by workspaceType and surface frequency-based insights
    const typeMap = new Map<string, number>()
    for (const r of records) {
      try {
        const content = JSON.parse(r.content) as { workspaceType?: string }
        const wt = content.workspaceType ?? 'unknown'
        typeMap.set(wt, (typeMap.get(wt) ?? 0) + 1)
      } catch {
        // skip malformed records
      }
    }

    const insights: string[] = []

    for (const [type, count] of typeMap.entries()) {
      if (count >= 3) {
        insights.push(`Frequent edits detected in "${type}" workspaces (${count} instances) — consider updating standard template`)
      }
    }

    if (records.length >= 10) {
      insights.push(`${records.length} pending edit patterns ready for review and approval`)
    }

    return insights
  }

  /**
   * Approves all pending firm-scoped memory records and promotes them to active memory.
   * Returns the count of approved records.
   */
  async syncToMemory(tenantId: string): Promise<number> {
    const pending = await this.prisma.legalMemoryRecord.findMany({
      where: {
        tenantId,
        scope: 'firm',
        recordType: 'document_pattern',
        approved: false,
      },
      select: { id: true },
    })

    if (pending.length === 0) return 0

    const ids = pending.map((r) => r.id)
    const now = new Date()

    await this.prisma.legalMemoryRecord.updateMany({
      where: { id: { in: ids } },
      data: { approved: true, approvedAt: now },
    })

    return ids.length
  }
}

/** Simple word-level diff summary for storage */
function computeSimpleDiff(original: string, edited: string): string {
  const origWords = original.split(/\s+/).length
  const editWords = edited.split(/\s+/).length
  const delta = editWords - origWords
  const direction = delta > 0 ? `+${delta}` : `${delta}`
  return `${direction} words (${origWords} → ${editWords})`
}
