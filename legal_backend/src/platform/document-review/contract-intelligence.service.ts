/**
 * TODO-074, TODO-075, TODO-076, TODO-079 — Contract Intelligence Service
 *
 * Extracts clauses from raw text, calculates risk scores, generates negotiation
 * guidance, and compares document versions for tracked changes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ContractClauseV2, ContractPlaybook } from '@prisma/client';
import type { ReviewFinding, VersionDiff, ClauseExtract } from './document-review.types';

// ─── Clause type detection patterns ──────────────────────────────────────────

interface ClauseDetectionRule {
  clauseType: string;
  title: string;
  headingPatterns: RegExp[];
  contentPatterns: RegExp[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const CLAUSE_DETECTION_RULES: ClauseDetectionRule[] = [
  {
    clauseType: 'payment',
    title: 'Payment Terms',
    headingPatterns: [/payment\s*terms?/i, /fees?\s*and\s*payment/i, /consideration/i],
    contentPatterns: [/shall\s+pay|must\s+pay|payment\s+of|invoice/i],
    riskLevel: 'medium',
  },
  {
    clauseType: 'term',
    title: 'Term and Duration',
    headingPatterns: [/term\s*(?:of\s*(?:the\s*)?agreement)?/i, /duration/i, /commencement/i],
    contentPatterns: [/effective\s+(?:date|period)|shall\s+commence|term\s+of\s+\d+/i],
    riskLevel: 'low',
  },
  {
    clauseType: 'termination',
    title: 'Termination',
    headingPatterns: [/termination/i, /right\s+to\s+terminate/i, /cancellation/i],
    contentPatterns: [/terminat(?:e|ion)|cancell?(?:ation|ed)|end(?:ing)?\s+of\s+(?:this\s+)?agreement/i],
    riskLevel: 'high',
  },
  {
    clauseType: 'liability',
    title: 'Limitation of Liability',
    headingPatterns: [/limitation\s+of\s+liability/i, /liability\s+cap/i, /exclusion\s+of\s+liability/i],
    contentPatterns: [/shall\s+not\s+be\s+liable|liability\s+shall\s+(?:not\s+exceed|be\s+limited)/i],
    riskLevel: 'critical',
  },
  {
    clauseType: 'indemnity',
    title: 'Indemnification',
    headingPatterns: [/indemnif(?:y|ication)/i, /hold\s+harmless/i],
    contentPatterns: [/indemnif(?:y|ication)|hold\s+harmless|defend\s+and\s+indemnify/i],
    riskLevel: 'high',
  },
  {
    clauseType: 'IP',
    title: 'Intellectual Property',
    headingPatterns: [/intellectual\s+property/i, /ip\s+rights?/i, /ownership\s+of\s+(?:ip|work)/i],
    contentPatterns: [/intellectual\s+property|copyright|patent|trademark|trade\s+secret|work\s+made\s+for\s+hire/i],
    riskLevel: 'high',
  },
  {
    clauseType: 'data_protection',
    title: 'Data Protection',
    headingPatterns: [/data\s+protection/i, /privacy/i, /personal\s+data/i, /data\s+processing/i],
    contentPatterns: [/personal\s+(?:data|information)|gdpr|pdpa|dpdp|data\s+(?:processor|controller)/i],
    riskLevel: 'high',
  },
  {
    clauseType: 'force_majeure',
    title: 'Force Majeure',
    headingPatterns: [/force\s+majeure/i, /act\s+of\s+god/i],
    contentPatterns: [/force\s+majeure|unforeseeable\s+circumstances|act\s+of\s+god|pandemic|natural\s+disaster/i],
    riskLevel: 'medium',
  },
  {
    clauseType: 'dispute',
    title: 'Dispute Resolution',
    headingPatterns: [/dispute\s+resolution/i, /arbitration/i, /governing\s+law\s+and\s+(?:jurisdiction|dispute)/i],
    contentPatterns: [/arbitration|mediation|dispute\s+shall\s+be|courts?\s+of\s+competent\s+jurisdiction/i],
    riskLevel: 'medium',
  },
  {
    clauseType: 'confidentiality',
    title: 'Confidentiality',
    headingPatterns: [/confidential(?:ity)?/i, /non-?disclosure/i, /secrecy/i],
    contentPatterns: [/confidential\s+information|non-?disclosure|shall\s+(?:keep|maintain)\s+confidential/i],
    riskLevel: 'medium',
  },
  {
    clauseType: 'governing_law',
    title: 'Governing Law',
    headingPatterns: [/governing\s+law/i, /applicable\s+law/i, /choice\s+of\s+law/i],
    contentPatterns: [/governed\s+by\s+(?:the\s+)?laws?\s+of|subject\s+to\s+(?:the\s+)?laws?\s+of/i],
    riskLevel: 'low',
  },
  {
    clauseType: 'warranty',
    title: 'Warranties and Representations',
    headingPatterns: [/warrantie?s?|representation/i],
    contentPatterns: [/warrants?\s+(?:that|and\s+represents?)|represents?\s+and\s+warrants?/i],
    riskLevel: 'medium',
  },
  {
    clauseType: 'penalty',
    title: 'Penalties and Liquidated Damages',
    headingPatterns: [/penalt(?:y|ies)/i, /liquidated\s+damages?/i, /breach\s+consequences/i],
    contentPatterns: [/liquidated\s+damages?|penalty\s+(?:clause|of)|damages?\s+of\s+[A-Z]{2,3}/i],
    riskLevel: 'high',
  },
  {
    clauseType: 'assignment',
    title: 'Assignment',
    headingPatterns: [/assignment/i, /transfer\s+of\s+rights/i],
    contentPatterns: [/may\s+not\s+assign|shall\s+not\s+assign|assignment\s+of\s+(?:this\s+)?(?:agreement|contract)/i],
    riskLevel: 'low',
  },
];

// ─── Risk scoring weights ─────────────────────────────────────────────────────

const CLAUSE_TYPE_RISK_CONTRIBUTION: Record<string, number> = {
  liability: 20,
  indemnity: 18,
  penalty: 15,
  termination: 12,
  IP: 12,
  data_protection: 11,
  payment: 10,
  force_majeure: 8,
  confidentiality: 8,
  warranty: 7,
  dispute: 6,
  governing_law: 5,
  assignment: 4,
  term: 3,
};

const RISK_LEVEL_MULTIPLIER: Record<string, number> = {
  critical: 1.5,
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

@Injectable()
export class ContractIntelligenceService {
  private readonly logger = new Logger(ContractIntelligenceService.name);

  // ─── TODO-074: Clause extraction ──────────────────────────────────────────

  extractClauses(rawText: string, _contractType: string): ClauseExtract[] {
    const clauses: ClauseExtract[] = [];
    const lines = rawText.split('\n');
    const foundTypes = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const rule of CLAUSE_DETECTION_RULES) {
        if (foundTypes.has(rule.clauseType)) continue;

        const headingMatch = rule.headingPatterns.some((p) => p.test(line));
        if (!headingMatch) continue;

        // Extract section content (next 40 lines or until next numbered heading)
        const sectionLines: string[] = [line];
        for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (this.isNewSection(nextLine) && j > i + 2) break;
          sectionLines.push(nextLine);
        }

        const rawClauseText = sectionLines.join('\n').trim();

        // Verify content patterns match too
        const contentMatch = rule.contentPatterns.some((p) => p.test(rawClauseText));
        if (!contentMatch && !headingMatch) continue;

        const riskFactors = this.identifyRiskFactors(rawClauseText, rule.clauseType);

        clauses.push({
          clauseType: rule.clauseType,
          title: rule.title,
          rawText: rawClauseText,
          section: line,
          riskLevel: this.assessClauseRisk(rawClauseText, rule),
          riskFactors,
        });

        foundTypes.add(rule.clauseType);
      }
    }

    return clauses;
  }

  // ─── TODO-075: Risk score calculation ─────────────────────────────────────

  calculateRiskScore(
    clauses: ClauseExtract[],
    findings: ReviewFinding[],
  ): { overall: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {
      financial: 0,
      legal: 0,
      operational: 0,
      data: 0,
    };

    let rawScore = 0;

    // Score from clauses
    for (const clause of clauses) {
      const typeContribution = CLAUSE_TYPE_RISK_CONTRIBUTION[clause.clauseType] ?? 5;
      const levelMultiplier = RISK_LEVEL_MULTIPLIER[clause.riskLevel] ?? 0.5;
      const contribution = typeContribution * levelMultiplier;
      rawScore += contribution;

      this.allocateToBreakdown(breakdown, clause.clauseType, contribution);
    }

    // Score from findings
    const findingWeights = { critical: 20, high: 10, medium: 5, low: 1 };
    for (const finding of findings) {
      rawScore += findingWeights[finding.severity] ?? 0;
    }

    const overall = Math.min(100, Math.round(rawScore));

    // Normalize breakdown to 0-100
    const maxPerDimension = 60;
    for (const key of Object.keys(breakdown)) {
      breakdown[key] = Math.min(100, Math.round((breakdown[key] / maxPerDimension) * 100));
    }

    return { overall, breakdown };
  }

  // ─── TODO-076: Negotiation guidance ───────────────────────────────────────

  generateNegotiationGuidance(
    clauses: ClauseExtract[],
    playbooks: ContractPlaybook[],
  ): Map<string, string> {
    const guidance = new Map<string, string>();

    for (const clause of clauses) {
      const playbook = playbooks.find(
        (p) => p.clauseType === clause.clauseType,
      );

      if (playbook?.negotiationGuide) {
        guidance.set(clause.clauseType, playbook.negotiationGuide);
        continue;
      }

      // Fallback built-in guidance
      const builtIn = this.getBuiltInGuidance(clause);
      if (builtIn) {
        guidance.set(clause.clauseType, builtIn);
      }
    }

    return guidance;
  }

  // ─── TODO-079: Version comparison ─────────────────────────────────────────

  compareVersions(
    textA: string,
    textB: string,
  ): VersionDiff[] {
    const diffs: VersionDiff[] = [];

    const sentencesA = this.splitToSentences(textA);
    const sentencesB = this.splitToSentences(textB);

    const setA = new Set(sentencesA.map((s) => s.trim().toLowerCase()));
    const setB = new Set(sentencesB.map((s) => s.trim().toLowerCase()));

    // Deletions: in A but not in B
    for (const sentence of sentencesA) {
      if (!setB.has(sentence.trim().toLowerCase())) {
        diffs.push({
          type: 'deletion',
          section: this.guessSectionForSentence(textA, sentence),
          before: sentence.trim(),
          after: '',
        });
      }
    }

    // Additions: in B but not in A
    for (const sentence of sentencesB) {
      if (!setA.has(sentence.trim().toLowerCase())) {
        diffs.push({
          type: 'addition',
          section: this.guessSectionForSentence(textB, sentence),
          before: '',
          after: sentence.trim(),
        });
      }
    }

    // Deduplicate and mark adjacent add/delete pairs as modifications
    return this.coalesceModifications(diffs);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private isNewSection(line: string): boolean {
    return /^(\d+(?:\.\d+)*)\s+[A-Z]/.test(line) || /^[A-Z]{4,}/.test(line);
  }

  private assessClauseRisk(
    text: string,
    rule: ClauseDetectionRule,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Elevate risk for certain problematic phrases
    const critical = /unlimited\s+liability|no\s+cap|absolute\s+indemnity/i;
    const high = /any\s+and\s+all\s+(?:damages?|losses?)|sole\s+discretion|without\s+notice/i;

    if (critical.test(text)) return 'critical';
    if (high.test(text)) return 'high';
    return rule.riskLevel;
  }

  private identifyRiskFactors(text: string, clauseType: string): string[] {
    const factors: string[] = [];
    const lower = text.toLowerCase();

    const riskIndicators: Array<[RegExp, string]> = [
      [/unlimited\s+liability/, 'Unlimited liability exposure'],
      [/no\s+cap/, 'No liability cap'],
      [/sole\s+discretion/, 'Unilateral discretion'],
      [/without\s+notice/, 'No notice required'],
      [/any\s+and\s+all/, 'Overly broad scope'],
      [/irrevocable/, 'Irrevocable rights granted'],
      [/in\s+perpetuity/, 'Perpetual obligation'],
      [/waive[rs]?\s+(?:any|all|right)/, 'Rights waiver detected'],
      [/non-?refundable/, 'Non-refundable payment terms'],
      [/liquidated\s+damages/, 'Liquidated damages clause'],
    ];

    for (const [pattern, label] of riskIndicators) {
      if (pattern.test(lower)) {
        factors.push(label);
      }
    }

    return factors;
  }

  private allocateToBreakdown(
    breakdown: Record<string, number>,
    clauseType: string,
    contribution: number,
  ): void {
    const financialTypes = new Set(['payment', 'penalty', 'indemnity', 'liability']);
    const dataTypes = new Set(['data_protection', 'confidentiality']);
    const operationalTypes = new Set(['force_majeure', 'termination', 'assignment', 'warranty']);

    if (financialTypes.has(clauseType)) {
      breakdown.financial += contribution;
    } else if (dataTypes.has(clauseType)) {
      breakdown.data += contribution;
    } else if (operationalTypes.has(clauseType)) {
      breakdown.operational += contribution;
    } else {
      breakdown.legal += contribution;
    }
  }

  private getBuiltInGuidance(clause: ClauseExtract): string | null {
    const builtIn: Record<string, string> = {
      liability:
        'Negotiate a mutual liability cap equal to fees paid in the preceding 12 months. Carve out fraud, wilful misconduct, and IP indemnities.',
      indemnity:
        'Push for mutual indemnification. Limit to direct damages caused by gross negligence or wilful misconduct. Avoid "any and all" language.',
      payment:
        'Ensure payment milestones are tied to deliverables. Include a right to dispute invoices within 10 business days.',
      termination:
        'Negotiate termination for convenience with at least 30 days written notice. Ensure accrued rights survive termination.',
      IP:
        'Clarify ownership of pre-existing IP vs. newly created work product. If work-for-hire, ensure assignment is explicit.',
      data_protection:
        'Include a data processing agreement if personal data is involved. Specify data retention, deletion, and breach notification timelines.',
      confidentiality:
        'Limit confidentiality obligations to 3-5 years post-termination with standard carve-outs for publicly available information.',
      dispute:
        'Prefer institutional arbitration (ICC/DIAC) over ad-hoc. Specify seat of arbitration, language, and number of arbitrators.',
    };

    return builtIn[clause.clauseType] ?? null;
  }

  private splitToSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
  }

  private guessSectionForSentence(text: string, sentence: string): string {
    const idx = text.indexOf(sentence);
    if (idx < 0) return 'Unknown';
    const textBefore = text.slice(0, idx);
    const lines = textBefore.split('\n').reverse();
    for (const line of lines) {
      if (/^(\d+(?:\.\d+)*)\s+[A-Z]|^[A-Z]{4,}/.test(line.trim())) {
        return line.trim().slice(0, 80);
      }
    }
    return 'Preamble';
  }

  private coalesceModifications(diffs: VersionDiff[]): VersionDiff[] {
    // Simple approach: pair deletions and additions that appear near each other
    const result: VersionDiff[] = [];
    const deletions = diffs.filter((d) => d.type === 'deletion');
    const additions = diffs.filter((d) => d.type === 'addition');
    const usedDeletions = new Set<number>();
    const usedAdditions = new Set<number>();

    for (let i = 0; i < deletions.length; i++) {
      const del = deletions[i];
      // Try to find an addition in the same section
      const matchIdx = additions.findIndex(
        (a, ai) => !usedAdditions.has(ai) && a.section === del.section,
      );
      if (matchIdx >= 0) {
        usedDeletions.add(i);
        usedAdditions.add(matchIdx);
        result.push({
          type: 'modification',
          section: del.section,
          before: del.before,
          after: additions[matchIdx].after,
        });
      }
    }

    // Add unmatched diffs
    for (let i = 0; i < deletions.length; i++) {
      if (!usedDeletions.has(i)) result.push(deletions[i]);
    }
    for (let i = 0; i < additions.length; i++) {
      if (!usedAdditions.has(i)) result.push(additions[i]);
    }

    return result;
  }
}
