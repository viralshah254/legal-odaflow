import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import { extractMatterFacts } from './matter-fact-extractor';
import type { DraftIntentMatch } from './draft-intent.types';

/** Explicit discharge / post-chargesheet criminal defence language. */
export function isCriminalDischargeContext(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    /\b(?:application\s+for\s+discharge|discharge\s+application|seeks?\s+discharge|bnss\s*§?\s*250|bnss\s*§?\s*262)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  return (
    /\bchargesheet\b/i.test(lower) &&
    /\b(?:private\s+defen[cs]e|self[-\s]?defen[cs]e|accused|culpable\s+homicide)\b/i.test(lower)
  );
}

const SELF_DEFENSE_CIVIL_EXCLUDE =
  /\b(india_legal_notice|india_civil_plaint|india_application_temp_injunction|india_suit_specific_performance|india_maintenance_|legal notice|civil suit|interim injunction|maintenance application|maintenance order|appeal \/ revision against maintenance)\b/i;

export interface DraftIntentBundleItem {
  kind: string;
  label: string;
  documentKind: string;
  order: number;
  selectedByDefault: boolean;
  /** Default reason shown to the user explaining why this document is recommended. */
  defaultReason?: string;
  /** Primary filing set vs opposing-party documents. */
  bundleRole?: 'primary' | 'opposing_party';
  /** Fact-weighted match confidence (0–1); overrides positional scoring when set. */
  confidence?: number;
  /** Forum or document vehicle inferred — user should confirm before drafting. */
  provisional?: boolean;
}

/**
 * Recommended India matrimonial filing bundle for contested divorce petitions.
 * Primary petition + respondent defence + ancillary maintenance + alternative remedies.
 */
export const MATRIMONIAL_DIVORCE_FILING_BUNDLE: DraftIntentBundleItem[] = [
  {
    kind: 'india_divorce_petition_s13',
    label: 'Divorce Petition (HMA §13)',
    documentKind: 'divorce_petition',
    order: 1,
    selectedByDefault: true,
    defaultReason: 'Primary relief sought — petition for dissolution of marriage on grounds of cruelty and/or desertion.',
  },
  {
    kind: 'india_written_statement',
    label: 'Written Statement (Respondent)',
    documentKind: 'written_statement_matrimonial',
    order: 2,
    selectedByDefault: true,
    defaultReason: 'Defence document for the respondent spouse — pleads reasonable cause for departure and denies cruelty.',
  },
  {
    kind: 'india_maintenance_application_bnss_144',
    label: 'Interim Maintenance Application',
    documentKind: 'maintenance_application',
    order: 3,
    selectedByDefault: false,
    defaultReason: 'Ancillary relief — may be sought during divorce proceedings if the respondent requires financial support.',
  },
  {
    kind: 'india_restitution_conjugal_rights',
    label: 'Restitution of Conjugal Rights (HMA §9)',
    documentKind: 'restitution_conjugal_rights',
    order: 4,
    selectedByDefault: false,
    defaultReason: 'Alternative remedy — relevant only if reconciliation is viable; not appropriate where marriage has irretrievably broken down.',
  },
];

/** Recommended India filing set for agreement-to-sell / specific-performance disputes. */
export const SPECIFIC_PERFORMANCE_FILING_BUNDLE: DraftIntentBundleItem[] = [
  {
    kind: 'india_legal_notice',
    label: 'Legal Notice',
    documentKind: 'legal_notice',
    order: 1,
    selectedByDefault: true,
  },
  {
    kind: 'india_civil_plaint',
    label: 'Civil Suit / Plaint',
    documentKind: 'civil_plaint',
    order: 2,
    selectedByDefault: true,
  },
  {
    kind: 'india_application_temp_injunction',
    label: 'Interim Injunction Application',
    documentKind: 'injunction_application',
    order: 3,
    selectedByDefault: true,
  },
];

