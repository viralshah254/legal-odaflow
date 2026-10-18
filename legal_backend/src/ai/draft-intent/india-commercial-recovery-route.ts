import type { ClarifyingQuestion, DraftRouteDecision } from './draft-intent.types';
import { calculateCommercialRecoveryClaim } from './commercial-recovery-calculator';

const COMMERCIAL_RECOVERY_SIGNAL =
  /\b(order\s*(?:xxxvii|37)|summary\s+suit|commercial\s+(?:recovery|summary)\s+suit|money\s+recovery|recovery\s+(?:of|for)\s+(?:money|dues|invoice)|unpaid\s+invoices?|purchase\s+order|payment\s+remains?\s+(?:due|payable)|outstanding\s+(?:amount|balance|dues))\b/i;
const WRITTEN_BASIS_SIGNAL =
  /\b(purchase\s+order|written\s+contract|agreement|invoice|bill|promissory\s+note|written\s+acknowledg(?:e)?ment|email\s+acknowledg(?:e)?ment|whatsapp\s+(?:message|acknowledg(?:e)?ment))\b/i;
const CLAIMANT_SIGNAL =
  /\b(claimant|plaintiff|supplier|seller|creditor|representing\s+the\s+claimant|recover(?:y|ing)\s+from)\b/i;
const SECTION_12A_SIGNAL =
  /\b(section\s+12a|pre[-\s]?institution\s+mediation|non[-\s]?starter\s+report)\b/i;
const INTEREST_SIGNAL = /\binterest\b|\b\d+(?:\.\d+)?%\s*(?:per\s+annum|p\.?a\.?)\b/i;
const MULTIPLE_INVOICES_SIGNAL =
  /\binvoice\b[\s\S]{0,500}\binvoice\b/i;
const PART_PAYMENT_SIGNAL =
  /\b(part(?:ial)?\s+payment|paid\s+(?:₹|rs\.?|inr)\s*[\d,]+|remaining\s+balance)\b/i;
const DELIVERY_DATE_SIGNAL =
  /\bdeliver(?:ed|y)\s+(?:on|dated)\s+\d{1,2}\s+[a-z]+\s+\d{4}\b/i;
const FILING_DATE_SIGNAL =
  /\b(?:institute|file|filing|proceedings)\b[\s\S]{0,40}\b\d{1,2}\s+[a-z]+\s+\d{4}\b/i;
const COMMERCIAL_COURT_SIGNAL =
  /\bcommercial\s+(?:court|division)\b/i;

export function isIndiaCommercialRecoveryQuery(query: string): boolean {
  if (
    /\b(united states|u\.?s\.? federal|california|new york|texas|england|wales|kenya)\b/i.test(
      query,
    ) &&
    !/\b(india|indian|cpc|ahmedabad|gujarat|commercial courts act)\b/i.test(query)
  ) {
    return false;
  }
  return COMMERCIAL_RECOVERY_SIGNAL.test(query);
}

function answerValue(
  answers: Record<string, string | string[]> | undefined,
  id: string,
): string | undefined {
  const value = answers?.[id];
  return Array.isArray(value) ? value[0] : value;
}

function isUnresolvedAnswer(value: string | undefined): boolean {
  return !value || /^not[\s_-]*sure\b/i.test(value);
}

