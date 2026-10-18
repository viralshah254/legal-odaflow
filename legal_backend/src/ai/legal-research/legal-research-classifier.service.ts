import { Injectable } from '@nestjs/common';
import { MatterIntelligenceService } from '@/ai/matter-intelligence/matter-intelligence.service';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import { buildMiResearchQuery } from '@/ai/matter-intelligence/mi-research-query.builder';
import { routeResearchTaskDeterministically } from './research-task-router.service';
import type { ResearchTaskProfile } from './research-planning.types';

/**
 * Legal domains the research agent supports. Used to select domain-specific
 * checklists and to persist research metadata.
 */
export type LegalDomain =
  | 'CRIMINAL'
  | 'CIVIL_LITIGATION'
  | 'CONTRACT'
  | 'CONSTRUCTION_DELAY'
  | 'CORPORATE_COMMERCIAL'
  | 'INSOLVENCY'
  | 'FAMILY'
  | 'PROPERTY'
  | 'CONSTITUTIONAL'
  | 'TAX'
  | 'EMPLOYMENT'
  | 'INTELLECTUAL_PROPERTY'
  | 'CONSUMER'
  | 'DATA_PRIVACY'
  | 'IMMIGRATION'
  | 'ARBITRATION'
  | 'GENERAL';

export type LegalIssueType =
  | 'STATUTORY_INTERPRETATION'
  | 'CASE_LAW_RESEARCH'
  | 'PROCEDURAL_STRATEGY'
  | 'DEFENCE_ANALYSIS'
  | 'CLAIM_ANALYSIS'
  | 'CONTRACT_REVIEW'
  | 'COMPLIANCE'
  | 'LITIGATION_MEMO'
  | 'MULTI_JURISDICTION_COMPARISON'
  | 'GENERAL_GUIDANCE';

export type LegalResearchIntent =
  | 'CASE_COMPARISON'
  | 'STATUTORY_INTERPRETATION'
  | 'PROCEDURE'
  | 'CURRENT_LAW'
  | 'ADVERSE_AUTHORITY'
  | 'CITATION_LOOKUP'
  | 'GENERAL_RESEARCH';

