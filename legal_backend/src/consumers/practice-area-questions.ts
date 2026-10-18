export interface PracticeAreaQuestion {
  id: string;
  question: string;
  type: 'select' | 'multiselect' | 'text' | 'boolean';
  options?: string[];
  required: boolean;
  helpText?: string;
}

export const PRACTICE_AREA_QUESTIONS: Record<string, PracticeAreaQuestion[]> =
  {
    employment_labour: [
      {
        id: 'emp_matter_type',
        question: 'What type of employment matter is this?',
        type: 'select',
        options: [
          'Unfair / Wrongful Dismissal',
          'Discrimination / Harassment',
          'Wage & Hour Dispute',
          'Redundancy',
          'TUPE / Transfer of Business',
          'Contract Negotiation',
          'Workplace Injury',
          'Collective / Trade Union',
          'Other',
        ],
        required: true,
      },
      {
        id: 'emp_party',
        question: 'Who does this matter concern?',
        type: 'select',
        options: ['Employee / Worker', 'Employer / Organisation', 'Union'],
        required: true,
      },
      {
        id: 'emp_jurisdiction_body',
        question: 'Which tribunal or court applies?',
        type: 'select',
        options: [
          'Employment & Labour Relations Court (KE)',
          'Employment Tribunal (UK)',
          'EEOC / Federal Court (US)',
          'Labour Court (IN)',
          'Not sure',
        ],
        required: false,
      },
      {
        id: 'emp_dismissal_date',
        question: 'When did the dismissal or incident occur? (approximate)',
        type: 'text',
        required: false,
        helpText: 'Important for limitation period — ET1 must be filed within 3 months in UK',
      },
      {
        id: 'emp_acas',
        question: 'Has Acas Early Conciliation been completed? (UK matters)',
        type: 'boolean',
        required: false,
      },
    ],

    family_matrimonial: [
      {
        id: 'fam_matter_type',
        question: 'What type of family matter is this?',
        type: 'select',
        options: [
          'Divorce / Dissolution',
          'Child Custody / Arrangements',
          'Maintenance / Financial Relief',
          'Adoption',
          'Domestic Violence / Protection Order',
          'Pre-nuptial Agreement',
          'Matrimonial Property',
          'Guardianship',
        ],
        required: true,
      },
      {
        id: 'fam_assets',
        question: 'Are significant assets or property involved?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'fam_children',
        question: 'Are there children under 18 involved?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'fam_international',
        question: 'Is there an international element? (parties from different countries)',
        type: 'boolean',
        required: false,
      },
      {
        id: 'fam_contested',
        question: 'Is this matter contested or uncontested?',
        type: 'select',
        options: ['Contested — parties disagree', 'Uncontested — both parties agree', 'Not sure yet'],
        required: false,
      },
    ],

    criminal_defense: [
      {
        id: 'crim_charge_category',
        question: 'What category of offence?',
        type: 'select',
        options: [
          'Property / Theft / Fraud',
          'Assault / Violence',
          'Drug Offence',
          'Traffic / Driving',
          'Financial Crime / Corruption',
          'Cybercrime',
          'Sexual Offence',
          'Murder / Serious Violence',
          'Other',
        ],
        required: true,
      },
      {
        id: 'crim_stage',
        question: 'What stage is the matter at?',
        type: 'select',
        options: [
          'Under investigation (no charge yet)',
          'Charged / Arrested',
          'Pre-trial / Remand',
          'At trial',
          'Convicted — seeking appeal',
          'Bail application',
        ],
        required: true,
      },
      {
        id: 'crim_bail',
        question: 'Is the client currently in custody?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'crim_legal_system',
        question: 'Which legal system applies?',
        type: 'select',
        options: [
          'Penal Code / CPC (Kenya)',
          'BNSS 2023 / IPC (India)',
          'Magistrates / Crown Court (England & Wales)',
          'State / Federal Criminal Court (US)',
        ],
        required: false,
      },
    ],

    immigration: [
      {
        id: 'imm_type',
        question: 'What type of immigration matter?',
        type: 'select',
        options: [
          'Work Visa / Permit',
          'Family Reunion / Spouse Visa',
          'Student Visa',
          'Permanent Residence / ILR',
          'Citizenship / Naturalisation',
          'Asylum / Refugee',
          'Deportation / Removal',
          'Business / Investor Visa',
          'Registration (FRRO / eCitizen)',
        ],
        required: true,
      },
      {
        id: 'imm_nationality',
        question: "What is the client's nationality?",
        type: 'text',
        required: false,
      },
      {
        id: 'imm_destination',
        question: 'Destination country?',
        type: 'select',
        options: ['Kenya', 'United States', 'United Kingdom', 'India', 'Other'],
        required: true,
      },
      {
        id: 'imm_current_status',
        question: 'Current immigration status in destination country?',
        type: 'select',
        options: [
          'Not yet entered',
          'Visitor / Tourist',
          'Student',
          'Worker',
          'Overstay / Unlawful',
          'Asylum seeker',
          'Permanent resident',
        ],
        required: false,
      },
    ],

    real_estate_property: [
      {
        id: 're_transaction_type',
        question: 'What type of real estate transaction?',
        type: 'select',
        options: [
          'Purchase (buying)',
          'Sale (selling)',
          'Lease / Tenancy',
          'Mortgage / Charge',
          'Landlord-Tenant Dispute',
          'Title Registration',
          'First Registration',
          'Boundary / Easement Dispute',
          'Compulsory Acquisition',
        ],
        required: true,
      },
      {
        id: 're_property_type',
        question: 'What type of property?',
        type: 'select',
        options: [
          'Residential — house / flat',
          'Commercial — office / retail',
          'Industrial',
          'Agricultural / Land',
          'Mixed use',
        ],
        required: true,
      },
      {
        id: 're_title_status',
        question: 'Is the title currently registered?',
        type: 'select',
        options: [
          'Yes — registered (Ardhisasa / HMLR / eCourts)',
          'No — unregistered',
          "Don't know",
        ],
        required: false,
      },
      {
        id: 're_value',
        question: 'Approximate property value (for stamp duty estimate)?',
        type: 'select',
        options: [
          'Under $50,000 / £50,000 / KES 5M / INR 50L',
          '$50k–$250k / £50k–£250k / KES 5M–25M / INR 50L–2.5Cr',
          '$250k–$1M / £250k–£1M / KES 25M–100M / INR 2.5Cr–10Cr',
          'Over $1M / £1M / KES 100M / INR 10Cr',
        ],
        required: false,
      },
    ],

    corporate_commercial: [
      {
        id: 'corp_matter_type',
        question: 'What type of corporate / commercial matter?',
        type: 'select',
        options: [
          'Company Incorporation',
          'Mergers & Acquisitions (M&A)',
          'Joint Venture',
          'Share Purchase / Sale',
          'Commercial Contract',
          'Company Secretarial / Annual Compliance',
          'Foreign Investment',
          'Corporate Restructuring',
          'Due Diligence',
          'Franchise / Distribution',
          'Insolvency / Liquidation',
        ],
        required: true,
      },
      {
        id: 'corp_entity_type',
        question: 'Entity type?',
        type: 'select',
        options: [
          'Private Limited Company',
          'Public Limited Company',
          'Partnership / LLP',
          'Foreign Branch',
          'Not yet formed',
          'Individual / Sole Trader',
        ],
        required: false,
      },
      {
        id: 'corp_deal_value',
        question: 'Approximate deal / transaction value?',
        type: 'select',
        options: [
          'Under $100k',
          '$100k–$1M',
          '$1M–$10M',
          '$10M–$100M',
          'Over $100M',
        ],
        required: false,
      },
      {
        id: 'corp_governing_law',
        question: 'What governing law applies?',
        type: 'select',
        options: ['Kenyan Law', 'English Law', 'US Law', 'Indian Law', 'Multiple / International', 'Not determined'],
        required: false,
      },
    ],

    intellectual_property: [
      {
        id: 'ip_type',
        question: 'What type of intellectual property?',
        type: 'multiselect',
        options: [
          'Trademark / Brand',
          'Patent / Invention',
          'Copyright / Creative Work',
          'Design / Trade Dress',
          'Trade Secret / Confidential Info',
          'Domain Name',
        ],
        required: true,
      },
      {
        id: 'ip_matter_type',
        question: 'What is the nature of the matter?',
        type: 'select',
        options: [
          'New registration / application',
          'Renewal of existing registration',
          'Infringement — enforcing our rights',
          'Infringement — defending a claim',
          'Licensing / Assignment',
          'Opposition / Cancellation',
          'IP Audit',
          'Due Diligence',
        ],
        required: true,
      },
      {
        id: 'ip_registration_status',
        question: 'Is the IP currently registered?',
        type: 'select',
        options: [
          'Not yet registered',
          'Registered in one country',
          'Registered in multiple countries',
          'Application pending',
        ],
        required: false,
      },
      {
        id: 'ip_jurisdictions',
        question: 'In which jurisdictions is protection needed?',
        type: 'multiselect',
        options: [
          'Kenya (KIPI)',
          'United States (USPTO)',
          'United Kingdom (IPO)',
          'India (IP India)',
          'European Union (EUIPO)',
          'ARIPO (African Regional)',
          'PCT (International Patent)',
          'Madrid System (International TM)',
        ],
        required: false,
      },
    ],

    tax: [
      {
        id: 'tax_type',
        question: 'What type of tax matter?',
        type: 'select',
        options: [
          'Income Tax (individual)',
          'Corporate Tax',
          'VAT / GST / Sales Tax',
          'Capital Gains Tax',
          'Inheritance / Estate Tax',
          'Transfer Pricing',
          'Tax Dispute / Investigation',
          'Tax Planning / Structuring',
          'Stamp Duty',
          'Payroll / PAYE',
        ],
        required: true,
      },
      {
        id: 'tax_entity',
        question: 'Who does this tax matter relate to?',
        type: 'select',
        options: [
          'Individual',
          'Private Company',
          'Public Company',
          'Partnership / LLP',
          'Trust',
          'Non-profit',
        ],
        required: true,
      },
      {
        id: 'tax_nature',
        question: 'Is this a dispute / investigation or planning / compliance?',
        type: 'select',
        options: [
          'Dispute or investigation by tax authority',
          'Planning — reducing tax liability',
          'Compliance — filing / reporting',
          'Both dispute and planning',
        ],
        required: true,
      },
      {
        id: 'tax_authority',
        question: 'Which tax authority?',
        type: 'select',
        options: [
          'Kenya Revenue Authority (KRA)',
          'HMRC (UK)',
          'IRS (US)',
          'Income Tax Department / CBDT (India)',
          'GST Network (India)',
          'Multiple',
        ],
        required: false,
      },
      {
        id: 'tax_period',
        question: 'Which tax period(s) are involved?',
        type: 'text',
        required: false,
        helpText: 'e.g. "FY 2023/24" or "Tax years 2021–2024"',
      },
    ],

    wills_estates_probate: [
      {
        id: 'wep_matter_type',
        question: 'What type of wills / estates matter?',
        type: 'select',
        options: [
          'Drafting a will',
          'Probate — with a will',
          'Letters of Administration — no will',
          'Succession Certificate',
          'Estate planning / trusts',
          'Contesting a will',
          'Estate administration',
          'Power of Attorney',
        ],
        required: true,
      },
      {
        id: 'wep_deceased',
        question: 'Has the person passed away?',
        type: 'select',
        options: [
          'Yes — recently deceased',
          'Yes — some time ago',
          'No — planning ahead',
        ],
        required: true,
      },
      {
        id: 'wep_will_exists',
        question: 'Does a valid will exist?',
        type: 'select',
        options: [
          'Yes — signed and witnessed will',
          'No — intestate (no will)',
          "Don't know / disputed",
        ],
        required: false,
      },
      {
        id: 'wep_estate_value',
        question: 'Approximate gross estate value?',
        type: 'select',
        options: [
          'Under $100k / £100k / KES 10M / INR 1Cr',
          '$100k–$500k / £100k–£325k',
          '$500k–$2M / £325k–£1M (IHT threshold)',
          'Over $2M / £1M / KES 200M / INR 10Cr',
        ],
        required: false,
        helpText: 'Important for inheritance / estate tax assessment',
      },
      {
        id: 'wep_contested',
        question: 'Is the estate / will being contested?',
        type: 'boolean',
        required: false,
      },
      {
        id: 'wep_probate_jurisdiction',
        question: 'Where was the deceased domiciled?',
        type: 'select',
        options: ['Kenya', 'United Kingdom', 'United States', 'India', 'Other'],
        required: false,
      },
    ],

    litigation_disputes: [
      {
        id: 'lit_type',
        question: 'What type of dispute?',
        type: 'select',
        options: [
          'Commercial / Contract Dispute',
          'Debt Recovery',
          'Professional Negligence',
          'Personal Injury',
          'Property / Land Dispute',
          'Director / Shareholder Dispute',
          'Insurance Dispute',
          'Small Claims',
          'Judicial Review',
          'Other Civil Claim',
        ],
        required: true,
      },
      {
        id: 'lit_value',
        question: 'Approximate claim value?',
        type: 'select',
        options: [
          'Small Claims (under £10k / $10k / KES 1M)',
          'Medium (£10k–£100k / $10k–$100k)',
          'Large (£100k–£1M)',
          'High value (over £1M / $1M)',
        ],
        required: false,
      },
      {
        id: 'lit_adr',
        question: 'Has Alternative Dispute Resolution (ADR) been attempted?',
        type: 'select',
        options: ['Not yet', 'Mediation attempted', 'Arbitration attempted', 'Pre-action protocol sent'],
        required: false,
      },
      {
        id: 'lit_limitation',
        question: 'When did the cause of action arise? (for limitation period check)',
        type: 'text',
        required: false,
        helpText: 'Standard limitation: 6 years contract (UK/KE), 4 years (US/CA), 3 years contract (IN)',
      },
    ],
  };

