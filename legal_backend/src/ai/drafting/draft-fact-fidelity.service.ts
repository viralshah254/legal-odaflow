import { Injectable } from '@nestjs/common';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';

export interface FactFidelityInput {
  draft: string;
  caseDetails: string;
  kind?: string;
}

export interface StructuredIntake {
  parties: string[];
  ages: string[];
  conductVerbs: string[];
  dates: string[];
  channels: string[];
  locations: string[];
  tokenEstimate: number;
  thinFacts: boolean;
}

const VERIFIER = 'draft-fact-fidelity-v1';
const THIN_FACT_TOKEN_THRESHOLD = 80;

const INVENTION_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  { id: 'cctv', pattern: /\bCCTV\b|\bsurveillance\s+camera/i, label: 'CCTV/surveillance' },
  {
    id: 'messages',
    pattern: /\b(?:WhatsApp|Instagram|Facebook|SMS|text\s+messages?|phone\s+calls?)\b/i,
    label: 'phone/social-media channel',
  },
  {
    id: 'witness',
    pattern: /\b(?:eyewitness|eye\s+witness|neighbour\s+witness|independent\s+witness)\b/i,
    label: 'witness detail',
  },
  {
    id: 'injury',
    pattern: /\b(?:grievous\s+hurt|fracture|bleeding|hospitalis|hospitaliz|medical\s+report)\b/i,
    label: 'injury/medical claim',
  },
  {
    id: 'mental',
    pattern: /\b(?:severe\s+anguish|grave\s+danger|mental\s+trauma|psychiatric)\b/i,
    label: 'mental-health / anguish claim',
  },
  {
    id: 'loitering',
    pattern: /\b(?:loiter(?:ing)?|spying|peeping)\b/i,
    label: 'specific conduct (loitering/spying)',
  },
  {
    id: 'repeated_contact',
    pattern: /\brepeated(?:ly)?\s+(?:contact|call|message|visit)/i,
    label: 'repeated contact detail',
  },
];

@Injectable()
export class DraftFactFidelityService {
  extractIntake(caseDetails: string): StructuredIntake {
    const text = caseDetails ?? '';
    const parties = [
      ...text.matchAll(/\b(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+[A-Z][a-zA-Z.]+/g),
    ].map((m) => m[0]);
    const ages = [...text.matchAll(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\.?|yo)\b/gi)].map(
      (m) => m[0],
    );
    const dates = [
      ...text.matchAll(
        /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
      ),
    ].map((m) => m[0]);
    const channels = [
      ...text.matchAll(
        /\b(?:WhatsApp|Instagram|Facebook|SMS|email|phone|call|message|social media)\b/gi,
      ),
    ].map((m) => m[0]);
    const locations = [
      ...text.matchAll(/\b(?:at|in|near)\s+[A-Z][a-zA-Z\s]{2,40}/g),
    ].map((m) => m[0]);
    const conductVerbs = [
      ...text.matchAll(
        /\b(?:stalk(?:ing|s|ed)?|assault(?:ed|ing)?|threat(?:en|ened|s)?|harass(?:ed|ing)?|stole|theft|cheat(?:ed|ing)?|follow(?:ed|ing)?)\b/gi,
      ),
    ].map((m) => m[0]);

    const tokenEstimate = Math.ceil(text.trim().split(/\s+/).filter(Boolean).length);
    return {
      parties,
      ages,
      conductVerbs,
      dates,
      channels,
      locations,
      tokenEstimate,
      thinFacts: tokenEstimate > 0 && tokenEstimate < THIN_FACT_TOKEN_THRESHOLD && dates.length === 0,
    };
  }

  evaluate(input: FactFidelityInput): VerificationFinding[] {
    const intake = this.extractIntake(input.caseDetails);
    const findings: VerificationFinding[] = [];
    const intakeLower = input.caseDetails.toLowerCase();

    for (const rule of INVENTION_PATTERNS) {
      if (rule.pattern.test(input.draft) && !rule.pattern.test(input.caseDetails)) {
        findings.push({
          checkId: `fact_fidelity:invented:${rule.id}`,
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'application',
          evidenceIds: [],
          explanation: `Draft invents ${rule.label} not present in intake facts — remove or mark [BLANK].`,
          repairAction: 'REMOVE',
          verifierVersion: VERIFIER,
        });
      }
    }

    // Invented proper nouns (simple heuristic): capitalized multi-word names in draft not in intake
    const draftNames = [
      ...input.draft.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g),
    ]
      .map((m) => m[1])
      .filter(
        (n) =>
          !/^(The|This|That|Hon|Court|State|India|Police|Station|Section|Article|Blank|Applicant|Petitioner|Respondent|Complainant|Accused)$/i.test(
            n,
          ),
      );
    for (const name of draftNames.slice(0, 12)) {
      if (!intakeLower.includes(name.toLowerCase()) && !/\[BLANK/i.test(name)) {
        // Only flag if intake is thin — avoid false positives on statute names
        if (intake.thinFacts && !/\b(?:Act|Code|Sanhita|Constitution)\b/i.test(name)) {
          findings.push({
            checkId: `fact_fidelity:invented_name:${name}`,
            state: 'FAIL',
            severity: 'HIGH',
            dimension: 'application',
            evidenceIds: [],
            explanation: `Proper name "${name}" appears in draft but not in intake — verify or replace with [BLANK].`,
            repairAction: 'QUALIFY',
            verifierVersion: VERIFIER,
          });
        }
      }
    }

    if (intake.thinFacts) {
      const wordCount = input.draft.trim().split(/\s+/).length;
      if (wordCount > 900) {
        findings.push({
          checkId: 'fact_fidelity:thin_fact_bloat',
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'application',
          evidenceIds: [],
          explanation:
            'Intake facts are sparse but draft is padded with narrative — use [BLANK] placeholders and keep the draft short.',
          repairAction: 'NARROW',
          verifierVersion: VERIFIER,
        });
      }
      if (intake.dates.length === 0 && !/\[BLANK:\s*(?:date|time|incident)/i.test(input.draft)) {
        findings.push({
          checkId: 'fact_fidelity:missing_date_blank',
          state: 'FAIL',
          severity: 'HIGH',
          dimension: 'application',
          evidenceIds: [],
          explanation:
            'No incident date in intake — draft must include [BLANK: date/time of incident] rather than inventing dates.',
          repairAction: 'QUALIFY',
          verifierVersion: VERIFIER,
        });
      }
    }

    return findings;
  }

  /** Prompt block for thin-fact / blank mode. */
  buildPromptBlock(caseDetails: string): string {
    const intake = this.extractIntake(caseDetails);
    if (!intake.thinFacts) {
      return [
        'FACT FIDELITY: Use only material facts from the case details. Do not invent evidence, witnesses, channels, injuries, or dates.',
      ].join('\n');
    }
    return [
      'THIN-FACT MODE (mandatory):',
      '- Intake is sparse. Cap the draft length; do not pad with narrative.',
      '- For every missing incident particular use [BLANK: description] (date/time, location, specific acts, evidence).',
      '- Do NOT invent CCTV, messages, witnesses, injuries, mental anguish, or repeated-contact details.',
      '- State only the facts explicitly provided by the user.',
    ].join('\n');
  }
}
