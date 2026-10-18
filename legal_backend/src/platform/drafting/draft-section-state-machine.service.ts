import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QualityFeedbackService } from '@/ai/feedback/quality-feedback.service';
import type { DraftSectionV3, DraftSectionVersion } from '@prisma/client';

/**
 * Valid states for a DraftSectionV3.
 *
 *   pending → generating → generated → repaired → edited → approved
 *                                                        ↗
 *                                            failed_verification
 *
 * Any non-approved section can transition to `failed_verification`,
 * and from there to `repaired` after targeted repair.
 */
export type SectionState =
  | 'pending'
  | 'generating'
  | 'generated'
  | 'failed_verification'
  | 'repaired'
  | 'edited'
  | 'approved';

const VALID_TRANSITIONS: Record<SectionState, SectionState[]> = {
  pending: ['generating'],
  generating: ['generated', 'pending'],
  generated: ['failed_verification', 'approved', 'editing'],
  failed_verification: ['repaired', 'pending'],
  repaired: ['failed_verification', 'edited', 'approved'],
  edited: ['failed_verification', 'approved'],
  approved: [],
} as any;

export interface TransitionResult {
  sectionId: string;
  previousStatus: string;
  currentStatus: SectionState;
  version: number;
}

@Injectable()
export class DraftSectionStateMachineService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly qualityFeedback: QualityFeedbackService | null,
  ) {}

  /**
   * Transitions a section to a new state. Creates a new DraftSectionVersion snapshot.
   */
  async transition(
    sectionId: string,
    tenantId: string,
    newState: SectionState,
    options?: {
      content?: string;
      changedBy?: string;
      reason?: string;
    },
  ): Promise<TransitionResult> {
    const section = await this.prisma.draftSectionV3.findFirst({
      where: { id: sectionId },
      include: { workspace: true },
    });

    if (!section) throw new NotFoundException(`Section ${sectionId} not found`);
    if ((section.workspace as any)?.tenantId !== tenantId) {
      throw new BadRequestException('Access denied');
    }

    const currentState = section.status as SectionState;
    const allowed = (VALID_TRANSITIONS[currentState] ?? []) as SectionState[];

    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition section from "${currentState}" to "${newState}". ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    const newContent = options?.content ?? section.content ?? '';
    const nextVersion = (section.version ?? 1) + (options?.content ? 1 : 0);

    // Snapshot if content changed
    if (options?.content && options.content !== section.content) {
      await this.prisma.draftSectionVersion.create({
        data: {
          sectionId,
          version: nextVersion,
          content: newContent,
          status: newState,
          changedBy: options.changedBy ?? 'system',
          metadata: {
            previousStatus: currentState,
            reason: options.reason ?? `Transitioned to ${newState}`,
            changedAt: new Date().toISOString(),
          },
        },
      });
    }

    await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: {
        status: newState,
        ...(options?.content ? { content: newContent, version: nextVersion } : {}),
      },
    });

    return {
      sectionId,
      previousStatus: currentState,
      currentStatus: newState,
      version: nextVersion,
    };
  }

  /**
   * Record a user edit to a section — transitions to "edited" and snapshots.
   */
  async recordUserEdit(
    sectionId: string,
    tenantId: string,
    newContent: string,
    editedBy: string,
  ): Promise<TransitionResult> {
    const section = await this.prisma.draftSectionV3.findFirst({
      where: { id: sectionId },
      include: { workspace: true },
    });

    if (!section) throw new NotFoundException(`Section ${sectionId} not found`);
    if ((section.workspace as any)?.tenantId !== tenantId) {
      throw new BadRequestException('Access denied');
    }

    const nextVersion = (section.version ?? 1) + 1;

    await this.prisma.draftSectionVersion.create({
      data: {
        sectionId,
        version: nextVersion,
        content: newContent,
        status: 'edited',
        changedBy: editedBy,
        metadata: {
          previousContent: section.content?.slice(0, 200),
          editedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: { content: newContent, status: 'edited', version: nextVersion },
    });

    // Record feedback for quality loop
    if (this.qualityFeedback && section.content && section.modelUsed) {
      const workspace = section.workspace as unknown as {
        tenantId: string;
        jurisdiction?: string;
        documentKind?: string;
      };
      await this.qualityFeedback.recordFeedback({
        tenantId: workspace.tenantId,
        userId: editedBy,
        feature: 'drafting',
        taskType: section.sectionType,
        modelUsed: section.modelUsed,
        jurisdiction: workspace.jurisdiction,
        originalContent: section.content,
        editedContent: newContent,
        editType: 'minor_edit',
        documentKind: workspace.documentKind ?? 'platform_v3',
        draftSectionV3Id: sectionId,
      }).catch(() => {});
    }

    return {
      sectionId,
      previousStatus: section.status,
      currentStatus: 'edited',
      version: nextVersion,
    };
  }

  /**
   * Approve a section (final state). Validates content is non-empty.
   */
  async approve(
    sectionId: string,
    tenantId: string,
    approvedBy: string,
  ): Promise<TransitionResult> {
    const section = await this.prisma.draftSectionV3.findFirst({
      where: { id: sectionId },
      include: { workspace: true },
    });

    if (!section) throw new NotFoundException(`Section ${sectionId} not found`);
    if ((section.workspace as any)?.tenantId !== tenantId) throw new BadRequestException('Access denied');
    if (!section.content || section.content.trim().length < 10) {
      throw new BadRequestException('Cannot approve a section with no content');
    }
    if (section.status === 'approved') return {
      sectionId,
      previousStatus: 'approved',
      currentStatus: 'approved',
      version: section.version ?? 1,
    };

    await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: { status: 'approved' },
    });

    return {
      sectionId,
      previousStatus: section.status,
      currentStatus: 'approved',
      version: section.version ?? 1,
    };
  }

  /**
   * Get the full version history of a section.
   */
  async getVersionHistory(sectionId: string): Promise<DraftSectionVersion[]> {
    return this.prisma.draftSectionVersion.findMany({
      where: { sectionId },
      orderBy: { version: 'asc' },
    });
  }

  /**
   * Restore a section to a previous version snapshot.
   */
  async restoreVersion(
    sectionId: string,
    tenantId: string,
    targetVersion: number,
    restoredBy: string,
  ): Promise<TransitionResult> {
    const section = await this.prisma.draftSectionV3.findFirst({
      where: { id: sectionId },
      include: { workspace: true },
    });

    if (!section) throw new NotFoundException(`Section ${sectionId} not found`);
    if ((section.workspace as any)?.tenantId !== tenantId) throw new BadRequestException('Access denied');

    const versionRecord = await this.prisma.draftSectionVersion.findFirst({
      where: { sectionId, version: targetVersion },
    });

    if (!versionRecord) {
      throw new NotFoundException(`Version ${targetVersion} not found for section ${sectionId}`);
    }

    const nextVersion = (section.version ?? 1) + 1;

    await this.prisma.draftSectionVersion.create({
      data: {
        sectionId,
        version: nextVersion,
        content: versionRecord.content,
        status: 'edited',
        changedBy: restoredBy,
        metadata: { restoredFromVersion: targetVersion, restoredAt: new Date().toISOString() },
      },
    });

    await this.prisma.draftSectionV3.update({
      where: { id: sectionId },
      data: { content: versionRecord.content, status: 'edited', version: nextVersion },
    });

    return {
      sectionId,
      previousStatus: section.status,
      currentStatus: 'edited',
      version: nextVersion,
    };
  }
}