/** Get AI planning questions for a given issue type or practice area slug */
export function getPracticeAreaQuestions(
  issueTypeOrSlug: string,
): PracticeAreaQuestion[] {
  // Normalise to slug-like key
  const key = issueTypeOrSlug
    .toLowerCase()
    .replace(/[&]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z_]/g, '');

  // Direct slug match
  if (PRACTICE_AREA_QUESTIONS[issueTypeOrSlug]) {
    return PRACTICE_AREA_QUESTIONS[issueTypeOrSlug];
  }

  // Try mapping from the normalised key
  const mapping: Record<string, string> = {
    employment_workplace: 'employment_labour',
    landlord_tenant: 'real_estate_property',
    family_divorce: 'family_matrimonial',
    consumer_rights: 'litigation_disputes',
    contract_dispute: 'litigation_disputes',
    debt_collections: 'litigation_disputes',
    criminal_matter: 'criminal_defense',
    corporate_commercial: 'corporate_commercial',
    real_estate_conveyancing: 'real_estate_property',
    intellectual_property: 'intellectual_property',
    tax_revenue: 'tax',
    wills_estates_probate: 'wills_estates_probate',
  };

  const mapped = mapping[key];
  return PRACTICE_AREA_QUESTIONS[mapped ?? key] ?? [];
}
