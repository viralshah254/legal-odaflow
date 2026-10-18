import type { VerificationFinding } from '@/ai/verification/verification-finding.types';

export interface DomainCompletenessInput {
  query: string;
  outputMarkdown: string;
  countryCode?: string;
  legalDomain?: string;
}

export interface ChecklistCoverageGap {
  id: string;
  label: string;
  retrievalTarget: string;
  finding: VerificationFinding;
}

interface ChecklistRequirement {
  id: string;
  label: string;
  applies: (context: DomainContext) => boolean;
  coveredBy: RegExp[];
  retrievalTarget: string;
  /**
   * Countries this requirement is written for. Omit for requirements that state
   * a universal analytical obligation (elements, forum, limitation, current law)
   * so no jurisdiction gets a thinner completeness check than India.
   */
  countries?: string[];
}

interface DomainContext {
  query: string;
  legalDomain: string;
  banking: boolean;
  digitalLending: boolean;
  civilRelief: boolean;
}

const BANKING_SIGNALS =
  /\b(?:bank(?:ing)?|upi|unaut[ h]?ori[sz]ed transaction|payment fraud|digital payment|wallet|account debit|regulated entity|rbi)\b/i;
const DIGITAL_LENDING_SIGNALS =
  /\b(?:digital lend(?:er|ing)|loan[- ]app|lending service provider|\blsp\b|recovery agent|loan account|credit app|instant loan)\b/i;
const CIVIL_RELIEF_SIGNALS =
  /\b(?:disputed (?:loan|liability|debit)|recovery|account (?:block|freeze)|lien|adverse credit|credit bureau|cibil|enforcement|injunction|declaration)\b/i;

