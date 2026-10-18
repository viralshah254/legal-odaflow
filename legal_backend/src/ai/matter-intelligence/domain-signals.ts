/**
 * Shared domain signals for matter intelligence.
 * Consolidated from legal-research-classifier; maps to PLATFORM_DOMAINS slugs.
 */

export interface DomainSignal {
  practiceArea: string;
  patterns: RegExp[];
  priority: number;
}

export const DISPUTE_SIGNALS: RegExp[] = [
  /\b(terminated|termination|dismissed|fired|wrongful|illegal|challenge|challeng|seek(s|ing)?|reinstatement|back wages|set aside|impugn|dispute|complaint against|without (notice|inquiry|hearing)|natural justice)\b/i,
  /\b(seek(s|ing)? (reinstatement|compensation|recovery|refund|damages|relief|maintenance|custody|bail|quashing))\b/i,
];

export const TRANSACTION_SIGNALS: RegExp[] = [
  /\b(draft|drafting|write|prepare|create|draw up|template|generate)\b.{0,40}\b(contract|agreement|nda|lease|employment agreement|partnership|document|deed|will|testament)\b/i,
  /\b(contract|agreement|nda|lease|employment agreement|partnership|document|deed|will|testament)\b.{0,40}\b(draft|drafting|write|prepare|create|draw up|template|generate)\b/i,
  /\b(new hire|offer letter|onboard|vendor agreement|service agreement|shareholders agreement)\b/i,
];

export const COMPLIANCE_SIGNALS: RegExp[] = [
  /\b(filing|register|registration|compliance|return|statutory|annual filing|GST return|ROC filing|EPFO|ESIC)\b/i,
];

export const ADVISORY_SIGNALS: RegExp[] = [
  /\b(legal opinion|opinion on|advise on|forum selection|which forum|what remedies|strategy|assessment)\b/i,
];

export const DOMAIN_SIGNALS: DomainSignal[] = [
  {
    practiceArea: 'insolvency',
    priority: 100,
    patterns: [
      /\b(insolvenc|bankrupt|liquidat|moratorium|IBC|insolvency and bankruptcy|NCLT|resolution professional|winding up|corporate debtor|operational creditor|financial creditor)\b/i,
    ],
  },
  {
    practiceArea: 'tax',
    priority: 95,
    patterns: [
      /\b(income[-\s]?tax|GST|VAT|customs|excise|TDS|assessment order|ITAT|tax tribunal|tax appeal|capital gains|tax notice)\b/i,
    ],
  },
  {
    practiceArea: 'intellectual_property',
    priority: 90,
    patterns: [
      /\b(patent|trademark|trade mark|copyright|design right|passing off|infringement of mark|trade secret)\b/i,
    ],
  },
  {
    practiceArea: 'regulatory_compliance',
    priority: 88,
    patterns: [
      /\b(data protection|data privacy|GDPR|DPDP|personal data|data breach|FEMA|FDI|environmental clearance)\b/i,
    ],
  },
  {
    practiceArea: 'immigration',
    priority: 85,
    patterns: [
      /\b(visa|immigration|deportation|asylum|residence permit|citizenship|work permit|OCI|PIO)\b/i,
    ],
  },
  {
    practiceArea: 'arbitration_adr',
    priority: 84,
    patterns: [
      /\b(arbitrat|arbitral award|arbitration clause|seat of arbitration|section 34|section 11|emergency arbitrator|UNCITRAL)\b/i,
    ],
  },
  {
    practiceArea: 'employment_labour',
    priority: 83,
    patterns: [
      /\b(wrongful termination|wrongful dismissal|industrial dispute|labour court|workman|ID Act|retrenchment|POSH|sexual harassment at workplace|back wages|reinstatement)\b/i,
      /\b(employ|termination of service|severance|gratuity|provident fund|labour|wages)\b/i,
    ],
  },
  {
    practiceArea: 'family_matrimonial',
    priority: 82,
    patterns: [
      /\b(divorce|maintenance|alimony|custody|child support|matrimonial|domestic violence|dowry|guardianship|adoption|judicial separation|hma|hindu marriage)\b/i,
    ],
  },
  {
    practiceArea: 'real_estate_property',
    priority: 81,
    patterns: [
      /\b(property dispute|title deed|possession|tenancy|tenant|landlord|eviction|vacate|easement|partition suit|specific performance|agreement to sell|sale deed|residential plot|immovable property)\b/i,
    ],
  },
  {
    practiceArea: 'consumer',
    priority: 80,
    patterns: [
      /\b(consumer (complaint|forum|protection|dispute)|deficiency in service|unfair trade practice|consumer commission|product liability|defective product)\b/i,
    ],
  },
  {
    practiceArea: 'litigation_disputes',
    priority: 78,
    patterns: [
      /\b(FIR|bail|anticipatory bail|quash|criminal revision|writ petition|habeas|mandamus|cheque bounce|section 138|NI Act|plaint|civil suit|injunction)\b/i,
    ],
  },
  {
    practiceArea: 'corporate_commercial',
    priority: 75,
    patterns: [
      /\b(shareholder|director|board resolution|companies act|merger|acquisition|due diligence|SEBI|NDA|non.?disclosure|MSA|master service)\b/i,
      /\b(order\s*(?:xxxvii|37)|summary\s+suit|commercial\s+recovery|money\s+recovery|purchase\s+order|unpaid\s+invoices?|outstanding\s+commercial\s+dues)\b/i,
    ],
  },
  {
    practiceArea: 'banking_finance',
    priority: 74,
    patterns: [/\b(SARFAESI|debt recovery|loan|mortgage|DRT|NPA|secured creditor)\b/i],
  },
];

export function scoreDomainMatch(text: string, signal: DomainSignal): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const pattern of signal.patterns) {
    if (pattern.test(lower)) hits += 1;
  }
  if (hits === 0) return 0;
  return Math.min(1, 0.5 + hits * 0.15 + signal.priority / 500);
}

export function detectNature(text: string): { nature: import('./matter-intelligence.types').MatterNature; confidence: number } {
  const lower = text.toLowerCase();
  const disputeHits = DISPUTE_SIGNALS.filter((p) => p.test(lower)).length;
  const transactionHits = TRANSACTION_SIGNALS.filter((p) => p.test(lower)).length;
  const complianceHits = COMPLIANCE_SIGNALS.filter((p) => p.test(lower)).length;
  const advisoryHits = ADVISORY_SIGNALS.filter((p) => p.test(lower)).length;

  // Dispute wins over incidental contract language in defence facts
  if (disputeHits > 0 && disputeHits >= transactionHits) {
    return { nature: 'dispute', confidence: Math.min(0.98, 0.65 + disputeHits * 0.1) };
  }
  if (transactionHits > 0) {
    return { nature: 'transaction', confidence: Math.min(0.95, 0.6 + transactionHits * 0.12) };
  }
  if (complianceHits > 0) {
    return { nature: 'compliance', confidence: Math.min(0.9, 0.55 + complianceHits * 0.12) };
  }
  if (advisoryHits > 0) {
    return { nature: 'advisory', confidence: Math.min(0.9, 0.55 + advisoryHits * 0.12) };
  }
  if (disputeHits > 0) {
    return { nature: 'dispute', confidence: 0.55 + disputeHits * 0.08 };
  }
  return { nature: 'unknown', confidence: 0.3 };
}
