/**
 * Stage 7 — Evidence Validation
 *
 * For every planned argument (issue) in the document, classifies the available
 * evidence as: supplied / missing / weak / contradictory.
 *
 * Key principle: if evidence is missing, the generator is instructed to
 * write "The client has not yet supplied evidence supporting [X]" — never
 * to invent facts.
 */

import { Injectable } from '@nestjs/common';
import type { EvidenceRef } from '@/ai/matter-intelligence/matter-intelligence.types';
import type {
  LegalPlan,
  DocumentOutline,
  SectionPlan,
  EvidenceValidationReport,
  SectionEvidenceValidation,
  EvidenceAssessment,
  EvidenceStatus,
} from './drafting-v2.types';

/** Keywords that suggest weak or unreliable evidence. */
const WEAK_EVIDENCE_SIGNALS = /photocopy|unclear|partial|unsigned|disputed|alleged|purported/i;
const CONTRADICTION_SIGNALS = /contradict|inconsistent|conflict|dispute|deny/i;

@Injectable()
export class EvidenceValidationService {
  /**
   * Validate available evidence against the planned document requirements.
   * Returns per-section guidance for the generator.
   */
  validate(
    plan: LegalPlan,
    outline: DocumentOutline,
    suppliedEvidence: EvidenceRef[],
  ): EvidenceValidationReport {
    const sectionValidations: SectionEvidenceValidation[] = [];

    for (const section of outline.sections) {
      if (!section.requiredEvidence || section.requiredEvidence.length === 0) continue;
      if (['heading', 'parties', 'prayer', 'verification', 'annexures'].includes(section.type)) continue;

      const issueId = section.issueIds[0]; // primary issue for this section
      const validation = this.validateSection(section, suppliedEvidence, issueId);
      sectionValidations.push(validation);
    }

    const overallStatus = this.computeOverallStatus(sectionValidations);

    return {
      sections: sectionValidations,
      overallStatus,
    };
  }

  private validateSection(
    section: SectionPlan,
    supplied: EvidenceRef[],
    issueId?: string,
  ): SectionEvidenceValidation {
    const assessments: EvidenceAssessment[] = section.requiredEvidence.map((evDesc) => {
      const match = this.findMatchingEvidence(evDesc, supplied);
      const status = this.assessStatus(evDesc, match);
      return {
        evidenceRef: match ?? {
          id: undefined,
          description: evDesc,
          sourceType: 'required',
        },
        status,
        statusReason: this.statusReason(status, evDesc, match),
        requiredForIssueId: issueId ?? 'unknown',
      };
    });

    const supplied_count = assessments.filter((a) => a.status === 'supplied').length;
    const missingCount = assessments.filter((a) => a.status === 'missing').length;
    const weakCount = assessments.filter((a) => a.status === 'weak').length;
    const contradictoryCount = assessments.filter((a) => a.status === 'contradictory').length;
    const missingDescriptions = assessments
      .filter((a) => a.status === 'missing' || a.status === 'weak')
      .map((a) => a.evidenceRef.description);

    return {
      sectionId: section.id,
      issueId,
      assessments,
      suppliedCount: supplied_count,
      missingCount,
      weakCount,
      contradictoryCount,
      missingDescriptions,
      generatorInstruction: this.buildGeneratorInstruction(missingDescriptions, contradictoryCount > 0),
    };
  }

  private findMatchingEvidence(
    required: string,
    supplied: EvidenceRef[],
  ): EvidenceRef | undefined {
    const reqLower = required.toLowerCase();
    return supplied.find((e) => {
      const descLower = e.description.toLowerCase();
      // Match on key nouns
      const reqWords = reqLower.split(/\s+/).filter((w) => w.length > 4);
      return reqWords.some((w) => descLower.includes(w));
    });
  }

  private assessStatus(required: string, match?: EvidenceRef): EvidenceStatus {
    if (!match) return 'missing';
    if (CONTRADICTION_SIGNALS.test(match.description)) return 'contradictory';
    if (WEAK_EVIDENCE_SIGNALS.test(match.description)) return 'weak';
    return 'supplied';
  }

  private statusReason(status: EvidenceStatus, required: string, match?: EvidenceRef): string {
    switch (status) {
      case 'supplied':
        return `Supplied: "${match?.description ?? required}"`;
      case 'missing':
        return `Not found in supplied documents: "${required}"`;
      case 'weak':
        return `Evidence found but may be insufficient: "${match?.description ?? required}"`;
      case 'contradictory':
        return `Evidence may contradict the pleaded facts: "${match?.description ?? required}"`;
    }
  }

  private buildGeneratorInstruction(
    missingDescriptions: string[],
    hasContradictions: boolean,
  ): string {
    const parts: string[] = [];

    if (missingDescriptions.length > 0) {
      parts.push(
        `For the following missing evidence items, write: "The [Petitioner/Client] has not yet supplied evidence supporting [description]" — do NOT invent facts:`,
      );
      for (const d of missingDescriptions) {
        parts.push(`  • ${d}`);
      }
    }

    if (hasContradictions) {
      parts.push(
        'Some evidence may be internally contradictory — present the facts as stated and note any discrepancy rather than resolving it.',
      );
    }

    return parts.join('\n');
  }

  private computeOverallStatus(
    validations: SectionEvidenceValidation[],
  ): EvidenceValidationReport['overallStatus'] {
    const totalMissing = validations.reduce((s, v) => s + v.missingCount, 0);
    const totalRequired = validations.reduce(
      (s, v) => s + v.assessments.length,
      0,
    );
    if (totalRequired === 0) return 'complete';
    const missingRate = totalMissing / totalRequired;
    if (missingRate < 0.2) return 'complete';
    if (missingRate < 0.6) return 'partial';
    return 'insufficient';
  }
}