/**
 * Returns true when the query is about a contested matrimonial dissolution (divorce /
 * judicial separation) where a ranked set of related documents adds value.
 * Mutual consent divorces are excluded — they have a simpler single-document workflow.
 */
export function isDivorceMatrimonialContext(text: string): boolean {
  const lower = text.toLowerCase();
  const hasDivorceIntent =
    /\b(divorce|dissolution\s+of\s+marriage|judicial\s+sep(aration)?|section\s+13\s+(of\s+)?(the\s+)?hma|hma\s+(sec(tion)?\.?\s*)?13\b|petition\s+(for|of)\s+(divorce|dissolution|separation)|decree\s+of\s+divorce|seeks?\s+divorce|grounds?\s+of\s+(cruelty|desertion|adultery)|mental\s+cruelty|desertion)\b/i.test(
      lower,
    );
  if (!hasDivorceIntent) return false;
  // Exclude mutual consent — different workflow, no "bundle" needed
  const isMutualConsent =
    /\bmutual\s+consent\b|hma\s*§?\s*(sec(tion)?\.?\s*)?13[\s\-.]?\s*b\b|section\s+13[\s\-.]?\s*b/i.test(lower);
  return !isMutualConsent;
}

export function isSpecificPerformancePropertyDispute(text: string): boolean {
  const lower = text.toLowerCase();
  const hasPropertySaleFrame =
    /\b(agreement to sell|sale agreement|sale deed|residential plot|immovable property|plot|flat|apartment|land purchase)\b/i.test(
      lower,
    );
  const hasDisputeRelief =
    /\b(specific performance|sold.{0,40}third party|third[- ]party|breach|injunction|damages|advance payment|wants|seeks|file.{0,20}suit|plaint)\b/i.test(
      lower,
    );
  const isDraftingTransaction =
    /\b(draft|prepare|create|execute|draw up)\b.{0,40}\b(agreement to sell|sale agreement|sale deed)\b/i.test(
      lower,
    );
  return hasPropertySaleFrame && hasDisputeRelief && !isDraftingTransaction;
}

/** Recommended India filing set for stalking / BNS §78 complaint routes. */
export const STALKING_COMPLAINT_BUNDLE: DraftIntentBundleItem[] = [
  {
    kind: 'india_fir_complaint',
    label: 'Police Complaint Seeking Registration of FIR (Stalking — BNS §78 / BNSS §173)',
    documentKind: 'police_complaint',
    order: 1,
    selectedByDefault: true,
    defaultReason:
      'Default route: cognizable stalking under BNS §78 is ordinarily reported to the SHO under BNSS §173 for FIR registration.',
  },
  {
    kind: 'india_complaint_magistrate_bnss_223',
    label: 'Private Criminal Complaint before the Jurisdictional Magistrate',
    documentKind: 'criminal_complaint',
    order: 2,
    selectedByDefault: false,
    defaultReason:
      'Secondary route when police do not register or act, or counsel deliberately chooses a Magistrate complaint.',
  },
];

export const STALKING_CYBER_BUNDLE_ITEM: DraftIntentBundleItem = {
  kind: 'india_cyber_crime_complaint',
  label: 'Cyber Crime Complaint (online / electronic conduct)',
  documentKind: 'cyber_complaint',
  order: 3,
  selectedByDefault: false,
  defaultReason:
    'Include only when facts show online monitoring, messages, fake accounts, or other electronic conduct.',
};

