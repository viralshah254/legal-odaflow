import { simpleDef, type TemplateDef } from './helpers';

const P = (fields: string) =>
  `Parties: {{party1Name}} and {{party2Name}}. Governing law: {{governingLaw}}. Matter: {{matterDescription}}. ${fields}`;

export const EXTENDED_TEMPLATE_DEFS: Record<string, TemplateDef[]> = {
  corporate_commercial: [
    simpleDef('articles_of_association', 'Articles of Association', P('Constitution of {{companyName}}.'), [
      'Share capital — Authorised and issued share capital: {{paymentTerms}}.',
      'Directors — Appointment, removal, and powers of directors.',
      'General meetings — Notice, quorum, and voting procedures.',
      'Dividends — Declaration and payment of dividends.',
      'Winding up — Distribution of assets on dissolution.',
    ]),
    simpleDef('memorandum_of_association', 'Memorandum of Association', P('Memorandum of {{companyName}}.'), [
      'Name clause — The name of the company is {{companyName}}.',
      'Registered office — {{party1Address}}.',
      'Objects clause — {{servicesDescription}}.',
      'Liability — Liability of members is limited.',
    ]),
    simpleDef('share_subscription_agreement', 'Share Subscription Agreement', P('Subscription for shares in {{companyName}}.'), [
      'Subscription — Subscriber: {{party2Name}}; Shares: {{equitySplit}}; Price: {{paymentTerms}}.',
      'Completion — Completion on {{contractStartDate}} subject to conditions precedent.',
      'Warranties — Standard subscriber warranties as to authority and funds.',
      'Governing law — {{governingLaw}}.',
    ]),
    simpleDef('share_purchase_agreement', 'Share Purchase Agreement', P('Sale of shares in {{companyName}}.'), [
      'Sale and purchase — Vendor sells {{equitySplit}} to Purchaser for {{propertyPrice}}.',
      'Completion — Completion on {{completionDate}} at {{party1Address}}.',
      'Warranties — Business warranties schedule attached.',
      'Restrictive covenants — Seller non-compete for {{contractDuration}}.',
    ]),
    simpleDef('asset_purchase_agreement', 'Asset Purchase Agreement', P('Asset sale by {{party1Name}} to {{party2Name}}.'), [
      'Assets — {{servicesDescription}} including goodwill and contracts.',
      'Price — {{propertyPrice}} payable on completion.',
      'Employees — TUPE / applicable labour transfer provisions.',
      'Liabilities — Excluded and assumed liabilities schedule.',
    ]),
    simpleDef('joint_venture_agreement', 'Joint Venture Agreement', P('JV between {{party1Name}} and {{party2Name}}.'), [
      'Purpose — {{servicesDescription}}.',
      'Contributions — {{paymentTerms}}.',
      'Governance — Board composition and reserved matters.',
      'Exit — Buy-out and deadlock mechanisms.',
    ]),
    simpleDef('convertible_note', 'Convertible Note', P('Investment in {{companyName}}.'), [
      'Principal — {{propertyPrice}} loan convertible to equity.',
      'Interest — {{paymentTerms}}.',
      'Conversion — Automatic conversion on qualified financing.',
      'Maturity — Repayment on {{contractEndDate}} if not converted.',
    ]),
    simpleDef('safe_agreement', 'SAFE Agreement', P('Simple Agreement for Future Equity.'), [
      'Investment amount — {{propertyPrice}}.',
      'Valuation cap — {{paymentTerms}}.',
      'Discount — Conversion discount on next equity round.',
      'Dissolution — Return of funds on winding up.',
    ]),
    simpleDef('term_sheet', 'Term Sheet', P('Non-binding heads of terms for {{matterDescription}}.'), [
      'Structure — Proposed transaction structure and parties.',
      'Economics — Price, earn-out, and working capital adjustments.',
      'Conditions — Due diligence, regulatory approvals, and financing.',
      'Exclusivity — {{contractDuration}} exclusivity period.',
    ]),
    simpleDef('franchise_agreement', 'Franchise Agreement', P('Franchise of {{businessName}}.'), [
      'Grant — Non-exclusive franchise in {{licensedTerritory}}.',
      'Fees — Initial fee {{propertyPrice}}; ongoing royalty {{royaltyRate}}.',
      'Operations — Brand standards and training obligations.',
      'Term — {{contractDuration}} with renewal options.',
    ]),
    simpleDef('distribution_agreement', 'Distribution Agreement', P('Distribution of products by {{party2Name}}.'), [
      'Products — {{servicesDescription}}.',
      'Territory — {{licensedTerritory}}.',
      'Pricing — {{paymentTerms}}.',
      'Term and termination — {{contractDuration}}; termination for material breach.',
    ]),
    simpleDef('supply_agreement', 'Supply Agreement', P('Supply of goods/services to {{party1Name}}.'), [
      'Specifications — {{servicesDescription}}.',
      'Orders and delivery — Lead times and acceptance criteria.',
      'Price — {{paymentTerms}}.',
      'Liability — Cap and exclusions per {{governingLaw}}.',
    ]),
    simpleDef('master_service_agreement', 'Master Service Agreement', P('Framework services agreement.'), [
      'Services — {{servicesDescription}} under statements of work.',
      'Fees — {{paymentTerms}} per SOW.',
      'IP — Work product ownership per SOW / default to client.',
      'Term — {{contractDuration}} with automatic renewal.',
    ]),
    simpleDef('consulting_agreement', 'Consulting Agreement', P('Consulting services for {{party1Name}}.'), [
      'Scope — {{servicesDescription}}.',
      'Deliverables — Milestones per Schedule 1.',
      'Fees — {{paymentTerms}}.',
      'Independent contractor — No employment relationship.',
    ]),
    simpleDef('data_processing_agreement', 'Data Processing Agreement', P('Processor terms for personal data.'), [
      'Subject matter — Processing of personal data for {{servicesDescription}}.',
      'Instructions — Client instructs Processor; Processor complies with DPDP/GDPR.',
      'Security — Technical and organisational measures schedule.',
      'Sub-processors — Prior written consent required.',
    ]),
    simpleDef('director_appointment_letter', 'Director Appointment Letter', P('Appointment of director.'), [
      'Appointment — {{party2Name}} appointed director of {{companyName}} effective {{contractStartDate}}.',
      'Duties — Fiduciary duties under {{governingLaw}}.',
      'Remuneration — {{paymentTerms}}.',
      'Conflicts — Disclosure obligations.',
    ]),
    simpleDef('director_resignation_letter', 'Director Resignation Letter', P('Resignation of director.'), [
      'Resignation — {{party2Name}} resigns as director of {{companyName}} effective {{contractEndDate}}.',
      'Handover — Cooperation with replacement director.',
      'Release — No claims except accrued remuneration.',
    ]),
    simpleDef('shareholder_resolution', 'Shareholder Written Resolution', P('Resolution of {{companyName}} shareholders.'), [
      'Resolution — IT IS RESOLVED THAT {{resolutionDescription}}.',
      'Effective date — {{contractStartDate}}.',
      'Signatures — Shareholder signatories.',
    ]),
    simpleDef('agm_minutes', 'AGM Minutes', P('Annual general meeting of {{companyName}}.'), [
      'Meeting details — Held on {{today}} at {{party1Address}}.',
      'Business — Accounts, directors report, auditor appointment.',
      'Resolutions — {{resolutionDescription}}.',
    ]),
    simpleDef('egm_notice', 'EGM Notice', P('Notice of extraordinary general meeting.'), [
      'Notice — EGM of {{companyName}} on {{contractStartDate}}.',
      'Resolutions — {{resolutionDescription}}.',
      'Quorum — Per articles of association.',
    ]),
    simpleDef('company_secretarial_checklist', 'Company Secretarial Checklist', P('Post-incorporation compliance.'), [
      'Registers — Members, directors, charges, PSC/register of beneficial owners.',
      'Filings — Annual return, accounts, event-driven filings.',
      'Meetings — AGM within statutory deadline.',
      'Registers location — {{party1Address}}.',
    ]),
    simpleDef('llp_deed', 'LLP Deed', P('LLP agreement for {{companyName}}.'), [
      'Partners — {{party1Name}} and {{party2Name}}; profit share {{equitySplit}}.',
      'Management — Designated partners and decision-making.',
      'Capital — {{paymentTerms}}.',
      'Retirement — Exit and goodwill valuation.',
    ]),
    simpleDef('partnership_deed', 'Partnership Deed', P('Partnership deed for {{businessName}}.'), [
      'Business — {{servicesDescription}}.',
      'Capital and profits — {{equitySplit}}; {{paymentTerms}}.',
      'Banking — Joint signatories.',
      'Dissolution — Winding up and asset distribution.',
    ]),
    simpleDef('beneficial_ownership_declaration', 'Beneficial Ownership Declaration', P('BO declaration for {{companyName}}.'), [
      'Declarant — {{clientName}}.',
      'Beneficial owners — Names, addresses, and control percentages.',
      'Confirmation — Information true and complete as at {{today}}.',
    ]),
    simpleDef('bank_account_resolution', 'Bank Account Resolution', P('Authority to open bank account.'), [
      'Resolution — Board resolves to open account with {{bankName}}.',
      'Signatories — {{directorNames}} authorised signatories.',
      'Mandate — Signing limits per schedule.',
    ]),
    simpleDef('registered_office_change', 'Registered Office Change', P('Change of registered office.'), [
      'Old address — {{party2Address}}.',
      'New address — {{party1Address}} effective {{contractStartDate}}.',
      'Filing — File with registrar within statutory period.',
    ]),
    simpleDef('general_affidavit', 'General Affidavit', P('Affidavit of {{clientName}}.'), [
      'Deponent — I, {{clientName}}, of {{clientAddress}}, state on oath:',
      'Facts — {{factsOfCase}}.',
      'Belief — I believe the contents are true.',
    ]),
    simpleDef('statutory_declaration', 'Statutory Declaration', P('Declaration by {{clientName}}.'), [
      'Declarant — {{clientName}} solemnly declares:',
      'Contents — {{factsOfCase}}.',
      'Penalty of perjury — Declared before commissioner.',
    ]),
    simpleDef('indemnity_agreement', 'Indemnity Agreement', P('Indemnity in favour of {{party1Name}}.'), [
      'Indemnity — {{party2Name}} indemnifies {{party1Name}} against {{matterDescription}}.',
      'Scope — Losses arising from breach of {{specialClauses}}.',
      'Cap — {{claimAmount}} maximum liability unless fraud.',
    ]),
    simpleDef('guarantee_deed', 'Guarantee Deed', P('Guarantee of obligations of {{party2Name}}.'), [
      'Guarantor — {{party1Name}} guarantees performance of {{matterDescription}}.',
      'Primary debtor — {{party2Name}}.',
      'Demand — Pay on written demand without first pursuing debtor.',
    ]),
    simpleDef('promissory_note', 'Promissory Note', P('Promise to pay {{claimAmount}}.'), [
      'Maker — {{party2Name}} promises to pay {{party1Name}} {{claimAmount}}.',
      'Date — Due on {{completionDate}}.',
      'Interest — {{paymentTerms}}.',
    ]),
    simpleDef('loan_agreement', 'Loan Agreement', P('Loan from {{party1Name}} to {{party2Name}}.'), [
      'Facility — Principal {{claimAmount}}; purpose {{servicesDescription}}.',
      'Interest and repayment — {{paymentTerms}}.',
      'Events of default — Non-payment, insolvency, material breach.',
      'Security — {{specialClauses}}.',
    ]),
    simpleDef('security_agreement', 'Security Agreement', P('Security over assets of {{party2Name}}.'), [
      'Secured obligations — {{claimAmount}} under loan agreement.',
      'Collateral — {{servicesDescription}}.',
      'Perfection — Filing and registration steps.',
    ]),
    simpleDef('privacy_policy', 'Privacy Policy', P('Privacy policy for {{companyName}}.'), [
      'Data collected — Categories of personal data processed.',
      'Purposes — {{servicesDescription}}; lawful bases under applicable privacy law.',
      'Rights — Access, correction, erasure, and complaint mechanisms.',
      'Contact — Data protection officer / privacy contact.',
    ]),
    simpleDef('terms_of_service', 'Terms of Service', P('Website/app terms for {{companyName}}.'), [
      'Acceptance — Binding terms for use of services.',
      'User obligations — Acceptable use and account security.',
      'Liability — Limitation and disclaimers per {{governingLaw}}.',
      'Termination — Suspension for breach.',
    ]),
    simpleDef('cookie_policy', 'Cookie Policy', P('Cookie policy for {{companyName}}.'), [
      'Cookies used — Essential, analytics, and marketing cookies.',
      'Consent — Mechanism for opt-in where required.',
      'Retention — Cookie duration table.',
    ]),
    simpleDef('general_power_of_attorney', 'General Power of Attorney', P('General POA by {{clientName}}.'), [
      'Principal — {{clientName}} appoints {{attorneyName}} as attorney.',
      'Powers — General authority over property and financial affairs.',
      'Duration — Until revoked or {{contractEndDate}}.',
    ]),
    simpleDef('special_power_of_attorney', 'Special Power of Attorney', P('Special POA by {{clientName}}.'), [
      'Principal — {{clientName}} appoints {{attorneyName}} for limited purpose.',
      'Specific powers — {{matterDescription}} only.',
      'Revocation — Revocable at any time in writing.',
    ]),
  ],
  real_estate_property: [
    simpleDef('residential_lease', 'Residential Lease', P('Residential tenancy at {{propertyAddress}}.'), [
      'Premises — {{propertyAddress}}; letting as private residence.',
      'Term — {{leaseTerm}} commencing {{contractStartDate}}.',
      'Rent — {{rentAmount}} per month; deposit {{depositAmount}}.',
      'Tenant covenants — Repair, use, and insurance obligations.',
    ]),
    simpleDef('commercial_lease', 'Commercial Lease', P('Commercial lease of {{propertyAddress}}.'), [
      'Premises — {{propertyAddress}}; permitted use {{servicesDescription}}.',
      'Term — {{leaseTerm}}; rent review per schedule.',
      'Rent — {{rentAmount}}; service charge apportionment.',
      'Alienation — Assignment and subletting restrictions.',
    ]),
    simpleDef('sublease_agreement', 'Sublease Agreement', P('Sublease of {{propertyAddress}}.'), [
      'Head lease — Subject to superior lease dated {{contractStartDate}}.',
      'Sub-landlord / sub-tenant — {{party1Name}} / {{party2Name}}.',
      'Term — Not exceeding remainder of head lease.',
      'Rent — {{rentAmount}}.',
    ]),
    simpleDef('lease_renewal', 'Lease Renewal Agreement', P('Renewal of lease for {{propertyAddress}}.'), [
      'Original lease — Dated {{contractStartDate}}.',
      'Renewed term — {{leaseTerm}} from {{completionDate}}.',
      'Revised rent — {{rentAmount}}.',
    ]),
    simpleDef('lease_termination_notice', 'Lease Termination Notice', P('Notice to terminate lease.'), [
      'Property — {{propertyAddress}}.',
      'Termination date — {{contractEndDate}} per break clause / notice period {{noticePeriod}}.',
      'Vacant possession — Required on termination.',
    ]),
    simpleDef('mortgage_deed', 'Mortgage Deed', P('Mortgage over {{propertyAddress}}.'), [
      'Borrower / lender — {{party2Name}} / {{party1Name}}.',
      'Secured amount — {{claimAmount}}.',
      'Property — {{propertyAddress}}.',
      'Covenants — Payment, insurance, and preservation of security.',
    ]),
    simpleDef('charge_registration_cover', 'Charge Registration Cover Letter', P('Registration of charge.'), [
      'Charge — Over assets of {{companyName}} in favour of {{party1Name}}.',
      'Registration — Filing with land registry / RoC as applicable.',
      'Enclosures — Charge instrument and board resolution.',
    ]),
    simpleDef('land_sale_agreement', 'Land Sale Agreement', P('Sale of land at {{propertyAddress}}.'), [
      'Vendor / purchaser — {{vendorName}} / {{clientName}}.',
      'Consideration — {{propertyPrice}}.',
      'Title — Freehold/leasehold; encumbrances disclosed.',
      'Completion — {{completionDate}}; vacant possession.',
    ]),
    simpleDef('development_agreement', 'Development Agreement', P('Property development at {{propertyAddress}}.'), [
      'Site — {{propertyAddress}}.',
      'Developer obligations — {{servicesDescription}}.',
      'Planning — Obtain and maintain planning permissions.',
      'Revenue share — {{paymentTerms}}.',
    ]),
    simpleDef('deed_of_assignment', 'Deed of Assignment', P('Assignment of lease/property interest.'), [
      'Assignor / assignee — {{party1Name}} / {{party2Name}}.',
      'Property — {{propertyAddress}}.',
      'Consideration — {{propertyPrice}}.',
      'Covenants — Title covenant and indemnity.',
    ]),
    simpleDef('transfer_deed', 'Transfer Deed', P('Transfer of {{propertyAddress}}.'), [
      'Transferor / transferee — {{vendorName}} / {{clientName}}.',
      'Title number — {{titleNumber}}.',
      'Price — {{propertyPrice}}; SDLT/stamp duty declaration.',
    ]),
    simpleDef('easement_agreement', 'Easement Agreement', P('Grant of easement over {{propertyAddress}}.'), [
      'Dominant / servient land — Description in schedule.',
      'Rights granted — Access, drainage, or utilities as specified.',
      'Maintenance — Cost sharing.',
    ]),
    simpleDef('property_management_agreement', 'Property Management Agreement', P('Management of {{propertyAddress}}.'), [
      'Manager — {{party2Name}} appointed by {{party1Name}}.',
      'Services — Letting, rent collection, maintenance.',
      'Fees — {{paymentTerms}}.',
    ]),
    simpleDef('rent_arrears_demand', 'Rent Arrears Demand', P('Demand for rent arrears.'), [
      'Tenant — {{party2Name}}; property {{propertyAddress}}.',
      'Arrears — {{claimAmount}} due by {{completionDate}}.',
      'Consequences — Forfeiture / possession proceedings if unpaid.',
    ]),
    simpleDef('eviction_notice', 'Eviction Notice', P('Notice seeking possession.'), [
      'Tenant — {{party2Name}}; premises {{propertyAddress}}.',
      'Grounds — {{disputeDetails}}.',
      'Date — Possession required by {{contractEndDate}}.',
    ]),
    simpleDef('notice_to_quit', 'Notice to Quit', P('Notice to quit tenancy.'), [
      'Tenant — {{party2Name}}.',
      'Expiry — Tenancy ends on {{contractEndDate}}.',
      'Minimum notice — Per applicable tenancy statute.',
    ]),
    simpleDef('completion_statement', 'Completion Statement', P('Completion statement for {{propertyAddress}}.'), [
      'Purchase price — {{propertyPrice}}.',
      'Adjustments — Rates, rent, and apportionments.',
      'Balance due — {{claimAmount}} on completion.',
    ]),
    simpleDef('vacant_possession_undertaking', 'Vacant Possession Undertaking', P('Undertaking to give vacant possession.'), [
      'Vendor — {{vendorName}} undertakes vacant possession on {{completionDate}}.',
      'Condition — Reasonable state of repair.',
    ]),
  ],
  employment_labour: [
    simpleDef('offer_letter', 'Offer of Employment', P('Offer to {{party2Name}}.'), [
      'Position — {{jobTitle}}; start date {{contractStartDate}}.',
      'Salary — {{salary}}; benefits summary.',
      'Conditions — Subject to references and right to work checks.',
      'Acceptance — Sign and return by {{completionDate}}.',
    ]),
    simpleDef('appointment_letter', 'Appointment Letter', P('Appointment of {{party2Name}}.'), [
      'Role — {{jobTitle}} reporting to {{managerName}}.',
      'Commencement — {{contractStartDate}}.',
      'Terms — Refer to employment contract enclosed.',
    ]),
    simpleDef('termination_letter', 'Termination Letter', P('Termination of employment.'), [
      'Employee — {{party2Name}}.',
      'Termination — Effective {{contractEndDate}} with {{noticePeriod}} notice.',
      'Reason — {{factsOfCase}}.',
      'Payments — Accrued salary and statutory entitlements.',
    ]),
    simpleDef('redundancy_letter', 'Redundancy Letter', P('Redundancy consultation.'), [
      'Employee — {{party2Name}}; role {{jobTitle}}.',
      'Reason — Redundancy situation: {{factsOfCase}}.',
      'Consultation — Meetings and selection criteria.',
      'Package — {{settlementAmount}} redundancy payment.',
    ]),
    simpleDef('warning_letter', 'Disciplinary Warning Letter', P('Formal warning to {{party2Name}}.'), [
      'Misconduct — {{factsOfCase}}.',
      'Warning level — First / final written warning.',
      'Improvement — Required standards and review period.',
    ]),
    simpleDef('settlement_waiver_release', 'Settlement Waiver and Release', P('Compromise agreement.'), [
      'Parties — Employer {{party1Name}}; Employee {{party2Name}}.',
      'Payment — {{settlementAmount}} in full and final settlement.',
      'Waiver — Claims waived except accrued pension rights.',
    ]),
    simpleDef('consultancy_agreement_individual', 'Individual Consultancy Agreement', P('Consultant {{party2Name}}.'), [
      'Services — {{servicesDescription}}.',
      'Fees — {{paymentTerms}}; not employment.',
      'IR35 / classification — Independent contractor status.',
    ]),
    simpleDef('employee_handbook_acknowledgment', 'Handbook Acknowledgment', P('Acknowledgment by {{party2Name}}.'), [
      'Receipt — Employee received employee handbook.',
      'Compliance — Agrees to abide by policies.',
      'Updates — Employer may amend with notice.',
    ]),
    simpleDef('restrictive_covenants_deed', 'Restrictive Covenants Deed', P('Post-termination restrictions.'), [
      'Employee — {{party2Name}}.',
      'Non-compete — {{restrictedTerritory}} for {{nonCompetePeriod}}.',
      'Non-solicit — Clients and employees.',
    ]),
    simpleDef('bonus_commission_plan', 'Bonus and Commission Plan', P('Incentive plan for {{party2Name}}.'), [
      'Targets — {{servicesDescription}}.',
      'Bonus — {{paymentTerms}} on achievement.',
      'Clawback — Malus/clawback on misconduct or restatement.',
    ]),
    simpleDef('secondment_agreement', 'Secondment Agreement', P('Secondment of {{party2Name}}.'), [
      'Host / home employer — {{party2Name}} seconded to {{party1Name}}.',
      'Duration — {{contractDuration}}.',
      'Costs — {{paymentTerms}} borne by host.',
    ]),
    simpleDef('collective_bargaining_draft', 'Collective Bargaining Draft', P('Draft collective terms.'), [
      'Parties — Employer and recognised union.',
      'Scope — {{servicesDescription}} workforce.',
      'Proposed terms — Wages, hours, and grievance procedure.',
    ]),
  ],
  family_matrimonial: [
    simpleDef('prenuptial_agreement', 'Prenuptial Agreement', P('Agreement before marriage.'), [
      'Parties — {{clientName}} and {{spouseName}}; marriage on {{marriageDate}}.',
      'Separate property — Schedule of premarital assets.',
      'Division — Terms on divorce or dissolution.',
      'Independent advice — Both parties received legal advice.',
    ]),
    simpleDef('postnuptial_agreement', 'Postnuptial Agreement', P('Agreement after marriage.'), [
      'Parties — {{clientName}} and {{spouseName}}.',
      'Purpose — Regulate financial affairs going forward.',
      'Full disclosure — Financial disclosure attached.',
    ]),
    simpleDef('separation_agreement', 'Separation Agreement', P('Separation of {{clientName}} and {{spouseName}}.'), [
      'Separation — Parties agree to live apart from {{contractStartDate}}.',
      'Finances — Maintenance {{paymentTerms}}; property {{propertyAddress}}.',
      'Children — {{childrenDetails}} arrangements.',
    ]),
    simpleDef('divorce_petition', 'Divorce Petition', P('Petition for divorce/dissolution.'), [
      'Petitioner — {{clientName}}; Respondent {{spouseName}}.',
      'Grounds — {{groundsForOrder}}.',
      'Relief — Decree and financial orders sought.',
    ]),
    simpleDef('financial_disclosure_form', 'Financial Disclosure Form (Form E)', P('Financial statement.'), [
      'Assets — Property, bank accounts, investments.',
      'Liabilities — Mortgages and debts.',
      'Income — {{salary}} and other income.',
    ]),
    simpleDef('consent_order_draft', 'Draft Consent Order', P('Agreed financial order.'), [
      'Parties — {{clientName}} and {{spouseName}}.',
      'Orders sought — {{pensionSharingTerms}}; property {{propertyAddress}}.',
      'Clean break — Mutual clean break where applicable.',
    ]),
    simpleDef('child_arrangements_application', 'Child Arrangements Application', P('Application re children.'), [
      'Applicant — {{clientName}}.',
      'Children — {{childrenDetails}}.',
      'Orders sought — Live with / spend time with arrangements.',
    ]),
    simpleDef('specific_issue_order', 'Specific Issue Order Application', P('Specific issue application.'), [
      'Issue — {{matterDescription}}.',
      'Proposal — {{clientPosition}}.',
    ]),
    simpleDef('domestic_violence_affidavit', 'Domestic Violence Affidavit', P('Supporting affidavit.'), [
      'Applicant — {{clientName}}; Respondent {{respondentName}}.',
      'Incidents — {{factsOfCase}}.',
      'Protection sought — Non-molestation / occupation order.',
    ]),
    simpleDef('marriage_affidavit', 'Marriage Affidavit', P('Affidavit as to marriage.'), [
      'Deponent — {{clientName}}.',
      'Marriage — To {{spouseName}} on {{marriageDate}}.',
    ]),
    simpleDef('name_change_deed_poll', 'Deed Poll (Name Change)', P('Change of name to {{newName}}.'), [
      'Declarant — {{clientName}} renounces former name.',
      'New name — Shall be known as {{newName}}.',
      'Publication — Advertise in gazette where required.',
    ]),
  ],
  tax: [
    simpleDef('tax_registration_application', 'Tax Registration Application', P('Registration for {{clientName}}.'), [
      'Entity — {{companyName}}; tax ID application.',
      'Business activity — {{servicesDescription}}.',
      'Effective date — {{contractStartDate}}.',
    ]),
    simpleDef('withholding_tax_declaration', 'Withholding Tax Declaration', P('WHT declaration.'), [
      'Payor — {{party1Name}}; payee {{party2Name}}.',
      'Rates — Applicable withholding per {{governingLaw}}.',
      'Certificates — Form 16 / equivalent attached.',
    ]),
    simpleDef('advance_tax_computation', 'Advance Tax Computation', P('Advance tax for {{clientName}}.'), [
      'Assessment year — {{taxPeriod}}.',
      'Estimated liability — {{additionalTaxDue}}.',
      'Installments — Payment schedule.',
    ]),
    simpleDef('transfer_pricing_memo', 'Transfer Pricing Memorandum', P('TP analysis for {{companyName}}.'), [
      'Controlled transactions — {{matterDescription}}.',
      'Method — CUP / TNMM / cost plus as applicable.',
      'Benchmark — Arm\'s length range.',
    ]),
    simpleDef('thin_capitalisation_note', 'Thin Capitalisation Note', P('Debt equity analysis.'), [
      'Borrower — {{companyName}}.',
      'Debt — {{claimAmount}}; equity {{equitySplit}}.',
      'Interest deductibility — Per {{governingLaw}}.',
    ]),
    simpleDef('objection_to_assessment', 'Objection to Assessment', P('Objection by {{clientName}}.'), [
      'Assessment — Dated {{assessmentDate}} for {{taxPeriod}}.',
      'Grounds — {{groundOne}}; {{groundTwo}}.',
      'Relief sought — Reduction / cancellation.',
    ]),
    simpleDef('appeal_to_tribunal', 'Appeal to Tax Tribunal', P('Appeal by {{clientName}}.'), [
      'Tribunal — {{taxTribunal}}.',
      'Decision appealed — {{assessmentDate}}.',
      'Grounds — {{groundOne}}.',
    ]),
    simpleDef('tax_clearance_request', 'Tax Clearance Certificate Request', P('Clearance for {{clientName}}.'), [
      'Purpose — {{matterDescription}}.',
      'Tax compliance — All returns filed; no outstanding liabilities.',
    ]),
    simpleDef('tax_residency_certificate_request', 'Tax Residency Certificate Request', P('Residency certificate.'), [
      'Applicant — {{clientName}}.',
      'Treaty — {{governingLaw}} double taxation treaty relief.',
    ]),
  ],
  litigation_disputes: [
    simpleDef('particulars_of_claim', 'Particulars of Claim', P('Claim by {{clientName}}.'), [
      'Parties — Claimant {{clientName}}; Defendant {{respondentName}}.',
      'Facts — {{factsOfCase}}.',
      'Breach — {{disputeDetails}}.',
      'Loss — {{claimAmount}}.',
    ]),
    simpleDef('defence', 'Defence', P('Defence of {{respondentName}}.'), [
      'Response — Deny/admit allegations in particulars.',
      'Own case — {{defenseStrategy}}.',
    ]),
    simpleDef('reply', 'Reply', P('Reply by {{clientName}}.'), [
      'Reply — Respond to new matters raised in defence.',
    ]),
    simpleDef('interlocutory_application', 'Interlocutory Application', P('Application in proceedings.'), [
      'Relief — {{matterDescription}}.',
      'Grounds — {{groundsForOrder}}.',
    ]),
    simpleDef('injunction_application', 'Injunction Application', P('Application for injunction.'), [
      'Applicant — {{clientName}}; Respondent {{respondentName}}.',
      'Interim relief — {{groundsForOrder}}.',
      'Undertaking as to damages — Offered.',
    ]),
    simpleDef('affidavit', 'Litigation Affidavit', P('Affidavit of {{clientName}}.'), [
      'Deponent — {{clientName}} of {{clientAddress}}.',
      'Evidence — {{witnessNarrative}}.',
    ]),
    simpleDef('skeleton_argument', 'Skeleton Argument', P('Skeleton for hearing.'), [
      'Issues — {{matterDescription}}.',
      'Submissions — {{clientPosition}}.',
      'Authorities — {{legislationCited}}.',
    ]),
    simpleDef('costs_budget', 'Costs Budget', P('Costs budget for {{clientName}}.'), [
      'Phase — Pre-action through trial.',
      'Estimated costs — {{claimAmount}}.',
    ]),
    simpleDef('without_prejudice_offer', 'Without Prejudice Offer', P('WP offer by {{clientName}}.'), [
      'Offer — {{settlementAmount}} in full settlement.',
      'Validity — Open until {{completionDate}}.',
    ]),
    simpleDef('calderbank_letter', 'Calderbank Letter', P('Calderbank offer.'), [
      'Offer — {{settlementAmount}}; costs consequences if rejected.',
    ]),
    simpleDef('expert_report_instruction', 'Expert Report Instruction Letter', P('Instructions to expert.'), [
      'Expert — {{expertName}}; field {{matterDescription}}.',
      'Questions — Issues for opinion.',
      'CPR / court rules — Comply with expert evidence rules.',
    ]),
    simpleDef('disclosure_list', 'Disclosure List', P('List of documents.'), [
      'Categories — Contract, correspondence, financial records.',
      'Inspection — Available at {{party1Address}}.',
    ]),
  ],
  criminal_defense: [
    simpleDef('bail_variation_application', 'Bail Variation Application', P('Variation of bail for {{clientName}}.'), [
      'Current bail — Terms to be varied.',
      'Proposed terms — {{specialClauses}}.',
    ]),
    simpleDef('charge_dispute_letter', 'Charge Dispute Letter', P('Dispute of charges against {{clientName}}.'), [
      'Charges — {{chargesSummary}}.',
      'Dispute — {{defenseStrategy}}.',
    ]),
    simpleDef('character_reference_letter', 'Character Reference Letter', P('Reference for {{clientName}}.'), [
      'Referee — {{refereeName}}.',
      'Relationship — {{personalCircumstances}}.',
      'Character — Known for {{remorseStatement}}.',
    ]),
    simpleDef('mitigation_bundle_cover', 'Mitigation Bundle Cover', P('Sentencing bundle for {{clientName}}.'), [
      'Contents — Plea in mitigation, references, medical reports.',
      'Charges — {{chargesSummary}}.',
    ]),
    simpleDef('complaint_to_prosecutor', 'Complaint to Prosecutor', P('Complaint re prosecution of {{clientName}}.'), [
      'Issue — {{complaintDetails}}.',
      'Relief — Discontinue / offer no evidence.',
    ]),
    simpleDef('judicial_review_grounds', 'Judicial Review Grounds', P('JR re decision affecting {{clientName}}.'), [
      'Decision — {{factsOfCase}}.',
      'Grounds — Illegality, irrationality, procedural unfairness.',
    ]),
  ],
  immigration: [
    simpleDef('affidavit_of_support', 'Affidavit of Support', P('Financial support for {{clientName}}.'), [
      'Sponsor — {{party1Name}}; applicant {{clientName}}.',
      'Income — {{salary}}; undertaking to maintain.',
    ]),
    simpleDef('relationship_evidence_index', 'Relationship Evidence Index', P('Index for {{clientName}} application.'), [
      'Categories — Communication, finances, cohabitation, photos.',
      'Documents — Listed in schedule.',
    ]),
    simpleDef('employer_sponsor_duty_letter', 'Employer Sponsor Duty Letter', P('Sponsor duties for {{companyName}}.'), [
      'Role — {{jobTitle}} for {{clientName}}.',
      'Compliance — Right to work, record-keeping, reporting.',
    ]),
    simpleDef('right_to_work_checklist', 'Right to Work Checklist', P('RTW checks for {{clientName}}.'), [
      'Documents inspected — Passport, visa, share code.',
      'Date — {{today}}; checker {{managerName}}.',
    ]),
    simpleDef('visa_refusal_reconsideration', 'Visa Refusal Reconsideration', P('Reconsideration for {{clientName}}.'), [
      'Refusal — Dated {{refusalDate}} for {{visaOrStatusType}}.',
      'New evidence — {{groundsOfAppeal}}.',
    ]),
    simpleDef('administrative_review', 'Administrative Review Application', P('AR for {{clientName}}.'), [
      'Decision — Refusal of {{visaOrStatusType}}.',
      'Grounds — Decision contains casework error.',
    ]),
    simpleDef('citizenship_application_cover', 'Citizenship Application Cover Letter', P('Naturalisation application.'), [
      'Applicant — {{clientName}}.',
      'Eligibility — Residence and good character.',
    ]),
    simpleDef('naturalisation_character_ref', 'Naturalisation Character Reference', P('Character ref for {{clientName}}.'), [
      'Referee — {{refereeName}}; known {{personalCircumstances}}.',
    ]),
  ],
  intellectual_property: [
    simpleDef('trademark_assignment', 'Trademark Assignment', P('Assignment of mark {{ipAssetDescription}}.'), [
      'Assignor / assignee — {{assignorName}} / {{clientName}}.',
      'Mark — Registration numbers in schedule.',
      'Consideration — {{assignmentConsideration}}.',
    ]),
    simpleDef('trademark_licence', 'Trademark Licence', P('Licence of {{ipAssetDescription}}.'), [
      'Licensor / licensee — {{party1Name}} / {{licenseeName}}.',
      'Territory — {{licensedTerritory}}; royalty {{royaltyRate}}.',
    ]),
    simpleDef('patent_assignment', 'Patent Assignment', P('Assignment of patent {{ipAssetDescription}}.'), [
      'Patent — Number and title in schedule.',
      'Assignee — {{clientName}}.',
    ]),
    simpleDef('software_licence', 'Software Licence Agreement', P('Licence of software.'), [
      'Software — {{ipAssetDescription}}.',
      'Scope — {{licensedTerritory}}; users {{equitySplit}}.',
      'Restrictions — No reverse engineering.',
    ]),
    simpleDef('work_for_hire_agreement', 'Work for Hire Agreement', P('Commissioned work for {{party1Name}}.'), [
      'Creator — {{party2Name}}.',
      'Deliverables — {{servicesDescription}}.',
      'Ownership — Vests in commissioner on payment.',
    ]),
    simpleDef('moral_rights_waiver', 'Moral Rights Waiver', P('Waiver by {{party2Name}}.'), [
      'Works — {{ipAssetDescription}}.',
      'Waiver — Moral rights to extent permitted by law.',
    ]),
    simpleDef('ip_due_diligence_checklist', 'IP Due Diligence Checklist', P('DD for {{companyName}}.'), [
      'Registered rights — Patents, trademarks, designs.',
      'Contracts — Licences, assignments, encumbrances.',
      'Open source — Compliance review.',
    ]),
    simpleDef('open_source_policy', 'Open Source Software Policy', P('OSS policy for {{companyName}}.'), [
      'Approved licences — MIT, Apache, GPL handling.',
      'Approval — Legal review for copyleft.',
    ]),
  ],
  wills_estates_probate: [
    simpleDef('codicil', 'Codicil to Will', P('Codicil to will of {{clientName}}.'), [
      'Will dated — {{contractStartDate}}.',
      'Amendments — {{specialClauses}}.',
      'Republication — Will republished with codicil.',
    ]),
    simpleDef('letter_of_wishes', 'Letter of Wishes', P('Non-binding wishes of {{clientName}}.'), [
      'Trust/will — Relates to estate plan.',
      'Guidance — {{distributionDetails}} for trustees.',
    ]),
    simpleDef('living_will', 'Living Will / Advance Directive', P('Healthcare wishes of {{clientName}}.'), [
      'Treatment — Preferences for life-sustaining treatment.',
      'Attorney — {{attorneyName}} to decide if incapacitated.',
    ]),
    simpleDef('grant_of_probate_application', 'Grant of Probate Application', P('Probate for estate of {{deceasedName}}.'), [
      'Executor — {{clientName}}.',
      'Estate value — {{netEstate}}.',
      'Will — Dated {{contractStartDate}} attached.',
    ]),
    simpleDef('letters_of_administration', 'Letters of Administration Application', P('Intestacy application.'), [
      'Applicant — {{clientName}}.',
      'Deceased — {{deceasedName}} died intestate.',
    ]),
    simpleDef('deed_of_variation', 'Deed of Variation', P('Variation of estate of {{deceasedName}}.'), [
      'Beneficiaries — Agree to vary entitlements.',
      'Tax — HMRC clearance sought where applicable.',
    ]),
    simpleDef('deed_of_family_arrangement', 'Deed of Family Arrangement', P('Family arrangement re {{deceasedName}} estate.'), [
      'Parties — Beneficiaries agree distribution {{distributionDetails}}.',
    ]),
    simpleDef('trustee_appointment_deed', 'Trustee Appointment Deed', P('Appointment of trustee.'), [
      'Trust — {{trustFundDescription}}.',
      'New trustee — {{trusteeNames}}.',
    ]),
    simpleDef('beneficiary_deed', 'Beneficiary Deed', P('Transfer on death designation.'), [
      'Property — {{propertyAddress}}.',
      'Beneficiary — {{primaryBeneficiary}}.',
    ]),
  ],
};
