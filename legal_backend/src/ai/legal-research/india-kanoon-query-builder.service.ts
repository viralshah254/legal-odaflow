import { Injectable } from '@nestjs/common';
import type { LegalDomain } from './legal-research-classifier.service';
import {
  buildLegalResearchProfile,
  domainAnchors,
} from '@/legal-search/legal-domain-profile';
import type {
  RequestedAuthorityType,
  StructuredLegalQueryContext,
} from '@/legal-search/legal-retrieval.types';
import {
  CONTRACT_ACT_WAIVER_CASE_QUERIES,
  isContractActWaiverQuery,
} from '@/legal-search/contract-act-waiver.util';
import {
  INDIA_TENANT_EVICTION_CASE_QUERIES,
  isIndiaTenantEvictionQuery,
} from '@/legal-search/india-tenant-eviction.util';

export interface IndiaKanoonRelaxationTier {
  tier: 'exact' | 'subject_pair' | 'doctrine_statute' | 'court_specific' | 'broad_fallback';
  queries: string[];
}

export interface IndiaKanoonQueryPlan {
  /** Primary case-law search across judgments. */
  caseLawQuery: string;
  /** Binding Supreme Court precedents. */
  bindingQuery: string;
  /** Statute / rules search when act references detected. */
  statuteQuery?: string;
  /** Jurisdiction-specific high court filter. */
  jurisdictionQuery?: string;
  /** All unique queries to execute (deduped). */
  allQueries: string[];
}

const JURISDICTION_TO_DOCTYPE: Record<string, string> = {
  delhi: 'delhi',
  'new delhi': 'delhi',
  maharashtra: 'bombay',
  mumbai: 'bombay',
  bombay: 'bombay',
  karnataka: 'karnataka',
  bangalore: 'karnataka',
  bengaluru: 'karnataka',
  tamilnadu: 'madras',
  'tamil nadu': 'madras',
  chennai: 'madras',
  madras: 'madras',
  gujarat: 'gujarat',
  rajasthan: 'rajasthan',
  punjab: 'punjab',
  haryana: 'punjab',
  uttarpradesh: 'allahabad',
  'uttar pradesh': 'allahabad',
  allahabad: 'allahabad',
  westbengal: 'calcutta',
  'west bengal': 'calcutta',
  kolkata: 'calcutta',
  calcutta: 'calcutta',
  kerala: 'kerala',
  odisha: 'orissa',
  orissa: 'orissa',
  madhyapradesh: 'madhyapradesh',
  'madhya pradesh': 'madhyapradesh',
  bihar: 'patna',
  jharkhand: 'jharkhand',
  assam: 'gauhati',
  himachal: 'himachal_pradesh',
  'himachal pradesh': 'himachal_pradesh',
  andhra: 'andhra',
  'andhra pradesh': 'andhra',
  telangana: 'telangana',
  chhattisgarh: 'chattisgarh',
  chattisgarh: 'chattisgarh',
  uttarakhand: 'uttarakhand',
  sikkim: 'sikkim',
  tripura: 'tripura',
  manipur: 'manipur',
  meghalaya: 'meghalaya',
  goa: 'bombay',
  chandigarh: 'punjab',
  'jammu and kashmir': 'jammu',
  jammu: 'jammu',
  kashmir: 'jammu',
};

const SYNONYM_PAIRS: Array<[string, string]> = [
  ['medical negligence', 'deficiency in service'],
  ['negligence', 'deficiency in service'],
  ['anticipatory bail', 'bail'],
  ['cheque bounce', 'dishonour of cheque'],
  ['dishonour of cheque', 'section 138'],
  ['maintenance', 'interim maintenance'],
  ['consumer complaint', 'consumer protection'],
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been', 'were', 'will',
  'would', 'could', 'should', 'about', 'into', 'their', 'there', 'which', 'when', 'where',
  'what', 'how', 'please', 'advise', 'client', 'matter', 'case', 'cases', 'query', 'research',
  'similar', 'comparable', 'involving', 'indian', 'india', 'law', 'laws', 'outcome',
  'outcomes', 'facts', 'fact', 'wanted', 'wants',
]);

