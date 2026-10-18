/**
 * Official primary-law domains per jurisdiction.
 *
 * Countries without a dedicated case-law connector (GB, and any tier-1 country
 * we have not integrated) would otherwise fall back to an India-shaped web
 * search and retrieve nothing - leaving that jurisdiction reasoning-only with
 * zero sources. A per-country source list keeps the grounded fallback usable
 * everywhere.
 */

export interface OfficialCaseSources {
  /** Domains that publish judgments. */
  judgmentDomains: string[];
  /** Domains that publish consolidated statute text. */
  statuteDomains: string[];
  /** Words that identify a judgment in this jurisdiction's writing conventions. */
  judgmentHints: RegExp;
}

const DEFAULT_JUDGMENT_HINTS = /\bv\.?\s|\bvs\.?\s|judgment|judgement|opinion|ruling|appeal/i;

const SOURCES: Record<string, OfficialCaseSources> = {
  IN: {
    judgmentDomains: ['sci.gov.in', 'judgments.ecourts.gov.in', 'indiankanoon.org'],
    statuteDomains: ['indiacode.nic.in', 'prsindia.org'],
    judgmentHints: /\bv\.?\s|\bvs\.?\s|judgment|bail|petition/i,
  },
  KE: {
    judgmentDomains: ['kenyalaw.org', 'new.kenyalaw.org'],
    statuteDomains: ['kenyalaw.org', 'new.kenyalaw.org'],
    judgmentHints: /\bv\.?\s|\bvs\.?\s|judgment|ruling|petition/i,
  },
  US: {
    judgmentDomains: ['supremecourt.gov', 'courtlistener.com', 'govinfo.gov', 'uscourts.gov'],
    statuteDomains: ['uscode.house.gov', 'law.cornell.edu', 'ecfr.gov'],
    judgmentHints: /\bv\.?\s|\bvs\.?\s|opinion|held|circuit|petitioner/i,
  },
  GB: {
    judgmentDomains: [
      'caselaw.nationalarchives.gov.uk',
      'bailii.org',
      'supremecourt.uk',
      'judiciary.uk',
    ],
    statuteDomains: ['legislation.gov.uk'],
    judgmentHints: /\bv\.?\s|\bvs\.?\s|judgment|appellant|respondent|lord|lady/i,
  },
};

export function getOfficialCaseSources(countryCode?: string): OfficialCaseSources {
  const code = countryCode?.toUpperCase();
  return (
    (code ? SOURCES[code] : undefined) ?? {
      judgmentDomains: [],
      statuteDomains: [],
      judgmentHints: DEFAULT_JUDGMENT_HINTS,
    }
  );
}

/**
 * Build a web query scoped to official judgment publishers. Falls back to an
 * unscoped judgment search when the jurisdiction has no known domains, which is
 * still far better than searching India's court sites for a US question.
 */
export function buildOfficialJudgmentWebQuery(issueQuery: string, countryCode?: string): string {
  const { judgmentDomains } = getOfficialCaseSources(countryCode);
  if (judgmentDomains.length === 0) {
    return `${issueQuery} court judgment full text`;
  }
  const siteFilter = judgmentDomains.map((domain) => `site:${domain}`).join(' OR ');
  return `${issueQuery} judgment ${siteFilter}`;
}

/** True when a jurisdiction has a grounded web fallback worth attempting. */
export function hasOfficialCaseSources(countryCode?: string): boolean {
  return getOfficialCaseSources(countryCode).judgmentDomains.length > 0;
}