export interface LegalResearchIntentResolution {
  primary: LegalResearchIntent;
  detected: LegalResearchIntent[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  scores: Partial<Record<LegalResearchIntent, number>>;
  tied: boolean;
  fallbackUsed: boolean;
}

export interface LegalResearchClassification {
  jurisdiction: string;
  subJurisdiction?: string;
  legalDomain: LegalDomain;
  issueType: LegalIssueType;
  proceduralPosture?: string;
  courtLevel?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresCurrentLawCheck: boolean;
  /** Recorded when jurisdiction could not be determined from input and a default was assumed. */
  jurisdictionAssumed: boolean;
  /** Matter-intelligence issue phrases, when classification had an enriched fact profile. */
  legalIssues?: string[];
  /** Auditable, deterministic resolution of the user's research task. */
  researchIntent: LegalResearchIntentResolution;
  /** Foundational executable-planning route. Existing intent fields remain authoritative for compatibility. */
  taskProfile: ResearchTaskProfile;
}

interface DomainSignal {
  domain: LegalDomain;
  patterns: RegExp[];
}

/**
 * Keyword/phrase signals per legal domain. Ordered by specificity — the most
 * specific domains (insolvency, IP, tax) are checked before broad ones so a
 * query like "tax appeal" is not misclassified as generic litigation.
 */
const DOMAIN_SIGNALS: DomainSignal[] = [
  {
    domain: 'CONSTRUCTION_DELAY',
    patterns: [
      /\b(delay analysis|extension of time|\bEOT\b|concurrent delay|critical path|time[- ]impact|as[- ]planned|as[- ]built|windows analysis|prolongation|disruption protocol|SCL Delay|Society of Construction Law|ASCE|FIDIC|programme delay|construction delay|liquidated damages.{0,40}(delay|EOT)|delay and disruption)\b/i,
    ],
  },
  {
    domain: 'INSOLVENCY',
    patterns: [
      /\b(insolvenc|bankrupt|liquidat|moratorium|IBC|insolvency and bankruptcy|NCLT|resolution professional|winding up|corporate debtor|operational creditor|financial creditor|personal guarantor)\b/i,
    ],
  },
  {
    domain: 'TAX',
    patterns: [
      /\b(income[-\s]?tax|GST|VAT|customs|excise|TDS|assessment order|ITAT|tax tribunal|tax appeal|capital gains|tax notice|taxmann|cenvat|tax demand)\b/i,
    ],
  },
  {
    domain: 'INTELLECTUAL_PROPERTY',
    patterns: [
      /\b(patent|trademark|trade mark|copyright|design right|passing off|infringement of mark|geographical indication|trade secret)\b/i,
    ],
  },
  {
    domain: 'DATA_PRIVACY',
    patterns: [
      /\b(data protection|data privacy|GDPR|DPDP|personal data|data breach|privacy policy|data fiduciary|consent manager)\b/i,
    ],
  },
  {
    domain: 'IMMIGRATION',
    patterns: [
      /\b(visa|immigration|deportation|asylum|residence permit|citizenship application|work permit|foreigner|passport seizure|OCI|PIO)\b/i,
    ],
  },
  {
    domain: 'ARBITRATION',
    patterns: [
      /\b(arbitrat\w*|arbitral award|arbitration clause|seat of arbitration|section 34|section 11|emergency arbitrator|UNCITRAL|institutional arbitration)\b/i,
    ],
  },
  {
    domain: 'EMPLOYMENT',
    patterns: [
      /\b(employee|employment|employer|wrongful (?:termination|dismissal)|termination of (?:employment|service)|unfair dismissal|severance|gratuity|provident fund|(?:industrial|labou?r) dispute|labou?r|wages?|workman|workplace harassment|sexual harassment (?:at )?workplace|POSH|retrenchment|unpaid (?:salary|wages?|incentives?|bonus|commission)|(?:employment|employee|workman)\s+notice period|shops? (?:and|&) establishments?|esi)\b/i,
    ],
  },
  {
    domain: 'FAMILY',
    patterns: [
      /\b(divorce|maintenance|alimony|custody|child support|matrimonial|domestic violence|dowry|guardianship|adoption|judicial separation|hindu marriage|muslim personal law|khula|talaq)\b/i,
    ],
  },
  {
    domain: 'PROPERTY',
    patterns: [
      /\b(property dispute|title deed|possession|tenancy|tenant|landlord|eviction|vacate|easement|partition suit|mutation|stamp duty|registration of (sale|deed)|encumbrance|specific relief|land acquisition|RERA)\b/i,
    ],
  },
  {
    domain: 'CONSTITUTIONAL',
    patterns: [
      /\b(writ petition|fundamental right|article \d+|constitutional|habeas corpus|mandamus|certiorari|public interest litigation|\bPIL\b|ultra vires|basic structure|article 14|article 21)\b/i,
    ],
  },
  {
    domain: 'CONSUMER',
    patterns: [
      /\b(consumer (complaint|forum|protection|dispute)|deficiency in service|unfair trade practice|consumer commission|product liability)\b/i,
    ],
  },
  {
    domain: 'CORPORATE_COMMERCIAL',
    patterns: [
      /\b(shareholder|director|board resolution|companies act|oppression and mismanagement|merger|acquisition|due diligence|related[-\s]?party|securities|SEBI|corporate governance|share transfer)\b/i,
    ],
  },
  {
    domain: 'CONTRACT',
    patterns: [
      /\b(breach of contract|contract|agreement|indemnit|force majeure|specific performance|consideration|misrepresentation|damages for breach|termination clause|governing law clause|MOU|memorandum of understanding)\b/i,
    ],
  },
  {
    domain: 'CRIMINAL',
    patterns: [
      /\b(FIR|cheque (bounce|dishonou?r)|bounced cheque|section 138|NI Act|negotiable instruments|bail|anticipatory bail|criminal|offence|accused|prosecution|charge[-\s]?sheet|IPC|BNS\b|BNSS|cognizable|quash|acquittal|conviction|cheating|fraud)\b/i,
    ],
  },
  {
    domain: 'CIVIL_LITIGATION',
    patterns: [
      /\b(civil suit|plaint|injunction|interim relief|cause of action|limitation period|decree|execution petition|recovery suit|declaratory|specific relief|CPC|order \d+ rule)\b/i,
    ],
  },
];

const ISSUE_TYPE_SIGNALS: Array<{ issueType: LegalIssueType; patterns: RegExp[] }> = [
  {
    issueType: 'MULTI_JURISDICTION_COMPARISON',
    patterns: [
      /\b(compare|comparison|across jurisdictions|versus .* law)\b/i,
      /\bin (india|us|uk|kenya)\b.*\b(and|vs\.?|versus)\b.*\b(india|us|uk|kenya)\b/i,
    ],
  },
  {
    issueType: 'CONTRACT_REVIEW',
    patterns: [/\b(review (this|the|my) (contract|agreement|clause)|clause[-\s]?by[-\s]?clause|redline)\b/i],
  },
  {
    issueType: 'DEFENCE_ANALYSIS',
    patterns: [/\b(defence|defense|how (do|can) i defend|rebut|grounds to (quash|set aside)|am i liable)\b/i],
  },
  {
    issueType: 'CLAIM_ANALYSIS',
    patterns: [/\b(can i (sue|claim|recover)|do i have a (case|claim)|strength of (my|the) claim|merits of)\b/i],
  },
  {
    issueType: 'PROCEDURAL_STRATEGY',
    patterns: [/\b(procedure|how (do|to) file|which (court|forum)|next step|strategy|timeline|limitation)\b/i],
  },
  {
    issueType: 'CASE_LAW_RESEARCH',
    patterns: [
      /\b(case law|precedent|judgment|judgement|leading cases|similar cases|comparable cases|cases involving|key outcomes?|supreme court (held|decision)|authorities on)\b/i,
    ],
  },
  {
    issueType: 'STATUTORY_INTERPRETATION',
    patterns: [/\b(section \d+|what does .* (mean|say)|interpretation of|scope of (section|s\.)|bare act)\b/i],
  },
  {
    issueType: 'COMPLIANCE',
    patterns: [/\b(complian|regulatory requirement|what (filings|approvals)|are we required to)\b/i],
  },
  {
    issueType: 'LITIGATION_MEMO',
    patterns: [/\b(memo|memorandum|brief|opinion on)\b/i],
  },
];

const URGENCY_SIGNALS: RegExp[] = [
  /\b(urgent|immediately|asap|today|tomorrow|deadline|time[-\s]?barred|limitation expir|arrest|warrant issued|hearing (today|tomorrow|this week))\b/i,
];

const CURRENT_LAW_SIGNALS: RegExp[] = [
  /\b(still good law|overruled|latest position|current law|recent (judgment|amendment|decision)|as it stands|up to date|2024|2025|2026|amendment)\b/i,
];

interface IntentSignal {
  intent: Exclude<LegalResearchIntent, 'GENERAL_RESEARCH'>;
  weight: number;
  patterns: RegExp[];
}

const RESEARCH_INTENT_SIGNALS: IntentSignal[] = [
  {
    intent: 'CITATION_LOOKUP',
    weight: 4,
    patterns: [
      /\b(?:find|locate|give|provide|verify|check)\s+(?:the\s+)?(?:citation|neutral citation|reporter citation)\b/i,
      /\b(?:citation|neutral citation)\s+(?:for|of)\b/i,
      /\b(?:AIR|SCC|SCR|CriLJ|All ER)\s+\d{4}\b/i,
    ],
  },
  {
    intent: 'ADVERSE_AUTHORITY',
    weight: 4,
    patterns: [
      /\b(?:adverse|contrary|negative|unfavourable|unfavorable)\s+(?:authority|authorities|precedent|case law|decision)\b/i,
      /\b(?:cases?|authorities)\s+(?:against|rejecting|limiting|distinguishing)\b/i,
      /\b(?:overruled|distinguished|doubted|criticised|criticized)\b/i,
    ],
  },
  {
    intent: 'CASE_COMPARISON',
    weight: 3,
    patterns: [
      /\b(?:compare|comparison)\b.*\b(?:facts?|holdings?|ratio|treatment|disposition|precedential)\b/i,
      /\bcases?\s+(?:with|on)\s+(?:similar|comparable|analogous)\s+facts\b.*\b(?:compare|distinguish)\b/i,
      /\bhow (?:have|did) (?:courts?|tribunals?) (?:differ|compare|treat)\b/i,
    ],
  },
  {
    intent: 'STATUTORY_INTERPRETATION',
    weight: 3,
    patterns: [
      /\b(?:interpret(?:ation)?|meaning|scope|construction|applicability)\s+(?:of\s+)?(?:section|article|rule|regulation|provision)\b/i,
      /\bwhat does\s+(?:section|article|rule|regulation)\b.*\b(?:mean|require|cover)\b/i,
      /\b(?:plain|literal|purposive|harmonious)\s+(?:meaning|construction|interpretation)\b/i,
      /\b(?:section|article|rule)\s+\d+[A-Za-z]?\b.*\b(?:interpret|scope|meaning|apply)\b/i,
    ],
  },
  {
    intent: 'PROCEDURE',
    weight: 3,
    patterns: [
      /\b(?:procedure|procedural|filing process|next steps?|which (?:court|forum|tribunal)|how (?:do|to|can) (?:i|we)?\s*(?:file|appeal|challenge|apply))\b/i,
      /\b(?:limitation period|filing deadline|time limit to (?:file|sue|appeal)|court fee|maintainability|appeal route)\b/i,
    ],
  },
  {
    intent: 'CURRENT_LAW',
    weight: 3,
    patterns: [
      /\b(?:current|latest|present|recent|up[- ]to[- ]date)\s+(?:law|position|status|authority|case law)\b/i,
      /\b(?:still good law|good law today|overruled|superseded|repealed|in force|latest amendment)\b/i,
      /\bas (?:of|at)\s+(?:today|20\d{2})\b/i,
    ],
  },
];

@Injectable()
export class LegalResearchClassifierService {
  constructor(private readonly matterIntelligence: MatterIntelligenceService) {}

