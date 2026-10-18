/**
 * Stage 2 — Planning Engine
 *
 * Consumes `MatterProfile` + draft input and produces a `LegalPlan` describing:
 *   - The required document type
 *   - Legal issues and their applicable law / required ingredients
 *   - Mandatory sections and structural rules
 *   - Required evidence and authorities
 *   - Procedural and formatting rules
 *
 * Nothing is generated here. The planner decides; the generator executes later.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ProceduralRouterResult } from '@/ai/drafting/draft-procedural-router.types';
import { DocumentDependencyService } from '@/ai/matter-intelligence/document-dependency.service';
import type {
  LegalPlan,
  LegalIssue,
  RuleEngineResult,
  DraftV2Input,
} from './drafting-v2.types';

/**
 * Static issue taxonomy per document kind.
 * Each entry maps known document kinds to a description of the legal issue,
 * the applicable statutes, required ingredients, and required evidence.
 *
 * This is the seed for Stage 3 (Legal Knowledge Graph). As the graph grows
 * richer, this static registry will be replaced by graph queries.
 */
const ISSUE_TAXONOMY: Record<
  string,
  {
    issues: Array<{
      description: string;
      applicableLaw: string[];
      ingredients: string[];
      evidence: string[];
      authorities: string[];
    }>;
    mandatorySections: string[];
    proceduralRules: string[];
    formattingRules: string[];
  }