/** Criminal self-defence / homicide defence filing set (never empty for this context). */
export const SELF_DEFENSE_DEFENCE_BUNDLE_BASE: DraftIntentBundleItem[] = [
  {
    kind: 'india_discharge_application_bnss_250',
    label: 'Discharge Application (BNSS §250)',
    documentKind: 'discharge_application',
    order: 1,
    selectedByDefault: true,
    defaultReason:
      'Post-chargesheet / pre-charge-framing — argue the material does not make out a case for trial (causation gaps, private defence).',
  },
  {
    kind: 'india_reply_to_chargesheet',
    label: 'Reply to Chargesheet',
    documentKind: 'defense_memo',
    order: 2,
    selectedByDefault: true,
    defaultReason:
      'Defence reply on the chargesheet — plead absence of causation and/or private defence without admitting disputed facts.',
  },
  {
    kind: 'india_regular_bail_bnss_480',
    label: 'Regular Bail Application (BNSS §480)',
    documentKind: 'bail_application',
    order: 3,
    selectedByDefault: false,
    defaultReason: 'If in custody or after arrest — seek bail on self-defence / weak causation facts.',
  },
  {
    kind: 'india_anticipatory_bail_bnss_482',
    label: 'Anticipatory Bail Application (BNSS §482)',
    documentKind: 'bail_application',
    order: 4,
    selectedByDefault: false,
    defaultReason: 'If arrest is feared — anticipatory bail on self-defence narrative.',
  },
];