  /**
   * Async classification — uses Matter Intelligence when extended facts are provided.
   */
  async classifyAsync(input: {
    query: string;
    facts?: string;
    countryCode?: string;
    jurisdiction?: string;
    practiceArea?: string;
  }): Promise<LegalResearchClassification> {
    const facts = input.facts?.trim();
    if (facts && facts.length >= 20) {
      const mi = await this.matterIntelligence.classify({
        facts,
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
      });
      const enrichedQuery = buildMiResearchQuery({
        profile: mi.profile,
        userQuery: input.query,
      });
      return this.fromMatterProfile(mi.profile, { ...input, query: enrichedQuery });
    }
    return this.classify(input);
  }

  /**
   * Deterministic, dependency-free classification of a legal research query.
   * Used to drive domain checklists, overlay selection, current-law checks,
   * and research metadata persistence.
   */
  classify(input: {
    query: string;
    countryCode?: string;
    jurisdiction?: string;
    practiceArea?: string;
  }): LegalResearchClassification {
    const query = input.query ?? '';
    const haystack = `${query} ${input.practiceArea ?? ''}`.toLowerCase();

    const legalDomain = this.detectDomain(haystack, input.practiceArea);
    const researchIntent = this.resolveResearchIntent(haystack);
    const issueType = this.detectIssueType(haystack, legalDomain, researchIntent.primary);

    const { jurisdiction, jurisdictionAssumed } = this.resolveJurisdiction(input.countryCode);

    const urgency = URGENCY_SIGNALS.some((p) => p.test(query)) ? 'HIGH' : 'MEDIUM';

    // Current-law check is required for case-law research, defence/claim analysis,
    // litigation memos, or when the query explicitly asks about the latest position.
    const requiresCurrentLawCheck =
      issueType === 'CASE_LAW_RESEARCH' ||
      issueType === 'DEFENCE_ANALYSIS' ||
      issueType === 'CLAIM_ANALYSIS' ||
      issueType === 'LITIGATION_MEMO' ||
      researchIntent.primary === 'CURRENT_LAW' ||
      CURRENT_LAW_SIGNALS.some((p) => p.test(query));

    return {
      jurisdiction,
      subJurisdiction: input.jurisdiction || undefined,
      legalDomain,
      issueType,
      proceduralPosture: this.detectProceduralPosture(query),
      courtLevel: this.detectCourtLevel(query),
      urgency,
      requiresCurrentLawCheck,
      jurisdictionAssumed,
      researchIntent,
      taskProfile: routeResearchTaskDeterministically({
        objective: query,
        statuteReferences: [],
        citedAuthorities: [],
      }),
    };
  }

