import { Injectable } from '@nestjs/common';

export type RelevanceState = 'GOVERNS' | 'RELATED' | 'OFF_POINT';

export interface RelevanceAuthority {
  title?: string | null;
  citation?: string | null;
  fullText?: string | null;
  summary?: string | null;
  practiceAreas?: string[];
  topics?: string[];
}

export interface RelevanceAssessment {
  state: RelevanceState;
  reason: string;
  score: number;
}

const STOP_WORDS = new Set([
  'about', 'against', 'authority', 'case', 'court', 'from', 'india', 'legal',
  'matter', 'section', 'shall', 'that', 'their', 'this', 'under', 'with',
]);

const DOMAIN_MARKERS: Array<{ terms: RegExp; domains: string[] }> = [
  { terms: /\b(?:pmla|money laundering|proceeds of crime)\b/i, domains: ['criminal', 'compliance', 'aml'] },
  { terms: /\b(?:cpc|civil procedure|costs of litigation)\b/i, domains: ['civil', 'procedure', 'litigation'] },
  { terms: /\b(?:rera|real estate regulation|allottee|promoter)\b/i, domains: ['property', 'real estate'] },
  { terms: /\b(?:consumer protection|upi|payment service|bank account|unauthori[sz]ed transaction)\b/i, domains: ['consumer', 'banking', 'payments'] },
  { terms: /\b(?:bail|offence|arrest|prosecution|criminal)\b/i, domains: ['criminal'] },
  { terms: /\b(?:tenancy|landlord|immovable property|real estate)\b/i, domains: ['property', 'real estate'] },
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return [...new Set(normalise(value).split(' ').filter((token) => token.length > 3 && !STOP_WORDS.has(token)))];
}

function namedInQuery(title: string, query: string): boolean {
  const names = [
    ...title.matchAll(/\b([A-Z][A-Za-z ]{2,60}(?:Act|Code|Rules|Regulations))(?:,\s*(\d{4}))?/g),
  ].map((match) => normalise(match[1]));
  const normalizedQuery = normalise(query);
  return names.some((name) => normalizedQuery.includes(name)) ||
    /\b(?:pmla|cpc|rera)\b/i.test(title) &&
      title.match(/\b(?:pmla|cpc|rera)\b/i)?.[0] !== undefined &&
      new RegExp(`\\b${title.match(/\b(?:pmla|cpc|rera)\b/i)![0]}\\b`, 'i').test(query);
}

@Injectable()
export class RelevanceVerificationService {
  assess(input: {
    authority: RelevanceAuthority;
    query: string;
    legalDomain?: string;
  }): RelevanceAssessment {
    const authorityText = [
      input.authority.title,
      input.authority.citation,
      input.authority.summary,
      input.authority.fullText?.slice(0, 6000),
      ...(input.authority.practiceAreas ?? []),
      ...(input.authority.topics ?? []),
    ].filter(Boolean).join(' ');
    const queryText = `${input.query} ${input.legalDomain ?? ''}`;
    const authorityTokens = new Set(tokens(authorityText));
    const queryTokens = tokens(queryText);
    const overlap = queryTokens.length
      ? queryTokens.filter((token) => authorityTokens.has(token)).length / queryTokens.length
      : 0;
    const explicitAct = namedInQuery(
      `${input.authority.title ?? ''} ${input.authority.citation ?? ''}`,
      input.query,
    );

    if (explicitAct) {
      return { state: 'GOVERNS', score: 1, reason: 'The query expressly names this enactment.' };
    }

    const authorityDomains = DOMAIN_MARKERS
      .filter((marker) => marker.terms.test(authorityText))
      .flatMap((marker) => marker.domains);
    const queryDomains = DOMAIN_MARKERS
      .filter((marker) => marker.terms.test(queryText))
      .flatMap((marker) => marker.domains);
    const domainOverlap = authorityDomains.some((domain) => queryDomains.includes(domain));
    const looksInstrumentSpecific = /\b(?:act|code|rules|regulations|section|s\.)\b/i.test(authorityText);

    if (
      looksInstrumentSpecific &&
      authorityDomains.length > 0 &&
      queryDomains.length > 0 &&
      !domainOverlap &&
      overlap < 0.2
    ) {
      return {
        state: 'OFF_POINT',
        score: Number(overlap.toFixed(3)),
        reason: `Authority concerns ${[...new Set(authorityDomains)].join('/')} law, not the query's ${[...new Set(queryDomains)].join('/')} domain, and the enactment was not requested.`,
      };
    }

    if (domainOverlap && overlap >= 0.2) {
      return {
        state: 'GOVERNS',
        score: Number(Math.min(1, 0.55 + overlap).toFixed(3)),
        reason: 'Authority matches the legal domain and material query terms.',
      };
    }
    if (domainOverlap || overlap >= 0.15) {
      return {
        state: 'RELATED',
        score: Number(Math.max(0.35, overlap).toFixed(3)),
        reason: 'Authority is related, but governing fit is not established.',
      };
    }
    return {
      state: 'OFF_POINT',
      score: Number(overlap.toFixed(3)),
      reason: 'No material legal-domain or proposition overlap was established.',
    };
  }
}
