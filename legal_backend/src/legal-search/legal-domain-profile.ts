import type { LegalDomain } from '@/ai/legal-research/legal-research-classifier.service';
import type { RetrievedAuthority } from './legal-retrieval.types';
import { getStatutesForCountry } from './statute-registry';
import type { StatuteEntry } from './statute-registry';

const DOMAIN_PRACTICE_AREAS: Partial<Record<LegalDomain, string[]>> = {
  EMPLOYMENT: ['employment'],
  CONTRACT: ['contract'],
  CONSTRUCTION_DELAY: ['contract', 'adr'],
  CONSUMER: ['consumer'],
  FAMILY: ['family'],
  PROPERTY: ['property'],
  ARBITRATION: ['adr'],
  INSOLVENCY: ['insolvency'],
  TAX: ['taxation'],
  INTELLECTUAL_PROPERTY: ['ip'],
  DATA_PRIVACY: ['privacy'],
  CORPORATE_COMMERCIAL: ['corporate'],
  CRIMINAL: ['criminal', 'criminal_procedure'],
  CIVIL_LITIGATION: ['civil_litigation'],
  CONSTITUTIONAL: ['constitutional'],
};

/** Registry IDs provide stable ordering; display/search names always come from the registry. */
const IN_PREFERRED_STATUTE_IDS: Partial<Record<LegalDomain, string[]>> = {
  EMPLOYMENT: ['industrial-disputes', 'sexual-harassment-act', 'industrial-employment-standing-orders-act'],
  CONTRACT: ['contract-act', 'specific-relief'],
  CONSUMER: ['consumer-protection'],
  FAMILY: ['hindu-marriage', 'domestic-violence'],
  PROPERTY: ['transfer-of-property', 'specific-relief', 'cpc', 'contract-act', 'registration-act'],
  ARBITRATION: ['arbitration-act'],
  INSOLVENCY: ['ibc'],
  TAX: ['income-tax', 'gst-act'],
  INTELLECTUAL_PROPERTY: ['trademarks-act', 'copyright-act', 'patents-act'],
  DATA_PRIVACY: ['dpdp'],
  CORPORATE_COMMERCIAL: ['companies-act'],
  CRIMINAL: ['bns', 'bnss'],
  CIVIL_LITIGATION: ['cpc', 'limitation-act'],
  CONSTITUTIONAL: ['constitution'],
};

const KE_PREFERRED_STATUTE_IDS: Partial<Record<LegalDomain, string[]>> = {
  EMPLOYMENT: ['employment-act-2007', 'labour-relations-act'],
  CONTRACT: ['cap-23'],
  CONSUMER: ['consumer-protection-act-2012', 'data-protection-act-2019'],
  DATA_PRIVACY: ['data-protection-act-2019', 'access-to-information-act-2016', 'constitution-ke'],
  FAMILY: ['marriage-act-2014', 'cap-160', 'children-act-2022'],
  PROPERTY: ['land-act-2012', 'land-registration-act'],
  INSOLVENCY: ['insolvency-act-2015'],
  TAX: ['cap-470', 'vat-act-2013'],
  CORPORATE_COMMERCIAL: ['companies-act-2015', 'insolvency-act-2015'],
  CRIMINAL: ['cap-63', 'cap-75'],
  CIVIL_LITIGATION: ['cap-22'],
  CONSTITUTIONAL: ['constitution-ke', 'access-to-information-act-2016', 'data-protection-act-2019'],
};

const PREFERRED_STATUTE_IDS_BY_COUNTRY: Record<
  string,
  Partial<Record<LegalDomain, string[]>>
> = {
  IN: IN_PREFERRED_STATUTE_IDS,
  KE: KE_PREFERRED_STATUTE_IDS,
};

export interface JurisdictionLegalResearchProfile {
  countryCode: string;
  domains: LegalDomain[];
  statuteAnchors: StatuteEntry[];
}

