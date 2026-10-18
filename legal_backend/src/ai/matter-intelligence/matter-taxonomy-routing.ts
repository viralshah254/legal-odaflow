import type { MatterNature, MatterProfile } from './matter-intelligence.types';
import { findPracticeArea, type SubPracticeDefinition } from './matter-taxonomy';

export interface MatterRoutingRule {
  practiceArea: string;
  subPracticeArea: string;
  nature: MatterNature | MatterNature[];
  signals: RegExp[];
  issues: string[];
  recommendedActions: string[];
  documentKind?: string;
  excludePracticeAreas?: string[];
}

export const MATTER_ROUTING_RULES: MatterRoutingRule[] = [
  {
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'commercial_recovery',
    nature: 'dispute',
    signals: [
      /\b(order\s*(?:xxxvii|37)|summary\s+suit|commercial\s+(?:recovery|summary)\s+suit|money\s+recovery)\b/i,
      /\b(purchase\s+order|unpaid\s+invoices?|outstanding\s+(?:dues|balance)|written\s+acknowledg(?:e)?ment)\b/i,
    ],
    issues: [
      'Commercial debt recovery',
      'Written-contract summary procedure',
      'Territorial and pecuniary jurisdiction',
      'Pre-institution mediation compliance',
    ],
    recommendedActions: [
      'Confirm Order XXXVII written-instrument maintainability',
      'Confirm designated Commercial Court and specified value',
      'Verify Section 12A compliance',
      'Prepare commercial summary suit and supporting filing documents',
    ],
    documentKind: 'summary_suit_recovery',
    excludePracticeAreas: [
      'family_matrimonial',
      'consumer',
      'regulatory_compliance',
    ],
  },
  // ─── Divorce / Judicial Separation / Restitution ────────────────────────────
  // Must be placed BEFORE the maintenance rule so cruelty+desertion narratives
  // that also mention ancillary alimony are not mis-routed to maintenance.
  {
    practiceArea: 'family_matrimonial',
    subPracticeArea: 'divorce',
    nature: 'dispute',
    signals: [
      /\b(divorce|dissolution\s+of\s+marriage|judicial\s+sep(aration)?|petition\s+(for|of)\s+(divorce|dissolution|separation))\b/i,
      /\b(section\s+13\s+(of\s+)?(the\s+)?hma|hma\s+(sec(tion)?\.?\s*)?13\b|grounds?\s+of\s+(cruelty|desertion|adultery)|mental\s+cruelty|desertion|restitution\s+of\s+conjugal\s+rights|section\s+9\s+(of\s+)?hma)\b/i,
    ],
    issues: ['Grounds of divorce', 'Cruelty or desertion', 'Ancillary relief'],
    recommendedActions: [
      'Draft divorce petition under HMA §13',
      'Gather evidence of cruelty/desertion',
      'Consider interim maintenance and custody claims',
    ],
    documentKind: 'divorce_petition',
    excludePracticeAreas: ['litigation_disputes'],
  },
  {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'dispute',
    signals: [
      // Require employment-dispute phrasing — bare "dismissed" matches Family Court orders (e.g. maintenance applications).
      /\b(wrongful termination|wrongful dismissal|illegal termination|terminated without|termination of (service|employment)|dismissed from (service|employment)|fired from|reinstatement|back wages|loss of confidence)\b/i,
      /\b(workman|industrial dispute|labour court|ID Act)\b/i,
    ],
    issues: [
      'Wrongful termination',
      'Workman classification',
      'Natural justice violation',
      'Reinstatement claim',
      'Back wages claim',
    ],
    recommendedActions: [
      'Review termination letter and employment records',
      'Assess workman vs managerial employee status',
      'Draft legal opinion on forum and remedies',
      'Issue demand notice to employer',
      'Prepare labour court / industrial dispute petition',
    ],
    documentKind: 'wrongful_termination_petition',
    excludePracticeAreas: ['arbitration_adr', 'corporate_commercial', 'real_estate_property'],
  },
  {
    practiceArea: 'employment_labour',
    subPracticeArea: 'employment_contract',
    nature: 'transaction',
    signals: [
      /\b(draft|prepare|create)\b.{0,30}\b(employment contract|offer letter|appointment letter)\b/i,
      /\b(new hire|onboard|employment agreement)\b/i,
    ],
    issues: ['Employment contract drafting'],
    recommendedActions: ['Draft employment agreement', 'Define compensation and notice terms'],
    documentKind: 'employment_contract',
  },
  {
    practiceArea: 'family_matrimonial',
    subPracticeArea: 'maintenance',
    nature: 'dispute',
    signals: [
      /\b(maintenance|alimony|crpc\s*125|bnss\s*144|section\s+24|hma|interim maintenance)\b/i,
      /\b(family court|matrimonial|dowry|mental cruelty|hindu (rites|marriage))\b/i,
    ],
    issues: ['Maintenance claim', 'Interim vs final order'],
    recommendedActions: [
      'Review impugned maintenance order',
      'Gather income and expense affidavits',
      'File maintenance application or revision',
    ],
    documentKind: 'maintenance_order_revision',
    excludePracticeAreas: ['litigation_disputes'],
  },
  {
    practiceArea: 'real_estate_property',
    subPracticeArea: 'specific_performance',
    nature: 'dispute',
    signals: [
      /\b(agreement to sell|sale agreement|sale deed|residential plot|immovable property|advance payment)\b/i,
      /\b(specific performance|sold.{0,40}third party|third[- ]party sale|injunction|damages for breach)\b/i,
    ],
    issues: [
      'Breach of agreement to sell',
      'Specific performance claim',
      'Injunction against third-party sale',
      'Recovery of advance payment',
      'Damages for breach',
    ],
    recommendedActions: [
      'Issue legal notice to vendor',
      'File suit for specific performance',
      'Seek interim injunction restraining third-party sale',
    ],
    documentKind: 'civil_plaint',
    excludePracticeAreas: ['arbitration_adr', 'corporate_commercial'],
  },
  {
    practiceArea: 'family_matrimonial',
    subPracticeArea: 'domestic_violence',
    nature: 'dispute',
    signals: [/\b(domestic violence|dv act|pwdva|protection order|non.?molestation)\b/i],
    issues: ['Domestic violence', 'Protection order'],
    recommendedActions: ['File domestic violence petition', 'Seek interim protection'],
    documentKind: 'protective_injunction',
  },
  {
    // Constitutional writ / habeas corpus — must be placed BEFORE criminal_fir_bail
    // because keywords like "arrest" and "custody" appear in both writ petitions and
    // bail applications. Multiple writ-specific signals outscore the bail rule.
    practiceArea: 'litigation_disputes',
    subPracticeArea: 'writ',
    nature: 'dispute',
    signals: [
      // Signal 1: explicit writ legal vocabulary
      /\b(habeas corpus|writ petition|certiorari|mandamus|prohibition|quo warranto)\b/i,
      // Signal 2: constitutional article references
      /\b(article\s+226|art\.?\s*226|article\s+32|art\.?\s*32)\b/i,
      // Signal 3: factual unlawful-detention indicators that signal habeas corpus
      /\b(not produced before.{0,40}magistrate|unlawful detention|illegal detention|unrecorded detention|unrecorded custody|enforced disappearance)\b/i,
      // Signal 4: location/custody denial patterns specific to habeas corpus
      /\b(whereabouts.{0,30}unknown|location.{0,30}undisclosed|whereabouts.{0,30}not.{0,20}known|denied having.{0,20}in custody)\b/i,
    ],
    issues: [
      'Unlawful or unrecorded detention',
      'Failure to produce before Magistrate within 24 hours',
      'Absence of arrest memo / FIR',
      'Violation of Art. 21 — right to personal liberty',
      'Habeas corpus — right to immediate production',
    ],
    recommendedActions: [
      'File Habeas Corpus Petition under Art. 226 before High Court',
      'Seek immediate production and release order',
      'Demand preservation of CCTV footage and custody records',
      'Explore compensation and disciplinary inquiry',
    ],
    documentKind: 'writ_petition',
    excludePracticeAreas: ['corporate_commercial', 'consumer'],
  },
  {
    practiceArea: 'litigation_disputes',
    subPracticeArea: 'criminal_complaint_filing',
    nature: 'dispute',
    signals: [
      /\bstalking?\b/i,
      /\bcyberstalking?\b/i,
      /\b(file|lodge|wants? to file|wants? to lodge)\s+(a\s+)?complaint\b/i,
      /\bcomplaint against\b.{0,80}\b(police|magistrate|court)\b/i,
      /\bvictim\b.{0,60}\b(criminal|offence|offense|stalked|harassed)\b/i,
    ],
    issues: [
      'Filing criminal complaint / FIR',
      'Stalking under BNS §78',
      'Harassment — filing against accused',
    ],
    recommendedActions: [
      'Identify applicable BNS/BNSS offence sections',
      'Draft complaint to Magistrate or police station',
      'Attach supporting evidence',
    ],
    documentKind: 'police_complaint',
    excludePracticeAreas: ['corporate_commercial', 'consumer'],
  },
  {
    practiceArea: 'litigation_disputes',
    subPracticeArea: 'criminal_fir_bail',
    nature: 'dispute',
    signals: [/\b(bail|anticipatory bail|FIR|arrest|custody|quash)\b/i],
    issues: ['Bail application', 'FIR quashing'],
    recommendedActions: ['Review FIR and charges', 'Prepare bail application'],
    documentKind: 'bail_application',
    excludePracticeAreas: ['corporate_commercial', 'consumer'],
  },
  {
    practiceArea: 'consumer',
    subPracticeArea: 'defective_product',
    nature: 'dispute',
    signals: [/\b(defective|deficiency|consumer complaint|refund|product liability)\b/i],
    issues: ['Deficiency of service', 'Product defect'],
    recommendedActions: ['Send legal notice', 'File consumer complaint'],
    documentKind: 'consumer_complaint',
    excludePracticeAreas: ['corporate_commercial'],
  },
  {
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'nda',
    nature: 'transaction',
    signals: [/\b(nda|non.?disclosure|confidentiality agreement)\b/i],
    issues: ['NDA drafting'],
    recommendedActions: ['Draft mutual or unilateral NDA', 'Define confidential information scope'],
    documentKind: 'nda',
  },
  {
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'msa',
    nature: 'transaction',
    signals: [/\b(service agreement|msa|master service|vendor contract|contractor agreement)\b/i],
    issues: ['Service agreement drafting'],
    recommendedActions: ['Draft service agreement', 'Define scope and payment terms'],
    documentKind: 'service_agreement',
  },
  {
    practiceArea: 'arbitration_adr',
    subPracticeArea: 'arbitration',
    nature: 'dispute',
    signals: [/\b(arbitration|arbitral|section 11|section 34)\b/i],
    issues: ['Arbitration proceedings'],
    recommendedActions: ['Review arbitration clause', 'File arbitration petition'],
    documentKind: 'arbitration_petition',
  },
];