@Injectable()
export class IndiaKanoonQueryBuilderService {
  build(input: StructuredLegalQueryContext & {
    query: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    countryCode?: string;
  }): IndiaKanoonQueryPlan {
    const keywords = this.extractKeywords(input.query);
    const core = keywords.slice(0, 4).join(' ');
    const entityPhrases = this.cleanPhrases(input.entities?.map((entity) => entity.text));
    const decomposedIssues = this.cleanPhrases(
      input.issueDecomposition?.flatMap(({ issue, subIssues }) => [issue, ...(subIssues ?? [])]),
    );
    const plannedIssues = this.cleanPhrases([
      ...(input.legalIssues ?? []),
      ...decomposedIssues,
    ]);
    const propositions = this.cleanPhrases(input.propositionPhrases);
    const doctrines = this.cleanPhrases(input.doctrines);
    const remedies = this.cleanPhrases(input.remedies);
    const plannedSections = this.cleanPhrases(input.statuteSections);
    const primaryIssue = plannedIssues[0] ?? propositions[0];
    const issuePhrase = primaryIssue
      ? `"${primaryIssue}"`
      : this.buildOrrPhrase(keywords, input.query);
    const statuteHint =
      plannedSections[0] ??
      this.extractStatuteHint(input.query, input.practiceArea, input.legalDomain);
    const domainQueries = domainAnchors(
      input.legalDomain,
      input.countryCode ?? 'IN',
      entityPhrases,
    ).map((anchor) =>
      this.cap(`${core} ${anchor} doctypes:judgments`),
    );
    const structuredQueries = [
      ...plannedIssues.slice(0, 3),
      ...propositions.slice(0, 2),
      ...doctrines.slice(0, 2),
    ].map((phrase) =>
      this.cap(
        `"${phrase}"${input.proceduralPosture ? ` "${this.cleanPhrase(input.proceduralPosture)}"` : ''} doctypes:judgments`,
      ),
    );
    const structuredStatuteQueries = plannedSections
      .slice(0, 3)
      .map((section) => this.cap(`"${section}" doctypes:laws`));
    const entityRemedyQueries = entityPhrases.slice(0, 2).flatMap((entity) =>
      remedies.slice(0, 2).map((remedy) =>
        this.cap(`"${entity}" "${remedy}" doctypes:judgments`),
      ),
    );
    const requestedAuthorityQueries = this.buildRequestedAuthorityQueries(
      input.requestedAuthorityTypes,
      primaryIssue || core,
    );
    const isPartnershipArbitration = this.isPartnershipArbitrationQuery(
      `${input.query} ${entityPhrases.join(' ')}`,
      input.legalDomain,
    );
    const partnershipStatute = isPartnershipArbitration
      ? buildLegalResearchProfile({
          countryCode: input.countryCode ?? 'IN',
          domains: ['ARBITRATION'],
          entities: entityPhrases.length > 0 ? entityPhrases : ['partnership'],
        }).statuteAnchors.find((statute) => statute.id === 'partnership-act')
      : undefined;
    const partnershipActName = partnershipStatute?.fullName.replace(/,\s*\d{4}$/, '');
    const partnershipArbitrationQueries = isPartnershipArbitration
      ? [
          '"partnership deed" "arbitration clause" doctypes:judgments',
          '"partnership agreement" "arbitration agreement" doctypes:judgments',
          partnershipActName
            ? `"${partnershipActName}" arbitration doctypes:judgments`
            : undefined,
          partnershipActName ? `"${partnershipActName}" doctypes:laws` : undefined,
        ]
      : [];
    const digitalLendingQueries = this.buildDigitalLendingQueries(input.query);
    const contractActWaiverQueries = this.buildContractActWaiverQueries(input.query);
    const tenantEvictionQueries = this.buildTenantEvictionQueries(input.query);

    const caseLawQuery = isPartnershipArbitration
      ? '"partnership deed" "arbitration clause" doctypes:judgments'
      : this.cap(
          issuePhrase ? `${issuePhrase} doctypes:judgments` : `${core} doctypes:judgments`,
        );
    const bindingQuery = this.cap(`${core || issuePhrase || 'law'} doctypes:supremecourt`);

    let statuteQuery: string | undefined;
    if (statuteHint) {
      statuteQuery = this.cap(`${statuteHint} doctypes:laws`);
    }

    let jurisdictionQuery: string | undefined;
    const courtDoctype = this.resolveCourtDoctype(input.jurisdiction);
    if (courtDoctype && core) {
      jurisdictionQuery = this.cap(`${core} doctypes:${courtDoctype}`);
    }

    const allQueries = [
      ...new Set(
        [
          ...partnershipArbitrationQueries,
          ...digitalLendingQueries,
          ...contractActWaiverQueries,
          ...tenantEvictionQueries,
          ...structuredQueries,
          caseLawQuery,
          bindingQuery,
          statuteQuery,
          ...structuredStatuteQueries,
          ...entityRemedyQueries,
          ...requestedAuthorityQueries,
          jurisdictionQuery,
          ...domainQueries,
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

  /**
   * Ordered query-relaxation ladder for zero-hit recovery.
   * Starts with exact phrases and broadens until budget is exhausted.
   */
  buildRelaxationTiers(
    input: StructuredLegalQueryContext & {
      query: string;
      practiceArea?: string;
      legalDomain?: LegalDomain;
      jurisdiction?: string;
      countryCode?: string;
    },
  ): IndiaKanoonRelaxationTier[] {
    const built = this.build(input);
    const keywords = this.extractKeywords(input.query);
    const core = keywords.slice(0, 4).join(' ');
    const isPartnershipArbitration = this.isPartnershipArbitrationQuery(
      input.query,
      input.legalDomain,
    );

    const exactQueries = [
      built.caseLawQuery,
      ...built.allQueries.filter((q) => q.includes('"') && q.includes('doctypes:judgments')).slice(0, 2),
    ];
    const subjectPairQueries = isPartnershipArbitration
      ? [
          '"partnership deed" "arbitration clause" doctypes:judgments',
          '"partnership agreement" arbitration enforceability doctypes:judgments',
          '"dissolution of partnership" arbitration doctypes:judgments',
          '"partnership accounts" arbitration doctypes:judgments',
        ]
      : [
          this.cap(`${this.buildOrrPhrase(keywords, input.query)} doctypes:judgments`),
          ...this.cleanPhrases(input.legalIssues).slice(0, 2).map(
            (issue) => this.cap(`"${issue}" doctypes:judgments`),
          ),
        ];
    const doctrineQueries = [
      ...this.cleanPhrases(input.doctrines).slice(0, 2).map(
        (doctrine) => this.cap(`"${doctrine}" doctypes:judgments`),
      ),
      ...this.cleanPhrases(input.statuteSections).slice(0, 2).map(
        (section) => this.cap(`"${section}" doctypes:judgments`),
      ),
      isPartnershipArbitration ? '"section 69" partnership arbitration doctypes:judgments' : undefined,
      isPartnershipArbitration ? '"section 11" arbitration agreement doctypes:judgments' : undefined,
      isPartnershipArbitration
        ? '"optional arbitration clause" partnership doctypes:judgments'
        : undefined,
    ].filter((q): q is string => !!q);
    const courtQueries = [
      built.bindingQuery,
      built.jurisdictionQuery,
      this.cap(`${core} doctypes:supremecourt`),
    ].filter((q): q is string => !!q);
    const broadQueries = [
      this.cap(`${core} arbitration doctypes:judgments`),
      this.cap(`${core} doctypes:judgments`),
      isPartnershipArbitration
        ? 'partnership arbitration clause dissolution accounts doctypes:judgments'
        : undefined,
    ].filter((q): q is string => !!q);

    const dedupe = (queries: string[]) =>
      [...new Set(queries.map((q) => q.trim()).filter(Boolean))];

    return [
      { tier: 'exact' as const, queries: dedupe(exactQueries) },
      { tier: 'subject_pair' as const, queries: dedupe(subjectPairQueries) },
      { tier: 'doctrine_statute' as const, queries: dedupe(doctrineQueries) },
      { tier: 'court_specific' as const, queries: dedupe(courtQueries) },
      { tier: 'broad_fallback' as const, queries: dedupe(broadQueries) },
    ].filter((tier) => tier.queries.length > 0);
  }

  /** Format a gap-expansion query for IK search. */
  formatGapQuery(issue: string, dimension: string, jurisdiction?: string): string {
    const keywords = this.extractKeywords(issue);
    const core = keywords.slice(0, 3).join(' ') || issue.slice(0, 80);
    switch (dimension) {
      case 'BINDING_AUTHORITY':
        return this.cap(`${core} doctypes:supremecourt`);
      case 'ADVERSE_AUTHORITY':
        return this.cap(`${core} overruled ORR distinguished doctypes:judgments`);
      case 'PRIMARY_LAW':
        return this.cap(`${core} doctypes:laws`);
      default: {
        const court = this.resolveCourtDoctype(jurisdiction);
        return court
          ? this.cap(`${core} doctypes:${court}`)
          : this.cap(`${core} doctypes:judgments`);
      }
    }
  }

  /** Compress query for docfragment formInput (no doctypes filter). */
  fragmentQuery(query: string, context: StructuredLegalQueryContext = {}): string {
    const plannedPhrases = this.cleanPhrases([
      ...(context.propositionPhrases ?? []),
      ...(context.legalIssues ?? []),
      ...(context.statuteSections ?? []),
      ...(context.doctrines ?? []),
      ...(context.entities?.map((entity) => entity.text) ?? []),
      ...(context.remedies ?? []),
      ...(context.issueDecomposition?.flatMap(({ issue, subIssues }) => [
        issue,
        ...(subIssues ?? []),
      ]) ?? []),
    ]);
    if (plannedPhrases.length > 0) {
      return this.cap(plannedPhrases.slice(0, 2).join(' '), 120);
    }
    const keywords = this.extractKeywords(query);
    return this.cap(keywords.slice(0, 5).join(' ') || query.slice(0, 120), 120);
  }

  private cleanPhrases(values?: string[]): string[] {
    return [
      ...new Set(
        (values ?? [])
          .map((value) => this.cleanPhrase(value))
          .filter((value) => value.length >= 2),
      ),
    ];
  }

  private cleanPhrase(value: string): string {
    return value
      .replace(/["\n\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  private extractKeywords(text: string): string[] {
    const sentences = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const primary = sentences[0] ?? text;
    const tokens = primary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
    const unique = [...new Set(tokens)];
    if (unique.length >= 2) return unique.slice(0, 6);

    const statute = text.match(
      /\b(?:BNS|BNSS|BSA|IPC|CrPC|NI Act|Section|Art(?:icle)?|CPC|Consumer Protection Act)\s*\d+[A-Za-z]?/gi,
    );
    if (statute?.[0]) unique.unshift(statute[0].toLowerCase());
    return unique.slice(0, 6);
  }

  private buildOrrPhrase(keywords: string[], rawQuery: string): string {
    const lower = rawQuery.toLowerCase();
    for (const [a, b] of SYNONYM_PAIRS) {
      if (lower.includes(a) || lower.includes(b)) {
        return `"${a}" ORR "${b}"`;
      }
    }
    if (keywords.length >= 2) {
      return `"${keywords[0]}" ORR "${keywords[1]}"`;
    }
    return keywords[0] ? `"${keywords[0]}"` : '';
  }

  private extractStatuteHint(
    query: string,
    practiceArea?: string,
    legalDomain?: LegalDomain,
  ): string | undefined {
    const match = query.match(
      /\b(?:BNS|BNSS|BSA|IPC|CrPC|NI Act|Section|Art(?:icle)?|CPC|Consumer Protection Act|DPDP Act|PMLA|POCSO|NDPS)\s*\d+[A-Za-z]?/i,
    );
    if (match) return match[0];
    if (/\b(cibil|digital.?lend|fraudulent?\s+loan|upi|credit\s+score)\b/i.test(query)) {
      return 'Consumer Protection Act 2019';
    }
    if (/\b(dpdp|personal data|data fiduciary)\b/i.test(query)) {
      return 'Digital Personal Data Protection Act 2023';
    }
    const anchor = domainAnchors(legalDomain)[0];
    if (anchor) return anchor;
    if (practiceArea && /consumer|medical|criminal|civil/i.test(practiceArea)) {
      return practiceArea;
    }
    return undefined;
  }

  /** Targeted IK queries for Contract Act contracting-out / waiver research. */
  private buildContractActWaiverQueries(query: string): string[] {
    if (!isContractActWaiverQuery(query)) return [];
    return CONTRACT_ACT_WAIVER_CASE_QUERIES.map((q) =>
      this.cap(`${q} doctypes:judgments`),
    );
  }

  /** Targeted IK queries for India tenant premature-notice / eviction research. */
  private buildTenantEvictionQueries(query: string): string[] {
    if (!isIndiaTenantEvictionQuery(query)) return [];
    return INDIA_TENANT_EVICTION_CASE_QUERIES.map((q) =>
      this.cap(`${q} doctypes:judgments`),
    );
  }

  /** Targeted IK queries for fraudulent digital lending / CIBIL / UPI fact patterns. */
  private buildDigitalLendingQueries(query: string): string[] {
    if (!/\b(cibil|credit|loan|fraud|rbi|upi|digital.?lend|identity\s+theft|dpdp)\b/i.test(query)) {
      return [];
    }
    return [
      this.cap('"digital lending" OR "loan app" CIBIL doctypes:judgments'),
      this.cap('"identity theft" fraudulent loan doctypes:judgments'),
      this.cap('"Consumer Protection Act" deficiency loan doctypes:judgments'),
      this.cap('"Information Technology Act" identity theft doctypes:judgments'),
      this.cap('RBI "digital lending" fair practices doctypes:judgments'),
      this.cap('"credit information" CIBIL dispute doctypes:judgments'),
      this.cap('"Digital Personal Data Protection" OR DPDP doctypes:laws'),
      this.cap('"Consumer Protection Act" 2019 doctypes:laws'),
    ];
  }

  private buildRequestedAuthorityQueries(
    authorityTypes: RequestedAuthorityType[] | undefined,
    subject: string,
  ): string[] {
    const cleanSubject = this.cleanPhrase(subject || 'law');
    return [...new Set(authorityTypes ?? [])].map((type) => {
      switch (type) {
        case 'BINDING_PRECEDENT':
          return this.cap(`${cleanSubject} doctypes:supremecourt`);
        case 'ADVERSE_AUTHORITY':
          return this.cap(`${cleanSubject} overruled ORR distinguished doctypes:judgments`);
        case 'STATUTE':
        case 'RULE':
        case 'REGULATION':
          return this.cap(`${cleanSubject} doctypes:laws`);
        case 'CITATION':
        case 'CASE_LAW':
        default:
          return this.cap(`${cleanSubject} doctypes:judgments`);
      }
    });
  }

  private isPartnershipArbitrationQuery(query: string, legalDomain?: LegalDomain): boolean {
    return /\b(partner(?:ship|s)?|partnership deed|partnership agreement)\b/i.test(query) &&
      (legalDomain === 'ARBITRATION' ||
        /\b(arbitrat(?:e|ed|ion|or|ors|ral)?|arbitration clause|arbitration agreement)\b/i.test(query));
  }

  private resolveCourtDoctype(jurisdiction?: string): string | undefined {
    if (!jurisdiction) return undefined;
    const key = jurisdiction
      .toLowerCase()
      .replace(/\b(?:high court of|high court|state of)\b/g, ' ')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return (
      JURISDICTION_TO_DOCTYPE[key] ??
      Object.entries(JURISDICTION_TO_DOCTYPE).find(([label]) => key.includes(label))?.[1]
    );
  }

  private cap(query: string, max = 200): string {
    return query.trim().slice(0, max);
  }
}
