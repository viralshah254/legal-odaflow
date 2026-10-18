import { Injectable } from '@nestjs/common';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

/** Minimal CPA 2019 allowlist for consumer drafting (not exhaustive India Code). */
const CPA_2019_ALLOWED: Record<string, string> = {
  '2(6)': 'complaint',
  '2(7)': 'consumer',
  '2(8)': 'consumer dispute',
  '2(11)': 'defect',
  '2(16)': 'deficiency',
  '2(42)': 'service',
  '2(47)': 'unfair trade practice',
  '34': 'jurisdiction of District Commission',
  '35': 'manner of filing complaint',
  '38': 'procedure on admission',
  '39': 'finding of District Commission',
  '47': 'jurisdiction of State Commission',
  '49': 'manner of filing appeal to State',
  '51': 'jurisdiction of National Commission',
  '58': 'procedure of National Commission',
  '69': 'limitation period',
};

/** Known wrong mappings seen in bad drafts. */
const KNOWN_WRONG_CPA: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern:
      /section\s*2\s*\(\s*1\s*\)\s*\(\s*h\s*\).{0,80}(jurisdiction|district\s+commission)/i,
    message:
      'CPA §2(1)(h) is not a valid CPA 2019 jurisdiction provision (likely confused with CPA 1986).',
  },
  {
    pattern:
      /section\s*2\s*\(\s*1\s*\)\s*\(\s*[cd]\s*\).{0,100}(jurisdiction|pecuniary|territorial|district\s+commission)/i,
    message:
      'CPA §2(1)(c)/(d) is not a valid CPA 2019 jurisdiction provision (CPA 1986 confusion).',
  },
  {
    pattern:
      /section\s*2\s*\(\s*18\s*\).{0,80}(deficiency|consumer\s+protection)/i,
    message:
      'CPA §2(18) is not the CPA 2019 definition of deficiency (use §2(16) under CPA 2019).',
  },
  {
    pattern:
      /district\s+consumer.{0,120}(exceeds\s+₹?\s*1\s*crore|1\s*crore.{0,40}10\s*crore)/i,
    message:
      'Draft states incorrect pecuniary band for District Consumer Commission (do not invent ₹1–10 crore District limits).',
  },
  {
    pattern:
      /pecuniary.{0,80}(exceeds\s+₹?\s*1\s*crore|1\s*crore.{0,30}10\s*crore).{0,40}district/i,
    message:
      'Pecuniary jurisdiction narrative uses unsupported District Commission ₹1–10 crore band.',
  },
];

function isAllowedCpaSection(key: string): boolean {
  const normalized = key.replace(/\s+/g, '');
  if (CPA_2019_ALLOWED[normalized]) return true;
  // Exact subsection match only — do NOT use startsWith('2') which accepts any 2(...)
  return Object.keys(CPA_2019_ALLOWED).some(
    (k) => normalized === k || (normalized.startsWith(k) && k.includes('(')),
  );
}

@Injectable()
export class StatuteSectionValidatorService {
  readonly version = 'statute-section-v2';

  evaluate(input: {
    draftText: string;
    documentKind?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { draftText, documentKind } = input;

    for (const wrong of KNOWN_WRONG_CPA) {
      if (wrong.pattern.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message: wrong.message,
          repairHint: 'Use CPA 2019 §§34/47/51 (forum) and §35 (complaint) as applicable; deficiency is §2(16).',
        });
      }
    }

