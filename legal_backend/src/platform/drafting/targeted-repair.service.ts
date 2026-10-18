import { Injectable, Logger, Optional } from '@nestjs/common';
import type { DraftSectionV3 } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import { VerificationService } from '@/platform/verification/verification.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { VerificationFinding, RepairPlan } from '@/platform/drafting/drafting.types';

const MAX_REPAIRS_PER_SECTION = 3;

@Injectable()
export class TargetedRepairService {
  private readonly logger = new Logger(TargetedRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  /**
   * Repair sections that have failed findings.
   *
   * Algorithm:
   *   1. Load workspace + sections + verification findings.
   *   2. Filter to sections that need repair (either by findingIds or all failed).
   *   3. For each section:
   *      a. Check canRepair — abort if max repairs exceeded.
   *      b. Snapshot the current version into DraftSectionVersion.
   *      c. [LLM placeholder] Regenerate section content with repair instructions.
   *      d. Save new content and bump version counter.
   *      e. Re-verify the section; update status.
   *   4. Return the updated section records.
   */
  async repair(
    workspaceId: string,
    tenantId: string,
    findingIds?: string[],
  ): Promise<DraftSectionV3[]> {
    const workspace = await this.prisma.draftWorkspaceV3.findFirst({
      where: { id: workspaceId, tenantId },
      include: { sections: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!workspace) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Workspace ${workspaceId} not found.`, 404);
    }

    // Identify which sections need repair
    let sectionsToRepair: DraftSectionV3[];

    if (findingIds && findingIds.length > 0) {
      // Repair only sections referenced by the given finding IDs
      const targetSectionIds = new Set(
        workspace.sections
          .filter((s) => {
            const findings = (s.verificationJson as VerificationFinding[] | null) ?? [];
            return findings.some((f) => findingIds.includes(f.id) && f.repairable && f.status === 'failed');
          })
          .map((s) => s.id),
      );
      sectionsToRepair = workspace.sections.filter((s) => targetSectionIds.has(s.id));
    } else {
      // Repair all sections in repair_needed or failed state
      sectionsToRepair = workspace.sections.filter(
        (s) => s.status === 'repair_needed' || s.status === 'generating',
      );
    }

    if (sectionsToRepair.length === 0) {
      this.logger.log(`No sections require repair in workspace ${workspaceId}`);
      return [];
    }

    const repairedSections: DraftSectionV3[] = [];

    for (const section of sectionsToRepair) {
      if (!this.canRepair(section)) {
        this.logger.warn(
          `Section ${section.id} has exceeded max repair attempts (${MAX_REPAIRS_PER_SECTION}). Skipping.`,
        );
        continue;
      }

      try {
        const repaired = await this.repairSection(section, workspace.id);
        repairedSections.push(repaired);
      } catch (err) {
        this.logger.error(`Failed to repair section ${section.id}: ${String(err)}`);
      }
    }

    // Update workspace status
    if (repairedSections.length > 0) {
      await this.prisma.draftWorkspaceV3.update({
        where: { id: workspaceId },
        data: { status: 'verifying', updatedAt: new Date() },
      });
    }

    return repairedSections;
  }

  canRepair(section: DraftSectionV3): boolean {
    const history = (section.repairHistoryJson as RepairAttempt[] | null) ?? [];
    return history.length < MAX_REPAIRS_PER_SECTION;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async repairSection(
    section: DraftSectionV3,
    workspaceId: string,
  ): Promise<DraftSectionV3> {
    this.logger.log(`Repairing section ${section.id} (${section.title})`);

    // 1. Snapshot current version
    await this.snapshotVersion(section);

    // 2. Build repair instructions from verification findings
    const findings = (section.verificationJson as VerificationFinding[] | null) ?? [];
    const repairInstructions = this.buildRepairInstructions(findings);

    // 3. Generate new content (LLM placeholder)
    //
    //    When the LLM integration is wired in, replace the call below with:
    //
    //    const newContent = await this.aiGateway.complete({
    //      model: 'gemini-2.0-flash',
    //      systemPrompt: REPAIR_SYSTEM_PROMPT,
    //      userPrompt: buildRepairPrompt(section, repairInstructions),
    //    });
    //
    const newContent = await this.generateRepairedContent(section, repairInstructions);

    const newVersion = (section.version ?? 1) + 1;

    // 4. Record the repair attempt in history
    const history = (section.repairHistoryJson as RepairAttempt[] | null) ?? [];
    const updatedHistory: RepairAttempt[] = [
      ...history,
      {
        attemptNumber: history.length + 1,
        repairedAt: new Date().toISOString(),
        findingCount: findings.filter((f) => f.status === 'failed').length,
        repairInstructions,
      },
    ];

    // 5. Re-verify the new content by running section verification inline
    const tempSection: DraftSectionV3 = {
      ...section,
      content: newContent,
      version: newVersion,
    };
    const newFindings = await this.verificationService.verifySections([tempSection]);
    const hasCritical = newFindings.some((f) => f.severity === 'critical' && f.status === 'failed');
    const hasMajor = newFindings.some((f) => f.severity === 'major' && f.status === 'failed');
    const newStatus: string = hasCritical || hasMajor ? 'repair_needed' : 'repaired';

    // 6. Persist
    const updated = await this.prisma.draftSectionV3.update({
      where: { id: section.id },
      data: {
        content: newContent,
        version: newVersion,
        status: newStatus,
        verificationJson: newFindings as unknown as object[],
        repairHistoryJson: updatedHistory as unknown as object[],
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Section ${section.id} repaired → status=${newStatus} version=${newVersion}`);
    return updated;
  }

  private async snapshotVersion(section: DraftSectionV3): Promise<void> {
    if (!section.content) return;

    await this.prisma.draftSectionVersion.create({
      data: {
        sectionId: section.id,
        version: section.version ?? 1,
        content: section.content,
        status: section.status ?? 'repair_needed',
        changedBy: 'ai_repair',
        metadata: { repairTriggeredAt: new Date().toISOString() },
      },
    });
  }

  private buildRepairInstructions(findings: VerificationFinding[]): string {
    const failedFindings = findings.filter((f) => f.status === 'failed' && f.repairable);
    if (failedFindings.length === 0) return 'Improve overall quality and clarity.';

    const lines = failedFindings.map(
      (f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.message}${f.suggestedAction ? ` → ${f.suggestedAction}` : ''}`,
    );

    return `Address the following issues:\n${lines.join('\n')}`;
  }

  private async generateRepairedContent(
    section: DraftSectionV3,
    repairInstructions: string,
  ): Promise<string> {
    const existingContent = section.content ?? `[${section.title} — content to be generated]`;

    if (!this.llm) {
      return existingContent;
    }

    const systemPrompt = `You are a senior Indian legal drafter. You are given a section of a legal document that has failed verification.
Your task is to rewrite the section to fix all identified issues while preserving accurate legal content.
Do not hallucinate citations. If you cannot verify a citation, use a descriptive placeholder like [cite authority].
Output ONLY the corrected section text, no meta-commentary.`;

    const userPrompt = `SECTION: ${section.title}

CURRENT CONTENT:
${existingContent}

ISSUES TO FIX:
${repairInstructions}

Rewrite the section addressing all issues above.`;

    try {
      const result = await this.llm.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 2000,
      });
      return result.content;
    } catch (err) {
      this.logger.warn(`LLM repair failed for section ${section.id}: ${String(err)}`);
      return existingContent;
    }
  }
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface RepairAttempt {
  attemptNumber: number;
  repairedAt: string;
  findingCount: number;
  repairInstructions: string;
}
