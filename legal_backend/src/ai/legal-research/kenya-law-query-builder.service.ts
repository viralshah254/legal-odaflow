import { Injectable } from '@nestjs/common';
import type { LegalDomain } from './legal-research-classifier.service';
import { domainAnchors } from '@/legal-search/legal-domain-profile';
import type {
  RequestedAuthorityType,
  StructuredLegalQueryContext,
} from '@/legal-search/legal-retrieval.types';

export interface KenyaLawRelaxationTier {
  tier: 'exact' | 'subject_pair' | 'doctrine_statute' | 'court_specific' | 'broad_fallback';
  queries: string[];
}

export interface KenyaLawQueryPlan {
  caseLawQuery: string;
  bindingQuery: string;
  statuteQuery?: string;
  jurisdictionQuery?: string;
  allQueries: string[];
}

/** Map free-text court / forum hints to Kenya Law court codes. */
const JURISDICTION_TO_COURT: Record<string, string> = {
  'supreme court': 'KESC',
  kesc: 'KESC',
  'court of appeal': 'KECA',
  keca: 'KECA',
  'high court': 'KEHC',
  kehc: 'KEHC',
  elrc: 'KEELRC',
  'employment and labour': 'KEELRC',
  'labour court': 'KEELRC',
  keelrc: 'KEELRC',
  elc: 'KEELC',
  'environment and land': 'KEELC',
  magistrate: 'KEMC',
  magistrates: 'KEMC',
  kemc: 'KEMC',
  tat: 'KETAT',
  'tax appeals': 'KETAT',
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been', 'were', 'will',
  'would', 'could', 'should', 'about', 'into', 'their', 'there', 'which', 'when', 'where',
  'what', 'how', 'please', 'advise', 'client', 'matter', 'case', 'cases', 'query', 'research',
  'similar', 'comparable', 'involving', 'kenyan', 'kenya', 'law', 'laws', 'outcome',
  'outcomes', 'facts', 'fact', 'wanted', 'wants',
]);

@Injectable()
export class KenyaLawQueryBuilderService {
  build(input: StructuredLegalQueryContext & {
    query: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    countryCode?: string;
  }): KenyaLawQueryPlan {
    const keywords = this.extractKeywords(input.query);
    const core = keywords.slice(0, 4).join(' ');
    const entityPhrases = this.cleanPhrases(input.entities?.map((entity) => entity.text));
    const plannedIssues = this.cleanPhrases([
      ...(input.legalIssues ?? []),
      ...(input.issueDecomposition?.flatMap(({ issue, subIssues }) => [
        issue,
        ...(subIssues ?? []),
      ]) ?? []),
    ]);
    const propositions = this.cleanPhrases(input.propositionPhrases);
    const doctrines = this.cleanPhrases(input.doctrines);
    const plannedSections = this.cleanPhrases(input.statuteSections);
    const primaryIssue = plannedIssues[0] ?? propositions[0];
    const issuePhrase = primaryIssue
      ? `"${primaryIssue}"`
      : this.buildQuotedPhrase(keywords, input.query);

    const citationToken = this.extractCitationToken(input.query);
    const courtCode = this.resolveCourtCode(input.jurisdiction ?? input.query);

    const caseLawQuery = citationToken
      ? citationToken
      : this.cap(issuePhrase || core || input.query.slice(0, 80));

    const bindingQuery = this.cap(
      `${core || issuePhrase || 'law'} KESC Supreme Court`,
    );

    let statuteQuery: string | undefined;
    const statuteHint =
      plannedSections[0] ?? this.extractStatuteHint(input.query, input.practiceArea);
    if (statuteHint) {
      statuteQuery = this.cap(statuteHint);
    }

    let jurisdictionQuery: string | undefined;
    if (courtCode && core) {
      jurisdictionQuery = this.cap(`${core} ${courtCode}`);
    }

    const structuredQueries = [
      ...plannedIssues.slice(0, 3),
      ...propositions.slice(0, 2),
      ...doctrines.slice(0, 2),
    ].map((phrase) => this.cap(`"${phrase}"`));

    const domainQueries = domainAnchors(
      input.legalDomain,
      input.countryCode ?? 'KE',
      entityPhrases,
    ).map((anchor) => this.cap(`${core} ${anchor}`));

    const partyQuery = this.extractPartyQuery(input.query);
    const digitalCreditQueries = this.buildDigitalCreditQueries(input.query);

    const allQueries = [
      ...new Set(
        [
          citationToken,
          partyQuery,
          ...digitalCreditQueries,
          ...structuredQueries,
          caseLawQuery,
          bindingQuery,
          statuteQuery,
          jurisdictionQuery,
          ...domainQueries,
          ...this.buildRequestedAuthorityQueries(
            input.requestedAuthorityTypes,
            primaryIssue || core,
          ),
        ].filter((q): q is string => !!q && q.trim().length > 0),
      ),
    ];

    return {
      caseLawQuery,
      bindingQuery,
      statuteQuery,
      jurisdictionQuery,
      allQueries,
    };
  }