  private detectDomain(haystack: string, practiceArea?: string): LegalDomain {
    // An explicit practice area takes priority when it maps cleanly to a domain.
    if (practiceArea) {
      const fromPractice = this.mapPracticeArea(practiceArea);
      if (fromPractice) return fromPractice;
    }
    for (const signal of DOMAIN_SIGNALS) {
      if (signal.patterns.some((p) => p.test(haystack))) {
        return signal.domain;
      }
    }
    return 'GENERAL';
  }

  private mapPracticeArea(practiceArea: string): LegalDomain | undefined {
    const p = practiceArea.toLowerCase();
    if (/criminal/.test(p)) return 'CRIMINAL';
    if (/insolven|bankrupt/.test(p)) return 'INSOLVENCY';
    if (/tax/.test(p)) return 'TAX';
    if (/family|matrimonial/.test(p)) return 'FAMILY';
    if (/property|real estate|land/.test(p)) return 'PROPERTY';
    if (/constitution/.test(p)) return 'CONSTITUTIONAL';
    if (/employ|labour|labor/.test(p)) return 'EMPLOYMENT';
    if (/intellectual|patent|trademark|copyright/.test(p)) return 'INTELLECTUAL_PROPERTY';
    if (/consumer/.test(p)) return 'CONSUMER';
    if (/privacy|data protection/.test(p)) return 'DATA_PRIVACY';
    if (/immigration/.test(p)) return 'IMMIGRATION';
    if (/arbitrat/.test(p)) return 'ARBITRATION';
    if (/construction|delay analysis|fidic|\beot\b/.test(p)) return 'CONSTRUCTION_DELAY';
    if (/corporate|commercial|company/.test(p)) return 'CORPORATE_COMMERCIAL';
    if (/contract/.test(p)) return 'CONTRACT';
    if (/civil/.test(p)) return 'CIVIL_LITIGATION';
    return undefined;
  }

