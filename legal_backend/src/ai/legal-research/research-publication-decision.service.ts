import { Injectable } from '@nestjs/common';
import type {
  PropositionGraph,
  ResearchPublicationAssessment,
  ResearchPublicationDecision,
} from './high-confidence-research.types';
import type { CitationAuditResult } from './legal-authority.types';
import { PropositionGraphValidatorService } from './proposition-graph-validator.service';

const STRUCTURAL_CODES = new Set([
  'SCOPE_MISMATCH',
  'DUPLICATE_NODE',
  'DANGLING_EDGE',
  'CIRCULAR_DEPENDENCY',
]);

@Injectable()
export class ResearchPublicationDecisionService {
  constructor(
    private readonly graphValidator: PropositionGraphValidatorService,
  ) {}

  evaluate(
    graph: PropositionGraph,
    context?: {
      jurisdiction?: string;
      kenyaVerifiedRequested?: boolean;
      citationAudit?: CitationAuditResult | null;
      hasProspectiveAuthority?: boolean;
    },
  ): ResearchPublicationAssessment {
    const issues = this.graphValidator.validate(graph);
    const applications = graph.nodes.filter(
      (node) => node.kind === 'APPLICATION',
    );

    if (applications.length === 0) {
      return this.result(
        'ABSTAIN',
        issues,
        [],
        'No application proposition is available for publication',
      );
    }

    if (context?.jurisdiction?.toUpperCase() === 'KE' && context.kenyaVerifiedRequested) {
      const reasons = [
        ...(context.citationAudit?.verificationDowngradeReasons ?? []),
        ...(context.hasProspectiveAuthority
          ? ['Prospective authority was excluded from current-law support.']
          : []),
      ];
      if (
        !context.citationAudit ||
        context.citationAudit.kenyaVerified !== true ||
        context.hasProspectiveAuthority
      ) {
        return this.result(
          'GAP',
          issues,
          [],
          reasons[0] ?? 'Kenya Verified requirements were not established',
        );
      }
    }

    if (issues.some((issue) => STRUCTURAL_CODES.has(issue.code))) {
      return this.result(
        'ABSTAIN',
        issues,
        [],
        'The proposition graph is structurally unsafe',
      );
    }

    const blockedApplicationIds = new Set(
      issues
        .filter(
          (issue) =>
            issue.blocking &&
            issue.nodeId &&
            issue.code.startsWith('APPLICATION_'),
        )
        .map((issue) => issue.nodeId as string),
    );
    const publishableNodeIds = applications
      .filter((node) => !blockedApplicationIds.has(node.nodeId))
      .map((node) => node.nodeId);
    const hasMaterialGap = issues.some(
      (issue) =>
        issue.code === 'MISSING_DISPOSITIVE_FACT' ||
        issue.code === 'CURRENT_LAW_UNKNOWN' ||
        issue.code === 'MATERIAL_CONFLICT' ||
        issue.blocking,
    );

    if (publishableNodeIds.length === applications.length && !hasMaterialGap) {
      return this.result(
        'VERIFIED',
        issues,
        publishableNodeIds,
        'Every application has verified legal and factual support',
      );
    }
    if (publishableNodeIds.length > 0) {
      return this.result(
        'PARTIAL',
        issues,
        publishableNodeIds,
        'Only supported applications may be published',
      );
    }
    return this.result(
      'GAP',
      issues,
      [],
      'Material legal or factual dependencies remain unresolved',
    );
  }

  private result(
    decision: ResearchPublicationDecision,
    issues: ResearchPublicationAssessment['issues'],
    publishableNodeIds: string[],
    reason: string,
  ): ResearchPublicationAssessment {
    return {
      decision,
      issues,
      publishableNodeIds,
      reasons: [reason, ...issues.map((issue) => issue.message)],
    };
  }
}