  buildRelaxationTiers(
    input: StructuredLegalQueryContext & {
      query: string;
      practiceArea?: string;
      legalDomain?: LegalDomain;
      jurisdiction?: string;
      countryCode?: string;
    },
  ): KenyaLawRelaxationTier[] {
    const built = this.build(input);
    const keywords = this.extractKeywords(input.query);
    const core = keywords.slice(0, 4).join(' ');
    const courtCode = this.resolveCourtCode(input.jurisdiction ?? input.query);

    const dedupe = (queries: string[]) =>
      [...new Set(queries.map((q) => q.trim()).filter(Boolean))];

    return [
      {
        tier: 'exact' as const,
        queries: dedupe([
          built.caseLawQuery,
          ...built.allQueries.filter((q) => q.includes('"')).slice(0, 2),
        ]),
      },
      {
        tier: 'subject_pair' as const,
        queries: dedupe([
          this.cap(this.buildQuotedPhrase(keywords, input.query)),
          ...this.cleanPhrases(input.legalIssues).slice(0, 2).map((issue) =>
            this.cap(`"${issue}"`),
          ),
        ]),
      },
      {
        tier: 'doctrine_statute' as const,
        queries: dedupe([
          ...this.cleanPhrases(input.doctrines).slice(0, 2).map((d) => this.cap(`"${d}"`)),
          ...this.cleanPhrases(input.statuteSections).slice(0, 2).map((s) =>
            this.cap(`"${s}"`),
          ),
          built.statuteQuery,
        ].filter((q): q is string => !!q)),
      },
      {
        tier: 'court_specific' as const,
        queries: dedupe(
          [
            built.bindingQuery,
            built.jurisdictionQuery,
            courtCode ? this.cap(`${core} ${courtCode}`) : undefined,
            this.cap(`${core} KESC`),
          ].filter((q): q is string => !!q),
        ),
      },
      {
        tier: 'broad_fallback' as const,
        queries: dedupe([this.cap(core), this.cap(`${core} judgment`)]),
      },
    ].filter((tier) => tier.queries.length > 0);
  }

  formatGapQuery(issue: string, dimension: string, jurisdiction?: string): string {
    const keywords = this.extractKeywords(issue);
    const core = keywords.slice(0, 3).join(' ') || issue.slice(0, 80);
    switch (dimension) {
      case 'BINDING_AUTHORITY':
        return this.cap(`${core} KESC Supreme Court`);
      case 'ADVERSE_AUTHORITY':
        return this.cap(`${core} overruled distinguished`);
      case 'PRIMARY_LAW':
        return this.cap(`${core} Act Cap`);
      default: {
        const court = this.resolveCourtCode(jurisdiction);
        return court ? this.cap(`${core} ${court}`) : this.cap(core);
      }
    }
  }

  fragmentQuery(query: string, context: StructuredLegalQueryContext = {}): string {
    const planned = this.cleanPhrases([
      ...(context.propositionPhrases ?? []),
      ...(context.legalIssues ?? []),
      ...(context.statuteSections ?? []),
      ...(context.doctrines ?? []),
      ...(context.entities?.map((entity) => entity.text) ?? []),
    ]);
    if (planned[0]) return planned[0].slice(0, 120);
    return this.extractKeywords(query).slice(0, 6).join(' ');
  }

