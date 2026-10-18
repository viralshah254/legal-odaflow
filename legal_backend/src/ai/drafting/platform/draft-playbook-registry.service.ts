import { Injectable, NotFoundException } from '@nestjs/common';
import type { DraftPlaybook } from '../contracts/draft-playbook';
import {
  PLATFORM_DRAFT_PLAYBOOKS,
  PLAYBOOK_KIND_ALIASES,
} from './platform-playbooks.registry';
import { DraftKindPlaybookService } from '../playbooks/draft-kind-playbook.service';

@Injectable()
export class DraftPlaybookRegistryService {
  private readonly byKind = new Map<string, DraftPlaybook>();

  constructor(private readonly legacyPlaybooks: DraftKindPlaybookService) {
    for (const pb of PLATFORM_DRAFT_PLAYBOOKS) {
      this.byKind.set(pb.documentKind, pb);
    }
  }

  resolveKind(documentKind: string): string {
    return PLAYBOOK_KIND_ALIASES[documentKind] ?? documentKind;
  }

  getPlaybook(
    jurisdiction: string,
    documentKind: string,
    version?: string,
  ): DraftPlaybook {
    const kind = this.resolveKind(documentKind);
    const pb = this.byKind.get(kind) ?? this.fromReadinessPolicy(documentKind, jurisdiction);
    if (pb.jurisdiction !== jurisdiction && jurisdiction !== 'IN') {
      // Soft: Wave-1 playbooks are IN-only; allow IN default.
    }
    if (version && pb.version !== version) {
      throw new NotFoundException(
        `Playbook version mismatch for ${kind}: requested ${version}, active ${pb.version}`,
      );
    }
    if (!pb.active) {
      throw new NotFoundException(`Playbook for ${kind} is disabled (outdated)`);
    }
    return pb;
  }

  tryGetPlaybook(documentKind: string): DraftPlaybook | null {
    const kind = this.resolveKind(documentKind);
    const pb = this.byKind.get(kind) ?? this.fromReadinessPolicy(documentKind);
    if (!pb || !pb.active) return null;
    return pb;
  }

  listActive(): DraftPlaybook[] {
    return [...this.byKind.values()].filter((p) => p.active);
  }

  /** True when playbook is active, lawyer-approved, and meets min eval threshold. */
  isProductionEnabled(documentKind: string, evalPassRate?: number): boolean {
    const pb = this.tryGetPlaybook(documentKind);
    if (!pb || !pb.lawyerApproved || !pb.active) return false;
    if (pb.minEvalPassRate != null && evalPassRate != null) {
      return evalPassRate >= pb.minEvalPassRate;
    }
    return true;
  }

  /**
   * Playbook version change invalidates prior verification artifacts
   * that were stamped with a different version.
   */
  isVerificationStale(artifactPlaybookVersion: string, documentKind: string): boolean {
    const pb = this.tryGetPlaybook(documentKind);
    if (!pb) return true;
    return pb.version !== artifactPlaybookVersion;
  }

  /** Bridge to legacy DraftKindPlaybook for gradual migration. */
  legacyFilingGrade(documentKind: string): boolean {
    const pb = this.tryGetPlaybook(documentKind);
    if (pb) return pb.filingGrade;
    return this.legacyPlaybooks.isFilingGrade(documentKind);
  }

  private fromReadinessPolicy(documentKind: string, jurisdiction?: string): DraftPlaybook {
    const policy = this.legacyPlaybooks.resolve(documentKind);
    const isKenya = jurisdiction === 'KE';
    const playbook: DraftPlaybook = {
      id: `playbook:${policy.kind}:readiness-v1`,
      jurisdiction: jurisdiction ?? policy.jurisdiction ?? 'IN',
      documentKind,
      version: 'readiness-1.0.0',
      active: true,
      filingGrade: policy.filingGrade,
      lawyerApproved: !isKenya,
      advocateReview: isKenya ? { status: 'pending' } : undefined,
      supportedCourts: [],
      supportedProceduralStages: [],
      mandatoryFields: (policy.requiredFactCategories ?? []).map((category) => ({
        id: category,
        label: category.replace(/_/g, ' '),
        path: `matterData.${category}`,
        blocking: policy.filingGrade,
      })),
      optionalFields: [],
      requiredSections: policy.requiredSections.map((title) => ({
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        title,
        required: true,
      })),
      optionalSections: [],
      issueTaxonomy: policy.requiredGroundTypes.map((issue) => ({
        id: issue,
        label: issue.replace(/_/g, ' '),
        required: true,
        authorities:
          policy.minVerifiedCaseAuthorities > 0 ||
          policy.citationPolicy === 'case_law_required'
            ? [issue]
            : undefined,
      })),
      requiredFactCategories: (policy.requiredFactCategories ?? []).map((category) => ({
        category,
        required: true,
        materialityDefault: 'critical',
      })),
      planningMode: policy.archetype === 'research_memo' ? 'legal_issue' : 'remedy_based',
      statuteRules: [],
      remedyRules: [],
      adverseFactRules: [],
      prayerRules: [],
      verificationRules: policy.requiredSections.some((section) => /verification/i.test(section))
        ? [{ id: 'verification', required: true }]
        : [],
      releaseChecks: [],
      partyLabel: policy.partyLabel,
      minCitationsPerGround: policy.minCitationsPerGround,
      minVerifiedCaseAuthorities: policy.minVerifiedCaseAuthorities,
      factCoverageThreshold: policy.factCoverageThreshold,
    };
    this.byKind.set(this.resolveKind(documentKind), playbook);
    return playbook;
  }
}
