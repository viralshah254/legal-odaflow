import { Injectable } from '@nestjs/common';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import type { DraftCaseBrief } from './draft-case-brief.types';

const VERIFIER = 'draft-case-fact-coverage-v1';

export interface FactCoverageResult {
  coverageRate: number;
  covered: string[];
  missing: string[];
  findings: VerificationFinding[];
  groundsWithoutCitation: string[];
}

export interface FactCoverageInput {
  draft: string;
  brief: DraftCaseBrief;
  kind?: string;
  filingGrade?: boolean;
}

const CITATION_RE =
  /\b(?:\(\d{4}\)\s+\d+\s+SCC\s+\d+|AIR\s+\d{4}\s+SC\s+\d+|BNSS\s*§?\s*\d+|BNS\s*§?\s*\d+|CrPC\s*§?\s*\d+|Article\s+\d+|SOURCE_\d+|curated__|\[SOURCE_\d+\])/i;

@Injectable()
export class DraftCaseFactCoverageService {
  evaluate(input: FactCoverageInput): FactCoverageResult {
    const draft = input.draft ?? '';
    const facts = input.brief.defenceFacts;
    const covered: string[] = [];
    const missing: string[] = [];
    const findings: VerificationFinding[] = [];

    for (const fact of facts) {
      const tokens = fact
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 4)
        .slice(0, 6);
      const hit =
        tokens.length === 0
          ? false
          : tokens.filter((t) => draft.toLowerCase().includes(t)).length >= Math.min(2, tokens.length);
      if (hit) covered.push(fact);
      else missing.push(fact);
    }

    const coverageRate = facts.length === 0 ? 1 : covered.length / facts.length;

    if (input.filingGrade !== false && facts.length > 0 && coverageRate < 0.85) {
      findings.push({
        checkId: 'fact_coverage:below_threshold',
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'application',
        evidenceIds: [],
        explanation: `Defence-fact coverage ${(coverageRate * 100).toFixed(0)}% is below 85%. Missing: ${missing
          .slice(0, 5)
          .join('; ')}`,
        repairAction: 'NARROW',
        verifierVersion: VERIFIER,
      });
    }

    for (const m of missing.slice(0, 8)) {
      findings.push({
        checkId: 'fact_coverage:missing_ground',
        state: 'FAIL',
        severity: 'HIGH',
        dimension: 'application',
        evidenceIds: [],
        explanation: `Defence fact not covered in grounds: ${m.slice(0, 160)}`,
        repairAction: 'NARROW',
        verifierVersion: VERIFIER,
      });
    }

    const groundsWithoutCitation = this.findGroundsWithoutCitation(draft);
    if (input.filingGrade !== false && /grounds|bail|writ|plaint|revision/i.test(input.kind ?? 'bail')) {
      for (const g of groundsWithoutCitation.slice(0, 10)) {
        findings.push({
          checkId: 'fact_coverage:ground_missing_citation',
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'citation',
          evidenceIds: [],
          explanation: `Ground lacks verified citation: ${g.slice(0, 120)}`,
          repairAction: 'RECITE',
          verifierVersion: VERIFIER,
        });
      }
    }

    return { coverageRate, covered, missing, findings, groundsWithoutCitation };
  }

  private findGroundsWithoutCitation(draft: string): string[] {
    const groundsSection =
      draft.match(
        /(?:GROUNDS|GROUNDS FOR BAIL|LEGAL GROUNDS|GROUNDS FOR RELIEF)[:\s]*([\s\S]{0,8000}?)(?=\n\s*(?:PRAYER|VERIFICATION|INTERIM|LIST OF DATES)\b|$)/i,
      )?.[1] ?? draft;

    const paras = groundsSection
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => /^(?:[A-Z]\)|\([a-z]\)|\d+\.|Ground\s+[A-Z0-9])/i.test(p) && p.length > 40);

    return paras.filter(
      (p) => /\[AUTHORITY TO BE ADDED\]/i.test(p) || !CITATION_RE.test(p),
    );
  }
}
