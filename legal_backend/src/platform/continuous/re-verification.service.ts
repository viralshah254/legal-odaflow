import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { VerificationService } from '@/platform/verification/verification.service'
import type { DraftSectionV3 } from '@prisma/client'

@Injectable()
export class ReVerificationService {
  private readonly logger = new Logger(ReVerificationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  /**
   * Schedules a re-verification check by storing an OutboxEvent for the given workspace.
   */
  async scheduleReVerification(workspaceId: string, tenantId: string, checkDate: Date): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        aggregateId: workspaceId,
        aggregateType: 'VerificationWorkspace',
        eventType: 're_verification_scheduled',
        payload: { workspaceId, checkDate: checkDate.toISOString() } as any,
        published: false,
      },
    })
  }

  /**
   * Runs re-verification for a workspace by finding the most recent verification job,
   * re-running VerificationService on all sections, and diffing old vs new findings.
   */
  async runReVerification(
    workspaceId: string,
    tenantId: string,
  ): Promise<{ changedPropositions: string[]; newFailures: string[] }> {
    this.logger.log(`Running re-verification for workspace ${workspaceId}`)

    // Load workspace with sections
    const workspace = await this.prisma.draftWorkspaceV3.findFirst({
      where: { id: workspaceId, tenantId },
      include: { sections: true },
    })

    if (!workspace || !workspace.sections.length) {
      return { changedPropositions: [], newFailures: [] }
    }

    // Get prior verification job for comparison
    const priorJob = await this.prisma.verificationJobV3.findFirst({
      where: { tenantId, artifactId: workspaceId },
      orderBy: { createdAt: 'desc' },
    })

    const priorFindings = ((priorJob?.findings as unknown[]) ?? []) as Array<Record<string, unknown>>

    // Re-run verification using the same VerificationService
    let newFindings: Array<Record<string, unknown>> = []
    try {
      const newJob = await this.verificationService.verifyDraftWorkspace(workspaceId, tenantId)
      newFindings = ((newJob.findings as unknown[]) ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      this.logger.error(`Re-verification failed for workspace ${workspaceId}: ${String(err)}`)
      return { changedPropositions: [], newFailures: [] }
    }

    // Diff old vs new findings
    const priorFindingMap = new Map<string, string>(
      priorFindings.map((f) => [f['id'] as string, f['status'] as string]),
    )

    const changedPropositions: string[] = []
    const newFailures: string[] = []

    for (const finding of newFindings) {
      const id = finding['id'] as string
      const newStatus = finding['status'] as string
      const oldStatus = priorFindingMap.get(id)

      if (oldStatus && oldStatus !== newStatus) {
        changedPropositions.push(id)
        if (oldStatus === 'passed' && newStatus === 'failed') {
          newFailures.push(id)
        }
      } else if (!oldStatus && newStatus === 'failed') {
        // New failure that didn't exist before
        newFailures.push(id)
        changedPropositions.push(id)
      }
    }

    // Record firm-learning event if findings changed
    if (changedPropositions.length > 0) {
      await this.prisma.outboxEvent.create({
        data: {
          tenantId,
          aggregateId: workspaceId,
          aggregateType: 'VerificationWorkspace',
          eventType: 're_verification_completed',
          payload: { workspaceId, changedPropositions, newFailures } as any,
          published: false,
        },
      })

      this.logger.log(
        `Re-verification completed: ${changedPropositions.length} changed, ${newFailures.length} new failures`,
      )
    }

    return { changedPropositions, newFailures }
  }

  /**
   * Finds all workspaces that cited authorities affected by a specific legal update.
   * Uses KG citation-to-workspace index built from VerificationJobV3 findings.
   */
  async getAffectedWorkspaces(updateId: string, tenantId?: string): Promise<string[]> {
    const update = await this.prisma.legalUpdateRecord.findFirst({
      where: { id: updateId, ...(tenantId ? { tenantId } : {}) },
    })

    if (!update) return []

    const affectedPropIds = (update.affectedPropositionIds as string[]) ?? []
    if (affectedPropIds.length === 0) return []

    // Query KG for citation edges to find affected workspaces
    const citationEdges = await this.prisma.knowledgeGraphEdge
      .findMany({
        where: {
          edgeType: 'cites',
          targetId: { in: affectedPropIds },
        },
        select: { sourceId: true, metadata: true },
      })
      .catch(() => [])

    const workspaceIdsFromKg = new Set<string>(
      citationEdges
        .map((e) => (e.metadata as Record<string, unknown>)?.['workspaceId'] as string)
        .filter(Boolean),
    )

    // Fallback: scan verification jobs for workspaces citing affected authorities
    const jobs = await this.prisma.verificationJobV3.findMany({
      where: { ...(tenantId ? { tenantId } : {}), status: 'completed' },
      select: { artifactId: true, findings: true },
    })

    for (const job of jobs) {
      const findings = (job.findings as unknown[]) ?? []
      const cited = (findings as Array<Record<string, unknown>>).some((f) => {
        const findingId = (f['id'] as string) ?? ''
        const citation = (f['citation'] as string) ?? ''
        const sourceRefs = (f['sourceRefs'] as string[]) ?? []
        return affectedPropIds.some(
          (p) =>
            findingId.includes(p) ||
            citation.includes(p) ||
            sourceRefs.some((r) => r.includes(p)),
        )
      })
      if (cited) workspaceIdsFromKg.add(job.artifactId)
    }

    return [...workspaceIdsFromKg]
  }

  /**
   * Processes all pending re-verification outbox events.
   * Called by the cron scheduler.
   */
  async processScheduledReVerifications(tenantId?: string): Promise<number> {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: {
        eventType: 're_verification_scheduled',
        published: false,
        ...(tenantId ? { tenantId } : {}),
        payload: {
          path: ['checkDate'],
          lte: new Date().toISOString(),
        },
      },
      take: 20,
    })

    let processed = 0

    for (const event of pendingEvents) {
      const payload = event.payload as { workspaceId: string }
      try {
        await this.runReVerification(payload.workspaceId, event.tenantId)
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { published: true },
        })
        processed++
      } catch (err) {
        this.logger.error(`Failed to process re-verification event ${event.id}: ${String(err)}`)
      }
    }

    return processed
  }
}
