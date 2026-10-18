/** On-demand TPA / SRA / CPC / Contract Act sections for India tenant premature-notice research. */

export const INDIA_TENANT_EVICTION_SECTIONS: ReadonlyArray<{
  actId: string;
  section: string;
}> = [
  { actId: 'transfer-of-property', section: '105' },
  { actId: 'transfer-of-property', section: '106' },
  { actId: 'transfer-of-property', section: '107' },
  { actId: 'transfer-of-property', section: '108' },
  { actId: 'transfer-of-property', section: '111' },
  { actId: 'specific-relief', section: '34' },
  { actId: 'specific-relief', section: '38' },
  { actId: 'specific-relief', section: '39' },
  { actId: 'cpc', section: '9' },
  { actId: 'contract-act', section: '37' },
  { actId: 'contract-act', section: '73' },
];

export const INDIA_TENANT_EVICTION_CASE_QUERIES = [
  '"section 106" "Transfer of Property Act" notice to quit',
  'injunction restrain dispossession tenant India',
  '"notice to quit" premature "Transfer of Property"',
  'tenant injunction possession "Specific Relief"',
] as const;

export function isIndiaTenantEvictionQuery(query: string): boolean {
  const q = query.toLowerCase();
  const tenancy =
    /\b(?:landlord|tenant|tenancy|lessee|lessor|lease)\b/i.test(q);
  const evictionTheme =
    /\b(?:evict|eviction|vacate|notice to quit|notice period|premature|dispossess|ejectment)\b/i.test(
      q,
    );
  return tenancy && evictionTheme;
}

export function authoritiesIncludeTenantPack(
  authorities: Array<{ citation?: string | null; title?: string | null }>,
): boolean {
  const blob = authorities
    .map((a) => `${a.title ?? ''} ${a.citation ?? ''}`)
    .join(' ')
    .toLowerCase();
  const hasTpa = /transfer of property|tpa/.test(blob) && /\b(?:105|106|111)\b/.test(blob);
  const hasSra = /specific relief/.test(blob) && /\b(?:34|38|39)\b/.test(blob);
  return hasTpa || hasSra;
}

export function isTenancyRemedyQuery(query: string): boolean {
  return (
    isIndiaTenantEvictionQuery(query) ||
    (/\b(?:remed(?:y|ies)|injunction|declaration)\b/i.test(query) &&
      /\b(?:landlord|tenant|tenancy|lease)\b/i.test(query))
  );
}