> = {
  india_maintenance_order_revision: {
    issues: [
      {
        description: 'Whether interim maintenance quantum is excessive or unsustainable under BNSS §144',
        applicableLaw: ['BNSS 2023 §144', 'BNSS 2023 §438', 'CrPC §125 (pre-2023)'],
        ingredients: [
          'Income and financial capacity of respondent',
          'Needs of applicant/children',
          'Standard of living before separation',
          'Proportionality of maintenance amount',
          'Date from which maintenance payable',
        ],
        evidence: ['Income affidavit', 'Salary slips', 'Bank statements', 'Prior court orders'],
        authorities: ['Rajnesh v Neha (2020 SC)', 'Kalyan Dey Chowdhury v Rita Dey Chowdhury (2017 SC)', 'Sunita Kachwaha v Anil Kachwaha (2014 SC)'],
      },
      {
        description: 'Whether revisional court can interfere with discretionary maintenance order',
        applicableLaw: ['BNSS 2023 §438', 'CrPC §397 (pre-2023)'],
        ingredients: [
          'Jurisdictional error',
          'Perversity or manifest illegality',
          'Error apparent on face of record',
        ],
        evidence: ['Impugned order', 'Trial court record'],
        authorities: ['Amit Kapoor v Ramesh Chander (2012 SC)', 'Surya Vadanan v State of Tamil Nadu (2015 SC)'],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'MAINTAINABILITY', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    proceduralRules: ['File in High Court under BNSS §438', 'Attach impugned order copy', 'Limitation under BNSS §474'],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs', 'Center court name in cause title'],
  },
  india_bail_application: {
    issues: [
      {
        description: 'Whether accused is entitled to bail under BNSS §480/§483',
        applicableLaw: ['BNSS 2023 §480', 'BNSS 2023 §483', 'BNSS 2023 §479'],
        ingredients: [
          'Nature and gravity of accusation',
          'Antecedents of accused',
          'Possibility of fleeing justice',
          'Possibility of tampering with evidence',
          'Prima facie case',
        ],
        evidence: ['FIR copy', 'Arrest memo', 'Chargesheet (if filed)', 'Sureties'],
        authorities: ['State of Rajasthan v Balchand (1977 SC)', 'Sanjay Chandra v CBI (2012 SC)', 'Dataram Singh v State of UP (2018 SC)'],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    proceduralRules: ['Sessions/High Court jurisdiction for non-bailable', 'Limitation not applicable to bail'],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs'],
  },
  /** Alias — runtime kind used by India draft catalog / unified engine. */
  india_regular_bail_bnss_480: {
    issues: [
      {
        description: 'Whether accused is entitled to bail under BNSS §480/§483',
        applicableLaw: ['BNSS 2023 §480', 'BNSS 2023 §483', 'BNSS 2023 §479'],
        ingredients: [
          'Nature and gravity of accusation',
          'Antecedents of accused',
          'Possibility of fleeing justice',
          'Possibility of tampering with evidence',
          'Prima facie case',
          'Fact-anchored defence grounds from Case Brief',
        ],
        evidence: ['FIR copy', 'Arrest memo', 'Chargesheet (if filed)', 'Sureties'],
        authorities: [
          'Satender Kumar Antil v CBI (2022) 10 SCC 51',
          'Sanjay Chandra v CBI (2012) 1 SCC 40',
          'Prasanta Kumar Sarkar v Ashis Chatterjee (2010) 14 SCC 496',
        ],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    proceduralRules: [
      'Sessions/High Court jurisdiction for non-bailable',
      'Limitation not applicable to bail',
      'Post-chargesheet: cite BNSS §193 for police report, not §173',
    ],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs', 'Applicant–Accused not Petitioner'],
  },
  india_anticipatory_bail_bnss_482: {
    issues: [
      {
        description: 'Whether accused is entitled to anticipatory bail under BNSS §482',
        applicableLaw: ['BNSS 2023 §482'],
        ingredients: [
          'Nature and gravity of accusation',
          'Antecedents',
          'Possibility of fleeing justice',
          'Accusation made bona fide',
        ],
        evidence: ['Complaint/FIR if registered', 'Threat of arrest particulars'],
        authorities: ['Siddharam Satlingappa Mhetre v State of Maharashtra (2011) 1 SCC 694'],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    proceduralRules: ['Anticipatory bail only when not yet arrested'],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs', 'Applicant–Accused not Petitioner'],
  },
  india_habeas_corpus_petition: {
    issues: [
      {
        description:
          'Whether the alleged detenue is in unlawful custody warranting habeas corpus under Articles 21, 22 and 226',
        applicableLaw: [
          'Constitution of India Article 226',
          'Constitution of India Article 21',
          'Constitution of India Article 22',
          'BNSS 2023 §35',
          'BNSS 2023 §36',
          'BNSS 2023 §47',
          'BNSS 2023 §48',
          'BNSS 2023 §57',
          'BNSS 2023 §58',
        ],
        ingredients: [
          'Identity of petitioner and relationship to detenue',
          'Identity of detenue',
          'Place and authority of alleged custody',
          'Absence of disclosed lawful arrest or remand',
          'Territorial nexus of the High Court',
        ],
        evidence: [
          'Last-seen particulars',
          'Representations to police',
          'Any arrest memo / FIR / remand order if disclosed',
        ],
        authorities: [
          'D.K. Basu v State of West Bengal (1997) 1 SCC 416',
          'Maneka Gandhi v Union of India (1978) 1 SCC 248',
          'Joginder Kumar v State of UP (1994) 4 SCC 260',
        ],
      },
    ],
    mandatorySections: [
      'CAUSE TITLE',
      'JURISDICTION',
      'FACTS',
      'GROUNDS',
      'PRAYER',
      'INTERIM RELIEF',
      'VERIFICATION',
    ],
    proceduralRules: [
      'File in High Court under Art.226',
      'Affidavit required',
      'Urgency — produce the detenue / disclose custody records',
    ],
    formattingRules: [
      'UPPERCASE headings',
      'Numbered paragraphs',
      'IN THE HIGH COURT OF...',
      'MOST RESPECTFULLY SHOWETH after the caption',
    ],
  },
  india_writ_petition_hc: {
    issues: [
      {
        description: 'Whether fundamental right or statutory right has been violated warranting writ relief',
        applicableLaw: ['Constitution of India Article 226'],
        ingredients: [
          'Existence of legal right',
          'Corresponding duty of respondent',
          'Breach of duty',
          'Absence of adequate alternative remedy',
        ],
        evidence: ['Impugned order/action', 'Prior correspondence', 'Statutory notices'],
        authorities: ['Dwarka Nath v Income Tax Officer (1965 SC)', 'State of Orissa v Dr Binapani Dei (1967 SC)'],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'JURISDICTION', 'FACTS', 'GROUNDS', 'PRAYER', 'INTERIM RELIEF', 'VERIFICATION'],
    proceduralRules: ['File in High Court under Art.226', 'Affidavit required', 'Exhaust alternative remedies ordinarily'],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs', 'IN THE HIGH COURT OF...'],
  },
  india_legal_notice: {
    issues: [
      {
        description: 'Statutory notice requirement prior to suit/action',
        applicableLaw: ['CPC s.80 (government defendant)', 'Specific Relief Act', 'Transfer of Property Act'],
        ingredients: ['Identity of addressee', 'Nature of claim', 'Relief demanded', 'Time for response'],
        evidence: ['Basis documents', 'Prior correspondence'],
        authorities: [],
      },
    ],
    mandatorySections: ['HEADER', 'PARTIES', 'FACTS', 'LEGAL GROUNDS', 'DEMAND', 'CONSEQUENCE OF NON-COMPLIANCE'],
    proceduralRules: ['Send by registered post + email', 'Retain delivery proof'],
    formattingRules: ['Date + reference number', 'Address parties correctly'],
  },
  india_cheque_dishonour_complaint: {
    issues: [
      {
        description: 'Complaint under NI Act s.138 for dishonour of cheque',
        applicableLaw: ['Negotiable Instruments Act 1881 §138', 'NI Act §139', 'NI Act §141'],
        ingredients: [
          'Cheque drawn on bank account',
          'Cheque returned unpaid for insufficient funds or account closure',
          'Legal notice served within 30 days of dishonour',
          'Demand for payment within 15 days of notice',
          'Failure to pay within 15 days',
        ],
        evidence: ['Original cheque', 'Dishonour memo from bank', 'Legal notice with postal receipt', 'Reply (if any)', 'Acknowledgment card'],
        authorities: ['Kusum Ingots and Alloys Ltd v Pennar Peterson Securities Ltd (2000 SC)', 'MSR Leathers v S Palaniappan (2013 SC)'],
      },
    ],
    mandatorySections: ['CAUSE TITLE', 'COMPLAINANT / ACCUSED', 'FACTS', 'LEGAL PROVISIONS', 'PRAYER', 'VERIFICATION'],
    proceduralRules: ['File within 30 days of expiry of 15-day notice period', 'Jurisdiction where cheque presented or drawn'],
    formattingRules: ['UPPERCASE headings', 'Numbered paragraphs'],
  },
};

const GENERIC_ISSUE: LegalPlan['issues'][0] = {
  id: 'issue-generic',
  description: 'Legal issue as described in the case details',
  applicableLaw: [],
  requiredIngredients: ['Material facts', 'Applicable statute', 'Relief sought'],
  requiredEvidence: ['Supporting documents as described in facts'],
  requiredAuthorities: [],
};

@Injectable()
export class PlanningEngineService {
  constructor(
    private readonly documentDependency: DocumentDependencyService,
  ) {}

  /**
   * Build a `LegalPlan` from matter profile, procedural router result, and raw input.
   * Everything decided here — document type, issues, required ingredients, mandatory sections —
   * is deterministic or near-deterministic. No LLM calls.
   *
   * Optional `mapIssues` from DraftingIntelligenceMapService are merged in so planning
   * can reflect map-driven issue framing without replacing the static taxonomy.
   */
  plan(
    input: DraftV2Input,
    profile: MatterProfile,
    proceduralResult: ProceduralRouterResult,
    ruleContext?: RuleEngineResult,
    mapIssues?: Array<{ id: string; label: string; kind?: string }>,
  ): LegalPlan {
    const effectiveKind = proceduralResult.kindOverridden
      ? proceduralResult.recommendedKind
      : input.kind;

    const KIND_ALIASES: Record<string, string> = {
      india_regular_bail_bnss_480: 'india_bail_application',
      india_anticipatory_bail_bnss_482: 'india_anticipatory_bail',
    };
    const taxonomy =
      ISSUE_TAXONOMY[effectiveKind] ??
      ISSUE_TAXONOMY[KIND_ALIASES[effectiveKind] ?? ''] ??
      undefined;

    const taxonomyIssues: LegalIssue[] = taxonomy
      ? taxonomy.issues.map((i, idx) => ({
          id: `issue-${idx}`,
          description: i.description,
          applicableLaw: i.applicableLaw,
          requiredIngredients: i.ingredients,
          requiredEvidence: i.evidence,
          requiredAuthorities: i.authorities,
        }))
      : [{ ...GENERIC_ISSUE }];

    const issues = this.mergeMapIssues(taxonomyIssues, mapIssues);

    // Gather all required evidence across issues
    const allRequiredEvidence = [
      ...new Set(issues.flatMap((i) => i.requiredEvidence)),
    ];

    const mandatorySections =
      taxonomy?.mandatorySections ?? ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'];

    const proceduralRules = [
      ...(taxonomy?.proceduralRules ?? []),
      ...proceduralResult.proceduralWarnings,
    ];

    const formattingRules = taxonomy?.formattingRules ?? [
      'UPPERCASE headings',
      'Numbered paragraphs',
    ];

    return {
      id: randomUUID(),
      documentKind: effectiveKind,
      documentTitle: this.buildDocumentTitle(effectiveKind, input),
      documentClass: proceduralResult.documentClass ?? 'pleading',
      jurisdiction: input.jurisdiction ?? profile.jurisdiction ?? 'IN',
      countryCode: profile.country ?? 'IN',
      forum: input.courtName ?? profile.forum,
      issues,
      applicableLaw: [
        ...new Set(issues.flatMap((i) => i.applicableLaw)),
        ...proceduralResult.governingSections.map((g) => `${g.actId} §${g.section}`),
      ],
      requiredIngredients: [
        ...new Set(issues.flatMap((i) => i.requiredIngredients)),
      ],
      mandatorySections,
      requiredEvidence: allRequiredEvidence,
      requiredAuthorities: [
        ...new Set(issues.flatMap((i) => i.requiredAuthorities)),
      ],
      proceduralRules,
      formattingRules,
      causeTitleVehicle: proceduralResult.causeTitleVehicle,
      filingGrade: this.isFilingGrade(effectiveKind),
      ruleContext,
      createdAt: new Date().toISOString(),
    };
  }

  private isFilingGrade(kind: string): boolean {
    return /appeal|revision|writ|petition|plaint|bail|maintenance|complaint|slp|quashing/i.test(
      kind,
    );
  }

  private buildDocumentTitle(kind: string, input: DraftV2Input): string {
    if (input.label) return input.label;
    return kind
      .replace(/^india_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Prefers taxonomy issues; appends novel map issues by label. */
  private mergeMapIssues(
    taxonomyIssues: LegalIssue[],
    mapIssues?: Array<{ id: string; label: string; kind?: string }>,
  ): LegalIssue[] {
    if (!mapIssues?.length) return taxonomyIssues;

    const existing = new Set(
      taxonomyIssues.map((i) => i.description.trim().toLowerCase()),
    );
    const extras: LegalIssue[] = [];
    for (const mi of mapIssues) {
      const label = mi.label?.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      extras.push({
        id: mi.id || `map-issue-${extras.length}`,
        description: label,
        applicableLaw: [],
        requiredIngredients: ['Material facts', 'Applicable statute', 'Relief sought'],
        requiredEvidence: ['Supporting documents as described in facts'],
        requiredAuthorities: [],
      });
    }

    // When taxonomy is only the generic placeholder, prefer map issues as primary.
    const onlyGeneric =
      taxonomyIssues.length === 1 && taxonomyIssues[0].id === 'issue-generic';
    if (onlyGeneric && extras.length > 0) {
      return extras;
    }
    return [...taxonomyIssues, ...extras];
  }
}
