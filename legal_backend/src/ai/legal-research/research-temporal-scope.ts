import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

/** Reject known future material; an unknown date never establishes historical validity. */
export function authorityWithinResearchDate(authority: RetrievedAuthority, asOfDate?: string): boolean {
  if (!asOfDate) return true;
  const cutoff = Date.parse(asOfDate.slice(0, 10) + 'T23:59:59.999Z');
  if (!Number.isFinite(cutoff)) return false;
  const year = new Date(cutoff).getUTCFullYear();
  for (const value of [authority.decisionDate, authority.instrumentDate]) {
    if (value && Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > cutoff) return false;
  }
  if ((authority.decisionYear ?? 0) > year || (authority.actYear ?? 0) > year) return false;
  // Reporter years are a conservative availability bound where decision dates are absent.
  const identity = [authority.citation, authority.neutralCitation, authority.title, authority.actName].filter(Boolean).join(' ');
  const years = [...identity.matchAll(/\b(?:18|19|20)\d{2}\b/g)].map(match => Number(match[0]));
  if (years.some(value => value > year)) return false;
  // Section Finder can carry legacy IDs while presenting the replacement Indian codes.
  if (cutoff < Date.parse('2024-07-01T00:00:00Z') && /\b(?:BNSS|BNS|BSA)\b|Bharatiya (?:Nagarik|Nyaya|Sakshya)/i.test(identity)) return false;
  return true;
}

export function filterAuthoritiesByResearchDate(authorities: RetrievedAuthority[], asOfDate?: string): RetrievedAuthority[] {
  return authorities.filter(authority => authorityWithinResearchDate(authority, asOfDate));
}
