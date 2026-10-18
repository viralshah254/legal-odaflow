/** Per-document-kind clause catalog.  Each entry carries a title, a mandatory
 *  flag (mandatory clauses are always included; optional ones the user can
 *  toggle), and a short description shown in the clause picker UI.
 */
export interface ClauseEntry {
  title: string;
  mandatory: boolean;
  description?: string;
}

export const CLAUSE_CATALOG: Record<string, ClauseEntry[]> = {
  employment_contract: [
    { title: 'Parties and Appointment',         mandatory: true,  description: 'Full legal names of employer and employee, and the role being offered.' },
    { title: 'Commencement Date',               mandatory: true,  description: 'The date on which employment begins.' },
    { title: 'Position and Duties',             mandatory: true,  description: 'Job title, reporting line, and core responsibilities.' },
    { title: 'Place of Work',                   mandatory: true,  description: 'Primary location(s) from which the employee will work.' },
    { title: 'Remuneration',                    mandatory: true,  description: 'Base salary or wage, currency, and pay frequency.' },
    { title: 'Working Hours',                   mandatory: true,  description: 'Contracted hours per week and any shift arrangements.' },
    { title: 'Leave Entitlement',               mandatory: true,  description: 'Annual paid leave days accrual and carry-over rules.' },
    { title: 'Termination and Notice',          mandatory: true,  description: 'Minimum notice periods required by each party.' },
    { title: 'Governing Law',                   mandatory: true,  description: 'Jurisdiction whose law governs the contract.' },
    { title: 'Signatures',                      mandatory: true,  description: 'Execution block for both parties.' },
    { title: 'Probationary Period',             mandatory: false, description: 'Duration and conditions of the initial probation period.' },
    { title: 'Remote Work / Hybrid Policy',     mandatory: false, description: 'Rules around working from home or off-site locations.' },
    { title: 'Overtime',                        mandatory: false, description: 'Eligibility for overtime pay and applicable rates.' },
    { title: 'Sick Leave',                      mandatory: false, description: 'Paid and unpaid sick-leave entitlements and notification requirements.' },
    { title: 'Maternity and Paternity Leave',   mandatory: false, description: 'Statutory and enhanced parental leave provisions.' },
    { title: 'Public Holidays',                 mandatory: false, description: 'How statutory public holidays are treated.' },
    { title: 'Pension and Benefits',            mandatory: false, description: 'Employer pension contributions, medical aid, and other benefits.' },
    { title: 'Expense Reimbursement',           mandatory: false, description: 'Policy for claiming and reimbursing work-related expenses.' },
    { title: 'Confidentiality',                 mandatory: false, description: 'Obligation to keep employer information confidential during and after employment.' },
    { title: 'Intellectual Property Assignment', mandatory: false, description: 'Assignment of work-product and inventions created during employment.' },
    { title: 'Non-Solicitation',                mandatory: false, description: 'Restriction on poaching clients or employees after departure.' },
    { title: 'Non-Competition',                 mandatory: false, description: 'Post-employment restriction on working for competitors.' },
    { title: 'Garden Leave',                    mandatory: false, description: 'Right to place the employee on paid leave during the notice period.' },
    { title: 'Redundancy',                      mandatory: false, description: 'Severance pay formula and selection criteria for redundancy.' },
    { title: 'Return of Company Property',      mandatory: false, description: 'Obligation to return devices, keys, and data on exit.' },
    { title: 'Grievance and Disciplinary Procedure', mandatory: false, description: 'Internal process for raising complaints and handling misconduct.' },
    { title: 'Data Protection and Privacy',     mandatory: false, description: 'How personal data about the employee is processed.' },
    { title: 'Entire Agreement',                mandatory: false, description: 'Supersession of prior negotiations and agreements.' },
    { title: 'Severability',                    mandatory: false, description: 'Survival of remaining clauses if any provision is unenforceable.' },
    { title: 'Dispute Resolution / Arbitration', mandatory: false, description: 'Mechanism for resolving employment disputes (mediation, arbitration, or courts).' },
  ],

  service_agreement: [
    { title: 'Parties',                         mandatory: true,  description: 'Full legal names and addresses of service provider and client.' },
    { title: 'Scope of Services',               mandatory: true,  description: 'Detailed description of the services to be provided.' },
    { title: 'Payment and Invoicing',           mandatory: true,  description: 'Fees, invoice schedule, and payment terms.' },
    { title: 'Term and Renewal',                mandatory: true,  description: 'Contract start date, duration, and renewal provisions.' },
    { title: 'Termination Notice',              mandatory: true,  description: 'Notice period required by each party to terminate.' },
    { title: 'Intellectual Property',           mandatory: true,  description: 'Ownership of deliverables and background IP.' },
    { title: 'Independent Contractor Status',   mandatory: true,  description: 'Clarification that the provider is not an employee.' },
    { title: 'Limitation of Liability',         mandatory: true,  description: 'Cap on damages each party may claim.' },
    { title: 'Confidentiality',                 mandatory: true,  description: 'Protection of each party\'s confidential information.' },
    { title: 'Governing Law and Dispute Resolution', mandatory: true, description: 'Jurisdiction and mechanism for resolving disputes.' },
    { title: 'Signature Blocks',                mandatory: true,  description: 'Execution block for authorised signatories.' },
    { title: 'Change Orders / Variations',      mandatory: false, description: 'Process for requesting and approving scope changes.' },
    { title: 'Warranties',                      mandatory: false, description: 'Provider representations about quality and fitness for purpose.' },
    { title: 'Indemnification',                 mandatory: false, description: 'Obligation to compensate the other party for specified losses.' },
    { title: 'Insurance',                       mandatory: false, description: 'Minimum insurance cover the provider must maintain.' },
    { title: 'Subcontracting',                  mandatory: false, description: 'Conditions under which work may be subcontracted.' },
    { title: 'Force Majeure',                   mandatory: false, description: 'Relief from obligations due to unforeseen events.' },
    { title: 'Assignment',                      mandatory: false, description: 'Restrictions on assigning rights under the contract.' },
    { title: 'Entire Agreement',                mandatory: false, description: 'Supersession clause.' },
    { title: 'Severability',                    mandatory: false, description: 'Survival of remaining terms if any provision is void.' },
  ],

  nda: [
    { title: 'Parties',                              mandatory: true, description: 'Disclosing and receiving party identification.' },
    { title: 'Definition of Confidential Information', mandatory: true, description: 'What information is covered by the NDA.' },
    { title: 'Exclusions',                           mandatory: true, description: 'Information that does not qualify as confidential.' },
    { title: 'Obligations of Receiving Party',       mandatory: true, description: 'How confidential information must be protected and used.' },
    { title: 'Term / Duration',                      mandatory: true, description: 'How long the obligations last.' },
    { title: 'Return or Destruction',                mandatory: true, description: 'What happens to confidential materials at the end of the NDA.' },
    { title: 'Permitted Disclosures',                mandatory: true, description: 'Carve-out for legal compulsion or professional advisors.' },
    { title: 'Remedies',                             mandatory: true, description: 'Right to injunctive relief and other remedies for breach.' },
    { title: 'Governing Law',                        mandatory: true, description: 'Jurisdiction for disputes.' },
    { title: 'Signatures',                           mandatory: true, description: 'Execution block.' },
    { title: 'Mutual vs Unilateral',                 mandatory: false, description: 'Whether obligations flow both ways or only to the receiver.' },
    { title: 'Non-Solicitation',                     mandatory: false, description: 'Restriction on poaching staff or clients during the NDA period.' },
    { title: 'Residual Knowledge',                   mandatory: false, description: 'Treatment of information retained in unaided memory.' },
    { title: 'Entire Agreement',                     mandatory: false, description: 'Supersession clause.' },
  ],

  lease_agreement: [
    { title: 'Parties',                         mandatory: true, description: 'Landlord and tenant full legal names.' },
    { title: 'Premises Description',            mandatory: true, description: 'Address and description of the leased property.' },
    { title: 'Lease Term',                      mandatory: true, description: 'Start date, end date, and renewal options.' },
    { title: 'Rent and Deposit',                mandatory: true, description: 'Monthly rent amount, deposit amount, and payment due date.' },
    { title: 'Permitted Use',                   mandatory: true, description: 'Allowed uses of the premises.' },
    { title: 'Maintenance Obligations',         mandatory: true, description: 'Respective repair and maintenance duties.' },
    { title: 'Utilities',                       mandatory: true, description: 'Which utilities are included and who is responsible.' },
    { title: 'Termination',                     mandatory: true, description: 'Notice requirements and grounds for early termination.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'Break Clause',                    mandatory: false, description: 'Early-termination right exercisable by either party.' },
    { title: 'Rent Review',                     mandatory: false, description: 'Mechanism for adjusting rent during the term.' },
    { title: 'Subletting and Assignment',       mandatory: false, description: 'Conditions for subletting or transferring the lease.' },
    { title: 'Alterations',                     mandatory: false, description: 'Rules around making changes or improvements to the premises.' },
    { title: 'Insurance',                       mandatory: false, description: 'What insurance each party must maintain.' },
    { title: 'Dispute Resolution',              mandatory: false, description: 'Mechanism for resolving landlord-tenant disputes.' },
    { title: 'Entire Agreement',                mandatory: false, description: 'Supersession clause.' },
  ],

  partnership_agreement: [
    { title: 'Business Purpose',                mandatory: true, description: 'Description of the business the partnership will conduct.' },
    { title: 'Capital Contributions',           mandatory: true, description: 'What each partner contributes and ownership percentages.' },
    { title: 'Profit and Loss Sharing',         mandatory: true, description: 'How profits and losses are allocated.' },
    { title: 'Management and Voting',           mandatory: true, description: 'Decision-making authority and voting rights.' },
    { title: 'Banking',                         mandatory: true, description: 'Authorised signatories for partnership accounts.' },
    { title: 'IP Ownership',                    mandatory: true, description: 'Who owns intellectual property developed by the partnership.' },
    { title: 'Admission of New Partners',       mandatory: true, description: 'Process for admitting new partners.' },
    { title: 'Dissolution',                     mandatory: true, description: 'Wind-up procedure and asset distribution.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'Duties of Partners',              mandatory: false, description: 'Fiduciary and operational duties of each partner.' },
    { title: 'Non-Compete',                     mandatory: false, description: 'Restriction on partners competing with the partnership.' },
    { title: 'Dispute Resolution',              mandatory: false, description: 'Mechanism for resolving inter-partner disputes.' },
    { title: 'Retirement of a Partner',         mandatory: false, description: 'Process and buy-out formula when a partner retires.' },
  ],

  shareholders_agreement: [
    { title: 'Parties and Shareholding',        mandatory: true, description: 'Shareholders, share classes, and percentage holdings.' },
    { title: 'Share Transfer Restrictions',     mandatory: true, description: 'Right of first refusal and lock-up periods.' },
    { title: 'Drag-Along and Tag-Along Rights', mandatory: true, description: 'Drag and tag provisions to protect minority shareholders.' },
    { title: 'Board Composition',               mandatory: true, description: 'Appointment and removal rights for directors.' },
    { title: 'Reserved Matters',                mandatory: true, description: 'Decisions requiring unanimous or special shareholder approval.' },
    { title: 'Dividend Policy',                 mandatory: true, description: 'When and how dividends are declared and paid.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'Anti-Dilution Protection',        mandatory: false, description: 'Price-based anti-dilution adjustments for existing shareholders.' },
    { title: 'Pre-emption Rights',              mandatory: false, description: 'Right of existing shareholders to participate in new share issuances.' },
    { title: 'Vesting',                         mandatory: false, description: 'Vesting schedule for founder or employee shares.' },
    { title: 'Exit Provisions',                 mandatory: false, description: 'Obligations and mechanics on an exit event (IPO, trade sale).' },
    { title: 'Dispute Resolution',              mandatory: false, description: 'Deadlock-breaking mechanism and dispute resolution process.' },
  ],

  loan_agreement: [
    { title: 'Parties',                         mandatory: true, description: 'Lender and borrower identification.' },
    { title: 'Principal Amount and Purpose',    mandatory: true, description: 'Amount lent and permitted use of funds.' },
    { title: 'Interest Rate',                   mandatory: true, description: 'Rate, calculation basis, and compounding frequency.' },
    { title: 'Repayment Schedule',              mandatory: true, description: 'Instalment dates, amounts, and final maturity date.' },
    { title: 'Events of Default',               mandatory: true, description: 'Circumstances that allow acceleration of the loan.' },
    { title: 'Security / Collateral',           mandatory: true, description: 'Assets pledged as security for the loan.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'Prepayment',                      mandatory: false, description: 'Right to repay early and any prepayment penalties.' },
    { title: 'Conditions Precedent',            mandatory: false, description: 'Conditions that must be satisfied before drawdown.' },
    { title: 'Representations and Warranties',  mandatory: false, description: 'Borrower representations about its legal and financial status.' },
    { title: 'Covenants',                       mandatory: false, description: 'Ongoing financial and operational undertakings of the borrower.' },
    { title: 'Dispute Resolution',              mandatory: false, description: 'Mechanism for resolving loan disputes.' },
  ],

  settlement_agreement: [
    { title: 'Parties',                         mandatory: true, description: 'Full legal names of settling parties.' },
    { title: 'Recitals',                         mandatory: true, description: 'Background to the dispute being settled.' },
    { title: 'Settlement Sum',                  mandatory: true, description: 'Amount payable and payment terms.' },
    { title: 'Release of Claims',               mandatory: true, description: 'Scope of mutual or one-sided release of claims.' },
    { title: 'Confidentiality',                 mandatory: true, description: 'Obligation to keep settlement terms private.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'Non-Admission of Liability',      mandatory: false, description: 'Statement that the settlement does not admit fault.' },
    { title: 'Non-Disparagement',               mandatory: false, description: 'Obligation not to make negative statements about the other party.' },
    { title: 'Tax Treatment',                   mandatory: false, description: 'Allocation of tax liability on the settlement sum.' },
    { title: 'Entire Agreement',                mandatory: false, description: 'Supersession clause.' },
  ],

  data_processing_agreement: [
    { title: 'Subject Matter and Duration',     mandatory: true, description: 'Nature, purpose, and duration of processing.' },
    { title: 'Processor Instructions',          mandatory: true, description: 'Controller\'s documented instructions for processing.' },
    { title: 'Security Measures',               mandatory: true, description: 'Technical and organisational measures to protect personal data.' },
    { title: 'Sub-Processors',                  mandatory: true, description: 'Conditions for engaging sub-processors.' },
    { title: 'Data Subject Rights',             mandatory: true, description: 'Assistance with data subject requests.' },
    { title: 'Breach Notification',             mandatory: true, description: 'Timelines and process for notifying data breaches.' },
    { title: 'Data Deletion or Return',         mandatory: true, description: 'Obligations at end of processing relationship.' },
    { title: 'Governing Law',                   mandatory: true, description: 'Jurisdiction and applicable data protection law.' },
    { title: 'Signatures',                      mandatory: true, description: 'Execution block.' },
    { title: 'International Transfers',         mandatory: false, description: 'Transfer mechanisms for cross-border data flows.' },
    { title: 'Audit Rights',                    mandatory: false, description: 'Controller\'s right to audit processor compliance.' },
    { title: 'Liability Allocation',            mandatory: false, description: 'How liability is allocated between controller and processor.' },
  ],
};

/** Legacy flat-list for backward-compat with runTemplateDraft prompt building. */
export const TEMPLATE_CLAUSE_RULES: Record<string, string[]> = Object.fromEntries(
  Object.entries(CLAUSE_CATALOG).map(([kind, entries]) => [
    kind,
    entries.filter((e) => e.mandatory).map((e) => e.title),
  ]),
);

/** Returns the full clause catalog for a document kind (mandatory + optional). */
export function getClauseCatalogForKind(documentKind: string): ClauseEntry[] {
  return CLAUSE_CATALOG[documentKind] ?? [
    { title: 'Parties identification', mandatory: true },
    { title: 'Subject matter',         mandatory: true },
    { title: 'Key terms',              mandatory: true },
    { title: 'Governing law',          mandatory: true },
    { title: 'Signatures',             mandatory: true },
  ];
}

/** Returns mandatory clause titles for a document kind (used in AI prompts). */
export function getClauseRulesForKind(documentKind: string): string[] {
  return TEMPLATE_CLAUSE_RULES[documentKind] ?? [
    'Parties identification',
    'Subject matter',
    'Key terms',
    'Governing law',
    'Signatures',
  ];
}
