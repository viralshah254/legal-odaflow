import { Injectable, Logger } from '@nestjs/common';
import type { DraftFact, ProceduralCheckResult } from './drafting.types';

export interface ProceduralGateInput {
  jurisdiction: string;
  region?: string;
  court?: string;
  documentType: string;
  objective: string;
  facts?: DraftFact[];
}

/** Deterministic procedural gate — no LLM, pure rules. */
@Injectable()
export class ProceduralGateService {
  private readonly logger = new Logger(ProceduralGateService.name);

  async runGate(dto: ProceduralGateInput): Promise<ProceduralCheckResult[]> {
    this.logger.log(`Running procedural gate for jurisdiction=${dto.jurisdiction} docType=${dto.documentType}`);

    const results: ProceduralCheckResult[] = await Promise.all([
      this.checkForum(dto),
      this.checkLimitation(dto),
      this.checkStanding(dto),
      this.checkRemedyAvailability(dto),
      this.checkRequiredNotice(dto),
    ]);

    return results;
  }

  hasBlockingErrors(results: ProceduralCheckResult[]): boolean {
    return results.some((r) => !r.passed && r.severity === 'error');
  }

  // ─── Individual checks ─────────────────────────────────────────────────────

  private async checkForum(dto: ProceduralGateInput): Promise<ProceduralCheckResult> {
    const { jurisdiction, court, documentType } = dto;

    // High court documents require a high court designation
    const requiresHighCourt = ['writ_petition', 'writ', 'appeal'].some((k) =>
      documentType?.toLowerCase().includes(k),
    );
    const isHighCourtDesignated = court
      ? /high court|supreme court|hc|sc/i.test(court)
      : false;

    if (requiresHighCourt && court && !isHighCourtDesignated) {
      return {
        checkType: 'forum',
        passed: false,
        severity: 'error',
        message: `Document type "${documentType}" requires a High Court or Supreme Court. Selected court "${court}" may not have jurisdiction.`,
        sourceRef: `forum_check:${jurisdiction}`,
      };
    }

    // District court documents generally cannot be filed in Supreme Court
    const isDistrictLevelDoc = ['suit', 'plaint', 'written_statement', 'execution_petition'].some((k) =>
      documentType?.toLowerCase().includes(k),
    );
    const isSupremeCourt = court ? /supreme court|sc/i.test(court) : false;
    if (isDistrictLevelDoc && isSupremeCourt) {
      return {
        checkType: 'forum',
        passed: false,
        severity: 'warning',
        message: `Document type "${documentType}" is typically filed in district courts, not the Supreme Court.`,
        sourceRef: `forum_check:${jurisdiction}`,
      };
    }

    return {
      checkType: 'forum',
      passed: true,
      severity: 'info',
      message: 'Forum appears appropriate for document type.',
      sourceRef: `forum_check:${jurisdiction}`,
    };
  }

  private async checkLimitation(dto: ProceduralGateInput): Promise<ProceduralCheckResult> {
    const { facts, documentType, jurisdiction } = dto;

    // Look for any date facts the user provided
    const dateFacts = (facts ?? []).filter(
      (f) =>
        f.classification === 'confirmed_fact' &&
        /\b(date|dated|on or about|accrued|cause of action|breach|incident)\b/i.test(f.text),
    );

    if (dateFacts.length === 0) {
      return {
        checkType: 'limitation',
        passed: true,
        severity: 'warning',
        message:
          'No accrual date found in facts. Limitation period cannot be verified automatically. Please confirm the matter is within limitation.',
        sourceRef: `limitation_check:${jurisdiction}`,
      };
    }

    // Basic pattern: India Limitation Act default periods
    const limitationYears = this.getLimitationYears(documentType, jurisdiction);

    return {
      checkType: 'limitation',
      passed: true,
      severity: 'info',
      message: `Default limitation period for "${documentType}" in ${jurisdiction} is approximately ${limitationYears} year(s). Please verify accrual date.`,
      sourceRef: `limitation_check:${jurisdiction}`,
    };
  }