  private detectIssueType(
    haystack: string,
    domain: LegalDomain,
    researchIntent?: LegalResearchIntent,
  ): LegalIssueType {
    if (
      researchIntent === 'CASE_COMPARISON' ||
      researchIntent === 'ADVERSE_AUTHORITY' ||
      researchIntent === 'CITATION_LOOKUP'
    ) {
      return 'CASE_LAW_RESEARCH';
    }
    if (researchIntent === 'STATUTORY_INTERPRETATION') return 'STATUTORY_INTERPRETATION';
    if (researchIntent === 'PROCEDURE') return 'PROCEDURAL_STRATEGY';
    for (const signal of ISSUE_TYPE_SIGNALS) {
      if (signal.patterns.some((p) => p.test(haystack))) {
        return signal.issueType;
      }
    }
    // Sensible default based on the detected domain.
    if (domain === 'CONTRACT' || domain === 'CONSTRUCTION_DELAY') return 'CONTRACT_REVIEW';
    if (domain === 'GENERAL') return 'GENERAL_GUIDANCE';
    return 'GENERAL_GUIDANCE';
  }

  private resolveResearchIntent(haystack: string): LegalResearchIntentResolution {
    const scores: Partial<Record<LegalResearchIntent, number>> = {};
    for (const signal of RESEARCH_INTENT_SIGNALS) {
      const matches = signal.patterns.filter((pattern) => pattern.test(haystack)).length;
      if (matches > 0) scores[signal.intent] = signal.weight + matches - 1;
    }

    const ranked = (Object.entries(scores) as Array<[LegalResearchIntent, number]>)
      .sort(([intentA, scoreA], [intentB, scoreB]) =>
        scoreB - scoreA || intentA.localeCompare(intentB),
      );
    if (ranked.length === 0) {
      const fallback: LegalResearchIntent = 'GENERAL_RESEARCH';
      return {
        primary: fallback,
        detected: [fallback],
        confidence: 'LOW',
        scores: { [fallback]: 1 },
        tied: false,
        fallbackUsed: true,
      };
    }

    const topScore = ranked[0][1];
    const tied = ranked.length > 1 && ranked[1][1] === topScore;
    return {
      primary: ranked[0][0],
      detected: ranked.map(([intent]) => intent),
      confidence: tied ? 'LOW' : topScore >= 4 ? 'HIGH' : 'MEDIUM',
      scores,
      tied,
      fallbackUsed: false,
    };
  }

