import { isHeadingOnlySection } from '@/legal-sources/parsers/india-act-text.parser';
import type { RetrievedAuthority } from './legal-retrieval.types';

export function isHeadingOnlyStatuteAuthority(authority: RetrievedAuthority): boolean {
  if (!['primary', 'seed'].includes(authority.sourceTier)) return false;
  if (/case/i.test(authority.authorityType ?? '') || authority.court) return false;
  const section =
    authority.section ??
    authority.citation?.match(/\b(?:s(?:ection)?\.?|§)\s*(\d+[A-Za-z0-9()/-]*)/i)?.[1] ??
    authority.title.match(/\b(?:s(?:ection)?\.?|§)\s*(\d+[A-Za-z0-9()/-]*)/i)?.[1];
  const fullText = authority.fullText?.trim();
  if (!section || !fullText) return false;
  return isHeadingOnlySection({
    section,
    title: authority.heading ?? authority.title,
    fullText,
    isRepealed: authority.isRepealed,
  });
}
