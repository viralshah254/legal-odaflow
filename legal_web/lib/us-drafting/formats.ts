/** Auto-generated US drafting catalog (Phase 7+). */
export type UsDraftJurisdiction = 'Federal' | 'State'
export type UsDraftCatalogType = 'template' | 'official'

export type UsDraftCategory =
  | 'All'
  | 'Federal'
  | 'State'
  | 'Official'
  | 'Civil'
  | 'Criminal'
  | 'Family'
  | 'Bankruptcy'
  | 'Immigration'
  | 'Tax'
  | 'Employment'
  | 'Administrative'
  | 'IP'
  | 'Constitutional'
  | 'Probate'
  | 'Real Estate'
  | 'Commercial'
  | 'Procedural'
  | 'Other'

export interface UsDraftFormat {
  id: string
  label: string
  subtitle: string
  category: Exclude<UsDraftCategory, 'All' | 'Federal' | 'State' | 'Official'>
  jurisdiction: UsDraftJurisdiction
  requiresState: boolean
  boundState?: string
  formNumber?: string
  catalogType?: UsDraftCatalogType
}

export const US_DRAFT_CATEGORIES: UsDraftCategory[] = ["All","Federal","State","Official","Civil","Criminal","Family","Bankruptcy","Immigration","Tax","Employment","Administrative","IP","Constitutional","Probate","Real Estate","Commercial","Procedural","Other"]

export const US_STATE_OPTIONS = [{"code":"AL","name":"Alabama"},{"code":"AK","name":"Alaska"},{"code":"AZ","name":"Arizona"},{"code":"AR","name":"Arkansas"},{"code":"CA","name":"California"},{"code":"CO","name":"Colorado"},{"code":"CT","name":"Connecticut"},{"code":"DE","name":"Delaware"},{"code":"FL","name":"Florida"},{"code":"GA","name":"Georgia"},{"code":"HI","name":"Hawaii"},{"code":"ID","name":"Idaho"},{"code":"IL","name":"Illinois"},{"code":"IN","name":"Indiana"},{"code":"IA","name":"Iowa"},{"code":"KS","name":"Kansas"},{"code":"KY","name":"Kentucky"},{"code":"LA","name":"Louisiana"},{"code":"ME","name":"Maine"},{"code":"MD","name":"Maryland"},{"code":"MA","name":"Massachusetts"},{"code":"MI","name":"Michigan"},{"code":"MN","name":"Minnesota"},{"code":"MS","name":"Mississippi"},{"code":"MO","name":"Missouri"},{"code":"MT","name":"Montana"},{"code":"NE","name":"Nebraska"},{"code":"NV","name":"Nevada"},{"code":"NH","name":"New Hampshire"},{"code":"NJ","name":"New Jersey"},{"code":"NM","name":"New Mexico"},{"code":"NY","name":"New York"},{"code":"NC","name":"North Carolina"},{"code":"ND","name":"North Dakota"},{"code":"OH","name":"Ohio"},{"code":"OK","name":"Oklahoma"},{"code":"OR","name":"Oregon"},{"code":"PA","name":"Pennsylvania"},{"code":"RI","name":"Rhode Island"},{"code":"SC","name":"South Carolina"},{"code":"SD","name":"South Dakota"},{"code":"TN","name":"Tennessee"},{"code":"TX","name":"Texas"},{"code":"UT","name":"Utah"},{"code":"VT","name":"Vermont"},{"code":"VA","name":"Virginia"},{"code":"WA","name":"Washington"},{"code":"WV","name":"West Virginia"},{"code":"WI","name":"Wisconsin"},{"code":"WY","name":"Wyoming"},{"code":"DC","name":"District of Columbia"}] as const

