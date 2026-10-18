/**
 * TODO-072, TODO-073 — Review Findings + Redlines
 *
 * Generates structured findings from document analysis and creates
 * redline suggestions for high/critical severity issues.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  DocumentStructure,
  ReviewFinding,
  Redline,
  PlaybookComparisonResult,
  FindingCategory,
  FindingSeverity,
  ObligationExtract,
} from './document-review.types';

// Required clause types that must be present in a complete contract
const REQUIRED_CLAUSE_TYPES = [
  'termination',
  'liability',
  'governing_law',
  'dispute',
  'confidentiality',
];

// Risk weights per category for score calculation
const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 7,
  low: 2,
};

const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  risk: 1.4,
  liability: 1.3,
  indemnities: 1.3,
  penalties: 1.2,
  data_protection: 1.2,
  termination: 1.1,
  jurisdiction: 1.1,
  obligations: 1.0,
  playbook: 1.0,
  missing_clause: 0.9,
  defined_terms: 0.6,
  formatting: 0.3,
};

@Injectable()
export class ReviewFindingsService {
  // ─── Public API ───────────────────────────────────────────────────────────

  generateFindings(
    structure: DocumentStructure,
    obligations: ObligationExtract[],
    playbookComparison: PlaybookComparisonResult[],
  ): ReviewFinding[] {
    const findings: ReviewFinding[] = [];

    findings.push(...this.findDefinedTermIssues(structure));
    findings.push(...this.findObligationIssues(obligations));
    findings.push(...this.findPlaybookIssues(playbookComparison));
    findings.push(...this.findMissingClauses(playbookComparison));
    findings.push(...this.findRiskPatterns(structure));
    findings.push(...this.findJurisdictionIssues(structure));

    return findings;
  }

  generateRedlines(findings: ReviewFinding[], structure: DocumentStructure): Redline[] {
    const redlines: Redline[] = [];

    for (const finding of findings) {
      if (finding.severity !== 'critical' && finding.severity !== 'high') continue;
      if (!finding.suggested) continue;

      const originalText = this.findTextRef(structure, finding.textRef ?? finding.sectionRef);
      if (!originalText) continue;

      const redline: Redline = {
        id: randomUUID(),
        sectionRef: finding.sectionRef ?? 'Unknown',
        originalText,
        proposedText: finding.suggested,
        reason: finding.description,
        riskLevel: finding.severity,
        category: finding.category,
        playbookRef: finding.playbookRef,
        anchorText: this.buildAnchorText(originalText),
        changeType: 'replace',
        severity: finding.severity,
      };

      redlines.push(redline);

      // Back-link the finding to its redline
      finding.redlineId = redline.id;
    }

    return redlines;
  }

  calculateRiskScore(findings: ReviewFinding[]): {
    score: number;
    breakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {
      financial: 0,
      legal: 0,
      operational: 0,
      data: 0,
    };

    let rawScore = 0;
    const maxPossible = 100;

    for (const finding of findings) {
      const baseWeight = SEVERITY_WEIGHTS[finding.severity];
      const categoryMultiplier = CATEGORY_WEIGHTS[finding.category] ?? 1.0;
      const contribution = baseWeight * categoryMultiplier;

      rawScore += contribution;

      // Bucket into breakdown dimensions
      if (['liability', 'indemnities', 'penalties'].includes(finding.category)) {
        breakdown.financial += contribution;
      } else if (['jurisdiction', 'playbook', 'missing_clause'].includes(finding.category)) {
        breakdown.legal += contribution;
      } else if (['obligations', 'termination'].includes(finding.category)) {
        breakdown.operational += contribution;
      } else if (['data_protection'].includes(finding.category)) {
        breakdown.data += contribution;
      } else {
        breakdown.legal += contribution;
      }
    }

    // Normalize each dimension to 0-100
    const cap = 150; // raw score that equals 100
    const score = Math.min(100, Math.round((rawScore / cap) * 100));

    for (const key of Object.keys(breakdown)) {
      breakdown[key] = Math.min(100, Math.round((breakdown[key] / (cap * 0.4)) * 100));
    }

    return { score, breakdown };
  }

  // ─── Finding generators ───────────────────────────────────────────────────

  private findDefinedTermIssues(structure: DocumentStructure): ReviewFinding[] {
    const findings: ReviewFinding[] = [];

    for (const term of structure.definedTerms) {
      if (term.inconsistentUsage) {
        findings.push({
          id: randomUUID(),
          category: 'defined_terms',
          severity: 'medium',
          title: `Inconsistent usage of defined term: "${term.term}"`,
          description: `The term "${term.term}" is defined in §${term.section} but appears to be used inconsistently across the document.`,
          sectionRef: term.section,
          textRef: term.term,
          actionRequired: true,
          suggested: `Review all usages of "${term.term}" and ensure consistent capitalisation and meaning throughout.`,
        });
      }
    }

    // Check for undefined capitalized terms (top 10 most suspicious)
    const undefinedTerms = structure.definedTerms
      .filter((t) => t.usageCount > 3 && t.definition.length < 10)
      .slice(0, 10);

    for (const term of undefinedTerms) {
      findings.push({
        id: randomUUID(),
        category: 'defined_terms',
        severity: 'low',
        title: `Possibly undefined term: "${term.term}"`,
        description: `"${term.term}" is used ${term.usageCount} times but its definition appears incomplete or absent.`,
        sectionRef: term.section,
        actionRequired: false,
      });
    }

    return findings;
  }

  private findObligationIssues(obligations: ObligationExtract[]): ReviewFinding[] {
    const findings: ReviewFinding[] = [];

    const paymentObligations = obligations.filter((o) => o.obligationType === 'payment');
    const noticeDates = obligations.filter(
      (o) => o.obligationType === 'notice' && !o.dueDate,
    );

    if (paymentObligations.some((o) => !o.dueDate)) {
      findings.push({
        id: randomUUID(),
        category: 'obligations',
        severity: 'high',
        title: 'Payment obligation without fixed due date',
        description:
          'One or more payment obligations do not specify a fixed payment date or determinable schedule. This creates enforceability risk.',
        actionRequired: true,
        suggested: 'Insert a specific payment date or payment schedule for each payment obligation.',
      });
    }

    if (noticeDates.length > 0) {
      findings.push({
        id: randomUUID(),
        category: 'obligations',
        severity: 'medium',
        title: 'Notice obligations without prescribed timeframe',
        description: `${noticeDates.length} notice obligation(s) do not specify a timeframe within which notice must be given.`,
        actionRequired: true,
        suggested:
          'Specify the number of days within which written notice must be provided (e.g. "within 7 business days").',
      });
    }

    return findings;
  }

  private findPlaybookIssues(playbookComparison: PlaybookComparisonResult[]): ReviewFinding[] {
    const findings: ReviewFinding[] = [];

    for (const result of playbookComparison) {
      if (result.status === 'prohibited') {
        findings.push({
          id: randomUUID(),
          category: 'playbook',
          severity: 'critical',
          title: `Prohibited clause language in ${result.clauseType}`,
          description:
            result.issue ??
            `The ${result.clauseType} clause contains language that is prohibited under your playbook.`,
          sectionRef: result.clauseType,
          textRef: result.matchedText,
          playbookRef: result.playbookId,
          actionRequired: true,
          suggested: result.suggestedReplacement,
        });
      } else if (result.status === 'flagged') {
        findings.push({
          id: randomUUID(),
          category: 'playbook',
          severity: 'high',
          title: `Flagged clause language in ${result.clauseType}`,
          description:
            result.issue ??
            `The ${result.clauseType} clause contains language that requires review under your playbook.`,
          sectionRef: result.clauseType,
          textRef: result.matchedText,
          playbookRef: result.playbookId,
          actionRequired: true,
          suggested: result.suggestedReplacement,
        });
      }
    }

    return findings;
  }

  private findMissingClauses(playbookComparison: PlaybookComparisonResult[]): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const foundTypes = new Set(playbookComparison.filter((r) => r.found).map((r) => r.clauseType));

    for (const requiredType of REQUIRED_CLAUSE_TYPES) {
      if (!foundTypes.has(requiredType)) {
        findings.push({
          id: randomUUID(),
          category: 'missing_clause',
          severity: 'high',
          title: `Missing clause: ${requiredType.replace(/_/g, ' ')}`,
          description: `The document does not appear to contain a ${requiredType.replace(/_/g, ' ')} clause, which is typically required for this type of agreement.`,
          actionRequired: true,
          suggested: `Insert a standard ${requiredType.replace(/_/g, ' ')} clause appropriate for the governing jurisdiction.`,
        });
      }
    }

    return findings;
  }

  private findRiskPatterns(structure: DocumentStructure): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const fullText = structure.rawText.toLowerCase();

    // Unlimited liability
    if (
      /unlimited\s+liability|no\s+cap\s+on\s+liability|not\s+limited\s+in\s+any\s+way/.test(
        fullText,
      )
    ) {
      findings.push({
        id: randomUUID(),
        category: 'liability',
        severity: 'critical',
        title: 'Unlimited liability exposure',
        description:
          'The document appears to contain language that exposes a party to unlimited liability.',
        actionRequired: true,
        suggested:
          'Insert a liability cap clause limiting total liability to the contract value or a specified amount.',
      });
    }

    // Broad indemnity
    if (/indemnify\s+and\s+hold\s+harmless.{0,100}any\s+and\s+all/.test(fullText)) {
      findings.push({
        id: randomUUID(),
        category: 'indemnities',
        severity: 'high',
        title: 'Broad indemnification language',
        description:
          'The indemnity clause uses expansive "any and all" language without adequate carve-outs.',
        actionRequired: true,
        suggested:
          'Limit indemnification to direct losses arising from gross negligence or wilful misconduct.',
      });
    }

    // Unilateral amendment
    if (/(?:may|can)\s+amend\s+(?:this\s+)?(?:agreement|contract|terms)\s+at\s+any\s+time/.test(fullText)) {
      findings.push({
        id: randomUUID(),
        category: 'risk',
        severity: 'high',
        title: 'Unilateral amendment right',
        description:
          'One party appears to have the unilateral right to amend the agreement without counter-party consent.',
        actionRequired: true,
        suggested:
          'Amendments should require written consent of both parties except in specified limited circumstances.',
      });
    }

    // Auto-renewal without notice
    if (/auto(?:matically)?\s+renew/.test(fullText) && !/notice\s+of\s+non-?renewal/.test(fullText)) {
      findings.push({
        id: randomUUID(),
        category: 'termination',
        severity: 'medium',
        title: 'Auto-renewal without notice provision',
        description:
          'The agreement appears to auto-renew but does not clearly specify a notice period to prevent renewal.',
        actionRequired: true,
        suggested: 'Insert a notice period (e.g. 30 days) required to prevent auto-renewal.',
      });
    }

    // Data protection
    if (
      /personal\s+data|personal\s+information|gdpr|pdpa|dpdp/.test(fullText) &&
      !/data\s+protection\s+(?:officer|clause|addendum|agreement)/.test(fullText)
    ) {
      findings.push({
        id: randomUUID(),
        category: 'data_protection',
        severity: 'high',
        title: 'Personal data referenced without data protection clause',
        description:
          'The agreement references personal data or personal information but does not appear to include a data protection or data processing clause.',
        actionRequired: true,
        suggested:
          'Include a data processing agreement or data protection addendum compliant with applicable regulations (GDPR/DPDP Act).',
      });
    }

    return findings;
  }

  private findJurisdictionIssues(structure: DocumentStructure): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const text = structure.rawText.toLowerCase();

    const hasGoverningLaw = /governing\s+law|governed\s+by\s+the\s+laws?\s+of/.test(text);
    const hasDispute = /dispute\s+resolution|arbitration|mediation|jurisdiction\s+of\s+(?:the\s+)?court/.test(text);

    if (!hasGoverningLaw) {
      findings.push({
        id: randomUUID(),
        category: 'jurisdiction',
        severity: 'high',
        title: 'No governing law clause',
        description:
          'The agreement does not specify which law governs the contract. This creates uncertainty about which jurisdiction\'s rules apply.',
        actionRequired: true,
        suggested:
          'Insert a governing law clause specifying the applicable jurisdiction (e.g. "This Agreement shall be governed by the laws of India").',
      });
    }

    if (!hasDispute) {
      findings.push({
        id: randomUUID(),
        category: 'jurisdiction',
        severity: 'medium',
        title: 'No dispute resolution mechanism',
        description:
          'The agreement does not specify how disputes will be resolved (arbitration, mediation, or court proceedings).',
        actionRequired: true,
        suggested:
          'Insert a dispute resolution clause specifying the preferred mechanism and seat of arbitration or court jurisdiction.',
      });
    }

    return findings;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private findTextRef(structure: DocumentStructure, ref?: string): string | undefined {
    if (!ref) return undefined;

    // Try section content first
    const section = structure.sections.find(
      (s) => s.title.toLowerCase().includes(ref.toLowerCase()),
    );
    if (section) {
      return section.content.slice(0, 300);
    }

    // Try raw text search for the ref phrase
    const idx = structure.rawText.toLowerCase().indexOf(ref.toLowerCase());
    if (idx >= 0) {
      return structure.rawText.slice(idx, idx + 300).trim();
    }

    return undefined;
  }

  private buildAnchorText(text: string): string {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 8) return trimmed.slice(0, 120);
    return words.slice(0, 8).join(' ');
  }
}
