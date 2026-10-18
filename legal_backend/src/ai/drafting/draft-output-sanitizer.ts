import { normalizeIndiaDraftStatutes } from '@/ai/india-draft/india-draft-statute-normalizer';
import { stripAuditFooters } from './draft-legal-blocklist';

export interface DraftOutputSanitizeResult {
  text: string;
  removedSections: string[];
}

const PASS_ARTEFACT_PATTERNS: RegExp[] = [
  /^#\s*PASS\s+\d+[^\n]*$/gim,
  /^##\s*PASS\s+\d+[^\n]*$/gim,
  /\*\*END OF PASS \d+[^\n]*\*\*/gi,
  /^END OF PASS \d+[^\n]*$/gim,
  /^---+\s*$/gm,
  /^\*\*Case Law Status:\*\*[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}|$)/gim,
  /^\*\*Factual Blanks:\*\*[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}|$)/gim,
  /^\*\*Drafting Compliance:\*\*[\s\S]*?(?=\n#{1,2}\s|\n[A-Z]{3,}|$)/gim,
  /^\*\*Section \d+\.\*\*[\s\S]*?(?=\n#{1,2}\s|$)/gim,
];

const CONTRACT_SECTION_HEADERS =
  /^(?:#{1,3}\s*)?(?:DEFINED TERMS|RECITALS|WHEREAS|INTERPRETATION|DEFINITIONS)\s*$/gim;

const JURISDICTION_CONFIRMED =
  /Jurisdiction\s+Confirmed\s*:\s*/gi;

const BNSS_NYAYA_SWAP =
  /\bBNSS\b[^.\n]{0,80}Bharatiya\s+Nyaya\s+Sanhita/gi;

const BNS_SURAKSHA_SWAP =
  /\bBNS\b[^.\n]{0,80}Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita/gi;

export function sanitizeDraftOutput(
  text: string,
  options?: { documentClass?: 'pleading' | 'contract' | 'form' | 'memo' | 'application' | 'reply'; kind?: string; caseDetails?: string },
): DraftOutputSanitizeResult {
  let out = text;
  const removedSections: string[] = [];

  for (const pattern of PASS_ARTEFACT_PATTERNS) {
    const before = out;
    out = out.replace(pattern, '');
    if (out !== before) removedSections.push('pass_artefact');
  }

  const footerStrip = stripAuditFooters(out);
  out = footerStrip.text;
  if (footerStrip.stripped.length > 0) {
    removedSections.push(...footerStrip.stripped);
  }

  out = out.replace(JURISDICTION_CONFIRMED, 'Jurisdiction (verified from facts): ');

  if (options?.documentClass === 'pleading' || /appeal|revision|writ|petition|plaint|bail|maintenance/i.test(options?.kind ?? '')) {
    const contractMatches = out.match(CONTRACT_SECTION_HEADERS);
    if (contractMatches) {
      removedSections.push('contract_sections');
      out = out.replace(CONTRACT_SECTION_HEADERS, '');
    }
  }

  if (BNSS_NYAYA_SWAP.test(out)) {
    out = out.replace(
      /\bBNSS\b([^.\n]{0,80})Bharatiya\s+Nyaya\s+Sanhita[^,\n]*/gi,
      'BNSS$1Bharatiya Nagarik Suraksha Sanhita, 2023',
    );
    removedSections.push('bnss_acronym_fix');
  }
  if (BNS_SURAKSHA_SWAP.test(out)) {
    out = out.replace(
      /\bBNS\b([^.\n]{0,80})Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita[^,\n]*/gi,
      'BNS$1Bharatiya Nyaya Sanhita, 2023',
    );
    removedSections.push('bns_acronym_fix');
  }

  const normalized = normalizeIndiaDraftStatutes(out, {
    kind: options?.kind,
    caseDetails: options?.caseDetails,
  });
  out = normalized.text;

  out = out.replace(/\n{4,}/g, '\n\n\n').trim();

  return { text: out, removedSections };
}