  private resolveJurisdiction(countryCode?: string): {
    jurisdiction: string;
    jurisdictionAssumed: boolean;
  } {
    if (countryCode && countryCode.trim()) {
      return { jurisdiction: countryCode.trim().toUpperCase(), jurisdictionAssumed: false };
    }
    // Do not silently attach India law to a globally worded question. UNKNOWN
    // forces downstream research to disclose the gap and seek clarification.
    return { jurisdiction: 'UNKNOWN', jurisdictionAssumed: true };
  }

  private detectProceduralPosture(query: string): string | undefined {
    if (/\bappeal\b/i.test(query)) return 'appeal';
    if (/\brevision\b/i.test(query)) return 'revision';
    if (/\bexecution\b/i.test(query)) return 'execution';
    if (/\btrial\b/i.test(query)) return 'trial';
    if (/\bpre[-\s]?litigation|before filing|notice stage\b/i.test(query)) return 'pre-litigation';
    if (/\bbail\b/i.test(query)) return 'bail';
    if (/\bquash/i.test(query)) return 'quashing';
    return undefined;
  }

  private detectCourtLevel(query: string): string | undefined {
    if (/\bsupreme court\b/i.test(query)) return 'Supreme Court';
    if (/\bhigh court\b/i.test(query)) return 'High Court';
    if (/\b(district court|sessions court|magistrate)\b/i.test(query)) return 'District/Subordinate';
    if (/\btribunal\b/i.test(query)) return 'Tribunal';
    return undefined;
  }

  private fromMatterProfile(
    profile: MatterProfile,
    input: { query: string; countryCode?: string; jurisdiction?: string },
  ): LegalResearchClassification {
    const query = input.query ?? '';
    const legalDomain = this.mapPracticeAreaToLegalDomain(profile);
    const intentHaystack = `${query} ${(profile.issues ?? []).join(' ')}`.toLowerCase();
    const researchIntent = this.resolveResearchIntent(intentHaystack);
    const issueType = this.detectIssueType(
      intentHaystack,
      legalDomain,
      researchIntent.primary,
    );
    const { jurisdiction, jurisdictionAssumed } = this.resolveJurisdiction(input.countryCode);
    const urgency = URGENCY_SIGNALS.some((p) => p.test(query)) ? 'HIGH' : 'MEDIUM';
    const requiresCurrentLawCheck =
      issueType === 'CASE_LAW_RESEARCH' ||
      issueType === 'DEFENCE_ANALYSIS' ||
      issueType === 'CLAIM_ANALYSIS' ||
      issueType === 'LITIGATION_MEMO' ||
      researchIntent.primary === 'CURRENT_LAW' ||
      CURRENT_LAW_SIGNALS.some((p) => p.test(query));

    return {
      jurisdiction,
      subJurisdiction: input.jurisdiction || profile.jurisdiction || undefined,
      legalDomain,
      issueType,
      proceduralPosture: profile.posture ?? this.detectProceduralPosture(query),
      courtLevel: this.detectCourtLevel(query),
      urgency,
      requiresCurrentLawCheck,
      jurisdictionAssumed,
      legalIssues: profile.issues,
      researchIntent,
      taskProfile: routeResearchTaskDeterministically({
        objective: query,
        facts: profile.issues.join(' '),
        statuteReferences: [],
        citedAuthorities: [],
      }),
    };
  }

  private mapPracticeAreaToLegalDomain(profile: MatterProfile): LegalDomain {
    const area = profile.practiceArea;
    const sub = profile.subPracticeArea ?? '';
    if (area === 'employment_labour') return 'EMPLOYMENT';
    if (area === 'family_matrimonial') return 'FAMILY';
    if (area === 'consumer') return 'CONSUMER';
    if (area === 'real_estate_property') return 'PROPERTY';
    if (area === 'insolvency') return 'INSOLVENCY';
    if (area === 'tax') return 'TAX';
    if (area === 'arbitration_adr') return 'ARBITRATION';
    if (area === 'corporate_commercial') {
      return profile.nature === 'transaction' ? 'CONTRACT' : 'CORPORATE_COMMERCIAL';
    }
    if (area === 'litigation_disputes') {
      if (/criminal|fir|bail/.test(sub)) return 'CRIMINAL';
      if (/writ|constitutional/.test(sub)) return 'CONSTITUTIONAL';
      return 'CIVIL_LITIGATION';
    }
    return this.detectDomain(`${area} ${sub}`, profile.practiceArea);
  }
}