const REQUIREMENTS: ChecklistRequirement[] = [
  {
    id: 'current_law_status',
    label: 'Current-law version and treatment qualification',
    applies: ({ query }) =>
      /\b(?:current|latest|present position|still good law|overruled|repealed|superseded)\b/i.test(query),
    coveredBy: [
      /\b(?:in force|effective from|current law|present position|superseded|repealed|overruled|affirmed|distinguished|treatment)\b/i,
    ],
    retrievalTarget:
      'Retrieve the operative statutory version and reliable subsequent-treatment material before stating the current position.',
  },
  {
    id: 'arbitration_agreement_scope',
    label: 'Arbitration agreement existence, validity, and scope',
    applies: ({ legalDomain, query }) =>
      legalDomain === 'ARBITRATION' && /\b(?:clause|agreement|refer|enforc)\b/i.test(query),
    coveredBy: [
      /\b(?:existence|validity|scope|operative|binding).{0,100}\barbitration (?:clause|agreement)\b/is,
      /\barbitration (?:clause|agreement)\b.{0,100}\b(?:existence|validity|scope|operative|binding)\b/is,
    ],
    retrievalTarget:
      'Retrieve the operative arbitration agreement and authorities addressing its existence, validity, scope, and parties.',
  },
  {
    id: 'arbitration_procedural_route',
    label: 'Applicable arbitration procedural route and outcome',
    applies: ({ legalDomain, query }) =>
      legalDomain === 'ARBITRATION' &&
      /\b(?:section 8|section 9|section 11|section 34|refer|appoint|challenge|set aside|enforce)\b/i.test(query),
    coveredBy: [
      /\b(?:section|s\.)\s*(?:8|9|11|34|36|48)\b/i,
      /\b(?:referral|appointment|set aside|challenge|enforcement).{0,100}\b(?:allowed|dismissed|granted|outcome|disposition)\b/is,
    ],
    retrievalTarget:
      'Retrieve the operative procedural provision and direct judgments stating the court route, test, and disposition.',
  },
  {
    id: 'criminal_elements_and_forum',
    label: 'Criminal-law elements, classification, and forum',
    applies: ({ legalDomain, query }) =>
      legalDomain === 'CRIMINAL' &&
      /\b(?:offence|offense|bail|quash|fir|charge|charged|prosecution|arrest|indict\w*|convict\w*|sentenc\w*)\b/i.test(
        query,
      ),
    coveredBy: [
      /\b(?:ingredient|element|mens rea|actus reus|cognizable|bailable|non-bailable|felony|misdemeanou?r|indictable|summary offence)\b/i,
      /\b(?:magistrate|sessions court|crown court|district court|high court|trial court|forum|jurisdiction)\b/i,
    ],
    retrievalTarget:
      'Retrieve the operative offence/procedure provisions and binding authority on elements, classification, and forum.',
  },
  {
    id: 'contract_remedy_and_limitation',
    label: 'Contract remedy and limitation analysis',
    applies: ({ legalDomain, query }) =>
      legalDomain === 'CONTRACT' && /\b(?:breach|damages|specific performance|termination|remed)\b/i.test(query),
    coveredBy: [
      /\b(?:damages|specific performance|rescission|restitution|injunction)\b/i,
      /\b(?:limitation|accrual|time[- ]bar|three years)\b/i,
    ],
    retrievalTarget:
      'Retrieve the governing contract-remedy provisions and applicable limitation rule.',
  },
  {
    id: 'commercial_entity_and_forum',
    label: 'Commercial entity status and dispute forum',
    applies: ({ legalDomain, query }) =>
      legalDomain === 'CORPORATE_COMMERCIAL' &&
      /\b(?:company|shareholder|director|partnership|llp|entity)\b/i.test(query),
    coveredBy: [
      /\b(?:company|partnership|limited liability partnership|llp|entity type)\b/i,
      /\b(?:nclt|commercial court|civil court|arbitration|forum|jurisdiction)\b/i,
    ],
    retrievalTarget:
      'Retrieve the entity-specific statute and authority governing the competent court or tribunal.',
  },
  {
    id: 'regulated_entity_complaint',
    label: 'Regulated-entity complaint',
    applies: ({ banking }) => banking,
    coveredBy: [
      /\b(?:complain|grievance).{0,80}(?:bank|regulated entity|lender|nodal officer)\b/is,
      /\b(?:bank|regulated entity|lender|nodal officer).{0,80}(?:complain|grievance)\b/is,
    ],
    retrievalTarget:
      'Retrieve the regulated entity grievance policy and the applicable regulator complaint-response requirements.',
  },
  {
    id: 'rbi_integrated_ombudsman',
    countries: ['IN'],
    label: 'RBI Integrated Ombudsman eligibility and process',
    applies: ({ banking }) => banking,
    coveredBy: [
      /\b(?:integrated ombudsman|rbi ombudsman|cms\.rbi|reserve bank.{0,30}ombudsman)\b/i,
    ],
    retrievalTarget:
      'Retrieve the current RBI Integrated Ombudsman Scheme provisions on covered entities, prior complaint, maintainability, time limits, filing, and relief.',
  },
  {
    id: 'consumer_commission',
    countries: ['IN'],
    label: 'Consumer Commission deficiency and unfair-practice route',
    applies: ({ banking }) => banking,
    coveredBy: [
      /\bconsumer (?:commission|forum|complaint)\b/i,
      /\bdeficien(?:cy|t).{0,80}(?:service|bank|lending|payment)\b/is,
      /\bunfair (?:trade )?practice\b/i,
    ],
    retrievalTarget:
      'Retrieve CPA 2019 materials on consumer status, deficiency, unfair trade practice, forum, limitation, and relief.',
  },
  {
    id: 'cybercrime_police',
    countries: ['IN'],
    label: 'Cybercrime and police fraud complaint',
    applies: ({ banking }) => banking,
    coveredBy: [
      /\b(?:cyber ?crime|cyber police|police complaint|national cyber crime|1930|cybercrime\.gov\.in)\b/i,
    ],
    retrievalTarget:
      'Retrieve current NCRP/1930 reporting guidance and the applicable criminal-procedure material for a cyber-fraud complaint.',
  },
  {
    id: 'civil_declaration_injunction',
    label: 'Civil declaration and injunction where needed',
    applies: ({ civilRelief }) => civilRelief,
    coveredBy: [
      /\bdeclar(?:ation|atory).{0,100}(?:non[- ]?liability|loan|debit|relief|suit)\b/is,
      /\b(?:temporary|interim|permanent)?\s*injunction\b/i,
    ],
    retrievalTarget:
      'Retrieve the specific-relief and civil-procedure materials for the governing jurisdiction, plus forum rules on declaration, non-liability, and interim or permanent injunction.',
  },
  {
    id: 'regulated_entity_lsp_responsibility',
    countries: ['IN'],
    label: 'Separate regulated-entity and LSP responsibility',
    applies: ({ digitalLending }) => digitalLending,
    coveredBy: [
      /\bregulated entity\b.{0,180}\b(?:lending service provider|\blsp\b|loan app)\b/is,
      /\b(?:lending service provider|\blsp\b|loan app)\b.{0,180}\bregulated entity\b/is,
    ],
    retrievalTarget:
      'Retrieve RBI digital-lending directions on regulated-entity responsibility, LSP outsourcing, and recovery agents.',
  },
  {
    id: 'kyc_onboarding',
    label: 'KYC and onboarding',
    applies: ({ digitalLending }) => digitalLending,
    coveredBy: [/\bkyc\b/i, /\b(?:onboard|consent|key fact statement|\bkfs\b).{0,100}(?:loan|lending|borrower)\b/is],
    retrievalTarget:
      'Retrieve the applicable KYC, digital-lending onboarding, consent, and disclosure requirements for the governing regulator.',
  },
  {
    id: 'funds_flow',
    label: 'Transaction and funds flow',
    applies: ({ banking }) => banking,
    coveredBy: [
      /\b(?:funds? flow|money trail|transaction trail|disburs|repay|beneficiary|settlement account|account statement)\b/i,
    ],
    retrievalTarget:
      'Retrieve transaction records and the applicable payment-system or digital-lending rules governing the end-to-end funds flow.',
  },
  {
    id: 'grievance_recovery_conduct',
    label: 'Grievance and recovery conduct',
    applies: ({ digitalLending }) => digitalLending,
    coveredBy: [
      /\bgrievance\b.{0,160}\b(?:recover|collection|agent|conduct|harass)\b/is,
      /\b(?:recover|collection|agent|harass)\b.{0,160}\bgrievance\b/is,
    ],
    retrievalTarget:
      'Retrieve the lender grievance policy and the regulator requirements governing recovery-agent disclosure, contact, and conduct.',
  },
];

