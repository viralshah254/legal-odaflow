/** Country → state/region → court type → forum slug lookup (P16 scaffold). */

export interface ForumEntry {
  countryCode: string;
  region?: string;
  courtType: string;
  forumSlug: string;
  label: string;
}

const FORUM_REGISTRY: ForumEntry[] = [
  { countryCode: 'IN', courtType: 'district', forumSlug: 'district_court', label: 'District Court' },
  { countryCode: 'IN', courtType: 'high', forumSlug: 'high_court', label: 'High Court' },
  { countryCode: 'IN', courtType: 'supreme', forumSlug: 'supreme_court', label: 'Supreme Court of India' },
  { countryCode: 'IN', courtType: 'consumer', forumSlug: 'consumer_commission', label: 'Consumer Commission' },
  { countryCode: 'IN', courtType: 'labour', forumSlug: 'labour_court', label: 'Labour Court' },
  { countryCode: 'IN', courtType: 'nclt', forumSlug: 'nclt', label: 'National Company Law Tribunal (NCLT)' },
  { countryCode: 'IN', courtType: 'nclat', forumSlug: 'nclat', label: 'National Company Law Appellate Tribunal (NCLAT)' },
  { countryCode: 'IN', courtType: 'drt', forumSlug: 'drt', label: 'Debt Recovery Tribunal (DRT)' },
  { countryCode: 'IN', courtType: 'rera', forumSlug: 'rera_authority', label: 'Real Estate Regulatory Authority (RERA)' },
  { countryCode: 'IN', courtType: 'ngt', forumSlug: 'ngt', label: 'National Green Tribunal (NGT)' },
  { countryCode: 'US', courtType: 'federal_district', forumSlug: 'us_federal_district', label: 'US District Court' },
  { countryCode: 'US', courtType: 'state_superior', forumSlug: 'us_state_superior', label: 'State Superior Court' },
  { countryCode: 'GB', courtType: 'high', forumSlug: 'high_court_england', label: 'High Court of England and Wales' },
  { countryCode: 'KE', courtType: 'high', forumSlug: 'ke_high_court', label: 'High Court of Kenya' },
];

export function lookupForums(
  countryCode: string,
  options?: { region?: string; courtType?: string },
): ForumEntry[] {
  const cc = countryCode.toUpperCase();
  return FORUM_REGISTRY.filter((entry) => {
    if (entry.countryCode !== cc) return false;
    if (options?.region && entry.region && entry.region !== options.region) return false;
    if (options?.courtType && entry.courtType !== options.courtType) return false;
    return true;
  });
}

export function resolveForumSlug(
  countryCode: string,
  forumHint?: string,
): string | undefined {
  if (!forumHint?.trim()) return undefined;
  const normalized = forumHint.toLowerCase().replace(/\W+/g, '_');
  const match = FORUM_REGISTRY.find(
    (entry) =>
      entry.countryCode === countryCode.toUpperCase() &&
      (entry.forumSlug === normalized || entry.courtType === normalized),
  );
  return match?.forumSlug ?? normalized;
}
