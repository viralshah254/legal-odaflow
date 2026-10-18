import { Injectable, Logger } from '@nestjs/common';
import { DraftJobService } from '../draft-job.service';
import { isUnifiedDraftEngineEnabled } from '../unified-draft-routing.policy';

/**
 * Workspace V3 Adapter
 *
 * Allows the v3 matter workspace to route through the unified engine
 * instead of its own sequential section generation.
 *
 * Enabled when UNIFIED_DRAFT_ENGINE_ENABLED=true and the workspace
 * requests full auto-generation.
 */
@Injectable()
export class WorkspaceV3Adapter {
  private readonly logger = new Logger(WorkspaceV3Adapter.name);

  constructor(private readonly draftJobService: DraftJobService) {}

  isEnabled(tenantId: string, userId: string): boolean {
    return isUnifiedDraftEngineEnabled(tenantId, userId);
  }

  async createJobFromWorkspace(opts: {
    tenantId: string;
    userId: string;
    workspaceId: string;
    documentType: string;
    jurisdiction: string;
    objective: string;
    courtName?: string;
    planJson?: Record<string, unknown>;
  }) {
    const facts = this.extractFactsFromPlan(opts.planJson, opts.objective);

    const job = await this.draftJobService.create({
      tenantId: opts.tenantId,
      userId: opts.userId,
      profile: 'matter_workspace',
      documentKind: opts.documentType,
      qualityTier: 'standard',
      facts,
      jurisdiction: opts.jurisdiction,
      courtName: opts.courtName,
      workspaceV3Id: opts.workspaceId,
      idempotencyKey: `workspace:${opts.workspaceId}:auto`,
    });

    this.logger.log(`Workspace ${opts.workspaceId} routed to unified engine — job ${job.jobId}`);
    return job;
  }

  private extractFactsFromPlan(planJson: Record<string, unknown> | undefined, objective: string): string {
    if (!planJson) return objective;
    const facts = (planJson['matterFacts'] as Array<{ text: string }> | undefined) ?? [];
    const issues = (planJson['matterIssues'] as Array<{ issueText: string }> | undefined) ?? [];
    const parts = [
      `Objective: ${objective}`,
      facts.length > 0 ? `Facts:\n${facts.map((f) => `- ${f.text}`).join('\n')}` : '',
      issues.length > 0 ? `Issues:\n${issues.map((i) => `- ${i.issueText}`).join('\n')}` : '',
    ].filter(Boolean);
    return parts.join('\n\n');
  }
}