  private async checkStanding(dto: ProceduralGateInput): Promise<ProceduralCheckResult> {
    const { facts, documentType } = dto;

    // If facts include no mention of the petitioner/plaintiff as a party, flag it
    const hasPetitionerFact = (facts ?? []).some(
      (f) =>
        f.classification === 'confirmed_fact' &&
        /\b(petitioner|plaintiff|applicant|claimant|appellant)\b/i.test(f.text),
    );

    const isPleading = ['petition', 'plaint', 'suit', 'application', 'appeal'].some((k) =>
      documentType?.toLowerCase().includes(k),
    );

    if (isPleading && !hasPetitionerFact) {
      return {
        checkType: 'standing',
        passed: true,
        severity: 'warning',
        message:
          'No explicit petitioner/plaintiff fact provided. Ensure the party has legal standing before filing.',
        sourceRef: 'standing_check',
      };
    }

    return {
      checkType: 'standing',
      passed: true,
      severity: 'info',
      message: 'Basic standing check passed.',
      sourceRef: 'standing_check',
    };
  }

  private async checkRemedyAvailability(dto: ProceduralGateInput): Promise<ProceduralCheckResult> {
    const { jurisdiction, documentType, objective } = dto;

    // Mandamus / certiorari only available against public authorities
    const isPrerogativeWrit = /mandamus|certiorari|prohibition|quo warranto/i.test(objective ?? '');
    const isPrivatePartyObjective = /private (company|party|individual|person)/i.test(objective ?? '');

    if (isPrerogativeWrit && isPrivatePartyObjective) {
      return {
        checkType: 'remedy_availability',
        passed: false,
        severity: 'error',
        message:
          'Prerogative writs (mandamus, certiorari, etc.) are generally not available against private parties. Consider alternative remedies.',
        sourceRef: `remedy_check:${jurisdiction}`,
      };
    }

    // Criminal complaints require a cognizable offence for FIR route
    const isCriminalComplaint = /fir|criminal complaint|section 154/i.test(documentType ?? '');
    if (isCriminalComplaint) {
      return {
        checkType: 'remedy_availability',
        passed: true,
        severity: 'warning',
        message: 'Ensure the offence alleged is cognizable under the applicable code before filing an FIR.',
        sourceRef: `remedy_check:${jurisdiction}`,
      };
    }

    return {
      checkType: 'remedy_availability',
      passed: true,
      severity: 'info',
      message: 'Requested remedy appears available in the specified jurisdiction.',
      sourceRef: `remedy_check:${jurisdiction}`,
    };
  }

  private async checkRequiredNotice(dto: ProceduralGateInput): Promise<ProceduralCheckResult> {
    const { documentType, facts, objective } = dto;

    // Consumer forum requires prior notice to the opposite party
    const requiresNotice =
      /consumer|section 80 cpc|legal notice|demand notice|statutory notice/i.test(
        documentType ?? '',
      ) ||
      /consumer forum|consumer court|district commission/i.test(objective ?? '');

    if (requiresNotice) {
      const hasNoticeInFacts = (facts ?? []).some(
        (f) => /notice|legal notice|demand/i.test(f.text),
      );

      if (!hasNoticeInFacts) {
        return {
          checkType: 'required_notice',
          passed: false,
          severity: 'warning',
          message:
            'This type of matter may require a pre-action legal notice to the opposite party. No notice fact was provided.',
          sourceRef: 'notice_check',
        };
      }
    }

    return {
      checkType: 'required_notice',
      passed: true,
      severity: 'info',
      message: 'No mandatory pre-action notice requirement identified, or notice already provided.',
      sourceRef: 'notice_check',
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getLimitationYears(documentType: string, jurisdiction: string): number {
    const lower = (documentType ?? '').toLowerCase();

    // India Limitation Act 1963 common periods
    if (/contract|breach of contract|money suit|recovery/i.test(lower)) return 3;
    if (/tort|negligence|accident/i.test(lower)) return 3;
    if (/property|title|possession|easement/i.test(lower)) return 12;
    if (/writ|fundamental rights/i.test(lower)) return 3;
    if (/consumer/i.test(lower)) return 2;
    if (/criminal/i.test(lower)) return 1;

    return 3; // default
  }
}
