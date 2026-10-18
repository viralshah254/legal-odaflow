import { Injectable } from '@nestjs/common';
import type { AuthorityRetrievalPlan } from '../contracts/authority-verification';
import { getAuthorityRequirement } from '../draft-authority-requirements';
import { resolveDraftReadinessPolicy } from '../playbooks/draft-readiness-policy';

interface KindPlanSeed {
  legalIssues: string[];
  permittedStatutes: string[];
  excludedDomains: string[];
}

const DEFAULT_EXCLUDED_DOMAINS = [
  'data_protection',
  'biodiversity',
  'copyright',
  'corruption',
  'criminal_procedure',
  'constitutional_amendment',
  'tax_indirect',
  'company_insolvency',
  'banking_recovery',
];

const CIVIL_SPECIFIC_PERFORMANCE: KindPlanSeed = {
  legalIssues: [
    'specific_performance',
    'readiness_and_willingness',
    'subsequent_transferee_notice',
    'unregistered_agreement',
    'temporary_injunction',
    'permanent_injunction',
    'limitation',
    'territorial_jurisdiction',
    'alternative_compensation',
    'costs',
  ],
  permittedStatutes: [
    'SRA',
    'Specific Relief Act',
    'TPA',
    'Transfer of Property Act',
    'CPC',
    'Code of Civil Procedure',
    'Limitation Act',
    'Registration Act',
    'Indian Contract Act',
    'Contract Act',
    'Gujarat Stamp Act',
    'Stamp Act',
  ],
  excludedDomains: DEFAULT_EXCLUDED_DOMAINS,
};

const CIVIL_PLAINT: KindPlanSeed = {
  legalIssues: [
    'cause_of_action',
    'jurisdiction',
    'limitation',
    'relief',
    'temporary_injunction',
    'costs',
  ],
  permittedStatutes: [
    'CPC',
    'Code of Civil Procedure',
    'Limitation Act',
    'SRA',
    'Specific Relief Act',
    'TPA',
    'Transfer of Property Act',
    'Indian Contract Act',
    'Contract Act',
  ],
  excludedDomains: DEFAULT_EXCLUDED_DOMAINS,
};

const COMMERCIAL_RECOVERY: KindPlanSeed = {
  legalIssues: [
    'written_or_liquidated_debt',
    'order_37_maintainability',
    'leave_to_defend',
    'limitation',
    'territorial_jurisdiction',
    'pecuniary_jurisdiction',
    'interest',
    'commercial_courts_act_section_12a',
  ],
  permittedStatutes: [
    'CPC',
    'Code of Civil Procedure',
    'Commercial Courts Act',
    'Limitation Act',
    'Indian Contract Act',
    'Contract Act',
  ],
  excludedDomains: DEFAULT_EXCLUDED_DOMAINS.filter((domain) => domain !== 'banking_recovery'),
};

const TEMP_INJUNCTION: KindPlanSeed = {
  legalIssues: [
    'temporary_injunction',
    'prima_facie_case',
    'balance_of_convenience',
    'irreparable_injury',
    'status_quo',
  ],
  permittedStatutes: ['CPC', 'Code of Civil Procedure', 'SRA', 'Specific Relief Act'],
  excludedDomains: DEFAULT_EXCLUDED_DOMAINS,
};

const BAIL: KindPlanSeed = {
  legalIssues: [
    'bail',
    'liberty',
    'flight_risk',
    'triple_test',
    'bail_conditions',
    'prolonged_detention',
  ],
  permittedStatutes: ['BNSS', 'CrPC', 'CRPC', 'BNS', 'IPC', 'Constitution'],
  excludedDomains: [
    'data_protection',
    'biodiversity',
    'copyright',
    'civil_property',
    'specific_performance',
  ],
};

const KIND_SEEDS: Array<{ match: RegExp; seed: KindPlanSeed }> = [
  {
    match: /suit_recovery_cpc_37|summary_suit_recovery|money_recovery|civil_suit_money_recovery/i,
    seed: COMMERCIAL_RECOVERY,
  },
  { match: /specific_performance/i, seed: CIVIL_SPECIFIC_PERFORMANCE },
  { match: /temp_injunction|temporary_injunction|injunction/i, seed: TEMP_INJUNCTION },
  { match: /civil_plaint|civil_suit|india_plaint/i, seed: CIVIL_PLAINT },
  { match: /anticipatory|bail/i, seed: BAIL },
];