/** Family maintenance narratives often mention the husband's employment — must not route to labour law. */
export function hasStrongFamilyMaintenanceContext(text: string): boolean {
  const lower = text.toLowerCase();
  const hasMaintenance = /\b(maintenance|alimony|interim maintenance)\b/i.test(lower);
  const hasFamilyFrame =
    /\b(family court|matrimonial|dowry|mental cruelty|hindu (rites|marriage)|matrimonial home)\b/i.test(
      lower,
    );
  return hasMaintenance && hasFamilyFrame;
}

/**
 * Returns true when the text is primarily about a divorce / judicial separation decree.
 * Maintenance/alimony appearing as ancillary relief does NOT disqualify.
 * A maintenance order being challenged (revision, set aside) does disqualify.
 */
export function hasStrongDivorceContext(text: string): boolean {
  const lower = text.toLowerCase();
  const hasDivorceIntent =
    /\b(divorce|dissolution\s+of\s+marriage|judicial\s+sep(aration)?|section\s+13\s+(of\s+)?(the\s+)?hma|hma\s+(sec(tion)?\.?\s*)?13\b|petition\s+(for|of)\s+(divorce|dissolution|separation)|decree\s+of\s+divorce|seeks?\s+divorce|grounds?\s+of\s+(cruelty|desertion|adultery))\b/i.test(
      lower,
    );
  if (!hasDivorceIntent) return false;
  const hasMaintenanceOrderChallenge =
    /\b(interim\s+maintenance\s+order|maintenance\s+order.{0,30}(revision|challenge|set aside|appeal)|revision.{0,30}maintenance\s+order|against.{0,30}maintenance\s+order|crpc\s*§?\s*125|bnss\s*§?\s*144|bnss\s+144|section\s+125|section\s+144)\b/i.test(
      lower,
    );
  return !hasMaintenanceOrderChallenge;
}

