export type CommercialProcedureSeverity = 'critical' | 'high' | 'medium';

export interface CommercialProcedureIssue {
  field: string;
  severity: CommercialProcedureSeverity;
  message: string;
}

export interface CommercialSummarySuitProcedureResult {
  isCommercialSummarySuit: boolean;
  section12aPosture: 'completed' | 'urgent_exception' | 'unknown' | 'contradictory';
  issues: CommercialProcedureIssue[];
}

export function evaluateCommercialSummarySuitProcedure(input: {
  kind: string;
  facts: string;
  courtName?: string;
}): CommercialSummarySuitProcedureResult {
  const isCommercialSummarySuit =
    /(?:india_suit_recovery_cpc_37|summary_suit_recovery)/i.test(input.kind);
  if (!isCommercialSummarySuit) {
    return { isCommercialSummarySuit, section12aPosture: 'unknown', issues: [] };
  }

  const facts = input.facts;
  const issues: CommercialProcedureIssue[] = [];
  const add = (
    severity: CommercialProcedureSeverity,
    field: string,
    message: string,
  ) => issues.push({ severity, field, message });

  if (
    input.courtName &&
    /\b(?:district court|district judge|civil court|civil judge|high court)\b/i.test(
      input.courtName,
    ) &&
    !/\bcommercial\b/i.test(input.courtName)
  ) {
    add(
      'high',
      'commercial_forum_not_designated',
      'The forum is not designated as a Commercial Court or Commercial Division — confirm the exact notified forum and its territorial and pecuniary allocation.',
    );
  }

  if (
    !/\b(?:written contract|agreement|purchase order|work order|invoice|bill|promissory note|bill of exchange|hund[iy]|guarantee|written acknowledgment|acknowledgement of debt|balance confirmation)\b/i.test(
      facts,
    )
  ) {
    add(
      'critical',
      'order_37_written_debt_basis',
      'Order XXXVII maintainability is not established — identify the written instrument supporting the debt or liquidated demand.',
    );
  }
  if (!/(?:₹|\brs\.?\b|\binr\b|\brupees?\b|\blakh\b|\bcrore\b)/i.test(facts)) {
    add(
      'critical',
      'summary_suit_claim_amount',
      'No claim amount found — principal and specified value are required to validate pecuniary jurisdiction, valuation, court fee, and prayer.',
    );
  }

  const mediationCompleted =
    /\b(?:section\s*12a|pre[- ]institution mediation|pre[- ]litigation mediation)\b[\s\S]{0,180}\b(?:non[- ]starter|completed|concluded|closed|failed)\b/i.test(
      facts,
    ) || /\bnon[- ]starter report\b/i.test(facts);
  const urgentException =
    /\b(?:urgent interim relief|urgent injunction|interim injunction|section\s*12a\s+exception)\b/i.test(
      facts,
    );
  const urgencyEvidence =
    /\b(?:specific asset transfer|identified asset|sale deed|transfer notice|removing assets|disposing of assets|dissipation evidence)\b/i.test(
      facts,
    );
  const section12aPosture =
    mediationCompleted && urgentException
      ? 'contradictory'
      : mediationCompleted
        ? 'completed'
        : urgentException
          ? 'urgent_exception'
          : 'unknown';

  if (section12aPosture === 'unknown') {
    add(
      'high',
      'section_12a_status',
      'Section 12A status is missing — provide completed pre-institution mediation particulars or concrete facts supporting a genuinely urgent interim-relief exception.',
    );
  } else if (section12aPosture === 'contradictory') {
    add(
      'critical',
      'section_12a_contradiction',
      'The facts both complete Section 12A mediation and claim an urgent-relief exception; choose the factually supported posture.',
    );
  } else if (section12aPosture === 'urgent_exception' && !urgencyEvidence) {
    add(
      'high',
      'section_12a_urgency_basis',
      'An interim prayer alone does not establish the Section 12A exception — provide concrete urgency evidence.',
    );
  }

  if (
    /\b(?:plaintiff|claimant).{0,80}\b(?:registered office|resides|address)\b/i.test(
      facts,
    ) &&
    !/\b(?:delivery|performance|payment payable|purchase order accepted|invoice issued|exclusive jurisdiction|section\s*20\s+cpc)\b/i.test(
      facts,
    )
  ) {
    add(
      'high',
      'territorial_jurisdiction_basis',
      'Territorial jurisdiction needs a material Section 20 CPC connecting fact; a plaintiff address alone is insufficient.',
    );
  }
  if (
    /\border\s*(?:xxxvii|37)\s*rule\s*2\b[\s\S]{0,100}\b(?:interim|attachment|injunction)\b/i.test(
      facts,
    )
  ) {
    add(
      'critical',
      'wrong_interim_relief_provision',
      'Order XXXVII Rule 2 governs institution of the summary suit and is not a source of attachment or injunction relief.',
    );
  }
  const seeksAttachment =
    /\b(?:attachment before judgment|order\s*(?:xxxviii|38)\s*rule\s*5)\b/i.test(facts);
  if (seeksAttachment && !urgencyEvidence) {
    add(
      'critical',
      'unsupported_attachment',
      'Attachment before judgment requires specific evidence of intended obstruction or asset dissipation; non-payment alone is insufficient.',
    );
  }
  if (!/\b(?:valuation|court fee|court-fee|ad valorem)\b/i.test(facts)) {
    add(
      'medium',
      'valuation_and_court_fee',
      'Retain a descriptive blank for valuation and court fee until the current Gujarat schedule and forum allocation are verified.',
    );
  }

  return { isCommercialSummarySuit, section12aPosture, issues };
}
