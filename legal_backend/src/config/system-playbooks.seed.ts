export interface SystemPlaybookTaskTemplate {
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueInDays: number;
  phase?: string;
  category?: string;
}

export interface SystemPlaybookSeed {
  name: string;
  description: string;
  practiceArea: string;
  matterType: string;
  countryCode: string | null;
  taskTemplates: SystemPlaybookTaskTemplate[];
  recommendedDocuments?: string[];
  limitationPeriodDays?: number;
  limitationNotes?: string;
}

export const SYSTEM_PLAYBOOKS: SystemPlaybookSeed[] = [
  // ═══════════════════════════════════════════════════════════════════
  // LITIGATION & DISPUTES — All jurisdictions
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Civil Litigation — Standard',
    description: 'Standard civil litigation playbook for commercial and general claims.',
    practiceArea: 'litigation_disputes',
    matterType: 'Litigation',
    countryCode: null,
    limitationPeriodDays: 2190, // 6 years
    limitationNotes: 'Standard contract/tort limitation: 6yr (UK/KE), 4yr (US-CA contract), 3yr (IN contract)',
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Preliminary Advice Memo',
      'Litigation Budget Estimate',
      'Evidence Checklist',
    ],
    taskTemplates: [
      { title: 'Initial client intake and conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Review client documents and evidence', priority: 'HIGH', dueInDays: 3, phase: 'Investigation', category: 'Review' },
      { title: 'Assess limitation period', priority: 'HIGH', dueInDays: 3, phase: 'Investigation', category: 'Legal' },
      { title: 'Draft preliminary advice / merits assessment', priority: 'HIGH', dueInDays: 7, phase: 'Investigation', category: 'Drafting' },
      { title: 'Send pre-action protocol letter / Letter before Action', priority: 'HIGH', dueInDays: 14, phase: 'Pre-Action', category: 'Correspondence' },
      { title: 'Obtain client authority for proceedings', priority: 'HIGH', dueInDays: 21, phase: 'Pre-Action', category: 'Admin' },
      { title: 'Draft and file claim / plaint', priority: 'HIGH', dueInDays: 30, phase: 'Pleadings', category: 'Court Filing' },
      { title: 'Serve claim on defendant', priority: 'HIGH', dueInDays: 35, phase: 'Pleadings', category: 'Court Filing' },
      { title: 'Consider ADR / mediation offer', priority: 'MEDIUM', dueInDays: 45, phase: 'Pre-Trial', category: 'Negotiation' },
      { title: 'Review defence / written statement', priority: 'HIGH', dueInDays: 50, phase: 'Pleadings', category: 'Review' },
      { title: 'File reply to defence if required', priority: 'MEDIUM', dueInDays: 60, phase: 'Pleadings', category: 'Court Filing' },
      { title: 'Prepare witness statements', priority: 'HIGH', dueInDays: 90, phase: 'Discovery', category: 'Drafting' },
      { title: 'Complete disclosure / discovery', priority: 'HIGH', dueInDays: 100, phase: 'Discovery', category: 'Legal' },
      { title: 'Instruct expert witnesses if required', priority: 'MEDIUM', dueInDays: 120, phase: 'Discovery', category: 'Expert' },
      { title: 'Pre-trial conference preparation', priority: 'HIGH', dueInDays: 150, phase: 'Pre-Trial', category: 'Preparation' },
      { title: 'Draft skeleton argument / written submissions', priority: 'HIGH', dueInDays: 170, phase: 'Trial', category: 'Drafting' },
      { title: 'Trial attendance and representation', priority: 'HIGH', dueInDays: 180, phase: 'Trial', category: 'Court' },
      { title: 'Post-judgment enforcement (if applicable)', priority: 'MEDIUM', dueInDays: 210, phase: 'Post-Trial', category: 'Enforcement' },
      { title: 'Close matter and archive file', priority: 'LOW', dueInDays: 240, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // REAL ESTATE — Conveyancing (Purchase)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Property Purchase — Conveyancing',
    description: 'Standard residential/commercial property purchase conveyancing.',
    practiceArea: 'real_estate_property',
    matterType: 'Transaction',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Sale Agreement / Contract',
      'Title Search Certificate',
      'Stamp Duty Calculation Memo',
      'Completion Statement',
    ],
    taskTemplates: [
      { title: 'Client intake, ID/KYC verification', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'KYC' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Obtain title search / official copy entries', priority: 'HIGH', dueInDays: 3, phase: 'Pre-Contract', category: 'Search' },
      { title: 'Review draft sale agreement / contract pack', priority: 'HIGH', dueInDays: 5, phase: 'Pre-Contract', category: 'Review' },
      { title: 'Raise pre-contract enquiries / requisitions on title', priority: 'HIGH', dueInDays: 7, phase: 'Pre-Contract', category: 'Correspondence' },
      { title: 'Instruct searches (local authority, drainage, environmental)', priority: 'HIGH', dueInDays: 7, phase: 'Pre-Contract', category: 'Search' },
      { title: 'Review search results and advise client', priority: 'HIGH', dueInDays: 14, phase: 'Pre-Contract', category: 'Review' },
      { title: 'Review mortgage offer and conditions', priority: 'HIGH', dueInDays: 14, phase: 'Pre-Contract', category: 'Finance' },
      { title: 'Advise client on contract and results', priority: 'HIGH', dueInDays: 21, phase: 'Pre-Contract', category: 'Advice' },
      { title: 'Exchange contracts (obtain deposit)', priority: 'HIGH', dueInDays: 30, phase: 'Exchange', category: 'Transaction' },
      { title: 'Prepare completion / transfer documents (TR1 / LRA forms)', priority: 'HIGH', dueInDays: 35, phase: 'Pre-Completion', category: 'Drafting' },
      { title: 'Report to mortgage lender', priority: 'HIGH', dueInDays: 35, phase: 'Pre-Completion', category: 'Finance' },
      { title: 'Calculate stamp duty / land tax and obtain funds', priority: 'HIGH', dueInDays: 38, phase: 'Pre-Completion', category: 'Tax' },
      { title: 'Completion — transfer funds and collect keys', priority: 'HIGH', dueInDays: 45, phase: 'Completion', category: 'Transaction' },
      { title: 'Pay stamp duty / land transaction tax (SDLT/LTT)', priority: 'HIGH', dueInDays: 46, phase: 'Post-Completion', category: 'Tax' },
      { title: 'Register title at Land Registry / Ardhisasa / Sub-Registrar', priority: 'HIGH', dueInDays: 60, phase: 'Post-Completion', category: 'Registration' },
      { title: 'Send title documents / register confirmation to client', priority: 'MEDIUM', dueInDays: 90, phase: 'Post-Completion', category: 'Correspondence' },
      { title: 'Close matter and archive', priority: 'LOW', dueInDays: 95, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CORPORATE — Company Incorporation
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Company Incorporation',
    description: 'New company formation and post-incorporation compliance setup.',
    practiceArea: 'corporate_commercial',
    matterType: 'Registration',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Shareholders Agreement',
      'Memorandum & Articles of Association',
      'Incorporation Certificate',
      'Share Allotment Resolution',
    ],
    taskTemplates: [
      { title: 'Initial consultation — structure, shareholders, and directors', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Advice' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'KYC — collect ID for all directors and shareholders', priority: 'HIGH', dueInDays: 3, phase: 'Intake', category: 'KYC' },
      { title: 'Reserve company name (eCitizen / Companies House)', priority: 'HIGH', dueInDays: 3, phase: 'Formation', category: 'Filing' },
      { title: 'Draft Memorandum & Articles / constitutional documents', priority: 'HIGH', dueInDays: 7, phase: 'Formation', category: 'Drafting' },
      { title: 'Obtain client approval of constitutional documents', priority: 'HIGH', dueInDays: 10, phase: 'Formation', category: 'Approval' },
      { title: 'File incorporation application (SPICe+/IN01/CR-1)', priority: 'HIGH', dueInDays: 14, phase: 'Formation', category: 'Filing' },
      { title: 'Receive Certificate of Incorporation', priority: 'HIGH', dueInDays: 21, phase: 'Formation', category: 'Receipt' },
      { title: 'Issue shares to shareholders', priority: 'HIGH', dueInDays: 25, phase: 'Post-Formation', category: 'Corporate' },
      { title: 'File return of allotment (SH01 / CR-19 / MCA form)', priority: 'HIGH', dueInDays: 28, phase: 'Post-Formation', category: 'Filing' },
      { title: 'Open business bank account', priority: 'MEDIUM', dueInDays: 30, phase: 'Post-Formation', category: 'Admin' },
      { title: 'Register for applicable taxes (VAT/GST, PAYE/EPFO)', priority: 'HIGH', dueInDays: 35, phase: 'Post-Formation', category: 'Tax' },
      { title: 'Draft shareholders agreement (if multiple shareholders)', priority: 'HIGH', dueInDays: 40, phase: 'Post-Formation', category: 'Drafting' },
      { title: 'Beneficial ownership register filing (LBOF-1 / PSC register)', priority: 'HIGH', dueInDays: 42, phase: 'Post-Formation', category: 'Compliance' },
      { title: 'Close matter and archive constitutionaldocuments', priority: 'LOW', dueInDays: 50, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // INTELLECTUAL PROPERTY — Trademark Registration
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Trademark Registration',
    description: 'New trademark application through to registration.',
    practiceArea: 'intellectual_property',
    matterType: 'Registration',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Trademark Search Report',
      'Application Confirmation',
      'Registration Certificate',
    ],
    taskTemplates: [
      { title: 'Client instructions — identify mark, goods/services, jurisdictions', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Intake' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Clearance search (KIPI/USPTO/IPO/IP India databases)', priority: 'HIGH', dueInDays: 5, phase: 'Search', category: 'Search' },
      { title: 'Report clearance search results and advise on risk', priority: 'HIGH', dueInDays: 7, phase: 'Search', category: 'Advice' },
      { title: 'Classify goods/services under Nice Classification', priority: 'HIGH', dueInDays: 8, phase: 'Application', category: 'Legal' },
      { title: 'Prepare and file trademark application (TM-1/TM3/TEAS/TM-A)', priority: 'HIGH', dueInDays: 14, phase: 'Application', category: 'Filing' },
      { title: 'Obtain application filing receipt / acknowledgment', priority: 'HIGH', dueInDays: 15, phase: 'Application', category: 'Receipt' },
      { title: 'Monitor examination period (respond to office actions if raised)', priority: 'HIGH', dueInDays: 90, phase: 'Examination', category: 'Monitoring' },
      { title: 'Respond to examination report / objections (if any)', priority: 'HIGH', dueInDays: 120, phase: 'Examination', category: 'Response' },
      { title: 'Monitor opposition period', priority: 'MEDIUM', dueInDays: 210, phase: 'Publication', category: 'Monitoring' },
      { title: 'Receive registration certificate', priority: 'HIGH', dueInDays: 365, phase: 'Registration', category: 'Receipt' },
      { title: 'Diarise renewal date (10 years from filing)', priority: 'HIGH', dueInDays: 366, phase: 'Registration', category: 'Diary' },
      { title: 'Issue registration certificate to client', priority: 'MEDIUM', dueInDays: 370, phase: 'Closure', category: 'Correspondence' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // EMPLOYMENT — Unfair Dismissal
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Employment — Unfair Dismissal Claim',
    description: 'Unfair or wrongful dismissal claim from initial instructions to settlement or hearing.',
    practiceArea: 'employment_labour',
    matterType: 'Dispute',
    countryCode: null,
    limitationPeriodDays: 92, // 3 months minus 1 day for ET
    limitationNotes: 'UK: 3 months less 1 day from effective date of termination. KE: 3 years. US: 180-300 days (EEOC). IN: 1 year (Labour Court).',
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Employment Contract',
      'Dismissal Letter',
      'Acas Early Conciliation Certificate',
      'ET1 Claim Form',
    ],
    taskTemplates: [
      { title: 'Urgent limitation period check (3 months UK)', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Limitation' },
      { title: 'Collect employment contract, dismissal letter, payslips', priority: 'HIGH', dueInDays: 2, phase: 'Intake', category: 'Documents' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Advise on merits of unfair/wrongful dismissal claim', priority: 'HIGH', dueInDays: 5, phase: 'Investigation', category: 'Advice' },
      { title: 'Apply for Acas Early Conciliation certificate (UK)', priority: 'HIGH', dueInDays: 7, phase: 'Pre-Claim', category: 'Procedure' },
      { title: 'File ET1 / ELRC claim / EEOC charge / Labour Court reference', priority: 'HIGH', dueInDays: 30, phase: 'Claim Filing', category: 'Filing' },
      { title: 'Prepare witness statement', priority: 'HIGH', dueInDays: 60, phase: 'Preparation', category: 'Drafting' },
      { title: 'Review ET3 / respondent response', priority: 'HIGH', dueInDays: 75, phase: 'Pleadings', category: 'Review' },
      { title: 'Explore settlement / negotiate settlement', priority: 'HIGH', dueInDays: 90, phase: 'Negotiation', category: 'Negotiation' },
      { title: 'Prepare Schedule of Loss', priority: 'HIGH', dueInDays: 100, phase: 'Preparation', category: 'Drafting' },
      { title: 'Exchange documents / disclosure', priority: 'HIGH', dueInDays: 120, phase: 'Disclosure', category: 'Legal' },
      { title: 'Prepare hearing bundle', priority: 'HIGH', dueInDays: 150, phase: 'Hearing Prep', category: 'Preparation' },
      { title: 'Employment Tribunal / ELRC hearing', priority: 'HIGH', dueInDays: 180, phase: 'Hearing', category: 'Court' },
      { title: 'Enforce judgment or appeal if required', priority: 'MEDIUM', dueInDays: 210, phase: 'Post-Hearing', category: 'Enforcement' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILY — Divorce
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Divorce / Dissolution of Marriage',
    description: 'Divorce proceedings from petition to decree absolute / final order.',
    practiceArea: 'family_matrimonial',
    matterType: 'Litigation',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Marriage Certificate',
      'D8 / MA18 / HMA Petition',
      'Financial Disclosure Statement (E1/FL-150)',
      'Child Arrangements Order (if applicable)',
      'Consent Order',
    ],
    taskTemplates: [
      { title: 'Intake — gather marriage certificate, identify children & assets', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Intake' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Advise on grounds for divorce and procedure', priority: 'HIGH', dueInDays: 3, phase: 'Intake', category: 'Advice' },
      { title: 'Consider family mediation (pre-application requirement UK)', priority: 'MEDIUM', dueInDays: 7, phase: 'Pre-Application', category: 'ADR' },
      { title: 'File divorce application (D8 / MA18 / HMA petition)', priority: 'HIGH', dueInDays: 14, phase: 'Petition', category: 'Filing' },
      { title: 'Serve application on respondent', priority: 'HIGH', dueInDays: 21, phase: 'Petition', category: 'Service' },
      { title: 'Conditional order / Decree Nisi application', priority: 'HIGH', dueInDays: 60, phase: 'Conditional Order', category: 'Filing' },
      { title: 'Financial disclosure — Form E1 / FL-150 / Statement of Means', priority: 'HIGH', dueInDays: 45, phase: 'Financial', category: 'Drafting' },
      { title: 'Negotiate financial settlement', priority: 'HIGH', dueInDays: 90, phase: 'Financial', category: 'Negotiation' },
      { title: 'Children arrangements (if disputed)', priority: 'HIGH', dueInDays: 90, phase: 'Children', category: 'Legal' },
      { title: 'Draft Consent Order / Binding Financial Agreement', priority: 'HIGH', dueInDays: 120, phase: 'Settlement', category: 'Drafting' },
      { title: 'Apply for Final Order / Decree Absolute', priority: 'HIGH', dueInDays: 135, phase: 'Final Order', category: 'Filing' },
      { title: 'Implementation — property transfer, pension share', priority: 'HIGH', dueInDays: 150, phase: 'Implementation', category: 'Transaction' },
      { title: 'Close matter and archive', priority: 'LOW', dueInDays: 160, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // WILLS, ESTATES & PROBATE
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Probate & Estate Administration',
    description: 'Grant of probate and full estate administration.',
    practiceArea: 'wills_estates_probate',
    matterType: 'Drafting',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Original Will',
      'Death Certificate',
      'Estate Inventory',
      'Inheritance Tax Return (IHT400/ITR)',
      'Grant of Probate / Letters of Administration',
    ],
    taskTemplates: [
      { title: 'Obtain death certificate and original will', priority: 'HIGH', dueInDays: 3, phase: 'Intake', category: 'Documents' },
      { title: 'Conflict check and check for caveats', priority: 'HIGH', dueInDays: 3, phase: 'Intake', category: 'Admin' },
      { title: 'Advise on capacity to administer estate', priority: 'HIGH', dueInDays: 5, phase: 'Intake', category: 'Advice' },
      { title: 'Prepare estate inventory — bank accounts, property, investments', priority: 'HIGH', dueInDays: 21, phase: 'Investigation', category: 'Inventory' },
      { title: 'Obtain asset valuations', priority: 'HIGH', dueInDays: 30, phase: 'Investigation', category: 'Valuation' },
      { title: 'Prepare inheritance / estate tax return (IHT400/ISA s.276)', priority: 'HIGH', dueInDays: 45, phase: 'Tax', category: 'Tax' },
      { title: 'Pay inheritance tax (if applicable)', priority: 'HIGH', dueInDays: 60, phase: 'Tax', category: 'Tax' },
      { title: 'File probate application (PA1P/PA1A / Form 78 / ISA petition)', priority: 'HIGH', dueInDays: 60, phase: 'Probate Application', category: 'Filing' },
      { title: 'Receive grant of probate / letters of administration', priority: 'HIGH', dueInDays: 90, phase: 'Grant', category: 'Receipt' },
      { title: 'Collect estate assets using grant', priority: 'HIGH', dueInDays: 120, phase: 'Collection', category: 'Administration' },
      { title: 'Settle liabilities and debts of estate', priority: 'HIGH', dueInDays: 150, phase: 'Administration', category: 'Administration' },
      { title: 'Prepare estate accounts', priority: 'HIGH', dueInDays: 180, phase: 'Accounts', category: 'Accounting' },
      { title: 'Distribute estate to beneficiaries', priority: 'HIGH', dueInDays: 200, phase: 'Distribution', category: 'Distribution' },
      { title: 'Obtain receipts from all beneficiaries', priority: 'HIGH', dueInDays: 210, phase: 'Distribution', category: 'Admin' },
      { title: 'Close matter and archive', priority: 'LOW', dueInDays: 220, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // IMMIGRATION — Work Permit / Visa
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Immigration — Work Visa Application',
    description: 'Work permit or skilled worker visa application.',
    practiceArea: 'immigration',
    matterType: 'Registration',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Passport Copies',
      'Certificate of Sponsorship / Job Offer',
      'Educational Certificates',
      'Application Form Checklist',
    ],
    taskTemplates: [
      { title: 'Assess eligibility for visa category', priority: 'HIGH', dueInDays: 1, phase: 'Assessment', category: 'Advice' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Collect all supporting documents checklist', priority: 'HIGH', dueInDays: 5, phase: 'Documents', category: 'Documents' },
      { title: 'Verify sponsor licence validity (UK Skilled Worker)', priority: 'HIGH', dueInDays: 5, phase: 'Preparation', category: 'Check' },
      { title: 'Prepare visa / permit application form', priority: 'HIGH', dueInDays: 10, phase: 'Application', category: 'Drafting' },
      { title: 'Client review and sign-off on application', priority: 'HIGH', dueInDays: 14, phase: 'Application', category: 'Approval' },
      { title: 'Submit application and pay government fees', priority: 'HIGH', dueInDays: 16, phase: 'Filing', category: 'Filing' },
      { title: 'Book biometrics appointment (if required)', priority: 'HIGH', dueInDays: 18, phase: 'Filing', category: 'Admin' },
      { title: 'Monitor application / respond to requests for evidence', priority: 'MEDIUM', dueInDays: 30, phase: 'Processing', category: 'Monitoring' },
      { title: 'Receive decision — advise client', priority: 'HIGH', dueInDays: 90, phase: 'Decision', category: 'Advice' },
      { title: 'Advise on appeal / administrative review (if refused)', priority: 'HIGH', dueInDays: 95, phase: 'Decision', category: 'Appeals' },
      { title: 'FRRO/eCitizen registration on arrival (if required)', priority: 'MEDIUM', dueInDays: 100, phase: 'Post-Arrival', category: 'Compliance' },
      { title: 'Diarise visa expiry and renewal reminder', priority: 'HIGH', dueInDays: 101, phase: 'Compliance', category: 'Diary' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAX — Tax Dispute
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Tax Dispute / Investigation',
    description: 'Tax authority investigation, audit, or appeal.',
    practiceArea: 'tax',
    matterType: 'Compliance',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Tax Authority Notice / Assessment',
      'Prior Returns & Accounts',
      'Grounds of Appeal',
      'Tax Computation',
    ],
    taskTemplates: [
      { title: 'Review tax authority notice / assessment', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Review' },
      { title: 'Check appeal / response deadline (critical)', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Limitation' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Obtain prior tax returns, accounts and correspondence', priority: 'HIGH', dueInDays: 5, phase: 'Investigation', category: 'Documents' },
      { title: 'Identify basis of assessment and legal challenge points', priority: 'HIGH', dueInDays: 10, phase: 'Investigation', category: 'Legal' },
      { title: 'File holding appeal / protective notice to preserve rights', priority: 'HIGH', dueInDays: 14, phase: 'Appeal', category: 'Filing' },
      { title: 'Draft detailed grounds of appeal', priority: 'HIGH', dueInDays: 30, phase: 'Appeal', category: 'Drafting' },
      { title: 'Negotiate with tax authority (settlement offer)', priority: 'HIGH', dueInDays: 60, phase: 'Negotiation', category: 'Negotiation' },
      { title: 'Prepare for Tax Tribunal / appellate hearing', priority: 'HIGH', dueInDays: 120, phase: 'Hearing', category: 'Preparation' },
      { title: 'Tribunal hearing', priority: 'HIGH', dueInDays: 150, phase: 'Hearing', category: 'Court' },
      { title: 'Implement judgment / settlement', priority: 'HIGH', dueInDays: 165, phase: 'Post-Hearing', category: 'Implementation' },
      { title: 'Close matter and archive', priority: 'LOW', dueInDays: 180, phase: 'Closure', category: 'Admin' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRIMINAL DEFENSE
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Criminal Defense — Standard',
    description: 'Criminal defense from investigation through to trial.',
    practiceArea: 'criminal_defense',
    matterType: 'Litigation',
    countryCode: null,
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Charge Sheet / Summons',
      'Police Disclosure',
      'Bail Application',
      'Witness Statements',
    ],
    taskTemplates: [
      { title: 'Urgent — attend police station / custody if required', priority: 'HIGH', dueInDays: 0, phase: 'Immediate', category: 'Court' },
      { title: 'Advise on right to silence and disclosure', priority: 'HIGH', dueInDays: 0, phase: 'Immediate', category: 'Advice' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Apply for bail if client in custody', priority: 'HIGH', dueInDays: 1, phase: 'Bail', category: 'Court' },
      { title: 'Obtain and review prosecution disclosure', priority: 'HIGH', dueInDays: 7, phase: 'Disclosure', category: 'Review' },
      { title: 'Advise on plea and merits of defense', priority: 'HIGH', dueInDays: 14, phase: 'Advice', category: 'Advice' },
      { title: 'Instruct experts (forensic, medical) if required', priority: 'MEDIUM', dueInDays: 21, phase: 'Preparation', category: 'Expert' },
      { title: 'Enter plea at first hearing', priority: 'HIGH', dueInDays: 30, phase: 'Hearing', category: 'Court' },
      { title: 'Prepare defense case statement', priority: 'HIGH', dueInDays: 60, phase: 'Preparation', category: 'Drafting' },
      { title: 'Prepare witness statements for defense', priority: 'HIGH', dueInDays: 90, phase: 'Preparation', category: 'Drafting' },
      { title: 'Trial preparation — skeleton argument / closing speech', priority: 'HIGH', dueInDays: 120, phase: 'Trial Prep', category: 'Drafting' },
      { title: 'Trial attendance', priority: 'HIGH', dueInDays: 150, phase: 'Trial', category: 'Court' },
      { title: 'Sentencing (if convicted)', priority: 'HIGH', dueInDays: 160, phase: 'Sentencing', category: 'Court' },
      { title: 'Advise on appeal prospects', priority: 'HIGH', dueInDays: 165, phase: 'Post-Trial', category: 'Advice' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // IP — Patent Application
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Patent Application',
    description: 'Patent application from drafting through to grant.',
    practiceArea: 'intellectual_property',
    matterType: 'Registration',
    countryCode: null,
    limitationPeriodDays: 365,
    limitationNotes: '12-month priority period from provisional filing. PCT national phase entry: 30 months.',
    recommendedDocuments: [
      'Client Retainer Agreement',
      'Invention Disclosure Form',
      'Provisional Application',
      'Complete Specification',
      'Claims Draft',
    ],
    taskTemplates: [
      { title: 'Invention disclosure — technical description from inventor', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Intake' },
      { title: 'Conflict check', priority: 'HIGH', dueInDays: 1, phase: 'Intake', category: 'Admin' },
      { title: 'Prior art search (USPTO/EPO/IP India/KIPI databases)', priority: 'HIGH', dueInDays: 7, phase: 'Search', category: 'Search' },
      { title: 'Advise on patentability and novelty', priority: 'HIGH', dueInDays: 10, phase: 'Search', category: 'Advice' },
      { title: 'File provisional application (secures priority date)', priority: 'HIGH', dueInDays: 14, phase: 'Filing', category: 'Filing' },
      { title: 'Draft complete specification and claims', priority: 'HIGH', dueInDays: 60, phase: 'Drafting', category: 'Drafting' },
      { title: 'File complete patent application (Form 1/2 / AIA-14)', priority: 'HIGH', dueInDays: 90, phase: 'Filing', category: 'Filing' },
      { title: 'File PCT application if international protection needed', priority: 'MEDIUM', dueInDays: 365, phase: 'International', category: 'Filing' },
      { title: 'Respond to examination reports / office actions', priority: 'HIGH', dueInDays: 730, phase: 'Examination', category: 'Response' },
      { title: 'Pay grant fee and receive patent grant', priority: 'HIGH', dueInDays: 1095, phase: 'Grant', category: 'Filing' },
      { title: 'Diarise annual renewal fee dates', priority: 'HIGH', dueInDays: 1096, phase: 'Post-Grant', category: 'Diary' },
    ],
  },
];