export function matchRoutingRule(
  text: string,
  nature: MatterNature,
  options?: { preferredPracticeArea?: string },
): MatterRoutingRule | undefined {
  const lower = text.toLowerCase();
  let best: { rule: MatterRoutingRule; score: number } | undefined;

  for (const rule of MATTER_ROUTING_RULES) {
    if (
      rule.practiceArea === 'employment_labour' &&
      rule.subPracticeArea === 'wrongful_termination' &&
      hasStrongFamilyMaintenanceContext(text)
    ) {
      continue;
    }

    // Skip the maintenance routing rule when the primary intent is divorce.
    if (
      rule.practiceArea === 'family_matrimonial' &&
      rule.subPracticeArea === 'maintenance' &&
      hasStrongDivorceContext(text)
    ) {
      continue;
    }

    const natures = Array.isArray(rule.nature) ? rule.nature : [rule.nature];
    if (!natures.includes(nature) && nature !== 'unknown') continue;

    let hits = 0;
    for (const signal of rule.signals) {
      if (signal.test(lower)) hits += 1;
    }
    if (hits === 0) continue;

    let score = hits + (natures.includes(nature) ? 2 : 0);
    if (options?.preferredPracticeArea && rule.practiceArea === options.preferredPracticeArea) {
      score += 0.5;
    }

    if (!best || score > best.score) {
      best = { rule, score };
    }
  }

  return best?.rule;
}

