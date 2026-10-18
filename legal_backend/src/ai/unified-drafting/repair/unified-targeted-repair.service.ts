import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DraftModelRouterService } from '../draft-model-router.service';
import { DraftJobService } from '../draft-job.service';
import { PrismaService } from '@/prisma/prisma.service';
import { DRAFT_MODEL_ALIASES } from '../contracts/model-aliases';
import type { QualityTier } from '../contracts/model-aliases';
import type { DraftIssue } from '../contracts/draft-issue';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';
import { toSourcePromptEntry } from '../contracts/verified-source';

const MAX_REPAIRS_PER_SECTION = 3;

export interface RepairAllInput {
  jobId: string;
  issues: DraftIssue[];
  sections: Array<{ id: string; sectionKey: string; sectionType: string; content: string; status: string; repairCount: number }>;
  sourceRegistry: VerifiedSourceRegistry;
  matter: NormalizedMatter;
  qualityTier: QualityTier;
}

/**
 * Unified Targeted Repair Service
 *
 * Repair hierarchy:
 *   Attempt 1: same-tier model, focused on affected paragraph/section
 *   Attempt 2: stronger model
 *   Attempt 3: mark for human review — do not loop indefinitely
 *
 * Never overwrites user_modified sections automatically.
 * Sends only the defective section, not the whole document.
 */
@Injectable()
export class UnifiedTargetedRepairService {
  private readonly logger = new Logger(UnifiedTargetedRepairService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly modelRouter: DraftModelRouterService,
    private readonly jobService: DraftJobService,
    private readonly prisma: PrismaService,
  ) {}

  async repairAll(input: RepairAllInput): Promise<void> {
    // Group issues by section
    const issuesBySectionKey = new Map<string, DraftIssue[]>();
    for (const issue of input.issues) {
      if (!issue.sectionId) continue;
      const existing = issuesBySectionKey.get(issue.sectionId) ?? [];
      existing.push(issue);
      issuesBySectionKey.set(issue.sectionId, existing);
    }

    for (const [sectionKey, sectionIssues] of issuesBySectionKey) {
      const section = input.sections.find((s) => s.sectionKey === sectionKey);
      if (!section) continue;

      // Never overwrite user-modified sections automatically
      if (section.status === 'user_modified') {
        this.logger.log(`Skipping repair for user_modified section ${sectionKey}`);
        continue;
      }

      if (section.repairCount >= MAX_REPAIRS_PER_SECTION) {
        this.logger.warn(`Section ${sectionKey} has reached max repairs (${MAX_REPAIRS_PER_SECTION}) — marking for human review`);
        await (this.prisma as any).draftJobSection.update({
          where: { id: section.id },
          data: { status: 'repair_needed' },
        }).catch(() => {});
        continue;
      }

      await this.repairSection({
        jobId: input.jobId,
        section,
        issues: sectionIssues,
        sourceRegistry: input.sourceRegistry,
        matter: input.matter,
        qualityTier: input.qualityTier,
        attemptNumber: section.repairCount + 1,
      });
    }
  }

  private async repairSection(opts: {
    jobId: string;
    section: RepairAllInput['sections'][number];
    issues: DraftIssue[];
    sourceRegistry: VerifiedSourceRegistry;
    matter: NormalizedMatter;
    qualityTier: QualityTier;
    attemptNumber: number;
  }): Promise<void> {
    const { jobId, section, issues, sourceRegistry, matter, qualityTier, attemptNumber } = opts;

    const isSubstantive = issues.some((i) =>
      ['citation', 'statute', 'unsupported_proposition', 'fact', 'logic'].includes(i.category),
    );

    const model = this.modelRouter.resolveRepairModel(isSubstantive, attemptNumber, qualityTier);

    const allowedSources = sourceRegistry.sources
      .filter((s) => s.verificationStatus !== 'rejected')
      .slice(0, 8)
      .map(toSourcePromptEntry);

    const issueDescriptions = issues
      .map((i) => `[${i.severity.toUpperCase()}] ${i.message}${i.suggestedCorrection ? ` — Fix: ${i.suggestedCorrection}` : ''}`)
      .join('\n');

    const systemPrompt = `You are an expert legal drafter performing a targeted repair.
You will receive a section that has specific defects. Repair ONLY the defective parts.

Rules:
- Do NOT rewrite the entire section unless the structure is fundamentally broken.
- Do NOT add new facts that are not in the FACTS block.
- Do NOT add sources that are not in the ALLOWED SOURCES block.
- Preserve all correctly drafted content.
- Output ONLY the repaired section text — no preamble or commentary.`;

    const userPrompt = [
      `SECTION TYPE: ${section.sectionType}`,
      ``,
      `CURRENT SECTION TEXT:`,
      section.content,
      ``,
      `DEFECTS TO FIX:`,
      issueDescriptions,
      ``,
      allowedSources.length > 0
        ? `ALLOWED SOURCES (only cite these):\n${allowedSources.map((s) => `[${s.id}] ${s.title}${s.citation ? ` — ${s.citation}` : ''}`).join('\n')}`
        : 'No pre-verified sources available — use [BLANK: cite authority] for any citation.',
      ``,
      `RELEVANT FACTS:\n${matter.facts.slice(0, 8).map((f) => `[${f.id}] (${f.status}) ${f.statement}`).join('\n')}`,
    ].join('\n');

    const t0 = Date.now();
    let repairedContent: string;

    try {
      const result = await this.llm.complete({
        modelName: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        // No maxTokens — repaired section must be at least as long as the original.
      });
      repairedContent = result.content;
      const durationMs = Date.now() - t0;
      const costUsd = result.inputTokens * 0.000001 + result.outputTokens * 0.000004;

      // Persist repair record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = this.prisma as any;
      await db.draftJobRepair.create({
        data: {
          jobId,
          sectionId: section.id,
          attemptNumber,
          outputConstraint: 'section',
          beforeText: section.content,
          afterText: repairedContent,
          model,
          issueIds: issues.map((i) => i.id).filter(Boolean),
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd,
          success: true,
        },
      });

      // Update section content and increment repair count
      await db.draftJobSection.update({
        where: { id: section.id },
        data: {
          content: repairedContent,
          status: 'repaired',
          version: { increment: 1 },
          repairCount: { increment: 1 },
        },
      });

      await this.jobService.recordModelUsage(
        jobId, 'repairing', model,
        result.inputTokens, result.outputTokens, costUsd,
        section.sectionKey, durationMs,
      );

      // Mark addressed issues as resolved
      await db.draftJobIssue.updateMany({
        where: { jobId, sectionId: section.sectionKey, repairableAutomatically: true },
        data: { resolved: true },
      });

      this.logger.log(`Repaired section ${section.sectionKey} with ${model} (attempt ${attemptNumber})`);
    } catch (err) {
      this.logger.error(`Repair failed for section ${section.sectionKey}: ${String(err)}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = this.prisma as any;
      await db.draftJobRepair.create({
        data: {
          jobId,
          sectionId: section.id,
          attemptNumber,
          outputConstraint: 'section',
          beforeText: section.content,
          model,
          issueIds: [],
          success: false,
          failureReason: String(err),
        },
      });

      if (attemptNumber >= MAX_REPAIRS_PER_SECTION) {
        await db.draftJobSection.update({
          where: { id: section.id },
          data: { status: 'repair_needed' },
        }).catch(() => {});
      }
    }
  }
}
