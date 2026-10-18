import { Injectable } from '@nestjs/common';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import type { DraftCaseBrief } from './draft-case-brief.types';

const VERIFIER = 'draft-procedural-timeline-v1';

export interface ProceduralTimelineInput {
  draft: string;
  caseDetails: string;
  kind?: string;
  brief?: DraftCaseBrief;
}

function normalizeDateToken(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

@Injectable()
export class DraftProceduralTimelineValidator {
  evaluate(input: ProceduralTimelineInput): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    const draft = input.draft ?? '';
    const brief = input.brief;
    const isBail = /bail/i.test(input.kind ?? '') || /bail/i.test(input.caseDetails ?? '');

    if (brief?.proceduralHistory.firDate) {
      const fir = normalizeDateToken(brief.proceduralHistory.firDate);
      // Common wrong date pattern from Rohan critique (19 Feb when brief says 17 Feb)
      const wrongFirMentions = [
        ...draft.matchAll(/\bFIR\b[^.\n]{0,60}?(\d{1,2}\s+\w+\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi),
      ];
      for (const m of wrongFirMentions) {
        const mentioned = normalizeDateToken(m[1]);
        if (mentioned && fir && mentioned !== fir && !fir.includes(mentioned) && !mentioned.includes(fir.split(' ')[0])) {
          // Only flag when digits clearly diverge (e.g. 17 vs 19)
          const briefDay = fir.match(/\d{1,2}/)?.[0];
          const draftDay = mentioned.match(/\d{1,2}/)?.[0];
          if (briefDay && draftDay && briefDay !== draftDay) {
            findings.push({
              checkId: 'procedural_timeline:fir_date_mismatch',
              state: 'FAIL',
              severity: 'BLOCKER',
              dimension: 'application',
              evidenceIds: [],
              explanation: `FIR date in draft (${m[1]}) does not match Case Brief (${brief.proceduralHistory.firDate}).`,
              repairAction: 'RECITE',
              verifierVersion: VERIFIER,
            });
            break;
          }
        }
      }
    }

    if (
      brief?.proceduralStage === 'post_chargesheet' ||
      /\bchargesheet\s+(?:filed|submitted)\b/i.test(input.caseDetails ?? '')
    ) {
      if (/\binvestigation\s+(?:is\s+)?(?:still\s+)?ongoing\b|\binvestigation\s+pending\b/i.test(draft)) {
        findings.push({
          checkId: 'procedural_timeline:investigation_ongoing_post_chargesheet',
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'application',
          evidenceIds: [],
          explanation:
            'Draft says investigation is ongoing/pending but Case Brief indicates chargesheet has been filed.',
          repairAction: 'RECITE',
          verifierVersion: VERIFIER,
        });
      }
    }

    // Section 173 vs 193 misuse for chargesheet
    if (
      /\bchargesheet\b|\bcharge[\s-]?sheet\b|\bpolice\s+report\b/i.test(draft) &&
      /\b(?:under|u\/s|section)\s*173\b/i.test(draft) &&
      !/\bFIR\b.{0,40}(?:section|u\/s)\s*173|\b173\b.{0,40}(?:FIR|information\s+in\s+cognizable)/i.test(draft)
    ) {
      findings.push({
        checkId: 'procedural_timeline:section_173_for_chargesheet',
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'currentLaw',
        evidenceIds: [],
        explanation:
          'Chargesheet / police report after investigation should cite BNSS §193 (not §173). Section 173 BNSS is for FIR / information in cognizable cases.',
        repairAction: 'RECITE',
        verifierVersion: VERIFIER,
      });
    }

    if (isBail && /\bPetitioner\b/i.test(draft) && !/\bApplicant[-–]?Accused\b/i.test(draft)) {
      findings.push({
        checkId: 'procedural_timeline:petitioner_label_in_bail',
        state: 'FAIL',
        severity: 'HIGH',
        dimension: 'application',
        evidenceIds: [],
        explanation: 'Criminal bail applications should use Applicant–Accused, not Petitioner.',
        repairAction: 'RECITE',
        verifierVersion: VERIFIER,
      });
    }

    const weakPhrases: Array<{ id: string; re: RegExp; label: string }> = [
      { id: 'benefit_of_doubt', re: /\bbenefit\s+of\s+(?:the\s+)?doubt\b/i, label: 'benefit of doubt' },
      { id: 'person_of_means', re: /\bperson\s+of\s+means\b|\breputable\s+family\b/i, label: 'class-based / person of means' },
      {
        id: 'acknowledges_serious',
        re: /\backnowledge[sd]?\s+(?:the\s+)?serious\s+nature\b/i,
        label: 'acknowledges serious nature',
      },
    ];
    for (const wp of weakPhrases) {
      if (wp.re.test(draft)) {
        findings.push({
          checkId: `procedural_timeline:weak_phrase:${wp.id}`,
          state: 'FAIL',
          severity: 'HIGH',
          dimension: 'application',
          evidenceIds: [],
          explanation: `Weak / non-court-ready phrase detected: ${wp.label}.`,
          repairAction: 'REMOVE',
          verifierVersion: VERIFIER,
        });
      }
    }

    return findings;
  }
}