export const US_DRAFT_FORMATS: UsDraftFormat[] = [
  {
    "id": "us_federal_complaint",
    "label": "Federal Civil Complaint",
    "subtitle": "FRCP Rule 8",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_answer",
    "label": "Federal Answer",
    "subtitle": "FRCP Rule 8(b)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_counterclaim",
    "label": "Federal Counterclaim",
    "subtitle": "FRCP Rule 13",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_dismiss_12b6",
    "label": "12(b)(6) Motion to Dismiss",
    "subtitle": "FRCP Rule 12(b)(6)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_dismiss_12b1",
    "label": "12(b)(1) Motion to Dismiss",
    "subtitle": "FRCP Rule 12(b)(1)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_summary_judgment",
    "label": "Summary Judgment Motion",
    "subtitle": "FRCP Rule 56",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_opposition_msj",
    "label": "Opposition to Summary Judgment",
    "subtitle": "FRCP Rule 56",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_preliminary_injunction",
    "label": "Preliminary Injunction",
    "subtitle": "FRCP Rule 65",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_tro",
    "label": "TRO Application",
    "subtitle": "FRCP Rule 65(b)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_in_limine",
    "label": "Motion in Limine",
    "subtitle": "FRE/FRCrP",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_daubert_motion",
    "label": "Daubert Motion",
    "subtitle": "FRE 702",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_interrogatories",
    "label": "Interrogatories",
    "subtitle": "FRCP Rule 33",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_rfp",
    "label": "Requests for Production",
    "subtitle": "FRCP Rule 34",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_rfa",
    "label": "Requests for Admission",
    "subtitle": "FRCP Rule 36",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_compel",
    "label": "Motion to Compel Discovery",
    "subtitle": "FRCP Rule 37",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_protective_order",
    "label": "Protective Order Motion",
    "subtitle": "FRCP Rule 26(c)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_class_certification",
    "label": "Class Certification Motion",
    "subtitle": "FRCP Rule 23",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_notice_appeal",
    "label": "Notice of Appeal",
    "subtitle": "FRAP Rule 3",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_appellate_brief",
    "label": "Circuit Appellate Brief",
    "subtitle": "FRAP",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_cert_petition",
    "label": "Petition for Certiorari",
    "subtitle": "SCOTUS Rule 13",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_demand_letter",
    "label": "Federal Demand Letter",
    "subtitle": "Pre-litigation",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_section_1983_complaint",
    "label": "42 USC §1983 Complaint",
    "subtitle": "42 USC §1983",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_criminal_complaint",
    "label": "Federal Criminal Complaint",
    "subtitle": "Fed. R. Crim. P. 3",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_plea_agreement",
    "label": "Federal Plea Agreement",
    "subtitle": "USSG",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_suppress_4th",
    "label": "Fourth Amendment Suppression Motion",
    "subtitle": "Fed. R. Crim. P. 12",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_sentencing_memo",
    "label": "Sentencing Memorandum",
    "subtitle": "18 USC §3553(a)",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_habeas_2255",
    "label": "28 USC §2255 Motion",
    "subtitle": "28 USC §2255",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_habeas_2241",
    "label": "28 USC §2241 Petition",
    "subtitle": "28 USC §2241",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_detention_memo",
    "label": "Bail/Detention Memorandum",
    "subtitle": "18 USC §3141",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_brady_motion",
    "label": "Brady/Giglio Motion",
    "subtitle": "Brady v Maryland",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_speedy_trial_motion",
    "label": "Speedy Trial Motion",
    "subtitle": "18 USC §3161",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_ch7_petition",
    "label": "Chapter 7 Petition",
    "subtitle": "Bankruptcy Code",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_ch11_petition",
    "label": "Chapter 11 Petition",
    "subtitle": "Bankruptcy Code",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_ch13_petition",
    "label": "Chapter 13 Petition",
    "subtitle": "Bankruptcy Code",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_proof_of_claim",
    "label": "Proof of Claim",
    "subtitle": "Official Form 410",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_plan_reorganization",
    "label": "Chapter 11 Plan",
    "subtitle": "11 USC",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_adversary_complaint",
    "label": "Adversary Proceeding Complaint",
    "subtitle": "Bankruptcy Rules",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_motion_lift_stay",
    "label": "Motion for Relief from Stay",
    "subtitle": "11 USC §362",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_preference_defense",
    "label": "Preference Defense Letter",
    "subtitle": "11 USC §547",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_asylum_application",
    "label": "Asylum Application Support Brief",
    "subtitle": "I-589 support",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_motion_reopen",
    "label": "Motion to Reopen/Reconsider",
    "subtitle": "8 CFR §1003.23",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_removal_defense",
    "label": "Removal Defense Brief",
    "subtitle": "INA §240",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_601a_waiver",
    "label": "I-601A Waiver Brief",
    "subtitle": "Unlawful presence waiver",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_employer_support",
    "label": "Employer Immigrant Petition Support Letter",
    "subtitle": "INA employment visa",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_hardship_declaration",
    "label": "Extreme Hardship Declaration",
    "subtitle": "Immigration waiver support",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_tax_court_petition",
    "label": "US Tax Court Petition",
    "subtitle": "TC Rule 34",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_audit_response",
    "label": "IRS Audit Response",
    "subtitle": "IRC audit procedure",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_offer_compromise",
    "label": "Offer in Compromise Application Support",
    "subtitle": "Form 656 support",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_cdp_request",
    "label": "CDP Hearing Request",
    "subtitle": "IRC §6320/6330",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_penalty_abatement",
    "label": "Penalty Abatement Request",
    "subtitle": "Reasonable cause",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_installment_request",
    "label": "Installment Agreement Request",
    "subtitle": "IRC §6159",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_eeoc_charge",
    "label": "EEOC Charge of Discrimination",
    "subtitle": "Title VII/ADA/ADEA/EPA",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_employment_complaint",
    "label": "Federal Employment Discrimination Complaint",
    "subtitle": "Title VII/ADA",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_fmla_dispute_letter",
    "label": "FMLA Dispute Letter",
    "subtitle": "FMLA",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_flsa_wage_claim",
    "label": "FLSA Wage Claim Complaint",
    "subtitle": "FLSA",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_nlrb_unfair_labor_charge",
    "label": "NLRB Unfair Labor Practice Charge",
    "subtitle": "NLRA §8",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ada_accommodation_request",
    "label": "ADA Accommodation Request",
    "subtitle": "ADA Title I",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_sec_inquiry_response",
    "label": "SEC Inquiry Response",
    "subtitle": "SEC enforcement",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ftc_complaint",
    "label": "FTC Consumer Complaint",
    "subtitle": "FTC Act",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_cfpb_complaint",
    "label": "CFPB Consumer Complaint",
    "subtitle": "CFPB jurisdiction",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_osha_complaint",
    "label": "OSHA Complaint",
    "subtitle": "OSH Act §11(c)",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_epa_enforcement_response",
    "label": "EPA Enforcement Response",
    "subtitle": "EPA administrative",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_fda_warning_letter_response",
    "label": "FDA Warning Letter Response",
    "subtitle": "FDA compliance",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_hhs_hipaa_complaint",
    "label": "HHS OCR HIPAA Complaint",
    "subtitle": "HIPAA Privacy Rule",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_patent_infringement_complaint",
    "label": "Patent Infringement Complaint",
    "subtitle": "35 USC §271",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_trademark_infringement_complaint",
    "label": "Trademark Infringement Complaint",
    "subtitle": "Lanham Act §32/43",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_copyright_infringement_complaint",
    "label": "Copyright Infringement Complaint",
    "subtitle": "17 USC §501",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_dmca_takedown",
    "label": "DMCA Takedown Notice",
    "subtitle": "17 USC §512(c)",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_dmca_counter_notice",
    "label": "DMCA Counter-Notice",
    "subtitle": "17 USC §512(g)",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_uspto_office_action_response",
    "label": "USPTO Office Action Response",
    "subtitle": "Trademark/Patent prosecution",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ttab_opposition_brief",
    "label": "TTAB Opposition Brief",
    "subtitle": "TTAB",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ipr_petition",
    "label": "Inter Partes Review Petition",
    "subtitle": "35 USC §311",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_bivens_complaint",
    "label": "Bivens Complaint",
    "subtitle": "Bivens action",
    "category": "Constitutional",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_first_amendment_complaint",
    "label": "First Amendment Complaint",
    "subtitle": "First Amendment",
    "category": "Constitutional",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_equal_protection_complaint",
    "label": "Equal Protection Complaint",
    "subtitle": "14th Amendment",
    "category": "Constitutional",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_cease_desist_letter",
    "label": "Cease and Desist Letter",
    "subtitle": "Pre-litigation",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_demand_breach_contract",
    "label": "Breach of Contract Demand Letter",
    "subtitle": "Contract",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_settlement_agreement_federal",
    "label": "Federal Settlement Agreement",
    "subtitle": "Litigation settlement",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_schedules_summary",
    "label": "Bankruptcy Schedules Summary",
    "subtitle": "Bankruptcy Code / Official Forms",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_bankruptcy_meeting_341",
    "label": "341 Meeting Notice Outline",
    "subtitle": "Bankruptcy Code §341",
    "category": "Bankruptcy",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_n400_naturalization_brief",
    "label": "N-400 Naturalization Support Brief",
    "subtitle": "INA naturalisation",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ssdi_disability_appeal",
    "label": "SSDI Disability Appeal Brief",
    "subtitle": "SSA disability appeals",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_va_benefits_claim_brief",
    "label": "VA Benefits Claim Brief",
    "subtitle": "38 USC veterans benefits",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_foia_request",
    "label": "FOIA Request Letter",
    "subtitle": "5 USC §552",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_medicare_advantage_appeal",
    "label": "Medicare Advantage Appeal",
    "subtitle": "Medicare appeals process",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_erisa_benefits_appeal",
    "label": "ERISA Benefits Denial Appeal",
    "subtitle": "ERISA §502",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_fcc_consumer_complaint",
    "label": "FCC Consumer Complaint",
    "subtitle": "Communications Act",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ferc_complaint",
    "label": "FERC Complaint/Letter",
    "subtitle": "Federal Power Act / NGA",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ucmj_article_32",
    "label": "UCMJ Article 32 Hearing Brief",
    "subtitle": "UCMJ Art. 32",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_criminal_superseding_response",
    "label": "Response to Superseding Indictment",
    "subtitle": "Fed. R. Crim. P. 12",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_continue",
    "label": "Motion for Continuance",
    "subtitle": "FRCP/FRCrP practice",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_seal",
    "label": "Motion to Seal",
    "subtitle": "FRCP / court privacy rules",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_subpoena_motion_quash",
    "label": "Motion to Quash Subpoena",
    "subtitle": "FRCP Rule 45",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_jury_instruction_request",
    "label": "Proposed Jury Instructions",
    "subtitle": "FRCP / pattern instructions",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_sentencing_variation",
    "label": "Sentencing Variance Motion",
    "subtitle": "18 USC §3553(a)",
    "category": "Criminal",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_declaratory_judgment",
    "label": "Declaratory Judgment Complaint",
    "subtitle": "28 USC §2201",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_interpleader",
    "label": "Interpleader Complaint",
    "subtitle": "28 USC §1335",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_mandamus_petition",
    "label": "Mandamus Petition",
    "subtitle": "All Writs Act / appellate practice",
    "category": "Constitutional",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_wage_garnishment_release",
    "label": "Wage Garnishment Release Request",
    "subtitle": "IRC levy/garnishment",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_eeoc_position_statement",
    "label": "EEOC Position Statement Response",
    "subtitle": "EEOC charge process",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_usitc_337_complaint",
    "label": "Section 337 ITC Complaint",
    "subtitle": "19 USC §1337",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_antitrust_sherman_complaint",
    "label": "Sherman Act Antitrust Complaint",
    "subtitle": "15 USC §1/§2",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_civil_cover_sheet_narrative",
    "label": "Civil Cover Sheet Narrative",
    "subtitle": "JS-44 support",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_motion_strike",
    "label": "Motion to Strike",
    "subtitle": "FRCP Rule 12(f)",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_cr_tra_reply",
    "label": "Reply in Support of Motion",
    "subtitle": "FRCP Rule 6 / local rules",
    "category": "Civil",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i129_petition",
    "label": "I-129 Petition Support Brief",
    "subtitle": "INA employment visa",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i140_petition",
    "label": "I-140 Immigrant Petition Support",
    "subtitle": "INA employment-based",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i539_extension",
    "label": "I-539 Extension/Change Support",
    "subtitle": "INA nonimmigrant status",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i751_removal_conditions",
    "label": "I-751 Removal of Conditions Support",
    "subtitle": "INA conditional GC",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i90_renewal",
    "label": "I-90 Green Card Renewal Support",
    "subtitle": "INA LPR renewal",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i824_follow_to_join",
    "label": "I-824 Follow-to-Join Support",
    "subtitle": "INA derivative",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i864_affidavit_support",
    "label": "I-864 Affidavit of Support Brief",
    "subtitle": "INA financial sponsor",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i912_fee_waiver",
    "label": "I-912 Fee Waiver Request",
    "subtitle": "USCIS fee waiver",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i131_travel_document",
    "label": "I-131 Advance Parole Support",
    "subtitle": "INA travel document",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i821_tps",
    "label": "I-821 TPS Application Support",
    "subtitle": "INA TPS",
    "category": "Immigration",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1040x_amended",
    "label": "Amended Return Support (1040-X)",
    "subtitle": "IRC amended return",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_9465_installment",
    "label": "Installment Agreement (9465) Support",
    "subtitle": "IRC §6159",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_433_a_collection",
    "label": "Collection Information (433-A) Support",
    "subtitle": "IRS collection",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8822_address_change",
    "label": "Address Change Notification Support",
    "subtitle": "IRS administrative",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2848_poa",
    "label": "Power of Attorney (2848)",
    "subtitle": "IRC representation",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_4506_t_transcript",
    "label": "Transcript Request (4506-T) Support",
    "subtitle": "IRS records",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_941_employer",
    "label": "Employer Quarterly Return Support",
    "subtitle": "IRC employment taxes",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_w4_employee",
    "label": "W-4 Employee Withholding Support",
    "subtitle": "IRC withholding",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_correction",
    "label": "1099 Correction Letter",
    "subtitle": "IRC information reporting",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_innocent_spouse_relief",
    "label": "Innocent Spouse Relief Request",
    "subtitle": "IRC §6015",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_injured_spouse_claim",
    "label": "Injured Spouse Allocation Claim",
    "subtitle": "IRC refund offset",
    "category": "Tax",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ssa_ss5_card_replacement",
    "label": "SS-5 Social Security Card Support",
    "subtitle": "SSA",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ssa_disability_reconsideration",
    "label": "SSA Disability Reconsideration",
    "subtitle": "SSA disability",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_medicare_part_b_appeal",
    "label": "Medicare Part B Appeal",
    "subtitle": "CMS appeals",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_medicaid_fair_hearing",
    "label": "Medicaid Fair Hearing Request",
    "subtitle": "State/federal Medicaid",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_dot_fmcsa_complaint",
    "label": "FMCSA Motor Carrier Complaint",
    "subtitle": "FMCSA regulations",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_cfpb_debt_collection_response",
    "label": "Debt Collection Validation Response",
    "subtitle": "FDCPA / CFPB",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_cfpb_credit_report_dispute",
    "label": "Credit Report Dispute Letter",
    "subtitle": "FCRA",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ftc_identity_theft_report",
    "label": "Identity Theft Report (FTC)",
    "subtitle": "FCRA / FTC",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_dol_whistleblower_complaint",
    "label": "DOL Whistleblower Complaint",
    "subtitle": "OSHA/DOL whistleblower",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_doj_civil_rights_complaint",
    "label": "DOJ Civil Rights Complaint",
    "subtitle": "Civil Rights Act",
    "category": "Constitutional",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_hud_fair_housing_complaint",
    "label": "HUD Fair Housing Complaint",
    "subtitle": "Fair Housing Act",
    "category": "Administrative",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_eeoc_rebuttal_position",
    "label": "EEOC Rebuttal to Position Statement",
    "subtitle": "Title VII process",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_dol_wage_hour_investigation",
    "label": "DOL Wage-Hour Investigation Response",
    "subtitle": "FLSA",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_nlrb_election_petition",
    "label": "NLRB Representation Election Petition",
    "subtitle": "NLRA §9",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_mspb_appeal",
    "label": "MSPB Appeal (Federal Employee)",
    "subtitle": "CSRA / MSPB",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_merit_systems_complaint",
    "label": "EEO / MSPB Mixed Case Complaint",
    "subtitle": "Federal sector EEO",
    "category": "Employment",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_cafc_patent_appeal",
    "label": "CAFC Patent Appeal Brief",
    "subtitle": "Patent appeal",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_ptab_ipr_response",
    "label": "IPR Patent Owner Response",
    "subtitle": "35 USC §311",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_copyright_dmca_counter_suit",
    "label": "DMCA Misrepresentation Counterclaim",
    "subtitle": "17 USC §512(f)",
    "category": "IP",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i130",
    "label": "us_immigration_i130",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i485",
    "label": "us_immigration_i485",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i765",
    "label": "us_immigration_i765",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i129",
    "label": "us_immigration_i129",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i140",
    "label": "us_immigration_i140",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i539",
    "label": "us_immigration_i539",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i751",
    "label": "us_immigration_i751",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i90",
    "label": "us_immigration_i90",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i824",
    "label": "us_immigration_i824",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i864",
    "label": "us_immigration_i864",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i912",
    "label": "us_immigration_i912",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i131",
    "label": "us_immigration_i131",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i821",
    "label": "us_immigration_i821",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_n400",
    "label": "us_immigration_n400",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i589",
    "label": "us_immigration_i589",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i601",
    "label": "us_immigration_i601",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i693",
    "label": "us_immigration_i693",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i129f",
    "label": "us_immigration_i129f",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i360",
    "label": "us_immigration_i360",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i526",
    "label": "us_immigration_i526",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i526e",
    "label": "us_immigration_i526e",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i829",
    "label": "us_immigration_i829",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i918",
    "label": "us_immigration_i918",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i918a",
    "label": "us_immigration_i918a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i914",
    "label": "us_immigration_i914",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i914a",
    "label": "us_immigration_i914a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i102",
    "label": "us_immigration_i102",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i212",
    "label": "us_immigration_i212",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i290b",
    "label": "us_immigration_i290b",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i407",
    "label": "us_immigration_i407",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i485j",
    "label": "us_immigration_i485j",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i600",
    "label": "us_immigration_i600",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i600a",
    "label": "us_immigration_i600a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i800",
    "label": "us_immigration_i800",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i800a",
    "label": "us_immigration_i800a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i907",
    "label": "us_immigration_i907",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i941",
    "label": "us_immigration_i941",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_n565",
    "label": "us_immigration_n565",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_n600",
    "label": "us_immigration_n600",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_n648",
    "label": "us_immigration_n648",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i765v",
    "label": "us_immigration_i765v",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i956",
    "label": "us_immigration_i956",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_immigration_i956f",
    "label": "us_immigration_i956f",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1040",
    "label": "us_irs_form_1040",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1040_sr",
    "label": "us_irs_form_1040_sr",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1040_x",
    "label": "us_irs_form_1040_x",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1040_es",
    "label": "us_irs_form_1040_es",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_a",
    "label": "us_irs_form_schedule_a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_b",
    "label": "us_irs_form_schedule_b",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_c",
    "label": "us_irs_form_schedule_c",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_d",
    "label": "us_irs_form_schedule_d",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_e",
    "label": "us_irs_form_schedule_e",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_schedule_se",
    "label": "us_irs_form_schedule_se",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_w_4",
    "label": "us_irs_form_w_4",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_w_9",
    "label": "us_irs_form_w_9",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_w_2",
    "label": "us_irs_form_w_2",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1120",
    "label": "us_irs_form_1120",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1120_s",
    "label": "us_irs_form_1120_s",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1065",
    "label": "us_irs_form_1065",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1120_f",
    "label": "us_irs_form_1120_f",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_990",
    "label": "us_irs_form_990",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_941",
    "label": "us_irs_form_941",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_940",
    "label": "us_irs_form_940",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_nec",
    "label": "us_irs_form_1099_nec",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_misc",
    "label": "us_irs_form_1099_misc",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_int",
    "label": "us_irs_form_1099_int",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_div",
    "label": "us_irs_form_1099_div",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_r",
    "label": "us_irs_form_1099_r",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2848",
    "label": "us_irs_form_2848",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_433_a",
    "label": "us_irs_form_433_a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_433_b",
    "label": "us_irs_form_433_b",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_9465",
    "label": "us_irs_form_9465",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_4506_t",
    "label": "us_irs_form_4506_t",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8822",
    "label": "us_irs_form_8822",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_56",
    "label": "us_irs_form_56",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_656",
    "label": "us_irs_form_656",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_843",
    "label": "us_irs_form_843",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_4868",
    "label": "us_irs_form_4868",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2553",
    "label": "us_irs_form_2553",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_5471",
    "label": "us_irs_form_5471",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8938",
    "label": "us_irs_form_8938",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1041",
    "label": "us_irs_form_1041",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_706",
    "label": "us_irs_form_706",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_709",
    "label": "us_irs_form_709",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_720",
    "label": "us_irs_form_720",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2290",
    "label": "us_irs_form_2290",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_4562",
    "label": "us_irs_form_4562",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_4797",
    "label": "us_irs_form_4797",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_6251",
    "label": "us_irs_form_6251",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8889",
    "label": "us_irs_form_8889",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8862",
    "label": "us_irs_form_8862",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1023",
    "label": "us_irs_form_1023",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8300",
    "label": "us_irs_form_8300",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1042",
    "label": "us_irs_form_1042",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2555",
    "label": "us_irs_form_2555",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1116",
    "label": "us_irs_form_1116",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8936",
    "label": "us_irs_form_8936",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8995",
    "label": "us_irs_form_8995",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2441",
    "label": "us_irs_form_2441",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8863",
    "label": "us_irs_form_8863",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8283",
    "label": "us_irs_form_8283",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8949",
    "label": "us_irs_form_8949",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8802",
    "label": "us_irs_form_8802",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8854",
    "label": "us_irs_form_8854",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_3520",
    "label": "us_irs_form_3520",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8865",
    "label": "us_irs_form_8865",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8621",
    "label": "us_irs_form_8621",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_926",
    "label": "us_irs_form_926",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8879",
    "label": "us_irs_form_8879",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8878",
    "label": "us_irs_form_8878",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8821",
    "label": "us_irs_form_8821",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_433_f",
    "label": "us_irs_form_433_f",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8379",
    "label": "us_irs_form_8379",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8857",
    "label": "us_irs_form_8857",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_7004",
    "label": "us_irs_form_7004",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1065_schedule_k_1",
    "label": "us_irs_form_1065_schedule_k_1",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_990_ez",
    "label": "us_irs_form_990_ez",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_990_pf",
    "label": "us_irs_form_990_pf",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_943",
    "label": "us_irs_form_943",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_944",
    "label": "us_irs_form_944",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1099_k",
    "label": "us_irs_form_1099_k",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_w_2g",
    "label": "us_irs_form_w_2g",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8832",
    "label": "us_irs_form_8832",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_5472",
    "label": "us_irs_form_5472",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_3520_a",
    "label": "us_irs_form_3520_a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8858",
    "label": "us_irs_form_8858",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8990",
    "label": "us_irs_form_8990",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8992",
    "label": "us_irs_form_8992",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8993",
    "label": "us_irs_form_8993",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8082",
    "label": "us_irs_form_8082",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8594",
    "label": "us_irs_form_8594",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1042_s",
    "label": "us_irs_form_1042_s",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8868",
    "label": "us_irs_form_8868",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_1024_a",
    "label": "us_irs_form_1024_a",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8716",
    "label": "us_irs_form_8716",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8308",
    "label": "us_irs_form_8308",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8883",
    "label": "us_irs_form_8883",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8888",
    "label": "us_irs_form_8888",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8940",
    "label": "us_irs_form_8940",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8971",
    "label": "us_irs_form_8971",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8994",
    "label": "us_irs_form_8994",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8996",
    "label": "us_irs_form_8996",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_5329",
    "label": "us_irs_form_5329",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8606",
    "label": "us_irs_form_8606",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8959",
    "label": "us_irs_form_8959",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8960",
    "label": "us_irs_form_8960",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_5695",
    "label": "us_irs_form_5695",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_2210",
    "label": "us_irs_form_2210",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_irs_form_8886",
    "label": "us_irs_form_8886",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b101",
    "label": "us_federal_court_b101",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106a_b",
    "label": "us_federal_court_b106a_b",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106c",
    "label": "us_federal_court_b106c",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106d",
    "label": "us_federal_court_b106d",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106e_f",
    "label": "us_federal_court_b106e_f",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106g",
    "label": "us_federal_court_b106g",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106h",
    "label": "us_federal_court_b106h",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106i",
    "label": "us_federal_court_b106i",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b106j",
    "label": "us_federal_court_b106j",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b107",
    "label": "us_federal_court_b107",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b121",
    "label": "us_federal_court_b121",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b122a_1",
    "label": "us_federal_court_b122a_1",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b122a_2",
    "label": "us_federal_court_b122a_2",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b122c_1",
    "label": "us_federal_court_b122c_1",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b201",
    "label": "us_federal_court_b201",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b301",
    "label": "us_federal_court_b301",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_b410",
    "label": "us_federal_court_b410",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao440",
    "label": "us_federal_court_ao440",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao450",
    "label": "us_federal_court_ao450",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao455",
    "label": "us_federal_court_ao455",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao459",
    "label": "us_federal_court_ao459",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao460",
    "label": "us_federal_court_ao460",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao470",
    "label": "us_federal_court_ao470",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao471",
    "label": "us_federal_court_ao471",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao473",
    "label": "us_federal_court_ao473",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao475",
    "label": "us_federal_court_ao475",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao478",
    "label": "us_federal_court_ao478",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao483",
    "label": "us_federal_court_ao483",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao485",
    "label": "us_federal_court_ao485",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao486",
    "label": "us_federal_court_ao486",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao487",
    "label": "us_federal_court_ao487",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao488",
    "label": "us_federal_court_ao488",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao489",
    "label": "us_federal_court_ao489",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao490",
    "label": "us_federal_court_ao490",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao491",
    "label": "us_federal_court_ao491",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao492",
    "label": "us_federal_court_ao492",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao493",
    "label": "us_federal_court_ao493",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao494",
    "label": "us_federal_court_ao494",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao495",
    "label": "us_federal_court_ao495",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_federal_court_ao496",
    "label": "us_federal_court_ao496",
    "subtitle": "Federal practice",
    "category": "Other",
    "jurisdiction": "Federal",
    "requiresState": false,
    "catalogType": "template"
  },
  {
    "id": "us_state_civil_complaint",
    "label": "State Civil Complaint",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_civil_answer",
    "label": "State Civil Answer",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_dismiss",
    "label": "State Motion to Dismiss",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_summary_judgment",
    "label": "State Summary Judgment Motion",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_injunction_motion",
    "label": "State Injunction/TRO Motion",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_small_claims_complaint",
    "label": "Small Claims Complaint",
    "subtitle": "Small claims court",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_bail_motion",
    "label": "State Bail/Bond Motion",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_suppress",
    "label": "State Suppression Motion",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_plea_agreement",
    "label": "State Plea Agreement",
    "subtitle": "State criminal practice",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_expungement_petition",
    "label": "Expungement/Sealing Petition",
    "subtitle": "State record relief",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_divorce_petition",
    "label": "Divorce/Dissolution Petition",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_child_custody",
    "label": "Child Custody/Parenting Plan",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_child_support_motion",
    "label": "Child Support Modification Motion",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_domestic_violence_petition",
    "label": "Protective Order Petition",
    "subtitle": "State DV statute",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_adoption_petition",
    "label": "Adoption Petition",
    "subtitle": "State adoption law",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_will",
    "label": "Last Will and Testament",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_living_trust",
    "label": "Revocable Living Trust",
    "subtitle": "State trust law",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_probate_petition",
    "label": "Probate Petition",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_power_of_attorney",
    "label": "Durable Power of Attorney",
    "subtitle": "State POA statute",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_warranty_deed",
    "label": "Warranty Deed",
    "subtitle": "State property law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_lease_agreement",
    "label": "Residential Lease Agreement",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_eviction_notice",
    "label": "Eviction/Unlawful Detainer Notice",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_restraining_order",
    "label": "Restraining Order Application",
    "subtitle": "State DV/harassment statutes",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_name_change_petition",
    "label": "Name Change Petition",
    "subtitle": "State name change statutes",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_mechanics_lien",
    "label": "Mechanic's Lien Claim",
    "subtitle": "State lien statutes",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_foreclosure_complaint",
    "label": "Foreclosure Complaint",
    "subtitle": "State foreclosure law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_quiet_title",
    "label": "Quiet Title Action",
    "subtitle": "State property code",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_workers_comp_claim",
    "label": "Workers' Compensation Claim",
    "subtitle": "State WC statutes",
    "category": "Employment",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_unemployment_appeal",
    "label": "Unemployment Benefits Appeal",
    "subtitle": "State UI statutes",
    "category": "Employment",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_dui_plea_petition",
    "label": "DUI Plea Petition",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_landlord_deposit_demand",
    "label": "Security Deposit Demand",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_small_estate_affidavit",
    "label": "Small Estate Affidavit",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_malpractice_notice",
    "label": "Medical Malpractice Pre-Suit Notice",
    "subtitle": "State malpractice statutes",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_prenuptial_agreement",
    "label": "Prenuptial Agreement",
    "subtitle": "State contract/family law",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_llc_formation",
    "label": "LLC Formation Documents",
    "subtitle": "State LLC statutes",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_gun_rights_restoration",
    "label": "Firearm Rights Restoration Petition",
    "subtitle": "State firearm statutes",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_parenting_plan_modification",
    "label": "Parenting Plan Modification",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_affidavit_of_service",
    "label": "Affidavit of Service",
    "subtitle": "State civil procedure",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_subpoena_duces_tecum",
    "label": "Subpoena Duces Tecum",
    "subtitle": "State civil procedure",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_continue",
    "label": "Motion for Continuance (State)",
    "subtitle": "State civil/criminal rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_tax_appeal",
    "label": "State Income Tax Appeal",
    "subtitle": "State revenue code",
    "category": "Tax",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_general_affidavit",
    "label": "General Affidavit (State)",
    "subtitle": "State court practice",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_civil_cover_sheet",
    "label": "Civil Cover Sheet Narrative",
    "subtitle": "State civil procedure",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_default_judgment",
    "label": "Motion for Default Judgment",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_joinder",
    "label": "Motion for Joinder of Parties",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_class_cert",
    "label": "Class Certification Motion (State)",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_interrogatories",
    "label": "Interrogatories (State)",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_request_production",
    "label": "Request for Production (State)",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_request_admissions",
    "label": "Request for Admissions (State)",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_deposition_notice",
    "label": "Deposition Notice",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_subpoena_ad_testificandum",
    "label": "Subpoena Ad Testificandum",
    "subtitle": "State civil procedure",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_compel_discovery",
    "label": "Motion to Compel Discovery",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_protective_order_discovery",
    "label": "Discovery Protective Order",
    "subtitle": "State discovery rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_preliminary_objections",
    "label": "Preliminary Objections (State)",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_new_trial_motion",
    "label": "Motion for New Trial",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_reconsideration",
    "label": "Motion for Reconsideration",
    "subtitle": "State civil procedure",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_notice_appeal",
    "label": "Notice of Appeal (State)",
    "subtitle": "State appellate rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_appellate_brief",
    "label": "Appellate Brief (State)",
    "subtitle": "State appellate rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_criminal_complaint",
    "label": "Criminal Complaint (State)",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_arraignment_waiver",
    "label": "Arraignment Waiver / Entry of Plea",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_reduce_bail",
    "label": "Motion to Reduce Bail",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_discovery_criminal",
    "label": "Criminal Discovery Motion",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_motion_dismiss_criminal",
    "label": "Motion to Dismiss (Criminal)",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_sentencing_memo",
    "label": "Sentencing Memorandum (State)",
    "subtitle": "State criminal procedure",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_marital_settlement",
    "label": "Marital Settlement Agreement",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_spousal_support_motion",
    "label": "Spousal Support Motion",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_paternity_petition",
    "label": "Paternity Petition",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_adoption_consent",
    "label": "Adoption Consent / Relinquishment",
    "subtitle": "State adoption law",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_emancipation_petition",
    "label": "Emancipation Petition",
    "subtitle": "State family code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_guardianship_petition",
    "label": "Guardianship Petition (State)",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_conservatorship_petition",
    "label": "Conservatorship Petition",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_codicil",
    "label": "Codicil (State)",
    "subtitle": "State probate code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_trust_amendment",
    "label": "Trust Amendment",
    "subtitle": "State trust law",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_promissory_note",
    "label": "Promissory Note",
    "subtitle": "State contract law",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_bill_of_sale",
    "label": "Bill of Sale",
    "subtitle": "State property law",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_contractor_agreement",
    "label": "Independent Contractor Agreement",
    "subtitle": "State contract law",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_commercial_lease",
    "label": "Commercial Lease Agreement",
    "subtitle": "State property law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_notice_to_vacate",
    "label": "Notice to Vacate",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_pay_or_quit_notice",
    "label": "Pay or Quit Notice",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_cure_or_quit_notice",
    "label": "Cure or Quit Notice",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_state_unlawful_detainer_complaint",
    "label": "Unlawful Detainer Complaint",
    "subtitle": "State landlord-tenant law",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "catalogType": "template"
  },
  {
    "id": "us_ca_sc100",
    "label": "SC-100 Plaintiff Claim",
    "subtitle": "Cal. Rules of Court",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_sc120",
    "label": "SC-120 Defendant Claim",
    "subtitle": "Cal. Rules of Court",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC120",
    "catalogType": "official"
  },
  {
    "id": "us_ca_sc500",
    "label": "SC-500 Request to Correct or Cancel Judgment",
    "subtitle": "Cal. Rules of Court",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC500",
    "catalogType": "official"
  },
  {
    "id": "us_ca_pldc001",
    "label": "PLD-C-001 Complaint",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLDC001",
    "catalogType": "official"
  },
  {
    "id": "us_ca_pldc010",
    "label": "PLD-C-010 Answer",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLDC010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_pldc050",
    "label": "PLD-C-050 Cross-Complaint",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLDC050",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc030",
    "label": "MC-030 Memorandum of Points and Authorities",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc031",
    "label": "MC-031 Attached Declaration",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC031",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc040",
    "label": "MC-040 Request for Court Order and Answer",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC040",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl100",
    "label": "FL-100 Petition—Marriage/Domestic Partnership",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl110",
    "label": "FL-110 Summons (Family Law)",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL110",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl120",
    "label": "FL-120 Response—Marriage/Domestic Partnership",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL120",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl150",
    "label": "FL-150 Income and Expense Declaration",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL150",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl160",
    "label": "FL-160 Property Declaration",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL160",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl180",
    "label": "FL-180 Judgment",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL180",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl210",
    "label": "FL-210 Request for Order",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL210",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl300",
    "label": "FL-300 Request for Order (Family Law)",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL300",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fl320",
    "label": "FL-320 Responsive Declaration",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL320",
    "catalogType": "official"
  },
  {
    "id": "us_ca_de111",
    "label": "DE-111 Petition for Probate",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE111",
    "catalogType": "official"
  },
  {
    "id": "us_ca_de147",
    "label": "DE-147 Letters Testamentary",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE147",
    "catalogType": "official"
  },
  {
    "id": "us_ca_de150",
    "label": "DE-150 Inventory and Appraisal",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE150",
    "catalogType": "official"
  },
  {
    "id": "us_ca_de160",
    "label": "DE-160 Notice of Petition to Administer Estate",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE160",
    "catalogType": "official"
  },
  {
    "id": "us_ca_ud100",
    "label": "UD-100 Unlawful Detainer Complaint",
    "subtitle": "Cal. Code Civ. Proc. §1161",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_ud120",
    "label": "UD-120 Answer to Unlawful Detainer",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD120",
    "catalogType": "official"
  },
  {
    "id": "us_ca_ud130",
    "label": "UD-130 Decision After Trial",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD130",
    "catalogType": "official"
  },
  {
    "id": "us_ca_disc001",
    "label": "DISC-001 Interrogatories",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC001",
    "catalogType": "official"
  },
  {
    "id": "us_ca_disc002",
    "label": "DISC-002 Form Interrogatories—General",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC002",
    "catalogType": "official"
  },
  {
    "id": "us_ca_disc003",
    "label": "DISC-003 Request for Production",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC003",
    "catalogType": "official"
  },
  {
    "id": "us_ca_cr180",
    "label": "CR-180 Petition for Dismissal",
    "subtitle": "Cal. Penal Code",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CR180",
    "catalogType": "official"
  },
  {
    "id": "us_ca_cr200",
    "label": "CR-200 Petition for Resentencing",
    "subtitle": "Cal. Penal Code",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CR200",
    "catalogType": "official"
  },
  {
    "id": "us_ca_ch100",
    "label": "CH-100 Request for Civil Harassment Restraining Order",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CH100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_ch120",
    "label": "CH-120 Response to Request for Civil Harassment Restraining Order",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CH120",
    "catalogType": "official"
  },
  {
    "id": "us_ca_dv100",
    "label": "DV-100 Request for Domestic Violence Restraining Order",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DV100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_dv120",
    "label": "DV-120 Response to Request for Domestic Violence Restraining Order",
    "subtitle": "Cal. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DV120",
    "catalogType": "official"
  },
  {
    "id": "us_ca_cm010",
    "label": "CM-010 Civil Case Cover Sheet",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CM010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_pos030",
    "label": "POS-030 Proof of Service",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "POS030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_pos040",
    "label": "POS-040 Proof of Service by Mail",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "POS040",
    "catalogType": "official"
  },
  {
    "id": "us_ca_fw001",
    "label": "FW-001 Application for Waiver of Court Fees",
    "subtitle": "Cal. Gov. Code §68632",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FW001",
    "catalogType": "official"
  },
  {
    "id": "us_ca_nc100",
    "label": "NC-100 Petition for Change of Name",
    "subtitle": "Cal. Code Civ. Proc. §1275",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "NC100",
    "catalogType": "official"
  },
  {
    "id": "us_ca_gc210",
    "label": "GC-210 Petition for Appointment of Guardian",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC210",
    "catalogType": "official"
  },
  {
    "id": "us_ca_gc220",
    "label": "GC-220 Petition for Termination of Guardianship",
    "subtitle": "Cal. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC220",
    "catalogType": "official"
  },
  {
    "id": "us_ca_jv180",
    "label": "JV-180 Application to Resume Driving Privileges",
    "subtitle": "Cal. Veh. Code",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "JV180",
    "catalogType": "official"
  },
  {
    "id": "us_ca_em115",
    "label": "EM-115 Application for Writ of Execution",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EM115",
    "catalogType": "official"
  },
  {
    "id": "us_ca_eao203",
    "label": "EAO-203 Application and Order for Appearance and Examination",
    "subtitle": "Cal. Code Civ. Proc.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EAO203",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc025",
    "label": "MC-025 Attached Declaration",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC025",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc050",
    "label": "MC-050 Request for Order Shortening Time",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC050",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc060",
    "label": "MC-060 Notice of Hearing",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC060",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc070",
    "label": "MC-070 Order on Request for Order Shortening Time",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC070",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc080",
    "label": "MC-080 Declaration Regarding Notice and Service of Request for Temporary Emergency Orders",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC080",
    "catalogType": "official"
  },
  {
    "id": "us_ca_mc090",
    "label": "MC-090 Declaration Regarding Service of Summons",
    "subtitle": "Cal. Rules of Court",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC090",
    "catalogType": "official"
  },
  {
    "id": "us_ny_supreme_summons",
    "label": "Supreme Court Summons with Notice",
    "subtitle": "N.Y. CPLR §305",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SUPREME_SUMMONS",
    "catalogType": "official"
  },
  {
    "id": "us_ny_supreme_complaint",
    "label": "Supreme Court Complaint",
    "subtitle": "N.Y. CPLR §3013",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SUPREME_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_supreme_answer",
    "label": "Supreme Court Answer",
    "subtitle": "N.Y. CPLR §3018",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SUPREME_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_ny_notice_motion",
    "label": "Notice of Motion",
    "subtitle": "N.Y. CPLR §2214",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "NOTICE_MOTION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_affirmation_support",
    "label": "Affirmation in Support of Motion",
    "subtitle": "N.Y. CPLR §2214",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "AFFIRMATION_SUPPORT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_matrimonial_summons",
    "label": "Matrimonial Summons with Notice",
    "subtitle": "DRL §170",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MATRIMONIAL_SUMMONS",
    "catalogType": "official"
  },
  {
    "id": "us_ny_matrimonial_complaint",
    "label": "Matrimonial Complaint",
    "subtitle": "DRL §170",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MATRIMONIAL_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_matrimonial_answer",
    "label": "Matrimonial Answer",
    "subtitle": "DRL §170",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MATRIMONIAL_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_ny_holdover_petition",
    "label": "Holdover Proceeding Petition",
    "subtitle": "RPAPL §711",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "HOLDOVER_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_nonpayment_petition",
    "label": "Nonpayment Proceeding Petition",
    "subtitle": "RPAPL §711",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "NONPAYMENT_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_surrogate_probate",
    "label": "Petition for Letters Testamentary",
    "subtitle": "SCPA §1402",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SURROGATE_PROBATE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_surrogate_administration",
    "label": "Petition for Letters of Administration",
    "subtitle": "SCPA §1001",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SURROGATE_ADMINISTRATION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_small_claims_statement",
    "label": "Small Claims Statement of Claim",
    "subtitle": "UCCA §1801",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SMALL_CLAIMS_STATEMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_discovery_demands",
    "label": "Discovery Demands (CPLR Art. 31)",
    "subtitle": "N.Y. CPLR §3101",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "DISCOVERY_DEMANDS",
    "catalogType": "official"
  },
  {
    "id": "us_ny_bill_particulars",
    "label": "Demand for Bill of Particulars",
    "subtitle": "N.Y. CPLR §3042",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "BILL_PARTICULARS",
    "catalogType": "official"
  },
  {
    "id": "us_ny_notice_appeal",
    "label": "Notice of Appeal",
    "subtitle": "N.Y. CPLR §5515",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "NOTICE_APPEAL",
    "catalogType": "official"
  },
  {
    "id": "us_ny_order_show_cause",
    "label": "Order to Show Cause",
    "subtitle": "N.Y. CPLR §2214",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "ORDER_SHOW_CAUSE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_stipulation_discontinuance",
    "label": "Stipulation of Discontinuance",
    "subtitle": "N.Y. CPLR §3217",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "STIPULATION_DISCONTINUANCE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_civil_cover_sheet",
    "label": "Civil Cover Sheet (NYSCEF)",
    "subtitle": "22 NYCRR §202",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "CIVIL_COVER_SHEET",
    "catalogType": "official"
  },
  {
    "id": "us_ny_rpapl_notice_termination",
    "label": "Notice of Termination of Tenancy",
    "subtitle": "RPAPL §226-c",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "RPAPL_NOTICE_TERMINATION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_family_support_petition",
    "label": "Family Court Support Petition",
    "subtitle": "FCA §413",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "FAMILY_SUPPORT_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_family_custody_petition",
    "label": "Family Court Custody Petition",
    "subtitle": "FCA §651",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "FAMILY_CUSTODY_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_family_visitation_petition",
    "label": "Family Court Visitation Petition",
    "subtitle": "FCA §651",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "FAMILY_VISITATION_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_family_order_protection",
    "label": "Family Offense Petition (Order of Protection)",
    "subtitle": "FCA §812",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "FAMILY_ORDER_PROTECTION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_scar_petition",
    "label": "Small Claims Assessment Review Petition",
    "subtitle": "RPTL §1598",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SCAR_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_article_78_petition",
    "label": "Article 78 Special Proceeding Petition",
    "subtitle": "CPLR Art. 78",
    "category": "Administrative",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "ARTICLE_78_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_commercial_division",
    "label": "Commercial Division Initial Filing",
    "subtitle": "22 NYCRR §202.70",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "COMMERCIAL_DIVISION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_ejectment_complaint",
    "label": "Ejectment Complaint",
    "subtitle": "N.Y. RPAPL",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "EJECTMENT_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_foreclosure_complaint",
    "label": "Foreclosure Complaint",
    "subtitle": "N.Y. CPLR / RPAPL",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "FORECLOSURE_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_mechanics_lien",
    "label": "Mechanics Lien Foreclosure Complaint",
    "subtitle": "N.Y. Lien Law",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MECHANICS_LIEN",
    "catalogType": "official"
  },
  {
    "id": "us_ny_surrogate_caveat",
    "label": "Probate Caveat",
    "subtitle": "SCPA §1410",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SURROGATE_CAVEAT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_surrogate_objection",
    "label": "Objection to Probate",
    "subtitle": "SCPA §1410",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SURROGATE_OBJECTION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_certification_settlement",
    "label": "Certification of Settlement",
    "subtitle": "N.Y. CPLR §3217",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "CERTIFICATION_SETTLEMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_note_issue",
    "label": "Note of Issue",
    "subtitle": "22 NYCRR §202.21",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "NOTE_ISSUE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_request_judicial_intervention",
    "label": "Request for Judicial Intervention",
    "subtitle": "22 NYCRR §202.21",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "REQUEST_JUDICIAL_INTERVENTION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_preliminary_conference",
    "label": "Preliminary Conference Request",
    "subtitle": "22 NYCRR §202.12",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "PRELIMINARY_CONFERENCE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_reargue",
    "label": "Motion to Reargue",
    "subtitle": "N.Y. CPLR §2221",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_REARGUE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_renew",
    "label": "Motion to Renew",
    "subtitle": "N.Y. CPLR §2221",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_RENEW",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_default_judgment",
    "label": "Motion for Default Judgment",
    "subtitle": "N.Y. CPLR §3215",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_DEFAULT_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_summary_judgment",
    "label": "Motion for Summary Judgment",
    "subtitle": "N.Y. CPLR §3212",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_SUMMARY_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_preliminary_injunction",
    "label": "Motion for Preliminary Injunction",
    "subtitle": "N.Y. CPLR §6301",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_PRELIMINARY_INJUNCTION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_compel",
    "label": "Motion to Compel Discovery",
    "subtitle": "N.Y. CPLR §3120",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_COMPEL",
    "catalogType": "official"
  },
  {
    "id": "us_ny_motion_protective",
    "label": "Motion for Protective Order",
    "subtitle": "N.Y. CPLR §3120",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "MOTION_PROTECTIVE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_subpoena_duces_tecum",
    "label": "Subpoena Duces Tecum",
    "subtitle": "N.Y. CPLR §3120",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SUBPOENA_DUCES_TECUM",
    "catalogType": "official"
  },
  {
    "id": "us_ny_subpoena_ad_testificandum",
    "label": "Subpoena Ad Testificandum",
    "subtitle": "N.Y. CPLR §2301",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "SUBPOENA_AD_TESTIFICANDUM",
    "catalogType": "official"
  },
  {
    "id": "us_ny_verification",
    "label": "Verification (General)",
    "subtitle": "N.Y. CPLR §3020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "VERIFICATION",
    "catalogType": "official"
  },
  {
    "id": "us_ny_affidavit_service",
    "label": "Affidavit of Service",
    "subtitle": "N.Y. CPLR §2103",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "AFFIDAVIT_SERVICE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_stipulation_settlement",
    "label": "Stipulation of Settlement",
    "subtitle": "N.Y. CPLR §3217",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "STIPULATION_SETTLEMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_consent_judgment",
    "label": "Consent Judgment",
    "subtitle": "N.Y. CPLR",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "CONSENT_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ny_order_reference",
    "label": "Order of Reference",
    "subtitle": "N.Y. CPLR §4319",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "ORDER_REFERENCE",
    "catalogType": "official"
  },
  {
    "id": "us_ny_judgment",
    "label": "Judgment (General Form)",
    "subtitle": "N.Y. CPLR §5013",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_original_petition",
    "label": "Original Petition",
    "subtitle": "Tex. R. Civ. P. Rule 45",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "ORIGINAL_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_original_answer",
    "label": "Original Answer",
    "subtitle": "Tex. R. Civ. P.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "ORIGINAL_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_summary_judgment",
    "label": "Motion for Summary Judgment",
    "subtitle": "Tex. R. Civ. P. Rule 166a",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_SUMMARY_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_default_judgment",
    "label": "Motion for Default Judgment",
    "subtitle": "Tex. R. Civ. P. Rule 237",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_DEFAULT_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_continuance",
    "label": "Motion for Continuance",
    "subtitle": "Tex. R. Civ. P. Rule 251",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_CONTINUANCE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_compel",
    "label": "Motion to Compel Discovery",
    "subtitle": "Tex. R. Civ. P. Rule 193",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_COMPEL",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_protective",
    "label": "Motion for Protective Order",
    "subtitle": "Tex. R. Civ. P. Rule 192",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_PROTECTIVE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_dismiss",
    "label": "Motion to Dismiss",
    "subtitle": "Tex. R. Civ. P. Rule 91a",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_DISMISS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_new_trial",
    "label": "Motion for New Trial",
    "subtitle": "Tex. R. Civ. P. Rule 329b",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_NEW_TRIAL",
    "catalogType": "official"
  },
  {
    "id": "us_tx_notice_appeal",
    "label": "Notice of Appeal",
    "subtitle": "Tex. R. App. P. Rule 25",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "NOTICE_APPEAL",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_divorce",
    "label": "Original Petition for Divorce",
    "subtitle": "Tex. Fam. Code §6",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_DIVORCE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_answer_divorce",
    "label": "Original Answer in Divorce",
    "subtitle": "Tex. Fam. Code",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "ANSWER_DIVORCE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_temporary_orders",
    "label": "Motion for Temporary Orders",
    "subtitle": "Tex. Fam. Code §105",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_TEMPORARY_ORDERS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_modification",
    "label": "Motion to Modify Order",
    "subtitle": "Tex. Fam. Code §156",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_MODIFICATION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_enforcement",
    "label": "Motion for Enforcement",
    "subtitle": "Tex. Fam. Code §157",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_ENFORCEMENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_custody",
    "label": "Suit Affecting Parent-Child Relationship",
    "subtitle": "Tex. Fam. Code §102",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_CUSTODY",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_adoption",
    "label": "Petition for Adoption",
    "subtitle": "Tex. Fam. Code Ch. 162",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_ADOPTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_probate_application",
    "label": "Application for Probate of Will",
    "subtitle": "Tex. Est. Code §256",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PROBATE_APPLICATION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_probate_heirship",
    "label": "Application to Determine Heirship",
    "subtitle": "Tex. Est. Code §202",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PROBATE_HEIRSHIP",
    "catalogType": "official"
  },
  {
    "id": "us_tx_probate_independent",
    "label": "Application for Independent Administration",
    "subtitle": "Tex. Est. Code §401",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PROBATE_INDEPENDENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_forcible_detainer",
    "label": "Forcible Detainer Petition",
    "subtitle": "Tex. Prop. Code Ch. 24",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "FORCIBLE_DETAINER",
    "catalogType": "official"
  },
  {
    "id": "us_tx_forcible_detainer_answer",
    "label": "Forcible Detainer Answer",
    "subtitle": "Tex. Prop. Code Ch. 24",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "FORCIBLE_DETAINER_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_tx_small_claims_petition",
    "label": "Justice Court Small Claims Petition",
    "subtitle": "Tex. Gov. Code Ch. 27",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "SMALL_CLAIMS_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_interrogatories",
    "label": "Interrogatories to Party",
    "subtitle": "Tex. R. Civ. P. Rule 190",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "INTERROGATORIES",
    "catalogType": "official"
  },
  {
    "id": "us_tx_request_production",
    "label": "Request for Production",
    "subtitle": "Tex. R. Civ. P. Rule 196",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "REQUEST_PRODUCTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_request_admissions",
    "label": "Request for Admissions",
    "subtitle": "Tex. R. Civ. P. Rule 198",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "REQUEST_ADMISSIONS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_deposition_notice",
    "label": "Notice of Oral Deposition",
    "subtitle": "Tex. R. Civ. P. Rule 199",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "DEPOSITION_NOTICE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_subpoena",
    "label": "Subpoena",
    "subtitle": "Tex. R. Civ. P. Rule 176",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "SUBPOENA",
    "catalogType": "official"
  },
  {
    "id": "us_tx_writ_garnishment",
    "label": "Application for Writ of Garnishment",
    "subtitle": "Tex. R. Civ. P. Rule 658",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "WRIT_GARNISHMENT",
    "catalogType": "official"
  },
  {
    "id": "us_tx_writ_execution",
    "label": "Request for Writ of Execution",
    "subtitle": "Tex. R. Civ. P. Rule 622",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "WRIT_EXECUTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_mechanics_lien",
    "label": "Mechanics Lien Affidavit",
    "subtitle": "Tex. Prop. Code Ch. 53",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MECHANICS_LIEN",
    "catalogType": "official"
  },
  {
    "id": "us_tx_non_compete",
    "label": "Non-Compete Agreement",
    "subtitle": "Tex. Bus. & Com. Code",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "NON_COMPETE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_promissory_note",
    "label": "Promissory Note",
    "subtitle": "Tex. Bus. & Com. Code",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PROMISSORY_NOTE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_commercial_lease",
    "label": "Commercial Lease Agreement",
    "subtitle": "Tex. Prop. Code",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "COMMERCIAL_LEASE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_residential_lease",
    "label": "Residential Lease Agreement",
    "subtitle": "Tex. Prop. Code Ch. 92",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "RESIDENTIAL_LEASE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_notice_to_vacate",
    "label": "Notice to Vacate",
    "subtitle": "Tex. Prop. Code §24.005",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "NOTICE_TO_VACATE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_injunction",
    "label": "Application for Temporary Injunction",
    "subtitle": "Tex. R. Civ. P. Rule 680",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_INJUNCTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_mandamus",
    "label": "Original Petition for Writ of Mandamus",
    "subtitle": "Tex. Gov. Code Ch. 81",
    "category": "Constitutional",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_MANDAMUS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_habeas",
    "label": "Application for Writ of Habeas Corpus",
    "subtitle": "Tex. Code Crim. Proc. Art. 11.07",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_HABEAS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_bond_reduction",
    "label": "Motion to Reduce Bond",
    "subtitle": "Tex. Code Crim. Proc. Art. 17.15",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_BOND_REDUCTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_suppress",
    "label": "Motion to Suppress Evidence",
    "subtitle": "Tex. Code Crim. Proc. Art. 28.01",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_SUPPRESS",
    "catalogType": "official"
  },
  {
    "id": "us_tx_motion_quash",
    "label": "Motion to Quash Indictment",
    "subtitle": "Tex. Code Crim. Proc.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "MOTION_QUASH",
    "catalogType": "official"
  },
  {
    "id": "us_tx_plea_bargain",
    "label": "Plea Agreement",
    "subtitle": "Tex. Code Crim. Proc.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PLEA_BARGAIN",
    "catalogType": "official"
  },
  {
    "id": "us_tx_sentencing_memo",
    "label": "Sentencing Memorandum",
    "subtitle": "Tex. Code Crim. Proc.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "SENTENCING_MEMO",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_expunction",
    "label": "Petition for Expunction",
    "subtitle": "Tex. Code Crim. Proc. Art. 55",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_EXPUNCTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_nondisclosure",
    "label": "Petition for Order of Nondisclosure",
    "subtitle": "Tex. Gov. Code Ch. 411",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_NONDISCLOSURE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_petition_name_change",
    "label": "Petition for Change of Name",
    "subtitle": "Tex. Fam. Code Ch. 45",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "PETITION_NAME_CHANGE",
    "catalogType": "official"
  },
  {
    "id": "us_tx_guardianship_application",
    "label": "Application for Appointment of Guardian",
    "subtitle": "Tex. Est. Code Ch. 1151",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "GUARDIANSHIP_APPLICATION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_trust_petition",
    "label": "Petition to Modify Trust",
    "subtitle": "Tex. Prop. Code Ch. 114",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "TRUST_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_llc_formation",
    "label": "Certificate of Formation (LLC)",
    "subtitle": "Tex. Bus. Org. Code",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "LLC_FORMATION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_certificate_correction",
    "label": "Certificate of Correction",
    "subtitle": "Tex. Bus. Org. Code",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "CERTIFICATE_CORRECTION",
    "catalogType": "official"
  },
  {
    "id": "us_tx_trademark_registration",
    "label": "Trademark Registration Application",
    "subtitle": "Tex. Bus. & Com. Code Ch. 16",
    "category": "IP",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "TX",
    "formNumber": "TRADEMARK_REGISTRATION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12901a",
    "label": "Form 12.901(a) Petition for Dissolution of Marriage",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12901A",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12901b",
    "label": "Form 12.901(b) Answer to Petition for Dissolution",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12901B",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12902",
    "label": "Form 12.902 Financial Affidavit",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12902",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12903",
    "label": "Form 12.903 Joint Parenting Plan",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12903",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12904",
    "label": "Form 12.904 Uniform Child Custody Jurisdiction Affidavit",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12904",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12905",
    "label": "Form 12.905 Petition for Injunction for Protection",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12905",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12906",
    "label": "Form 12.906 Motion for Temporary Support",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12906",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12907",
    "label": "Form 12.907 Notice of Social Security Number",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12907",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12908",
    "label": "Form 12.908 Certificate of Compliance",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12908",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12909",
    "label": "Form 12.909 Petition for Modification",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12909",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12910",
    "label": "Form 12.910 Summons for Dissolution",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12910",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12911",
    "label": "Form 12.911 Affidavit of Diligent Search",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12911",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12912",
    "label": "Form 12.912 Motion for Default",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12912",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12913",
    "label": "Form 12.913 Final Judgment of Dissolution",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12913",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12914",
    "label": "Form 12.914 Marital Settlement Agreement",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12914",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12915",
    "label": "Form 12.915 Petition for Paternity",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12915",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12916",
    "label": "Form 12.916 Motion for Contempt",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12916",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12917",
    "label": "Form 12.917 Notice of Hearing",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12917",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12918",
    "label": "Form 12.918 Motion to Compel",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12918",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12919",
    "label": "Form 12.919 Motion for Temporary Custody",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12919",
    "catalogType": "official"
  },
  {
    "id": "us_fl_12920",
    "label": "Form 12.920 Motion for Attorney Fees",
    "subtitle": "Fla. Fam. Law Rules",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "12920",
    "catalogType": "official"
  },
  {
    "id": "us_fl_civil_complaint",
    "label": "Civil Complaint",
    "subtitle": "Fla. R. Civ. P.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CIVIL_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_civil_answer",
    "label": "Answer to Complaint",
    "subtitle": "Fla. R. Civ. P.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CIVIL_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_fl_motion_summary_judgment",
    "label": "Motion for Summary Judgment",
    "subtitle": "Fla. R. Civ. P. 1.510",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "MOTION_SUMMARY_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_motion_default",
    "label": "Motion for Default",
    "subtitle": "Fla. R. Civ. P. 1.500",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "MOTION_DEFAULT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_motion_compel",
    "label": "Motion to Compel Discovery",
    "subtitle": "Fla. R. Civ. P. 1.380",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "MOTION_COMPEL",
    "catalogType": "official"
  },
  {
    "id": "us_fl_eviction_complaint",
    "label": "Complaint for Eviction",
    "subtitle": "Fla. Stat. §83",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "EVICTION_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_eviction_answer",
    "label": "Answer to Eviction Complaint",
    "subtitle": "Fla. Stat. §83",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "EVICTION_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_fl_probate_formal",
    "label": "Formal Administration Petition",
    "subtitle": "Fla. Prob. Rules",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "PROBATE_FORMAL",
    "catalogType": "official"
  },
  {
    "id": "us_fl_probate_summary",
    "label": "Summary Administration Petition",
    "subtitle": "Fla. Prob. Rules",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "PROBATE_SUMMARY",
    "catalogType": "official"
  },
  {
    "id": "us_fl_probate_homestead",
    "label": "Petition to Determine Homestead Status",
    "subtitle": "Fla. Prob. Rules",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "PROBATE_HOMESTEAD",
    "catalogType": "official"
  },
  {
    "id": "us_fl_small_claims",
    "label": "Statement of Claim (Small Claims)",
    "subtitle": "Fla. Sm. Cl. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "SMALL_CLAIMS",
    "catalogType": "official"
  },
  {
    "id": "us_fl_notice_appeal",
    "label": "Notice of Appeal",
    "subtitle": "Fla. R. App. P. 9.110",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "NOTICE_APPEAL",
    "catalogType": "official"
  },
  {
    "id": "us_fl_criminal_affidavit",
    "label": "Affidavit of Probable Cause",
    "subtitle": "Fla. R. Crim. P. 3.133",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CRIMINAL_AFFIDAVIT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_criminal_motion_dismiss",
    "label": "Motion to Dismiss",
    "subtitle": "Fla. R. Crim. P.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CRIMINAL_MOTION_DISMISS",
    "catalogType": "official"
  },
  {
    "id": "us_fl_criminal_motion_suppress",
    "label": "Motion to Suppress",
    "subtitle": "Fla. R. Crim. P.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CRIMINAL_MOTION_SUPPRESS",
    "catalogType": "official"
  },
  {
    "id": "us_fl_criminal_plea",
    "label": "Plea in Court",
    "subtitle": "Fla. R. Crim. P.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CRIMINAL_PLEA",
    "catalogType": "official"
  },
  {
    "id": "us_fl_criminal_sentencing",
    "label": "Sentencing Memorandum",
    "subtitle": "Fla. R. Crim. P.",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CRIMINAL_SENTENCING",
    "catalogType": "official"
  },
  {
    "id": "us_fl_guardianship_petition",
    "label": "Petition for Appointment of Guardian",
    "subtitle": "Fla. Prob. Rules",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "GUARDIANSHIP_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_trust_petition",
    "label": "Petition to Modify Trust",
    "subtitle": "Fla. Prob. Code",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "TRUST_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_mechanics_lien",
    "label": "Construction Lien Statement",
    "subtitle": "Fla. Stat. Ch. 713",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "MECHANICS_LIEN",
    "catalogType": "official"
  },
  {
    "id": "us_fl_foreclosure_complaint",
    "label": "Foreclosure Complaint",
    "subtitle": "Fla. Stat. Ch. 702",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "FORECLOSURE_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_replevin_complaint",
    "label": "Replevin Complaint",
    "subtitle": "Fla. Stat. §78.055",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "REPLEVIN_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_fl_injunction_petition",
    "label": "Petition for Injunction",
    "subtitle": "Fla. R. Civ. P. 1.610",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "INJUNCTION_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_deposition_notice",
    "label": "Notice of Taking Deposition",
    "subtitle": "Fla. R. Civ. P. 1.310",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "DEPOSITION_NOTICE",
    "catalogType": "official"
  },
  {
    "id": "us_fl_subpoena",
    "label": "Subpoena",
    "subtitle": "Fla. R. Civ. P. 1.410",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "SUBPOENA",
    "catalogType": "official"
  },
  {
    "id": "us_fl_certificate_service",
    "label": "Certificate of Service",
    "subtitle": "Fla. R. Gen. Prac.",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CERTIFICATE_SERVICE",
    "catalogType": "official"
  },
  {
    "id": "us_fl_cover_sheet",
    "label": "Civil Cover Sheet",
    "subtitle": "Fla. R. Gen. Prac.",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "COVER_SHEET",
    "catalogType": "official"
  },
  {
    "id": "us_fl_verification",
    "label": "Verification",
    "subtitle": "Fla. R. Civ. P.",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "VERIFICATION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_stipulation",
    "label": "Stipulation for Settlement",
    "subtitle": "Fla. R. Civ. P.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "STIPULATION",
    "catalogType": "official"
  },
  {
    "id": "us_fl_consent_final_judgment",
    "label": "Consent Final Judgment",
    "subtitle": "Fla. R. Civ. P.",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "FL",
    "formNumber": "CONSENT_FINAL_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_il_civil_complaint",
    "label": "Civil Complaint",
    "subtitle": "735 ILCS 5/",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CIVIL_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_il_civil_answer",
    "label": "Answer and Affirmative Defenses",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CIVIL_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_summary_judgment",
    "label": "Motion for Summary Judgment",
    "subtitle": "Ill. Sup. Ct. Rule 191",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_SUMMARY_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_default",
    "label": "Motion for Default Judgment",
    "subtitle": "735 ILCS 5/2-1301",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_DEFAULT",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_compel",
    "label": "Motion to Compel Discovery",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_COMPEL",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_protective",
    "label": "Motion for Protective Order",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_PROTECTIVE",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_dismiss",
    "label": "Motion to Dismiss",
    "subtitle": "735 ILCS 5/2-619",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_DISMISS",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_continuance",
    "label": "Motion for Continuance",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_CONTINUANCE",
    "catalogType": "official"
  },
  {
    "id": "us_il_notice_appeal",
    "label": "Notice of Appeal",
    "subtitle": "Ill. App. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "NOTICE_APPEAL",
    "catalogType": "official"
  },
  {
    "id": "us_il_petition_divorce",
    "label": "Petition for Dissolution of Marriage",
    "subtitle": "750 ILCS 5/",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PETITION_DIVORCE",
    "catalogType": "official"
  },
  {
    "id": "us_il_answer_divorce",
    "label": "Answer to Petition for Dissolution",
    "subtitle": "750 ILCS 5/",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "ANSWER_DIVORCE",
    "catalogType": "official"
  },
  {
    "id": "us_il_motion_temporary_relief",
    "label": "Motion for Temporary Relief",
    "subtitle": "750 ILCS 5/",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MOTION_TEMPORARY_RELIEF",
    "catalogType": "official"
  },
  {
    "id": "us_il_parenting_plan",
    "label": "Joint Parenting Agreement",
    "subtitle": "750 ILCS 5/602.10",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PARENTING_PLAN",
    "catalogType": "official"
  },
  {
    "id": "us_il_child_support_petition",
    "label": "Petition for Child Support",
    "subtitle": "750 ILCS 28/",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CHILD_SUPPORT_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_order_protection",
    "label": "Petition for Order of Protection",
    "subtitle": "750 ILCS 60/",
    "category": "Family",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "ORDER_PROTECTION",
    "catalogType": "official"
  },
  {
    "id": "us_il_probate_will",
    "label": "Petition for Probate of Will",
    "subtitle": "755 ILCS 5/",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PROBATE_WILL",
    "catalogType": "official"
  },
  {
    "id": "us_il_probate_intestate",
    "label": "Petition for Letters of Administration",
    "subtitle": "755 ILCS 5/",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PROBATE_INTESTATE",
    "catalogType": "official"
  },
  {
    "id": "us_il_probate_small_estate",
    "label": "Small Estate Affidavit",
    "subtitle": "755 ILCS 5/25-1",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PROBATE_SMALL_ESTATE",
    "catalogType": "official"
  },
  {
    "id": "us_il_forcible_detainer",
    "label": "Forcible Entry and Detainer Complaint",
    "subtitle": "735 ILCS 5/9-101",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "FORCIBLE_DETAINER",
    "catalogType": "official"
  },
  {
    "id": "us_il_forcible_detainer_answer",
    "label": "Forcible Detainer Answer",
    "subtitle": "735 ILCS 5/9-101",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "FORCIBLE_DETAINER_ANSWER",
    "catalogType": "official"
  },
  {
    "id": "us_il_small_claims",
    "label": "Small Claims Affidavit",
    "subtitle": "735 ILCS 5/2-101",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "SMALL_CLAIMS",
    "catalogType": "official"
  },
  {
    "id": "us_il_interrogatories",
    "label": "Interrogatories to Party",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "INTERROGATORIES",
    "catalogType": "official"
  },
  {
    "id": "us_il_request_production",
    "label": "Request for Production of Documents",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "REQUEST_PRODUCTION",
    "catalogType": "official"
  },
  {
    "id": "us_il_request_admissions",
    "label": "Request for Admissions",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "REQUEST_ADMISSIONS",
    "catalogType": "official"
  },
  {
    "id": "us_il_deposition_notice",
    "label": "Notice of Deposition",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "DEPOSITION_NOTICE",
    "catalogType": "official"
  },
  {
    "id": "us_il_subpoena",
    "label": "Subpoena",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "SUBPOENA",
    "catalogType": "official"
  },
  {
    "id": "us_il_mechanics_lien",
    "label": "Mechanics Lien Claim",
    "subtitle": "770 ILCS 60/",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MECHANICS_LIEN",
    "catalogType": "official"
  },
  {
    "id": "us_il_foreclosure_complaint",
    "label": "Mortgage Foreclosure Complaint",
    "subtitle": "735 ILCS 5/15-1501",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "FORECLOSURE_COMPLAINT",
    "catalogType": "official"
  },
  {
    "id": "us_il_injunction_petition",
    "label": "Petition for Preliminary Injunction",
    "subtitle": "735 ILCS 5/2-622",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "INJUNCTION_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_mandamus_petition",
    "label": "Petition for Writ of Mandamus",
    "subtitle": "735 ILCS 5/2-102",
    "category": "Constitutional",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "MANDAMUS_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_habeas_corpus",
    "label": "Petition for Writ of Habeas Corpus",
    "subtitle": "735 ILCS 5/10-101",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "HABEAS_CORPUS",
    "catalogType": "official"
  },
  {
    "id": "us_il_criminal_motion_quash",
    "label": "Motion to Quash Arrest/Search",
    "subtitle": "725 ILCS 5/",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CRIMINAL_MOTION_QUASH",
    "catalogType": "official"
  },
  {
    "id": "us_il_criminal_motion_suppress",
    "label": "Motion to Suppress Evidence",
    "subtitle": "725 ILCS 5/114-12",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CRIMINAL_MOTION_SUPPRESS",
    "catalogType": "official"
  },
  {
    "id": "us_il_criminal_motion_dismiss",
    "label": "Motion to Dismiss Indictment",
    "subtitle": "725 ILCS 5/",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CRIMINAL_MOTION_DISMISS",
    "catalogType": "official"
  },
  {
    "id": "us_il_criminal_plea",
    "label": "Plea Agreement",
    "subtitle": "725 ILCS 5/",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CRIMINAL_PLEA",
    "catalogType": "official"
  },
  {
    "id": "us_il_criminal_sentencing",
    "label": "Sentencing Memorandum",
    "subtitle": "730 ILCS 5/",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CRIMINAL_SENTENCING",
    "catalogType": "official"
  },
  {
    "id": "us_il_expungement_petition",
    "label": "Petition for Expungement/Sealing",
    "subtitle": "720 ILCS 5/2630",
    "category": "Criminal",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "EXPUNGEMENT_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_guardianship_petition",
    "label": "Petition for Appointment of Guardian",
    "subtitle": "755 ILCS 5/11a",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "GUARDIANSHIP_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_trust_petition",
    "label": "Petition to Modify Trust",
    "subtitle": "760 ILCS 3/",
    "category": "Probate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "TRUST_PETITION",
    "catalogType": "official"
  },
  {
    "id": "us_il_name_change",
    "label": "Petition for Change of Name",
    "subtitle": "735 ILCS 5/21-101",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "NAME_CHANGE",
    "catalogType": "official"
  },
  {
    "id": "us_il_llc_articles",
    "label": "Articles of Organization (LLC)",
    "subtitle": "805 ILCS 180/",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "LLC_ARTICLES",
    "catalogType": "official"
  },
  {
    "id": "us_il_corporation_articles",
    "label": "Articles of Incorporation",
    "subtitle": "805 ILCS 5/",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CORPORATION_ARTICLES",
    "catalogType": "official"
  },
  {
    "id": "us_il_promissory_note",
    "label": "Promissory Note",
    "subtitle": "810 ILCS 5/",
    "category": "Commercial",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "PROMISSORY_NOTE",
    "catalogType": "official"
  },
  {
    "id": "us_il_commercial_lease",
    "label": "Commercial Lease Agreement",
    "subtitle": "765 ILCS 705/",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "COMMERCIAL_LEASE",
    "catalogType": "official"
  },
  {
    "id": "us_il_residential_lease",
    "label": "Residential Lease Agreement",
    "subtitle": "765 ILCS 705/",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "RESIDENTIAL_LEASE",
    "catalogType": "official"
  },
  {
    "id": "us_il_notice_termination",
    "label": "Notice of Termination of Tenancy",
    "subtitle": "765 ILCS 705/",
    "category": "Real Estate",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "NOTICE_TERMINATION",
    "catalogType": "official"
  },
  {
    "id": "us_il_certificate_service",
    "label": "Certificate of Service",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CERTIFICATE_SERVICE",
    "catalogType": "official"
  },
  {
    "id": "us_il_cover_sheet",
    "label": "Civil Cover Sheet",
    "subtitle": "Ill. Sup. Ct. Rules",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "COVER_SHEET",
    "catalogType": "official"
  },
  {
    "id": "us_il_verification",
    "label": "Verification",
    "subtitle": "735 ILCS 5/",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "VERIFICATION",
    "catalogType": "official"
  },
  {
    "id": "us_il_stipulation",
    "label": "Stipulation for Settlement",
    "subtitle": "735 ILCS 5/",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "STIPULATION",
    "catalogType": "official"
  },
  {
    "id": "us_il_consent_judgment",
    "label": "Consent Judgment",
    "subtitle": "735 ILCS 5/",
    "category": "Civil",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "IL",
    "formNumber": "CONSENT_JUDGMENT",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_mc010",
    "label": "Judicial Council Form MC-010",
    "subtitle": "MC-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_mc020",
    "label": "Judicial Council Form MC-020",
    "subtitle": "MC-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_mc030",
    "label": "Judicial Council Form MC-030",
    "subtitle": "MC-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fl010",
    "label": "Judicial Council Form FL-010",
    "subtitle": "FL-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fl020",
    "label": "Judicial Council Form FL-020",
    "subtitle": "FL-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fl030",
    "label": "Judicial Council Form FL-030",
    "subtitle": "FL-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FL-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_de010",
    "label": "Judicial Council Form DE-010",
    "subtitle": "DE-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_de020",
    "label": "Judicial Council Form DE-020",
    "subtitle": "DE-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_de030",
    "label": "Judicial Council Form DE-030",
    "subtitle": "DE-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ud010",
    "label": "Judicial Council Form UD-010",
    "subtitle": "UD-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ud020",
    "label": "Judicial Council Form UD-020",
    "subtitle": "UD-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ud030",
    "label": "Judicial Council Form UD-030",
    "subtitle": "UD-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "UD-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sc010",
    "label": "Judicial Council Form SC-010",
    "subtitle": "SC-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sc020",
    "label": "Judicial Council Form SC-020",
    "subtitle": "SC-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sc030",
    "label": "Judicial Council Form SC-030",
    "subtitle": "SC-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SC-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pld010",
    "label": "Judicial Council Form PLD-010",
    "subtitle": "PLD-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLD-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pld020",
    "label": "Judicial Council Form PLD-020",
    "subtitle": "PLD-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLD-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pld030",
    "label": "Judicial Council Form PLD-030",
    "subtitle": "PLD-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLD-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_disc010",
    "label": "Judicial Council Form DISC-010",
    "subtitle": "DISC-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_disc020",
    "label": "Judicial Council Form DISC-020",
    "subtitle": "DISC-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_disc030",
    "label": "Judicial Council Form DISC-030",
    "subtitle": "DISC-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cr010",
    "label": "Judicial Council Form CR-010",
    "subtitle": "CR-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CR-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cr020",
    "label": "Judicial Council Form CR-020",
    "subtitle": "CR-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CR-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cr030",
    "label": "Judicial Council Form CR-030",
    "subtitle": "CR-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CR-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ch010",
    "label": "Judicial Council Form CH-010",
    "subtitle": "CH-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CH-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ch020",
    "label": "Judicial Council Form CH-020",
    "subtitle": "CH-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CH-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ch030",
    "label": "Judicial Council Form CH-030",
    "subtitle": "CH-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CH-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_dv010",
    "label": "Judicial Council Form DV-010",
    "subtitle": "DV-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DV-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_dv020",
    "label": "Judicial Council Form DV-020",
    "subtitle": "DV-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DV-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_dv030",
    "label": "Judicial Council Form DV-030",
    "subtitle": "DV-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DV-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_gc010",
    "label": "Judicial Council Form GC-010",
    "subtitle": "GC-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_gc020",
    "label": "Judicial Council Form GC-020",
    "subtitle": "GC-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_gc030",
    "label": "Judicial Council Form GC-030",
    "subtitle": "GC-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_nc010",
    "label": "Judicial Council Form NC-010",
    "subtitle": "NC-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "NC-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_nc020",
    "label": "Judicial Council Form NC-020",
    "subtitle": "NC-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "NC-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_nc030",
    "label": "Judicial Council Form NC-030",
    "subtitle": "NC-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "NC-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fw010",
    "label": "Judicial Council Form FW-010",
    "subtitle": "FW-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FW-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fw020",
    "label": "Judicial Council Form FW-020",
    "subtitle": "FW-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FW-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fw030",
    "label": "Judicial Council Form FW-030",
    "subtitle": "FW-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FW-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pos010",
    "label": "Judicial Council Form POS-010",
    "subtitle": "POS-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "POS-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pos020",
    "label": "Judicial Council Form POS-020",
    "subtitle": "POS-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "POS-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pos030",
    "label": "Judicial Council Form POS-030",
    "subtitle": "POS-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "POS-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cm010",
    "label": "Judicial Council Form CM-010",
    "subtitle": "CM-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CM-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cm020",
    "label": "Judicial Council Form CM-020",
    "subtitle": "CM-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CM-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_cm030",
    "label": "Judicial Council Form CM-030",
    "subtitle": "CM-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CM-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_eao010",
    "label": "Judicial Council Form EAO-010",
    "subtitle": "EAO-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EAO-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_eao020",
    "label": "Judicial Council Form EAO-020",
    "subtitle": "EAO-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EAO-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_eao030",
    "label": "Judicial Council Form EAO-030",
    "subtitle": "EAO-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EAO-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_em010",
    "label": "Judicial Council Form EM-010",
    "subtitle": "EM-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EM-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_em020",
    "label": "Judicial Council Form EM-020",
    "subtitle": "EM-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EM-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_em030",
    "label": "Judicial Council Form EM-030",
    "subtitle": "EM-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "EM-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_jv010",
    "label": "Judicial Council Form JV-010",
    "subtitle": "JV-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "JV-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_jv020",
    "label": "Judicial Council Form JV-020",
    "subtitle": "JV-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "JV-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_jv030",
    "label": "Judicial Council Form JV-030",
    "subtitle": "JV-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "JV-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ri010",
    "label": "Judicial Council Form RI-010",
    "subtitle": "RI-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "RI-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ri020",
    "label": "Judicial Council Form RI-020",
    "subtitle": "RI-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "RI-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_ri030",
    "label": "Judicial Council Form RI-030",
    "subtitle": "RI-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "RI-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_app010",
    "label": "Judicial Council Form APP-010",
    "subtitle": "APP-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "APP-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_app020",
    "label": "Judicial Council Form APP-020",
    "subtitle": "APP-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "APP-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_app030",
    "label": "Judicial Council Form APP-030",
    "subtitle": "APP-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "APP-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_subp010",
    "label": "Judicial Council Form SUBP-010",
    "subtitle": "SUBP-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUBP-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_subp020",
    "label": "Judicial Council Form SUBP-020",
    "subtitle": "SUBP-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUBP-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_subp030",
    "label": "Judicial Council Form SUBP-030",
    "subtitle": "SUBP-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUBP-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sum010",
    "label": "Judicial Council Form SUM-010",
    "subtitle": "SUM-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUM-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sum020",
    "label": "Judicial Council Form SUM-020",
    "subtitle": "SUM-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUM-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sum030",
    "label": "Judicial Council Form SUM-030",
    "subtitle": "SUM-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SUM-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_civ010",
    "label": "Judicial Council Form CIV-010",
    "subtitle": "CIV-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CIV-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_civ020",
    "label": "Judicial Council Form CIV-020",
    "subtitle": "CIV-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CIV-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_civ030",
    "label": "Judicial Council Form CIV-030",
    "subtitle": "CIV-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "CIV-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sn010",
    "label": "Judicial Council Form SN-010",
    "subtitle": "SN-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SN-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sn020",
    "label": "Judicial Council Form SN-020",
    "subtitle": "SN-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SN-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_sn030",
    "label": "Judicial Council Form SN-030",
    "subtitle": "SN-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "SN-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_adopt010",
    "label": "Judicial Council Form ADOPT-010",
    "subtitle": "ADOPT-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "ADOPT-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_adopt020",
    "label": "Judicial Council Form ADOPT-020",
    "subtitle": "ADOPT-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "ADOPT-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_adopt030",
    "label": "Judicial Council Form ADOPT-030",
    "subtitle": "ADOPT-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "ADOPT-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_wv010",
    "label": "Judicial Council Form WV-010",
    "subtitle": "WV-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "WV-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_wv020",
    "label": "Judicial Council Form WV-020",
    "subtitle": "WV-020",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "WV-020",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_wv030",
    "label": "Judicial Council Form WV-030",
    "subtitle": "WV-030",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "WV-030",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pldc001",
    "label": "Judicial Council Form PLD-C-001",
    "subtitle": "PLD-C-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLD-C-001",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_pldc010",
    "label": "Judicial Council Form PLD-C-010",
    "subtitle": "PLD-C-010",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "PLD-C-010",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_de111",
    "label": "Judicial Council Form DE-111",
    "subtitle": "DE-111",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DE-111",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_mc031",
    "label": "Judicial Council Form MC-031",
    "subtitle": "MC-031",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "MC-031",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_disc001",
    "label": "Judicial Council Form DISC-001",
    "subtitle": "DISC-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "DISC-001",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_gc210",
    "label": "Judicial Council Form GC-210",
    "subtitle": "GC-210",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "GC-210",
    "catalogType": "official"
  },
  {
    "id": "us_ca_form_fw001",
    "label": "Judicial Council Form FW-001",
    "subtitle": "FW-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "CA",
    "formNumber": "FW-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsmat001",
    "label": "Matrimonial Form 1",
    "subtitle": "UCS-MAT-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-MAT-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsmat002",
    "label": "Matrimonial Form 2",
    "subtitle": "UCS-MAT-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-MAT-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucscom001",
    "label": "Commercial Form 1",
    "subtitle": "UCS-COM-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-COM-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucscom002",
    "label": "Commercial Form 2",
    "subtitle": "UCS-COM-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-COM-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucslan001",
    "label": "Landlord-Tenant Form 1",
    "subtitle": "UCS-LAN-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-LAN-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucslan002",
    "label": "Landlord-Tenant Form 2",
    "subtitle": "UCS-LAN-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-LAN-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucssur001",
    "label": "Surrogate Form 1",
    "subtitle": "UCS-SUR-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-SUR-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucssur002",
    "label": "Surrogate Form 2",
    "subtitle": "UCS-SUR-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-SUR-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsapp001",
    "label": "Appellate Form 1",
    "subtitle": "UCS-APP-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-APP-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsapp002",
    "label": "Appellate Form 2",
    "subtitle": "UCS-APP-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-APP-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsciv001",
    "label": "Civil Form 1",
    "subtitle": "UCS-CIV-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-CIV-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsciv002",
    "label": "Civil Form 2",
    "subtitle": "UCS-CIV-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-CIV-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsfam001",
    "label": "Family Form 1",
    "subtitle": "UCS-FAM-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-FAM-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucsfam002",
    "label": "Family Form 2",
    "subtitle": "UCS-FAM-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-FAM-002",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucssma001",
    "label": "Small Claims Form 1",
    "subtitle": "UCS-SMA-001",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-SMA-001",
    "catalogType": "official"
  },
  {
    "id": "us_ny_form_ucssma002",
    "label": "Small Claims Form 2",
    "subtitle": "UCS-SMA-002",
    "category": "Procedural",
    "jurisdiction": "State",
    "requiresState": true,
    "boundState": "NY",
    "formNumber": "UCS-SMA-002",
    "catalogType": "official"
  }
]

export function getUsCategoryColor(category: string): string {
  const map: Record<string, string> = {
  "Federal": "#1D4ED8",
  "State": "#2563EB",
  "Official": "#0F766E",
  "Civil": "#2563EB",
  "Criminal": "#DC2626",
  "Family": "#059669",
  "Bankruptcy": "#7C3AED",
  "Immigration": "#0891B2",
  "Tax": "#CA8A04",
  "Employment": "#EA580C",
  "Administrative": "#65A30D",
  "IP": "#0284C7",
  "Constitutional": "#9333EA",
  "Probate": "#B45309",
  "Real Estate": "#0D9488",
  "Commercial": "#4F46E5",
  "Procedural": "#6B7280",
  "Other": "#6B7280"
}
  return map[category] ?? '#1D4ED8'
}