export function buildProfileFromRule(
  rule: MatterRoutingRule,
  country: string,
  jurisdiction?: string,
  confidence?: number,
): Partial<MatterProfile> {
  const subDef = findPracticeArea(rule.practiceArea)?.subAreas.find(
    (s) => s.slug === rule.subPracticeArea,
  );

  const natures = Array.isArray(rule.nature) ? rule.nature[0] : rule.nature;

  return {
    country,
    practiceArea: rule.practiceArea,
    subPracticeArea: rule.subPracticeArea,
    nature: natures,
    forum: subDef?.forums[0],
    stage: natures === 'dispute' ? 'pre_filing' : undefined,
    remedies: subDef?.remedies ?? [],
    issues: rule.issues,
    documentTypes: subDef?.documentTypes ?? [],
    documentKind: rule.documentKind,
    curatedKinds: subDef?.curatedKinds ?? [],
    jurisdiction,
    confidence: confidence ?? 0.85,
  };
}

export function getSubPracticeForProfile(
  practiceArea: string,
  subPracticeArea?: string,
): SubPracticeDefinition | undefined {
  if (!subPracticeArea) return undefined;
  return findPracticeArea(practiceArea)?.subAreas.find((s) => s.slug === subPracticeArea);
}

export function getExcludePracticeAreas(
  practiceArea: string,
  subPracticeArea?: string,
): string[] {
  const sub = getSubPracticeForProfile(practiceArea, subPracticeArea);
  return sub?.excludePracticeAreas ?? [];
}
