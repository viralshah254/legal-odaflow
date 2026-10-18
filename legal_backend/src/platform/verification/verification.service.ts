import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DraftWorkspaceV3, DraftSectionV3, VerificationJobV3 } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';
import type {
  VerificationFinding,
  FilingBlocker,
  FilingReadinessReport,
  RepairItem,
  RepairPlan,
} from '@/platform/drafting/drafting.types';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  async verifyDraftWorkspace(workspaceId: string, tenantId: string): Promise<VerificationJobV3> {
    const workspace = await this.prisma.draftWorkspaceV3.findFirst({
      where: { id: workspaceId, tenantId },
      include: { sections: true },
    });

    if (!workspace) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Workspace ${workspaceId} not found.`, 404);
    }

    // Create a pending verification job
    const job = await this.prisma.verificationJobV3.create({
      data: {
        tenantId,
        artifactType: 'draft_workspace',
        artifactId: workspaceId,
        status: 'running',
        dimensions: ['structural', 'formatting', 'logical', 'factual'],
      },
    });

    try {
      const findings = await this.verifySections(workspace.sections as DraftSectionV3[]);
      const overallScore = this.computeOverallScore(findings);

      const completedJob = await this.prisma.verificationJobV3.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          findings: findings as unknown as object[],
          overallScore,
          completedAt: new Date(),
        },
      });

      // Update workspace sections with individual verification results
      await this.updateSectionVerificationStatus(workspace.sections as DraftSectionV3[], findings);

      this.logger.log(`Verification complete for workspace ${workspaceId}. Score: ${overallScore}`);
      return completedJob;
    } catch (err) {
      await this.prisma.verificationJobV3.update({
        where: { id: job.id },
        data: { status: 'failed', updatedAt: new Date() },
      });
      throw err;
    }
  }

  async verifySections(sections: DraftSectionV3[]): Promise<VerificationFinding[]> {
    const findings: VerificationFinding[] = [];

    for (const section of sections) {
      const sectionType = (section as { sectionType?: string }).sectionType;
      if (!section.content) {
        // Missing required content
        if (section.required) {
          findings.push({
            id: randomUUID(),
            checkId: `structural:missing:${sectionType ?? section.id}`,
            sectionType,
            dimension: 'structural',
            severity: 'critical',
            status: 'failed',
            message: `Required section "${section.title}" has no content.`,
            sectionId: section.id,
            repairable: true,
            suggestedAction: 'Generate content for this section.',
          });
        }
        continue;
      }

      findings.push(...this.tagSectionType(this.checkStructural(section), sectionType));
      findings.push(...this.tagSectionType(this.checkFormatting(section), sectionType));
      findings.push(...this.tagSectionType(this.checkLogical(section), sectionType));
      findings.push(...this.tagSectionType(this.checkFactual(section), sectionType));
    }

    return findings;
  }

  private tagSectionType(
    findings: VerificationFinding[],
    sectionType?: string,
  ): VerificationFinding[] {
    if (!sectionType) return findings;
    return findings.map((f) => ({ ...f, sectionType }));
  }

  calculateFilingReadiness(
    workspace: DraftWorkspaceV3,
    findings: VerificationFinding[],
  ): FilingReadinessReport {
    const criticalFindings = findings.filter((f) => f.severity === 'critical' && f.status === 'failed');
    const majorFindings = findings.filter((f) => f.severity === 'major' && f.status === 'failed');
    const minorFindings = findings.filter((f) => f.severity === 'minor' && f.status !== 'passed');

    const blockers: FilingBlocker[] = [];

    // Map critical findings to filing blockers
    for (const finding of criticalFindings) {
      blockers.push({
        component: this.mapFindingToComponent(finding),
        severity: 'error',
        message: finding.message,
        repairAction: finding.suggestedAction,
      });
    }

    for (const finding of majorFindings) {
      blockers.push({
        component: this.mapFindingToComponent(finding),
        severity: 'warning',
        message: finding.message,
        repairAction: finding.suggestedAction,
      });
    }

    const mandatoryComponents = [
      'cause_title',
      'parties',
      'facts',
      'legal_grounds',
      'prayer',
      'verification',
      'formatting',
      'citations',
    ] as const;

    const componentScores: Record<string, number> = Object.fromEntries(
      mandatoryComponents.map((c) => [c, 0]),
    );

    const completed = findings.filter((f) => f.status === 'passed' || f.status === 'failed');
    if (completed.length === 0) {
      blockers.push({
        component: 'verification',
        severity: 'error',
        message: 'Mandatory verification checks have not been run',
      });
    }

    for (const f of completed) {
      const comp = this.mapFindingToComponent(f);
      if (componentScores[comp] === undefined) continue;
      if (f.status === 'passed') {
        componentScores[comp] = 100;
      } else {
        const penalty = f.severity === 'critical' ? 100 : f.severity === 'major' ? 60 : 20;
        componentScores[comp] = Math.max(0, 100 - penalty);
      }
    }

    const overallScore =
      Object.values(componentScores).reduce((a, b) => a + b, 0) /
      mandatoryComponents.length;

    const allMandatoryPassed = mandatoryComponents.every((c) => componentScores[c] === 100);

    return {
      overallScore: Math.round(overallScore),
      blockers,
      componentScores,
      readyForFiling:
        completed.length > 0 &&
        criticalFindings.length === 0 &&
        allMandatoryPassed &&
        majorFindings.length === 0,
    };
  }

  createRepairPlan(workspaceId: string, findings: VerificationFinding[]): RepairPlan {
    const repairableFindings = findings.filter((f) => f.repairable && f.status === 'failed');

    const items: RepairItem[] = repairableFindings
      .filter((f) => f.sectionId)
      .map((f, idx) => ({
        findingId: f.id,
        sectionId: f.sectionId!,
        action: f.suggestedAction ?? 'Regenerate section content.',
        priority: f.severity === 'critical' ? 1 : f.severity === 'major' ? 2 : 3,
      }))
      .sort((a, b) => a.priority - b.priority);

    const uniqueSections = new Set(items.map((i) => i.sectionId));

    return {
      workspaceId,
      items,
      estimatedSections: uniqueSections.size,
      createdAt: new Date().toISOString(),
    };
  }

  // ─── Structural checks ────────────────────────────────────────────────────

  private checkStructural(section: DraftSectionV3): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const content = section.content ?? '';

    // Unreplaced placeholder check
    const placeholders = content.match(/\[([A-Z_]+)\]/g);
    if (placeholders && placeholders.length > 0) {
      findings.push({
        id: randomUUID(),
        dimension: 'structural',
        severity: 'major',
        status: 'failed',
        message: `Section "${section.title}" contains ${placeholders.length} unreplaced placeholder(s): ${placeholders.slice(0, 5).join(', ')}.`,
        sectionId: section.id,
        repairable: true,
        suggestedAction: 'Replace all placeholder values with actual content.',
      });
    }

    // Heading section must not be empty
    if (section.sectionType === 'heading' && content.trim().length < 20) {
      findings.push({
        id: randomUUID(),
        dimension: 'structural',
        severity: 'critical',
        status: 'failed',
        message: `Heading / cause title is too short or missing.`,
        sectionId: section.id,
        repairable: true,
        suggestedAction: 'Regenerate the cause title section.',
      });
    }

    // Verification section must include the word "verified" / "affirm"
    if (section.sectionType === 'verification') {
      const hasVerificationLanguage = /verif(y|ied|ication)|affirm|depose|sworn/i.test(content);
      if (!hasVerificationLanguage) {
        findings.push({
          id: randomUUID(),
          dimension: 'structural',
          severity: 'critical',
          status: 'failed',
          message: `Verification section is missing required verification language.`,
          sectionId: section.id,
          repairable: true,
          suggestedAction: 'Add standard verification / oath paragraph.',
        });
      }
    }

    // Prayer section must include specific relief
    if (section.sectionType === 'prayer') {
      const hasPrayerLanguage =
        /pray|prayed|relief|direct(ion)?|order|decree|injunction|award|compensat/i.test(content);
      if (!hasPrayerLanguage) {
        findings.push({
          id: randomUUID(),
          dimension: 'structural',
          severity: 'major',
          status: 'failed',
          message: `Prayer section appears to lack specific relief requested.`,
          sectionId: section.id,
          repairable: true,
          suggestedAction: 'Ensure the prayer clearly states the relief/remedy sought.',
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        id: randomUUID(),
        dimension: 'structural',
        severity: 'info',
        status: 'passed',
        message: `Section "${section.title}" passed structural checks.`,
        sectionId: section.id,
        repairable: false,
      });
    }

    return findings;
  }

  // ─── Formatting checks ────────────────────────────────────────────────────

  private checkFormatting(section: DraftSectionV3): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const content = section.content ?? '';

    // Check for broken citation formats (common patterns)
    const brokenCitations = content.match(/\(\s*\d{4}\s*\)/g);
    if (brokenCitations && brokenCitations.length > 0) {
      findings.push({
        id: randomUUID(),
        dimension: 'formatting',
        severity: 'minor',
        status: 'warning',
        message: `Section "${section.title}" has ${brokenCitations.length} year-only citation(s) that may be incomplete.`,
        sectionId: section.id,
        repairable: false,
        suggestedAction: 'Verify and complete all legal citations with full case/statute references.',
      });
    }

    // Excessive whitespace
    if (/\n{4,}/.test(content)) {
      findings.push({
        id: randomUUID(),
        dimension: 'formatting',
        severity: 'minor',
        status: 'warning',
        message: `Section "${section.title}" has excessive blank lines which may cause formatting issues.`,
        sectionId: section.id,
        repairable: true,
        suggestedAction: 'Clean up excessive whitespace.',
      });
    }

    return findings;
  }

  // ─── Logical checks ───────────────────────────────────────────────────────

  private checkLogical(section: DraftSectionV3): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const content = section.content ?? '';

    // Detect contradictions by looking for opposite assertions in the same section
    const hasContradiction =
      (/petitioner.*respondent.*did not/i.test(content) && /petitioner.*respondent.*did/i.test(content)) ||
      /on one hand.*on the other hand/i.test(content);

    if (hasContradiction) {
      findings.push({
        id: randomUUID(),
        dimension: 'logical',
        severity: 'major',
        status: 'warning',
        message: `Section "${section.title}" may contain contradictory statements. Review for logical consistency.`,
        sectionId: section.id,
        repairable: false,
        suggestedAction: 'Review and reconcile any contradictory assertions within this section.',
      });
    }

    return findings;
  }

  // ─── Factual checks ───────────────────────────────────────────────────────

  private checkFactual(section: DraftSectionV3): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const content = section.content ?? '';

    if (section.sectionType !== 'facts') return findings;

    // Check if facts section uses speculative language without qualification
    const speculativePatterns = [
      /it is alleged that/i,
      /it is claimed that/i,
      /presumably/i,
      /allegedly/i,
    ];
    const hasSpeculativeLanguage = speculativePatterns.some((p) => p.test(content));

    if (hasSpeculativeLanguage) {
      findings.push({
        id: randomUUID(),
        dimension: 'factual',
        severity: 'minor',
        status: 'warning',
        message: `Facts section contains speculative language. Ensure allegations are properly classified.`,
        sectionId: section.id,
        repairable: false,
        suggestedAction: 'Classify all allegations clearly and distinguish confirmed facts from allegations.',
      });
    }

    return findings;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private computeOverallScore(findings: VerificationFinding[]): number {
    if (findings.length === 0) return 100;

    const weights = { critical: 30, major: 15, minor: 5, info: 0 };
    const totalPenalty = findings
      .filter((f) => f.status !== 'passed')
      .reduce((sum, f) => sum + (weights[f.severity] ?? 0), 0);

    return Math.max(0, Math.min(100, 100 - totalPenalty));
  }

  private mapFindingToComponent(finding: VerificationFinding): FilingBlocker['component'] {
    if (finding.checkId?.startsWith('manifest:')) {
      const id = finding.checkId.slice('manifest:'.length);
      if (
        [
          'cause_title',
          'parties',
          'facts',
          'legal_grounds',
          'prayer',
          'verification',
          'formatting',
          'citations',
        ].includes(id)
      ) {
        return id as FilingBlocker['component'];
      }
    }

    const sectionTypeMap: Record<string, FilingBlocker['component']> = {
      heading: 'cause_title',
      parties: 'parties',
      facts: 'facts',
      legal_grounds: 'legal_grounds',
      prayer: 'prayer',
      verification: 'verification',
      signature: 'signatures',
      schedule: 'formatting',
      definitions: 'formatting',
      custom: 'formatting',
    };

    if (finding.sectionType && sectionTypeMap[finding.sectionType]) {
      return sectionTypeMap[finding.sectionType];
    }

    const dimensionMap: Record<string, FilingBlocker['component']> = {
      structural: 'formatting',
      formatting: 'formatting',
      logical: 'legal_grounds',
      factual: 'facts',
      jurisdictional: 'citations',
      statutory: 'legal_grounds',
      case_law: 'citations',
      procedural: 'citations',
    };

    return dimensionMap[finding.dimension] ?? 'formatting';
  }

  private async updateSectionVerificationStatus(
    sections: DraftSectionV3[],
    findings: VerificationFinding[],
  ): Promise<void> {
    const findingsBySection = new Map<string, VerificationFinding[]>();

    for (const f of findings) {
      if (!f.sectionId) continue;
      const existing = findingsBySection.get(f.sectionId) ?? [];
      existing.push(f);
      findingsBySection.set(f.sectionId, existing);
    }

    await Promise.all(
      sections.map(async (section) => {
        const sectionFindings = findingsBySection.get(section.id) ?? [];
        const hasCriticalFailure = sectionFindings.some(
          (f) => f.severity === 'critical' && f.status === 'failed',
        );
        const hasMajorFailure = sectionFindings.some(
          (f) => f.severity === 'major' && f.status === 'failed',
        );

        const newStatus = hasCriticalFailure || hasMajorFailure ? 'repair_needed' : 'verified';
        const confidenceScore =
          sectionFindings.length === 0
            ? 1.0
            : Math.max(0, 1 - sectionFindings.filter((f) => f.status === 'failed').length * 0.2);

        await this.prisma.draftSectionV3.update({
          where: { id: section.id },
          data: {
            status: newStatus,
            confidence: confidenceScore,
            verificationJson: sectionFindings as unknown as object[],
          },
        });
      }),
    );
  }
}