/** Act/title patterns → excluded domain labels. */
export const DOMAIN_ACT_PATTERNS: Array<{ domain: string; pattern: RegExp }> = [
  { domain: 'data_protection', pattern: /\bDPDP\b|digital\s+personal\s+data|data\s+protection/i },
  { domain: 'biodiversity', pattern: /biological\s+diversity|biodiversity/i },
  { domain: 'copyright', pattern: /\bcopyright\s+act\b/i },
  { domain: 'corruption', pattern: /prevention\s+of\s+corruption|\bPC\s+Act\b/i },
  {
    domain: 'criminal_procedure',
    pattern: /\bCrPC\b|\bCRPC\b|\bBNSS\b|anticipatory\s+bail|s\.?\s*438\b/i,
  },
  {
    domain: 'constitutional_amendment',
    pattern: /article\s*370|appendix\s*III|constitution.*appendix/i,
  },
  { domain: 'tax_indirect', pattern: /\bGST\b|\bCGST\b|customs\s+act/i },
  { domain: 'company_insolvency', pattern: /\bIBC\b|insolvency\s+and\s+bankruptcy/i },
  {
    domain: 'banking_recovery',
    pattern:
      /\bloan\b|personal\s+loan|recovery\s+of|SARFAESI|\bDRT\b|guarantor|outstanding\s+principal|suit\s+for\s+recovery|ex[- ]parte\s+judgment\s+in\s+suit\s+for\s+recovery|\bCanara\s+Bank\b|\bState\s+Bank\b|\bHDFC\s+Bank\b|\bICICI\s+Bank\b/i,
  },
];

@Injectable()
export class AuthorityRetrievalPlannerService {
  buildPlan(input: {
    documentKind: string;
    jurisdiction?: string;
    rawFacts?: string;
  }): AuthorityRetrievalPlan {
    const kind = input.documentKind ?? '';
    const seed = this.resolveSeed(kind, input.rawFacts);
    const requirement = getAuthorityRequirement(kind);
    const policy = resolveDraftReadinessPolicy(kind);

    // When facts clearly indicate specific performance, upgrade civil plaint plan
    const facts = (input.rawFacts ?? '').toLowerCase();
    let legalIssues = [...seed.legalIssues];
    let permittedStatutes = [...seed.permittedStatutes];
    if (
      /civil_plaint|civil_suit/i.test(kind) &&
      /specific\s+performance|agreement\s+to\s+sell|sale\s+deed|readiness\s+and\s+willingness/i.test(
        facts,
      )
    ) {
      legalIssues = [...new Set([...legalIssues, ...CIVIL_SPECIFIC_PERFORMANCE.legalIssues])];
      permittedStatutes = [
        ...new Set([...permittedStatutes, ...CIVIL_SPECIFIC_PERFORMANCE.permittedStatutes]),
      ];
    }

    return {
      jurisdiction: input.jurisdiction?.trim() || 'IN',
      documentKind: kind,
      legalIssues: [...new Set([...legalIssues, ...(policy.requiredAuthorityTopics ?? [])])],
      permittedStatutes: [
        ...new Set([...permittedStatutes, ...(policy.permittedStatutes ?? [])]),
      ],
      excludedDomains:
        policy.excludedAuthorityDomains && policy.excludedAuthorityDomains.length > 0
          ? policy.excludedAuthorityDomains
          : seed.excludedDomains,
      requiredTopics: requirement.requiredTopics ?? [],
    };
  }

  /** Detect excluded domain from authority title/citation/summary. */
  detectExcludedDomain(
    text: string,
    plan: AuthorityRetrievalPlan,
  ): string | null {
    for (const { domain, pattern } of DOMAIN_ACT_PATTERNS) {
      if (!plan.excludedDomains.includes(domain)) continue;
      if (pattern.test(text)) return domain;
    }
    return null;
  }

  /** True if act name appears in permittedStatutes (fuzzy). */
  isPermittedStatute(actText: string, plan: AuthorityRetrievalPlan): boolean {
    const hay = actText.toLowerCase();
    return plan.permittedStatutes.some((p) => {
      const needle = p.toLowerCase();
      return hay.includes(needle) || needle.includes(hay.slice(0, 12));
    });
  }

  private resolveSeed(kind: string, rawFacts?: string): KindPlanSeed {
    for (const { match, seed } of KIND_SEEDS) {
      if (match.test(kind)) return seed;
    }
    if (
      rawFacts &&
      /specific\s+performance|agreement\s+to\s+sell|readiness\s+and\s+willingness/i.test(rawFacts)
    ) {
      return CIVIL_SPECIFIC_PERFORMANCE;
    }
    return {
      legalIssues: ['cause_of_action', 'jurisdiction', 'relief'],
      permittedStatutes: ['CPC', 'Code of Civil Procedure'],
      excludedDomains: DEFAULT_EXCLUDED_DOMAINS,
    };
  }
}