function firstAnswer(
  answers: Record<string, string | string[]> | undefined,
  id: string,
): string | undefined {
  const raw = answers?.[id];
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export type MatrimonialRepresentedParty = 'petitioner' | 'respondent';

/** Resolve which spouse the user represents from clarifying answer or fact inference. */
export function resolveMatrimonialPartyRole(
  extracted: import('./matter-fact-extractor').ExtractedMatterFacts,
  answers?: Record<string, string | string[]>,
): MatrimonialRepresentedParty {
  const answer = firstAnswer(answers, 'matrimonial_party_role');
  if (
    answer === 'petitioner' ||
    answer === 'wife_seeking_divorce' ||
    answer === 'husband_seeking_divorce'
  ) {
    return 'petitioner';
  }
  if (answer === 'respondent' || answer === 'defending_spouse') {
    return 'respondent';
  }
  if (extracted.inferredRepresentedParty === 'petitioner') return 'petitioner';
  if (extracted.inferredRepresentedParty === 'respondent') return 'respondent';
  // Wife/petitioner seeking divorce is the common default when posture is apply.
  if (extracted.posture === 'apply' && /\bdivorce\b/i.test(extracted.summaryLines.join(' '))) {
    return 'petitioner';
  }
  return 'petitioner';
}

function divorcePetitionLabel(extracted: import('./matter-fact-extractor').ExtractedMatterFacts): string {
  if (extracted.inferredDivorceGround === 'cruelty') {
    return 'Divorce Petition — HMA §13(1)(ia) cruelty';
  }
  if (extracted.inferredDivorceGround === 'desertion') {
    return 'Divorce Petition — HMA §13(1)(ib) desertion';
  }
  if (extracted.inferredDivorceGround === 'adultery') {
    return 'Divorce Petition — HMA §13(1)(i) adultery';
  }
  return 'Divorce Petition — HMA §13';
}

/**
 * Fact-driven matrimonial filing set — separates petitioner filings from opposing-party documents.
 */
export function resolveMatrimonialDivorceBundle(
  extracted: import('./matter-fact-extractor').ExtractedMatterFacts,
  answers?: Record<string, string | string[]>,
): DraftIntentBundleItem[] {
  const role = resolveMatrimonialPartyRole(extracted, answers);
  const items: DraftIntentBundleItem[] = [];
  let order = 1;

  const push = (item: Omit<DraftIntentBundleItem, 'order'> & { order?: number }) => {
    items.push({ ...item, order: item.order ?? order++ });
  };

  if (role === 'petitioner') {
    push({
      kind: 'india_divorce_petition_s13',
      label: divorcePetitionLabel(extracted),
      documentKind: 'divorce_petition',
      selectedByDefault: true,
      bundleRole: 'primary',
      confidence: 0.97,
      defaultReason:
        extracted.inferredDivorceGround === 'cruelty'
          ? 'Primary relief — dissolution of marriage on the ground of cruelty under HMA §13(1)(ia).'
          : 'Primary relief — petition for dissolution of marriage under HMA §13.',
    });

    if (extracted.seeksInterimMaintenance || extracted.hasMaintenanceContext) {
      push({
        kind: 'india_hma_interim_maintenance_s24',
        label: 'Interim Maintenance & Litigation Expenses — HMA §24',
        documentKind: 'hma_interim_maintenance',
        selectedByDefault: true,
        bundleRole: 'primary',
        confidence: extracted.seeksInterimMaintenance ? 0.95 : 0.88,
        defaultReason:
          'Facts mention maintenance pendente lite or litigation expenses — HMA §24 covers interim maintenance and proceeding expenses during the divorce case.',
      });
    }

    if (extracted.hasChildCustodyDispute) {
      push({
        kind: 'india_hma_custody_interim_s26',
        label: 'Interim Custody, Visitation & Child Expenses — HMA §26',
        documentKind: 'custody_petition',
        selectedByDefault: true,
        bundleRole: 'primary',
        confidence: 0.93,
        defaultReason:
          'Child custody, visitation, or education expenses are in dispute — HMA §26 governs interim custody and related orders in matrimonial proceedings.',
      });
    }

    if (extracted.hasDvCase || extracted.hasThreatOrViolenceSignals) {
      push({
        kind: 'india_domestic_violence_petition',
        label: 'Domestic Violence Application — PWDVA §12 (§§18–23 reliefs)',
        documentKind: 'dv_petition',
        selectedByDefault: true,
        bundleRole: 'primary',
        confidence: extracted.hasDvCase ? 0.94 : 0.87,
        defaultReason:
          'Domestic violence or safety concerns appear in the facts — PWDVA §12 can seek protection, residence, monetary relief, and interim orders under §§18–23.',
      });
    }

    if (
      extracted.hasMaintenanceContext ||
      extracted.hasChildCustodyDispute ||
      /\b(?:wife|child|children|minor)\b/i.test(extracted.summaryLines.join(' '))
    ) {
      push({
        kind: 'india_maintenance_application_bnss_144_family',
        label: 'Maintenance Application for Wife and Child — BNSS §144',
        documentKind: 'maintenance_application',
        selectedByDefault: extracted.hasChildCustodyDispute || extracted.hasMaintenanceContext,
        bundleRole: 'primary',
        confidence: 0.9,
        defaultReason:
          'BNSS §144 provides maintenance for wives, children, and parents — relevant alongside or separate from HMA §24 in family proceedings.',
      });
    }

    if (extracted.seeksFinancialDisclosure || extracted.seeksInterimMaintenance) {
      push({
        kind: 'india_financial_disclosure_affidavit',
        label: 'Financial Disclosure / Assets & Liabilities Affidavit',
        documentKind: 'financial_disclosure_form',
        selectedByDefault: false,
        bundleRole: 'primary',
        confidence: 0.86,
        defaultReason:
          'Income and asset disclosure supports interim maintenance, litigation expenses, and child expense claims.',
      });
    }

    if (extracted.seeksStridhanRecovery) {
      push({
        kind: 'india_stridhan_recovery_application',
        label: 'Application for Return / Protection of Jewellery & Personal Articles',
        documentKind: 'stridhan_recovery',
        selectedByDefault: false,
        bundleRole: 'primary',
        confidence: 0.88,
        defaultReason:
          'Facts mention stridhan, jewellery, or dowry articles — seek return or protection of personal articles.',
      });
    }

    push({
      kind: 'india_written_statement',
      label: 'Written Statement (Respondent)',
      documentKind: 'written_statement_matrimonial',
      selectedByDefault: false,
      bundleRole: 'opposing_party',
      confidence: 0.72,
      defaultReason:
        'Filed by the respondent after service of the divorce petition — not part of your initial filing set as petitioner.',
    });

    push({
      kind: 'india_restitution_conjugal_rights',
      label: 'Restitution of Conjugal Rights (HMA §9)',
      documentKind: 'restitution_conjugal_rights',
      selectedByDefault: false,
      bundleRole: 'opposing_party',
      confidence: 0.68,
      defaultReason:
        'A remedy the respondent may pursue to compel return to the matrimonial home — inappropriate where you seek divorce on safety or cruelty grounds.',
    });
  } else {
    push({
      kind: 'india_written_statement',
      label: 'Written Statement (Respondent)',
      documentKind: 'written_statement_matrimonial',
      selectedByDefault: true,
      bundleRole: 'primary',
      confidence: 0.97,
      defaultReason:
        'Primary defence document — respond to the divorce petition and plead your version of facts.',
    });

    if (/\brestitution\b|\bconjugal\s+rights\b|\breconciliation\b/i.test(extracted.summaryLines.join(' '))) {
      push({
        kind: 'india_restitution_conjugal_rights',
        label: 'Restitution of Conjugal Rights (HMA §9)',
        documentKind: 'restitution_conjugal_rights',
        selectedByDefault: true,
        bundleRole: 'primary',
        confidence: 0.9,
        defaultReason: 'Facts support seeking restitution of conjugal rights under HMA §9.',
      });
    }

    push({
      kind: 'india_divorce_petition_s13',
      label: divorcePetitionLabel(extracted),
      documentKind: 'divorce_petition',
      selectedByDefault: false,
      bundleRole: 'opposing_party',
      confidence: 0.7,
      defaultReason: 'Filed by the petitioner spouse — not your document if you represent the respondent.',
    });
  }

  return items;
}

/**
 * Ranked criminal defence playbook for death + self-defence / discharge matters.
 * Facts drive primary ranking; clarifying answers refine selection defaults.
 */
export function resolveSelfDefenseBundle(
  extracted: import('./matter-fact-extractor').ExtractedMatterFacts,
  answers?: Record<string, string | string[]>,
  query?: string,
): DraftIntentBundleItem[] {
  const goal = firstAnswer(answers, 'self_defense_goal');
  const fir = firstAnswer(answers, 'self_defense_fir_status');
  const custody = firstAnswer(answers, 'self_defense_custody_stage');
  const wantsDischarge =
    goal === 'discharge_application' ||
    extracted.seeksDischarge ||
    Boolean(query && isCriminalDischargeContext(query));
  const chargesheetStage =
    extracted.hasChargesheetFiled ||
    fir === 'fir_against_client' ||
    custody === 'in_custody_or_chargesheet' ||
    // Unknown FIR but facts say chargesheet — treat as post-chargesheet for ranking.
    ((fir === 'unknown' || !fir) && extracted.hasChargesheetFiled);

  const items = SELF_DEFENSE_DEFENCE_BUNDLE_BASE.map((item) => ({ ...item }));

  // Re-order / select defaults by goal + stage.
  if (goal === 'bail_or_anticipatory' || custody === 'arrest_feared') {
    return [
      {
        ...items.find((i) => i.kind === 'india_anticipatory_bail_bnss_482')!,
        order: 1,
        selectedByDefault: true,
      },
      {
        ...items.find((i) => i.kind === 'india_regular_bail_bnss_480')!,
        order: 2,
        selectedByDefault: custody === 'in_custody_or_chargesheet',
      },
      {
        ...items.find((i) => i.kind === 'india_discharge_application_bnss_250')!,
        order: 3,
        selectedByDefault: false,
      },
      {
        ...items.find((i) => i.kind === 'india_reply_to_chargesheet')!,
        order: 4,
        selectedByDefault: false,
      },
    ];
  }

  if (goal === 'police_statement_only' && !chargesheetStage) {
    return [
      {
        kind: 'india_reply_to_chargesheet',
        label: 'Police statement / self-defence narrative',
        documentKind: 'defense_memo',
        order: 1,
        selectedByDefault: true,
        defaultReason:
          'Preserve CCTV, medical, and emergency-call facts; formal discharge/FIR route still open.',
      },
      {
        ...items.find((i) => i.kind === 'india_discharge_application_bnss_250')!,
        order: 2,
        selectedByDefault: false,
      },
      {
        ...items.find((i) => i.kind === 'india_anticipatory_bail_bnss_482')!,
        order: 3,
        selectedByDefault: false,
      },
    ];
  }

  if (goal === 'file_fir_as_survivor') {
    return [
      {
        kind: 'india_fir_complaint',
        label: 'Police Complaint Seeking Registration of FIR',
        documentKind: 'police_complaint',
        order: 1,
        selectedByDefault: true,
        defaultReason: 'Complainant / survivor route — lodge FIR of the attack and self-defence.',
      },
      {
        ...items.find((i) => i.kind === 'india_anticipatory_bail_bnss_482')!,
        order: 2,
        selectedByDefault: false,
      },
    ];
  }

  // Default / discharge / defence / not_sure / unknown FIR: discharge + reply first when chargesheet.
  const dischargeFirst = wantsDischarge || chargesheetStage || !goal || goal === 'not_sure';
  if (dischargeFirst) {
    return [
      {
        ...items.find((i) => i.kind === 'india_discharge_application_bnss_250')!,
        order: 1,
        selectedByDefault: true,
        defaultReason: wantsDischarge
          ? 'Facts / answers seek discharge — BNSS §250 / §262 application on behalf of the accused.'
          : 'Chargesheet / post-FIR defence posture — discharge is the usual first vehicle; confirm stage above to refine.',
      },
      {
        ...items.find((i) => i.kind === 'india_reply_to_chargesheet')!,
        order: 2,
        selectedByDefault: true,
      },
      {
        ...items.find((i) =>
          custody === 'in_custody_or_chargesheet'
            ? i.kind === 'india_regular_bail_bnss_480'
            : i.kind === 'india_anticipatory_bail_bnss_482',
        )!,
        order: 3,
        selectedByDefault: false,
      },
    ];
  }

  return [
    {
      ...items.find((i) => i.kind === 'india_reply_to_chargesheet')!,
      order: 1,
      selectedByDefault: true,
    },
    {
      ...items.find((i) => i.kind === 'india_discharge_application_bnss_250')!,
      order: 2,
      selectedByDefault: extracted.hasChargesheetFiled,
    },
    {
      ...items.find((i) => i.kind === 'india_anticipatory_bail_bnss_482')!,
      order: 3,
      selectedByDefault: false,
    },
  ];
}

export function isStalkingComplaintQuery(text: string): boolean {
  return (
    /\bstalk(?:s|ing|ed)?\b|\bcyber\s*-?\s*stalk/i.test(text) ||
    /\b(?:section|sec\.?|s\.?|§)\s*78\b.{0,20}\bbns\b|\bbns\b.{0,20}(?:section|sec\.?|s\.?|§)?\s*78\b/i.test(
      text,
    )
  );
}

export function hasOnlineConductInQuery(text: string): boolean {
  return /\b(?:whatsapp|instagram|facebook|twitter|social\s+media|email|e-mail|monitor(?:ed|ing)?|fake\s+account|online|cyber)\b/i.test(
    text,
  );
}

export function resolveDocumentBundle(
  profile: MatterProfile | undefined,
  query: string,
  options?: {
    includeCyber?: boolean;
    selfDefenseHomicide?: boolean;
    extracted?: import('./matter-fact-extractor').ExtractedMatterFacts;
    answers?: Record<string, string | string[]>;
  },
): DraftIntentBundleItem[] | undefined {
  const extracted = options?.extracted ?? extractMatterFacts(query);
  const selfDefenseHomicide =
    options?.selfDefenseHomicide ??
    (extracted.isSelfDefenseHomicideContext || isCriminalDischargeContext(query));

  // Stalking / BNS §78 bundle (allowed even alongside other criminal facts)
  if (
    (profile?.practiceArea === 'litigation_disputes' &&
      profile.subPracticeArea === 'criminal_complaint_filing' &&
      isStalkingComplaintQuery(query)) ||
    isStalkingComplaintQuery(query)
  ) {
    // Prefer self-defence playbook when death + self-defence dominates stalking signals.
    if (selfDefenseHomicide && !extracted.hasStalkingAllegation) {
      return resolveSelfDefenseBundle(extracted, options?.answers, query);
    }
    const includeCyber = options?.includeCyber ?? hasOnlineConductInQuery(query);
    return includeCyber
      ? [...STALKING_COMPLAINT_BUNDLE, STALKING_CYBER_BUNDLE_ITEM]
      : STALKING_COMPLAINT_BUNDLE;
  }

  // Death + self-defence / discharge: criminal defence playbook (never civil/matrimonial).
  if (selfDefenseHomicide) {
    return resolveSelfDefenseBundle(extracted, options?.answers, query);
  }

  // Matrimonial / divorce bundle — party-role and fact-driven
  if (
    (profile?.practiceArea === 'family_matrimonial' && profile.subPracticeArea === 'divorce') ||
    isDivorceMatrimonialContext(query)
  ) {
    return resolveMatrimonialDivorceBundle(extracted, options?.answers);
  }

  // Require query-level property-sale dispute — do not trust MI profile alone
  // (e.g. "apartment" in a homicide narrative must not yield Legal Notice / Plaint).
  if (isSpecificPerformancePropertyDispute(query)) {
    return SPECIFIC_PERFORMANCE_FILING_BUNDLE;
  }
  return undefined;
}

export function isPropertySpecificPerformanceContext(
  profile: MatterProfile | undefined,
  query: string,
): boolean {
  if (
    extractMatterFacts(query).isSelfDefenseHomicideContext ||
    isCriminalDischargeContext(query)
  ) {
    return false;
  }
  return isSpecificPerformancePropertyDispute(query);
}

function matchHaystack(match: DraftIntentMatch): string {
  return [
    match.summary,
    match.type === 'curated_draft' ? match.label : '',
    match.type === 'curated_draft' ? match.kind : '',
    match.type === 'template' ? match.name : '',
    match.type === 'template' ? match.documentKind ?? '' : '',
    match.type === 'official_form' ? match.formName : '',
    match.type === 'generate' ? match.suggestedKind : '',
  ]
    .join(' ')
    .toLowerCase();
}

/** Drop irrelevant catalog hits (rent, arbitration, ATS templates) for property suits;
 *  also drop civil/maintenance noise for self-defence homicide / discharge. */
export function shouldExcludeDraftIntentMatch(
  match: DraftIntentMatch,
  profile: MatterProfile | undefined,
  query: string,
): boolean {
  const haystack = matchHaystack(match);
  const selfDefenseHomicide =
    extractMatterFacts(query).isSelfDefenseHomicideContext || isCriminalDischargeContext(query);

  if (selfDefenseHomicide && SELF_DEFENSE_CIVIL_EXCLUDE.test(haystack)) {
    return true;
  }

  if (!isPropertySpecificPerformanceContext(profile, query)) return false;

  if (/\b(rent|eviction|tenancy|lease|landlord|tenant)\b/i.test(haystack)) return true;
  if (/\barbitrat/i.test(haystack)) return true;
  if (match.type === 'template' && /\b(agreement to sell|sale agreement|sale deed)\b/i.test(haystack)) {
    return true;
  }
  if (
    /\b(agreement to sell|agreement_to_sell|sale deed|sale_agreement)\b/i.test(haystack) &&
    !/\b(plaint|suit|notice|injunction)\b/i.test(haystack)
  ) {
    return true;
  }
  return false;
}