export function checkDomainCompleteness(
  input: DomainCompletenessInput,
): ChecklistCoverageGap[] {
  const countryCode = (input.countryCode ?? 'IN').toUpperCase();

  // Applicability is derived from the user's request, never from generated memo
  // text. Otherwise an unrelated phrase in synthesis can activate a foreign
  // domain checklist and contaminate verification findings.
  const source = input.query;
  const banking = BANKING_SIGNALS.test(source);

  const digitalLending = DIGITAL_LENDING_SIGNALS.test(source);
  const context: DomainContext = {
    query: source,
    legalDomain: input.legalDomain ?? 'GENERAL',
    banking,
    digitalLending,
    civilRelief: digitalLending || CIVIL_RELIEF_SIGNALS.test(source),
  };

  return REQUIREMENTS.filter(
    (requirement) => !requirement.countries || requirement.countries.includes(countryCode),
  )
    .filter((requirement) => requirement.applies(context))
    .filter(
      (requirement) =>
        !requirement.coveredBy.some((pattern) => pattern.test(input.outputMarkdown)),
    )
    .map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      retrievalTarget: requirement.retrievalTarget,
      finding: {
        checkId: `checklist_unmet:${requirement.id}`,
        state: 'FAIL',
        severity: 'HIGH',
        dimension: 'coverage',
        evidenceIds: [],
        explanation: `${requirement.label} was omitted from the ${context.legalDomain.toLowerCase().replace(/_/g, ' ')} analysis. ${requirement.retrievalTarget}`,
        repairAction: 'RETRIEVE',
        verifierVersion: 'domain-completeness-v2',
      },
    }));
}