export function buildIndiaCommercialRecoveryRoute(
  query: string,
  answers?: Record<string, string | string[]>,
): DraftRouteDecision | undefined {
  if (!isIndiaCommercialRecoveryQuery(query)) return undefined;

  const summaryProcedureNegated =
    /\b(without|do\s+not|not)\b[\s\S]{0,40}\b(?:assum(?:e|ing)|apply|using?)\b[\s\S]{0,30}\border\s*(?:xxxvii|37)\b/i.test(
      query,
    );
  const summarySuitRequested =
    !summaryProcedureNegated &&
    /\b(order\s*(?:xxxvii|37)|summary\s+suit)\b/i.test(query);
  const writtenBasisAnswer = answerValue(answers, 'commercial_written_basis');
  const writtenBasisNegated =
    /\b(?:no|without)\s+(?:written\s+)?(?:contract|purchase\s+order|invoice|negotiable\s+instrument|acknowledg(?:e)?ment)\b/i.test(
      query,
    ) ||
    /\boral\s+(?:instructions?|agreement|contract)\b/i.test(query);
  const hasWrittenBasis =
    (WRITTEN_BASIS_SIGNAL.test(query) && !writtenBasisNegated) ||
    !isUnresolvedAnswer(writtenBasisAnswer);
  const claimantPosture = CLAIMANT_SIGNAL.test(query);
  const hasSection12A = SECTION_12A_SIGNAL.test(query);
  const needsInterestInputs =
    INTEREST_SIGNAL.test(query) &&
    MULTIPLE_INVOICES_SIGNAL.test(query) &&
    !DELIVERY_DATE_SIGNAL.test(query);
  const needsAppropriation =
    MULTIPLE_INVOICES_SIGNAL.test(query) &&
    PART_PAYMENT_SIGNAL.test(query);

  const blockingIssues: DraftRouteDecision['blockingIssues'] = [];
  if (summarySuitRequested && !hasWrittenBasis) {
    blockingIssues.push({
      id: 'commercial_written_basis',
      field: 'claimBasis',
      message:
        'Order XXXVII requires the debt to arise from a qualifying written instrument or written contract.',
    });
  }
  if (needsInterestInputs) {
    const answer = answerValue(answers, 'commercial_delivery_dates');
    if (isUnresolvedAnswer(answer)) {
      blockingIssues.push({
        id: 'commercial_delivery_dates',
        field: 'limitationDates',
        message:
          'Exact delivery/due dates must be confirmed before contractual pre-suit interest can be calculated.',
      });
    }
  }
  if (needsAppropriation) {
    const answer = answerValue(answers, 'commercial_part_payment_allocation');
    if (isUnresolvedAnswer(answer)) {
      blockingIssues.push({
        id: 'commercial_part_payment_allocation',
        field: 'claimAmount',
        message:
          'The treatment of the part-payment must be confirmed before invoice-wise principal and interest are calculated.',
      });
    }
  }
  if (
    COMMERCIAL_COURT_SIGNAL.test(query) &&
    isUnresolvedAnswer(answerValue(answers, 'commercial_court_designation'))
  ) {
    blockingIssues.push({
      id: 'commercial_court_designation',
      field: 'forum',
      message:
        'Confirm the designated court and pecuniary allocation before finalising the cause title and court fee.',
    });
  }

  const calculation = calculateCommercialRecoveryClaim({
    facts: query,
    deliveryBasis: answerValue(answers, 'commercial_delivery_dates'),
    allocationMethod: answerValue(
      answers,
      'commercial_part_payment_allocation',
    ),
  });

  return {
    jurisdiction: 'IN',
    practiceArea: 'corporate_commercial',
    subPracticeArea: 'commercial_recovery',
    partyRole: claimantPosture ? 'claimant' : 'unknown',
    causeOfAction: 'commercial_debt_recovery',
    claimBasis: hasWrittenBasis ? 'written_contract_or_invoices' : 'unconfirmed',
    proceedingType: summarySuitRequested ? 'summary_suit' : 'money_recovery_suit',
    documentKind: summarySuitRequested
      ? 'summary_suit_recovery'
      : 'money_recovery_suit',
    draftKind: summarySuitRequested
      ? 'india_suit_recovery_cpc_37'
      : 'india_civil_suit_money_recovery',
    forum: COMMERCIAL_COURT_SIGNAL.test(query)
      ? 'commercial_court'
      : 'civil_court_unconfirmed',
    courtLevel: /high\s+court|commercial\s+division/i.test(query)
      ? 'high_court'
      : COMMERCIAL_COURT_SIGNAL.test(query)
        ? 'district_commercial_court'
        : 'unconfirmed',
    territorialBasis: [
      /\bahmedabad|gujarat|sanand\b/i.test(query)
        ? 'Performance/delivery and claimant establishment facts indicate Gujarat; exact local court allocation must be confirmed.'
        : 'Territorial connecting facts require confirmation.',
    ],
    mandatoryPreFilingSteps: hasSection12A
      ? ['Section 12A pre-institution mediation pleaded as completed/non-starter']
      : ['Confirm Section 12A Commercial Courts Act compliance or urgent-interim-relief exception'],
    confidence:
      summarySuitRequested && hasWrittenBasis && claimantPosture ? 'high' : 'medium',
    reasons: [
      hasWrittenBasis
        ? 'The claim is founded on written commercial instruments and acknowledgments.'
        : 'The written basis for summary procedure remains unconfirmed.',
      summarySuitRequested
        ? 'The user expressly requested the Order XXXVII summary procedure.'
        : 'The facts describe recovery of unpaid commercial dues.',
      FILING_DATE_SIGNAL.test(query)
        ? 'A proposed institution date is stated for limitation and interest checks.'
        : 'The proposed filing date remains to be confirmed.',
    ],
    blockingIssues,
    primaryDocumentLabel: summarySuitRequested
      ? 'Commercial Summary Suit for Recovery under Order XXXVII CPC'
      : 'Commercial Money Recovery Suit',
    supportingDocumentLabels: [
      'Statement of Truth',
      'Supporting affidavit',
      'List of dates and events',
      'List/index of documents and annexures',
    ],
    calculation,
  };
}

