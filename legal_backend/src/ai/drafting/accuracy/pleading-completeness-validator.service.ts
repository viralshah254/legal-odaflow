import { Injectable } from '@nestjs/common';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

const MIN_SECTION_WORDS = 40;

const STUB_PATTERNS: RegExp[] = [
  /\bfor\s+specific\s+risks\s+is\s+blank\b/i,
  /\bis\s+blank\b/i,
  /^\[BLANK(?::[^\]]*)?\]$/i,
  /\bto\s+be\s+(?:filled|inserted|completed)\b/i,
  /\bTODO\b/,
  /\bTBD\b/,
];

/** Headings that must have substantive body for filing-grade consumer/civil drafts. */
const SUBSTANTIVE_SECTIONS = [
  'FACTS',
  'STATEMENT OF FACTS',
  'GROUNDS',
  'PRAYER',
  'JURISDICTION',
];

const MEMO_SUBSTANTIVE_SECTIONS = [
  'SHORT ANSWER',
  'ISSUES',
  'FACTS',
  'ANALYSIS',
  'AUTHORITIES',
];

export interface DraftSectionSlice {
  title: string;
  body: string;
  start: number;
  end: number;
}

/**
 * Split markdown/plain draft into heading + body slices.
 * Recognizes `#`, `##`, and ALL-CAPS lines used as section headers.
 */
export function splitDraftSections(draftText: string): DraftSectionSlice[] {
  const lines = draftText.split(/\n/);
  const headingIdx: Array<{ line: number; title: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const md = raw.match(/^#{1,3}\s+(.+)$/);
    if (md) {
      headingIdx.push({ line: i, title: md[1].replace(/\*+/g, '').trim() });
      continue;
    }
    // ALL-CAPS header (min 4 letters), optional surrounding **
    const plain = raw.replace(/\*+/g, '').trim();
    if (
      plain.length >= 4 &&
      plain.length <= 80 &&
      /^[A-Z0-9][A-Z0-9\s/&,:.\-()]+$/.test(plain) &&
      /[A-Z]{3,}/.test(plain)
    ) {
      headingIdx.push({ line: i, title: plain });
    }
  }

  if (headingIdx.length === 0) {
    return [{ title: '', body: draftText.trim(), start: 0, end: draftText.length }];
  }

  const slices: DraftSectionSlice[] = [];
  let charPos = 0;
  const lineStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(charPos);
    charPos += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }

  for (let h = 0; h < headingIdx.length; h++) {
    const startLine = headingIdx[h].line;
    const endLine =
      h + 1 < headingIdx.length ? headingIdx[h + 1].line : lines.length;
    const bodyLines = lines.slice(startLine + 1, endLine);
    const body = bodyLines.join('\n').trim();
    const start = lineStarts[startLine] ?? 0;
    const end =
      endLine < lines.length
        ? (lineStarts[endLine] ?? draftText.length)
        : draftText.length;
    slices.push({
      title: headingIdx[h].title,
      body,
      start,
      end,
    });
  }
  return slices;
}

export function wordCount(text: string): number {
  return text
    .replace(/[#*_`>-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function matchesStubPattern(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;
  if (STUB_PATTERNS.some((re) => re.test(trimmed))) return true;
  // Lone party / single short line (e.g. "Riya Desai")
  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && wordCount(lines[0]) <= 4 && !/[.!?]$/.test(lines[0])) {
    return true;
  }
  return false;
}

function sectionMatchesRequired(title: string, required: string): boolean {
  const t = title.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const r = required.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  if (t.includes(r) || r.includes(t)) return true;
  // FACTS ↔ STATEMENT OF FACTS
  if (r === 'FACTS' && /\bFACTS\b/.test(t)) return true;
  if (r === 'GROUNDS' && /\bGROUNDS\b/.test(t)) return true;
  return false;
}

@Injectable()
export class PleadingCompletenessValidatorService {
  readonly version = 'pleading-completeness-v2';

  evaluate(input: {
    draftText: string;
    requiredSections?: string[];
    documentKind?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const text = input.draftText;
    const isResearchMemo = /research_memo|case_strategy|legal_research/i.test(
      input.documentKind ?? '',
    );
    const required =
      input.requiredSections ??
      (isResearchMemo
        ? ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS']
        : /consumer/i.test(input.documentKind ?? '')
          ? ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION']
          : ['FACTS', 'PRAYER']);

    for (const section of required) {
      const re = new RegExp(section.replace(/\s+/g, '\\s+'), 'i');
      if (!re.test(text)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION,
          severity: section === 'VERIFICATION' ? 'warning' : 'blocker',
          message: `Required section "${section}" not found in draft.`,
          sectionHint: section,
          repairHint: 'Regenerate the missing section from the CaseRecord and playbook.',
        });
      }
    }

    if (/consumer|complaint|plaint|petition/i.test(input.documentKind ?? '') && !isResearchMemo) {
      if (!/\bverif(y|ication)\b/i.test(text)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.MISSING_VERIFICATION,
          severity: 'warning',
          message: 'Filing-grade draft appears to omit verification.',
        });
      }
    }

    // Hollow / stub section bodies
    const slices = splitDraftSections(text);
    const checkTitles = isResearchMemo
      ? [...MEMO_SUBSTANTIVE_SECTIONS, ...required]
      : [
          ...SUBSTANTIVE_SECTIONS,
          ...required.filter((r) => /facts|grounds|prayer|jurisdiction/i.test(r)),
        ];

    for (const slice of slices) {
      if (!slice.title) continue;
      const isSubstantive = checkTitles.some((t) => sectionMatchesRequired(slice.title, t));
      if (!isSubstantive) continue;

      const words = wordCount(slice.body);
      const stub = matchesStubPattern(slice.body);
      const tooShort = words < MIN_SECTION_WORDS;

      if (stub || tooShort) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
          severity: 'blocker',
          message: `Section "${slice.title}" is empty, stub, or too short (${words} words).`,
          sectionHint: slice.title,
          repairHint:
            'Regenerate this section from the confirmed CaseRecord chronology, facts, and parties. Do not leave template placeholders.',
          metadata: { wordCount: words, stub },
        });
      }

      if (/\[BLANK/i.test(slice.body)) {
        const blankInSubstantive = isResearchMemo
          ? /facts|analysis|short answer|issues/i.test(slice.title)
          : /facts|grounds/i.test(slice.title);
        if (blankInSubstantive) {
          findings.push({
            code: ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
            severity: 'blocker',
            message: `Section "${slice.title}" still contains [BLANK] placeholders in substantive content.`,
            sectionHint: slice.title,
            repairHint: 'Fill blanks from CaseRecord or regenerate the section.',
          });
        }
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}