  private extractCitationToken(query: string): string | undefined {
    const kesc = query.match(/\[\s*(\d{4})\s*\]\s*(KESC|KECA|KEHC|KEELRC|KEELC)\s+(\d+)/i);
    if (kesc) return `[${kesc[1]}] ${kesc[2].toUpperCase()} ${kesc[3]}`;
    const eklr = query.match(/\[\s*(\d{4})\s*\]\s*eKLR/i);
    if (eklr) return `[${eklr[1]}] eKLR`;
    return undefined;
  }

  private extractPartyQuery(query: string): string | undefined {
    const match = query.match(
      /([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,3})\s+(?:v\.?|vs\.?|versus)\s+([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,4})/,
    );
    if (!match) return undefined;
    return `"${match[1]}" "${match[2]}"`;
  }

  private resolveCourtCode(text?: string): string | undefined {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    for (const [hint, code] of Object.entries(JURISDICTION_TO_COURT)) {
      if (lower.includes(hint.toLowerCase())) return code;
    }
    return undefined;
  }

  private extractStatuteHint(query: string, practiceArea?: string): string | undefined {
    const cap = query.match(/\bCap\.?\s*(\d+)\b/i);
    if (cap) return `Cap ${cap[1]}`;
    const act = query.match(
      /\b((?:Employment|Companies|Land|Constitution|Penal|Criminal Procedure|Data Protection|Fair Administrative Action|Evidence|Consumer Protection)\s+Act(?:\s*,?\s*\d{4})?)/i,
    );
    if (act) return act[1];
    if (/\b(crb|credit reference|digital.?loan|digital.?credit|mpesa|safaricom)\b/i.test(query)) {
      return 'Data Protection Act';
    }
    if (/employment|unfair dismissal|redundancy/i.test(query) || practiceArea === 'employment') {
      return 'Employment Act';
    }
    if (/constitutional|bill of rights|article\s+\d+/i.test(query)) {
      return 'Constitution of Kenya';
    }
    return undefined;
  }

  /** Aisha-class digital loan / CRB / DPA research phrases for Kenya Law search. */
  private buildDigitalCreditQueries(query: string): string[] {
    if (
      !/\b(crb|credit reference|digital.?loan|digital.?credit|fraudulent?\s+loan|mpesa|safaricom|data protection|dpa|dcp)\b/i.test(
        query,
      )
    ) {
      return [];
    }
    return [
      this.cap('Data Protection Act unauthorised processing digital loan'),
      this.cap('credit reference bureau listing dispute'),
      this.cap('digital credit provider CBK consumer protection'),
      this.cap('Evidence Act electronic records mobile money'),
      this.cap('fraudulent loan identity theft Kenya'),
      this.cap('Safaricom digital lending CRB'),
    ];
  }

  private buildRequestedAuthorityQueries(
    types: RequestedAuthorityType[] | undefined,
    core: string,
  ): string[] {
    if (!types?.length) return [];
    const out: string[] = [];
    if (types.includes('CASE_LAW') || types.includes('BINDING_PRECEDENT')) {
      out.push(this.cap(`${core} judgment`));
    }
    if (types.includes('STATUTE') || types.includes('RULE')) {
      out.push(this.cap(`${core} Act`));
    }
    return out;
  }

  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
      .slice(0, 12);
  }

  private cleanPhrases(values?: Array<string | undefined | null>): string[] {
    return (values ?? [])
      .map((value) => this.cleanPhrase(value ?? ''))
      .filter((value) => value.length >= 3);
  }

  private cleanPhrase(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  private buildQuotedPhrase(keywords: string[], query: string): string {
    if (keywords.length >= 2) {
      return `"${keywords.slice(0, 3).join(' ')}"`;
    }
    const trimmed = query.trim().slice(0, 80);
    return trimmed ? `"${trimmed}"` : '';
  }

  private cap(query: string, max = 180): string {
    return query.replace(/\s+/g, ' ').trim().slice(0, max);
  }
}