    if (
      /consumer\s+protection\s+act,?\s*1986/i.test(draftText) &&
      !/repeal|transition|replaced\s+by|2019/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.STALE_STATUTE,
        severity: 'blocker',
        message: 'Draft cites Consumer Protection Act, 1986 without transition to CPA 2019.',
        repairHint: 'Cite CPA 2019 provisions.',
      });
    }

    // Bare "Section 2(1)(x)" near Consumer Act / jurisdiction without allowlisted cite
    const bareWrong = [
      ...draftText.matchAll(
        /(?:under|pursuant\s+to|as\s+prescribed\s+under)\s+Section\s*2\s*\(\s*1\s*\)\s*\(\s*[a-z]\s*\)/gi,
      ),
    ];
    for (const m of bareWrong) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
        severity: 'blocker',
        message: `Unverified CPA-style citation resembling repealed 1986 form: ${m[0]}`,
        repairHint: 'Use CPA 2019 §§34/47/51 for forum jurisdiction.',
      });
    }

    // Bare §2(1)(*) / §2(18) without CPA 2019 context
    const bare218Patterns = [
      /\bSection\s*2\s*\(\s*18\s*\)/gi,
      /\b§\s*2\s*\(\s*18\s*\)/gi,
      /\bSection\s*2\s*\(\s*1\s*\)\s*\(\s*d\s*\)/gi,
    ];
    for (const re of bare218Patterns) {
      if (re.test(draftText) && !/Consumer Protection Act,?\s*2019|CPA\s*2019/i.test(draftText.slice(0, 500))) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message: 'Bare CPA §2(1)(d) or §2(18) citation — repealed CPA 1986 form.',
          repairHint: 'Use CPA 2019 §2(16) for deficiency; §34 for District forum jurisdiction.',
        });
        break;
      }
    }

    // Semantic role misuse: §2(16) cited for jurisdiction/forum (not deficiency)
    const s216MisusePatterns = [
      /(?:jurisdiction|forum|pecuniary|territorial|maintainability).{0,60}(?:§|section|sec\.?)\s*2\s*\(\s*16\s*\)/i,
      /(?:§|section|sec\.?)\s*2\s*\(\s*16\s*\).{0,40}(?:pecuniary|territorial)\s+jurisdiction/i,
      /pecuniary\s+jurisdiction.{0,40}(?:§|section|sec\.?)\s*2\s*\(\s*16\s*\)/i,
    ];
    for (const re of s216MisusePatterns) {
      if (re.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message: 'CPA §2(16) (deficiency definition) misapplied in jurisdiction/forum context.',
          repairHint: 'Use §2(16) only for deficiency definition; forum jurisdiction is §34/§47/§51.',
        });
        break;
      }
    }

    // Semantic role misuse: §34 used to define deficiency/service (not forum jurisdiction)
    const s34MisusePatterns = [
      /(?:deficien(?:cy)?|deficient\s+service|meaning\s+of\s+service).{0,60}(?:§|section|sec\.?)\s*34\b/i,
      /(?:§|section|sec\.?)\s*34\b.{0,60}(?:deficien(?:cy)?|deficient\s+service|meaning\s+of\s+service)/i,
      /defined\s+under\s+(?:§|section|sec\.?)\s*34\b/i,
    ];
    for (const re of s34MisusePatterns) {
      if (re.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message: 'CPA §34 (District forum jurisdiction) misapplied to define deficiency or service.',
          repairHint: 'Use §2(16) for deficiency; §34 only for District Commission jurisdiction.',
        });
        break;
      }
    }

    const cpaSectionMentions = [
      ...draftText.matchAll(
        /(?:CPA|Consumer Protection Act(?:,?\s*2019)?)\s*(?:§|section|sec\.?)\s*([0-9]+(?:\s*\([^)]+\))*)/gi,
      ),
    ];
    for (const m of cpaSectionMentions) {
      const key = m[1].replace(/\s+/g, '');
      if (!isAllowedCpaSection(key)) {
        // Block invented 2(1)(*) and unknown subsections; warn on other unknowns
        const severity = /2\(1\)|2\(18\)/.test(key) ? 'blocker' : 'warning';
        findings.push({
          code:
            severity === 'blocker'
              ? ACCURACY_BLOCKER_CODES.WRONG_SUBSECTION
              : ACCURACY_BLOCKER_CODES.UNVERIFIED_STATUTORY_PROPOSITION,
          severity,
          message: `Unverified or incorrect CPA section citation: ${m[0]}`,
          repairHint: 'Verify against CPA 2019 section list (§§2(6)/2(7)/2(16)/2(42)/34/35/47/51/69).',
        });
      }
    }

    if (/consumer/i.test(documentKind ?? '') && /code\s+of\s+civil\s+procedure|cpc\s+§/i.test(draftText)) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.STATUTE_NOT_RELEVANT,
        severity: 'warning',
        message: 'Consumer complaint draft cites CPC as primary procedural statute.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