export function buildCommercialRecoveryQuestions(
  route: DraftRouteDecision | undefined,
): ClarifyingQuestion[] {
  if (!route) return [];
  const ids = new Set(route.blockingIssues.map((issue) => issue.id));
  const questions: ClarifyingQuestion[] = [];

  if (ids.has('commercial_written_basis')) {
    questions.push({
      id: 'commercial_written_basis',
      prompt: 'What written instrument records the debt sought to be recovered?',
      options: [
        { value: 'written_contract', label: 'Written contract / purchase order' },
        { value: 'invoices_acknowledged', label: 'Invoices with written acknowledgment of liability' },
        { value: 'negotiable_instrument', label: 'Cheque, promissory note, or other negotiable instrument' },
        { value: 'not_sure', label: 'Not sure — do not select summary procedure yet' },
      ],
    });
  }
  if (ids.has('commercial_delivery_dates')) {
    questions.push({
      id: 'commercial_delivery_dates',
      prompt:
        'Which dates should control the 30-day payment period and contractual interest calculation?',
      options: [
        { value: 'invoice_dates', label: 'Delivery occurred on the invoice dates' },
        { value: 'challan_dates_in_context', label: 'Use the signed delivery-challan dates added in the case details' },
        { value: 'not_sure', label: 'Not sure — keep interest calculation blocked' },
      ],
    });
  }
  if (ids.has('commercial_part_payment_allocation')) {
    questions.push({
      id: 'commercial_part_payment_allocation',
      prompt: 'How was the part-payment allocated?',
      options: [
        { value: 'debtor_specified', label: 'The debtor specified the invoice or allocation' },
        { value: 'oldest_invoice_first', label: 'Apply it to the oldest outstanding invoice first' },
        { value: 'no_agreed_allocation', label: 'No allocation was agreed — apply the legally supportable default' },
        { value: 'not_sure', label: 'Not sure — keep the monetary calculation blocked' },
      ],
    });
  }
  if (ids.has('commercial_court_designation')) {
    questions.push({
      id: 'commercial_court_designation',
      prompt:
        'Which court designation has been verified for this specified value and territorial jurisdiction?',
      options: [
        { value: 'designated_commercial_court', label: 'Designated Commercial Court at Ahmedabad' },
        { value: 'commercial_division_high_court', label: 'Commercial Division of the Gujarat High Court' },
        { value: 'not_sure', label: 'Not sure — keep the cause title and court fee blocked' },
      ],
    });
  }
  return questions.slice(0, 4);
}
