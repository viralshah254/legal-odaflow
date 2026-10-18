import { isHeadingOnlySection } from '@/legal-sources/parsers/india-act-text.parser';

export type CitationAuthorityKind = 'case' | 'statute' | 'regulation';
export type CitationContractDimension =
  | 'partyName'
  | 'court'
  | 'judgmentDate'
  | 'citation'
  | 'pinpoint'
  | 'proposition'
  | 'act'
  | 'section'
  | 'heading'
  | 'operativeText'
  | 'regulator'
  | 'instrument';

export interface CitationContractCheck {
  dimension: CitationContractDimension;
  passed: boolean;
  reason?: string;
}

export interface CitationContractInput {
  kind: CitationAuthorityKind;
  title?: string | null;
  court?: string | null;
  judgmentDate?: string | Date | null;
  citation?: string | null;
  neutralCitation?: string | null;
  pinpoint?: string | null;
  quotedPassage?: string | null;
  quotedPassageVerified?: boolean;
  proposition?: string | null;
  actName?: string | null;
  actYear?: number | string | null;
  section?: string | null;
  heading?: string | null;
  operativeText?: string | null;
  regulator?: string | null;
  instrumentType?: string | null;
  instrumentNumber?: string | null;
  instrumentDate?: string | Date | null;
}

export interface CitationContractResult {
  kind: CitationAuthorityKind;
  passed: boolean;
  checks: CitationContractCheck[];
  missingReasons: string[];
}

export function hasPartyStyleCaseName(title: string | null | undefined): boolean {
  if (!title?.trim()) return false;
  const match = title.trim().match(/^(.+?)\s+(?:v(?:s\.?|ersus)?\.?)\s+(.+)$/i);
  return Boolean(match?.[1]?.trim() && match?.[2]?.trim());
}

export function hasFullDate(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const text = value?.trim();
  if (!text || /^\d{4}$/.test(text)) return false;
  if (!/\b\d{1,2}\b/.test(text) || !/\b(?:19|20)\d{2}\b/.test(text)) return false;
  return !Number.isNaN(Date.parse(text));
}

function present(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function check(
  dimension: CitationContractDimension,
  passed: boolean,
  reason: string,
): CitationContractCheck {
  return passed ? { dimension, passed: true } : { dimension, passed: false, reason };
}

export function validateCitationContract(input: CitationContractInput): CitationContractResult {
  const propositionCheck = check(
    'proposition',
    present(input.proposition),
    'A proposition tied to the authority is required.',
  );
  let checks: CitationContractCheck[];

  if (input.kind === 'case') {
    checks = [
      check('partyName', hasPartyStyleCaseName(input.title), 'Case title must identify both parties.'),
      check('court', present(input.court), 'Court metadata is required.'),
      check(
        'judgmentDate',
        hasFullDate(input.judgmentDate),
        'A full judgment date is required; a year alone is insufficient.',
      ),
      check(
        'citation',
        present(input.citation) || present(input.neutralCitation),
        'A reporter citation or neutral citation is required.',
      ),
      check(
        'pinpoint',
        present(input.pinpoint) ||
          (present(input.quotedPassage) && input.quotedPassageVerified === true),
        'A pinpoint paragraph or a verified quoted passage is required.',
      ),
      propositionCheck,
    ];
  } else if (input.kind === 'statute') {
    const operativeText = input.operativeText?.trim() ?? '';
    const headingOnly =
      operativeText.length > 0 &&
      isHeadingOnlySection({
        section: input.section?.trim() || 'unknown',
        title: input.heading?.trim() || '',
        fullText: operativeText,
      });
    checks = [
      check(
        'act',
        present(input.actName) && present(input.actYear),
        'Act name and enactment year are required.',
      ),
      check('section', present(input.section), 'A section identifier is required.'),
      check('heading', present(input.heading), 'The section heading is required.'),
      check(
        'operativeText',
        operativeText.length > 0 && !headingOnly,
        headingOnly
          ? 'The retrieved section contains only a heading and no substantive operative text.'
          : 'Substantive operative section text is required.',
      ),
      propositionCheck,
    ];
  } else {
    checks = [
      check('regulator', present(input.regulator), 'The issuing regulator is required.'),
      check(
        'instrument',
        present(input.instrumentType) &&
          present(input.instrumentNumber) &&
          hasFullDate(input.instrumentDate),
        'Instrument type, number, and full date are required.',
      ),
      check('pinpoint', present(input.pinpoint), 'A regulation paragraph or pinpoint is required.'),
      propositionCheck,
    ];
  }

  const missingReasons = checks.flatMap((item) =>
    item.passed || !item.reason ? [] : [item.reason],
  );
  return { kind: input.kind, passed: missingReasons.length === 0, checks, missingReasons };
}