const CRIMINAL_MARKERS =
  /\b(?:fir|accused|arrest|bail|charge(?:sheet)?|prosecution|offence|ipc|bns|bnss|crpc|pocso|ndps|pmla|cheque\s+(?:bounce|dishonou?r)|section\s+\d+\s+(?:ipc|bns|bnss|crpc))\b/i;
const CRIMINAL_AUTHORITY_MARKERS =
  /\b(?:bns|bnss|bsa|ipc|crpc|indian penal code|criminal procedure|bharatiya nyaya|bharatiya nagarik|bail|murder|rape|theft|robbery|cheating)\b/i;

export function buildLegalResearchProfile(input: {
  countryCode?: string;
  domains?: LegalDomain[];
  entities?: string[];
}): JurisdictionLegalResearchProfile {
  const countryCode = (input.countryCode || 'UNKNOWN').toUpperCase();
  const domains = [...new Set(input.domains ?? [])];
  const statutes = getStatutesForCountry(countryCode);
  const jurisdictionPreferences = PREFERRED_STATUTE_IDS_BY_COUNTRY[countryCode] ?? {};
  const preferredIds = domains.flatMap((domain) => jurisdictionPreferences[domain] ?? []);
  const practiceAreas = new Set(domains.flatMap((domain) => DOMAIN_PRACTICE_AREAS[domain] ?? []));
  const entityIds =
    countryCode === 'IN' &&
    (input.entities ?? []).some((entity) => /\bpartner(?:ship|s)?\b/i.test(entity))
      ? ['partnership-act']
      : [];

  const rankedIds = [...new Set([...entityIds, ...preferredIds])];
  const preferred = rankedIds
    .map((id) => statutes.find((statute) => statute.id === id))
    .filter((statute): statute is StatuteEntry => !!statute);
  const discovered = statutes
    .filter(
      (statute) =>
        !rankedIds.includes(statute.id) &&
        statute.practiceAreas.some((area) => practiceAreas.has(area)),
    )
    .sort((a, b) =>
      (a.ingestPriority ?? 99) - (b.ingestPriority ?? 99) ||
      a.shortName.localeCompare(b.shortName),
    );

  return {
    countryCode,
    domains,
    statuteAnchors: [...preferred, ...discovered].slice(0, Math.max(4, preferred.length)),
  };
}

export function domainAnchors(
  domain?: LegalDomain,
  countryCode = 'IN',
  entities: string[] = [],
): string[] {
  if (!domain) return [];
  return buildLegalResearchProfile({ countryCode, domains: [domain], entities })
    .statuteAnchors
    .map((statute) => `${statute.shortName}${statute.year ? ` ${statute.year}` : ''}`);
}

/** Criminal-code grounding must be explicit outside a criminal classification. */
export function allowsCriminalGrounding(domain: LegalDomain | undefined, query: string): boolean {
  return domain === 'CRIMINAL' || (!domain || domain === 'GENERAL') && CRIMINAL_MARKERS.test(query);
}

/**
 * Conservative topic-fit test. It only rejects unmistakably criminal material from
 * non-criminal work; all other authorities remain eligible for semantic ranking.
 */
export function isClearlyOffDomainAuthority(
  authority: RetrievedAuthority,
  domain?: LegalDomain,
): boolean {
  if (!domain || domain === 'GENERAL' || domain === 'CRIMINAL') return false;
  const text = [
    authority.title,
    authority.citation,
    authority.summary,
    authority.fullText?.slice(0, 800),
  ]
    .filter(Boolean)
    .join(' ');
  return CRIMINAL_AUTHORITY_MARKERS.test(text);
}

export function domainFitRatio(
  authorities: RetrievedAuthority[],
  domain?: LegalDomain,
): number {
  if (authorities.length === 0 || !domain || domain === 'GENERAL') return 1;
  return authorities.filter((authority) => !isClearlyOffDomainAuthority(authority, domain)).length /
    authorities.length;
}
