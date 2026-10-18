import type { SectionFinderEntry } from './section-finder.types';

type TaxActKey = 'income-tax' | 'gst-act' | 'customs-act';

interface TaxActMeta {
  short: string;
  full: string;
  trialCourtLabel: string;
}

const TAX_ACT_META: Record<TaxActKey, TaxActMeta> = {
  'income-tax': {
    short: 'Income-tax Act',
    full: 'Income-tax Act, 1961',
    trialCourtLabel: 'Income Tax Appellate Tribunal (ITAT)',
  },
  'gst-act': {
    short: 'CGST Act',
    full: 'Central Goods and Services Tax Act, 2017',
    trialCourtLabel: 'GST Appellate Authority / GSTAT',
  },
  'customs-act': {
    short: 'Customs Act',
    full: 'Customs Act, 1962',
    trialCourtLabel: 'CESTAT / Commissioner (Appeals)',
  },
};

/**
 * Factory for tax-act curated entries.
 * The id format `${actId.toUpperCase()}-${section}` matches the key generated
 * in SectionFinderService step-1 lookup: `${actId.toUpperCase()}-${sectionToken}`.
 * legacyActId is set to 'other' (the catch-all LegacyActId value) because tax
 * acts do not participate in the IPC→BNS crosswalk; legacyActShort/Full carry
 * the display names.
 */
function taxEntry(
  actId: TaxActKey,
  section: string,
  title: string,
  changeSummary: string,
  penalty: string,
  isCognizable: boolean,
  isBailable: boolean,
  proceduralNote: string,
  sourceRef: string,
  practiceNote?: string,
): SectionFinderEntry {
  const meta = TAX_ACT_META[actId];
  return {
    id: `${actId.toUpperCase()}-${section}`,
    legacyActId: 'other',
    legacyActShort: meta.short,
    legacyActFull: meta.full,
    legacySection: section,
    legacyTitle: title,
    newActId: 'unchanged',
    newActShort: '',
    newActFull: '',
    newSection: section,
    newTitle: title,
    changeType: 'unchanged',
    changeSummary,
    punishment: penalty,
    isCognizable,
    isBailable,
    isCompoundable: false,
    trialCourt: 'special_court',
    trialCourtLabel: meta.trialCourtLabel,
    bailPosture: proceduralNote,
    practiceNote,
    sourceRef,
    transitionDate: '2024-07-01',
    tier: 'enriched',
    isInForce: true,
    effectiveAsOf: '1961-04-01',
    lastVerifiedAt: '2026-06-15',
  };
}

// ── Income-tax Act, 1961 ─────────────────────────────────────────────────────

export const INCOME_TAX_SECTION_FINDER_DATA: SectionFinderEntry[] = [
  taxEntry(
    'income-tax', '59',
    'Profits chargeable to tax',
    'Deals with the computation of profits and gains of business or profession chargeable to income-tax. Governs how business income is determined, including deductions, depreciation, and adjustments for specific industries.',
    'N/A — charging/computation section; penalties for concealment under s.270A',
    false, true,
    'Civil. Disputes on business income computation are adjudicated by AO → CIT(A) → ITAT.',
    'Income-tax Act, 1961, s.59',
    'Section 59 is part of the head "Profits and gains of business or profession" (ss.28–44). Read with ss.28 (charge), 30–43 (deductions), and Rule 6F for presumptive taxation where applicable.',
  ),
  taxEntry(
    'income-tax', '4',
    'Charge of income-tax',
    'Foundational charging section. Income-tax is levied for every assessment year on the total income of every person at the rates provided in the Finance Act (or the Income-tax Act for specified items).',
    'N/A — charging section; no penalty provision',
    false, true,
    'Civil liability. Disputes go to AO → CIT(A) → ITAT → High Court → Supreme Court.',
    'Income-tax Act, 1961, s.4',
    'Every computation of tax liability begins here. AY is the year of assessment; PY is the previous year in which income is earned.',
  ),
  taxEntry(
    'income-tax', '10',
    'Incomes not included in total income (exemptions)',
    'Provides a list of exempt incomes including agricultural income (10(1)), HUF income from impartible estate (10(2)), share of profit from firm (10(2A)), LTA (10(5)), gratuity (10(10)), VRS (10(10C)), insurance maturity (10(10D)), PPF (10(11)), LTCG on listed equity ≤₹1 lakh (10(38) — omitted from AY 2019-20), tribal area income (10(26)), and others.',
    'N/A — exemption provision; no penalty',
    false, true,
    'Civil. AO may disallow exemption claim; appealable to CIT(A), then ITAT.',
    'Income-tax Act, 1961, s.10',
    'Note: s.10(38) LTCG exemption was removed by Finance Act 2018 w.e.f. AY 2019-20; gains above ₹1 lakh on listed equity now taxable under s.112A.',
  ),
  taxEntry(
    'income-tax', '80C',
    'Deduction in respect of life insurance premia, contributions to PPF, ELSS, etc.',
    'Allows deduction of up to ₹1,50,000 per year from gross total income for payments/deposits into qualifying instruments: LIC/insurance premia, PPF, NSC, ELSS, home loan principal repayment, tuition fees, Sukanya Samriddhi, NPS (under 80CCD(1)), etc.',
    'N/A — deduction provision; no penalty',
    false, true,
    'Civil. Available only under old tax regime; not available if taxpayer opts for new concessional regime under s.115BAC.',
    'Income-tax Act, 1961, s.80C',
    'New tax regime (s.115BAC) introduced from AY 2020-21 does not allow this deduction. Effective AY 2024-25, the new regime is the default regime.',
  ),
  taxEntry(
    'income-tax', '80D',
    'Deduction in respect of health insurance premia',
    'Allows deduction for medical insurance premiums paid for self/spouse/dependent children (up to ₹25,000; ₹50,000 for senior citizens) and for parents (additional ₹25,000 or ₹50,000 if parent is senior citizen). Preventive health check-up deduction of up to ₹5,000 included within the overall limit.',
    'N/A — deduction provision; no penalty',
    false, true,
    'Civil. Not available under new tax regime (s.115BAC) without exercising the old-regime option.',
    'Income-tax Act, 1961, s.80D',
    'Premium must be paid by any mode other than cash (except preventive health check-up). Senior citizen limit is ₹50,000 from AY 2019-20.',
  ),
  taxEntry(
    'income-tax', '87A',
    'Rebate of income-tax',
    'Provides a rebate from income-tax for resident individuals. Under old regime: rebate of ₹12,500 if total income does not exceed ₹5,00,000. Under new regime (s.115BAC): rebate of ₹25,000 if total income does not exceed ₹7,00,000.',
    'N/A — rebate provision; no penalty',
    false, true,
    'Civil. The rebate reduces tax liability to nil in the specified income slab; it is not a deduction from income.',
    'Income-tax Act, 1961, s.87A',
    'Finance Act 2023 enhanced the new-regime rebate threshold to ₹7 lakh (₹7,00,000), making the tax liability nil for income up to ₹7 lakh under new regime. Rebate applies before surcharge and cess calculation.',
  ),
  taxEntry(
    'income-tax', '139',
    'Return of income',
    'Obligates specified persons to file returns of income by the due dates. Due date is generally 31 July (non-audit cases) or 31 October (audit cases) of the AY. s.139(1): original return; s.139(5): revised return (by 31 Dec of AY); s.139(8A): updated return within 2 years of end of AY (with additional tax).',
    'Late filing fee: ₹5,000 (₹1,000 if income ≤₹5 lakh) under s.234F',
    false, true,
    'Civil default. Failure to file does not attract prosecution by itself; s.276CC provides criminal liability for wilful failure to furnish return when tax liability exceeds ₹25 lakh.',
    'Income-tax Act, 1961, s.139',
    's.139(8A) updated return allows taxpayers to file or correct returns within 2 assessment years of the relevant AY, subject to additional tax of 25%–50% on aggregate tax and interest.',
  ),
  taxEntry(
    'income-tax', '147',
    'Income escaping assessment',
    'Empowers the AO to reopen a completed assessment if there is reason to believe that income has escaped assessment. Time limits: 3 years from end of AY for income below ₹50 lakh; 10 years where AO has in his possession evidence that income escaping assessment is ₹50 lakh or more. Inserted by Finance Act 2021 replacing old s.147–151 framework.',
    'Reassessment followed by demand, interest, and penalty',
    false, true,
    'Civil. Reassessment proceedings: s.147 notice → AO order → CIT(A) → ITAT → High Court → Supreme Court.',
    'Income-tax Act, 1961, s.147',
    'Finance Act 2021 overhauled the reassessment regime: the old "reason to believe" framework was retained but procedure was consolidated. Section 148A (pre-show-cause inquiry) is now mandatory before issuing a s.148 notice.',
  ),
  taxEntry(
    'income-tax', '148',
    'Issue of notice where income has escaped assessment',
    'The AO must issue a notice under s.148 before reopening an assessment under s.147. Finance Act 2021 added s.148A requiring the AO to conduct an inquiry and give the assessee an opportunity to respond before issuing the s.148 notice.',
    'Reassessment demand with interest under s.234A/B/C; penalty under s.270A if applicable',
    false, true,
    'Civil. The notice itself is not penal; the consequential assessment and penalty are. Assessee can challenge notice validity before ITAT on jurisdictional grounds.',
    'Income-tax Act, 1961, s.148',
    'Crucial to check time limits under s.149 (3/10 years). Notice must be signed by an officer not below the rank of PCIT/CIT for cases exceeding 10 years (s.151).',
  ),
  taxEntry(
    'income-tax', '270A',
    'Penalty for under-reporting and misreporting of income',
    'Replaces s.271(1)(c) (w.e.f. AY 2017-18). Penalty for under-reporting: 50% of tax on under-reported income. Penalty for misreporting (deliberate): 200% of tax on misreported income. Grounds for misreporting: false entry in books, suppression of evidence, failure to record investment, etc.',
    '50% of tax payable on under-reported income; 200% on misreported income',
    false, true,
    'Civil penalty. Imposed by AO; appealable to CIT(A) → ITAT. Immunity from penalty under s.270AA if tax and interest are paid and no appeal is filed.',
    'Income-tax Act, 1961, s.270A',
    's.270AA provides immunity: if assessee pays tax, interest, and does not file an appeal against the assessment order, the AO may grant immunity from penalty under s.270A and from prosecution under s.276C.',
  ),
  taxEntry(
    'income-tax', '276C',
    'Wilful attempt to evade tax',
    'Criminal provision. A person who wilfully attempts in any manner to evade payment of tax, penalty or interest is punishable with rigorous imprisonment and fine. Threshold: if tax sought to be evaded exceeds ₹25 lakh, minimum RI of 6 months up to 7 years; otherwise 3 months to 2 years.',
    'RI 6 months–7 years (tax evaded > ₹25 lakh); RI 3 months–2 years (tax evaded ≤ ₹25 lakh); with fine',
    true, false,
    'Criminal proceedings before Special Court designated under s.280A. Non-bailable. Prosecution requires sanction of the CCIT/PCIT.',
    'Income-tax Act, 1961, s.276C',
    'Prosecution under s.276C requires prior sanction of the Principal Chief Commissioner or Chief Commissioner (s.279). Offence is compoundable under s.279(2) subject to PCIT/CIT approval.',
  ),
];

// ── CGST Act, 2017 ───────────────────────────────────────────────────────────

export const CGST_SECTION_FINDER_DATA: SectionFinderEntry[] = [
  taxEntry(
    'gst-act', '9',
    'Levy and collection of central tax',
    'Foundational charging section. CGST is levied on intra-state supply of goods and services at rates notified by the GST Council (up to 20% under CGST Act). Composition levy under sub-section (3) applies to specified categories. Reverse charge mechanism under sub-section (3) and (4).',
    'N/A — charging section; no penalty',
    false, true,
    'Civil. CGST liability arises at the time of supply per s.12/13. Demand for non-payment is raised under s.73 (non-fraud) or s.74 (fraud).',
    'CGST Act, 2017, s.9',
    'CGST + SGST/UTGST together make up GST on intra-state supplies. IGST applies on inter-state supplies. Import of services subject to reverse charge (RCM) under s.9(3).',
  ),
  taxEntry(
    'gst-act', '16',
    'Eligibility and conditions for taking input tax credit',
    'Allows registered persons to claim ITC on GST paid on inward supplies used for business. Conditions: valid tax invoice/debit note, goods/services received, tax paid by supplier, return filed. ITC disallowed on goods/services listed in s.17(5) (blocked credits). Matching with GSTR-2B/GSTR-3B is essential from FY 2022-23.',
    'Wrongful ITC claim: tax demand + equal penalty under s.122(2)(a)',
    false, true,
    'Civil. ITC reversal demands are raised under s.73/s.74. The Supreme Court in Union of India v. Filco Trade Centre (2022) held that ITC matching is a substantive right, not a concession.',
    'CGST Act, 2017, s.16',
    'Finance Act 2024 amended s.16(4) to provide one-time relief for ITC claims for FYs 2017-18 to 2020-21, allowing claims up to 30 Nov 2021. Time limit under s.16(4) is the earlier of 30 November of the following year or the date of filing of annual return (GSTR-9).',
  ),
  taxEntry(
    'gst-act', '17',
    'Apportionment of credit and blocked credits',
    'Provides rules for apportionment of ITC where supplies are used partly for taxable and partly for exempt/personal purposes. Sub-section (5) lists blocked credits where ITC is not available: motor vehicles (subject to exceptions), food/beverages, club membership, works contract (for immovable property), goods/services for personal consumption, goods lost/stolen/destroyed.',
    'Wrongful ITC claim on blocked items: demand equal to ITC wrongly availed + penalty',
    false, true,
    'Civil. Blocked credits under s.17(5) are absolute disallowances; no ITC even if tax was paid. Key litigation area — especially on construction contracts and motor vehicles.',
    'CGST Act, 2017, s.17(5)',
    'Exception under s.17(5)(a)(ii): ITC on motor vehicles is available if they are used for transportation of persons with seating capacity > 12, or for further supply of such vehicles, or for transportation of goods.',
  ),
  taxEntry(
    'gst-act', '73',
    'Determination of tax not paid or short paid (non-fraud)',
    'Empowers the proper officer to issue a show-cause notice (SCN) and pass an order determining tax not paid/short paid/erroneously refunded or ITC wrongly availed, in cases not involving fraud, wilful misstatement or suppression. Time limit: SCN within 3 years from due date of return for the financial year; order within 3 months of SCN.',
    'Tax demand + 10% of tax (minimum ₹10,000) as penalty; interest under s.50',
    false, true,
    'Civil adjudication by Proper Officer (Deputy/Assistant Commissioner level). First appeal to Commissioner (Appeals) under s.107, then GSTAT, then High Court.',
    'CGST Act, 2017, s.73',
    'Penalty reduced to 25% of determined tax if paid within 30 days of SCN (s.73(11)). No penalty if tax + interest paid before SCN issuance (s.73(11) proviso).',
  ),
  taxEntry(
    'gst-act', '74',
    'Determination of tax not paid — fraud, wilful misstatement or suppression',
    'Applies where non-payment/short payment is attributable to fraud, wilful misstatement, or suppression of facts. Extended time limit: 5 years from due date of relevant annual return. Penalty is 100% of the tax determined (not a mere 10%).',
    'Tax demand + 100% of tax as penalty; interest under s.50',
    true, false,
    'Civil adjudication escalating to quasi-criminal in nature. Parallel criminal prosecution possible under s.132 for tax evasion above threshold amounts.',
    'CGST Act, 2017, s.74',
    'Penalty can be reduced to 25% if tax + interest + reduced penalty paid within 30 days of SCN (s.74(11)(a)); 50% if paid within 30 days of order. Crossing ₹5 crore threshold in s.74 cases can trigger prosecution under s.132.',
  ),
  taxEntry(
    'gst-act', '132',
    'Punishment for certain offences',
    'Criminal provision for GST evasion. Offences include: supply without invoice, issuance of invoice without supply (fake invoices), availing ITC through fake invoices, collecting but not depositing GST above ₹3 months. Threshold: if tax evaded exceeds ₹5 crore, RI up to 5 years + fine; ₹2–5 crore: up to 3 years; ₹1–2 crore: up to 1 year.',
    'RI up to 5 years + fine (tax evaded > ₹5 crore); RI up to 3 years (₹2–5 crore); RI up to 1 year (₹1–2 crore)',
    true, false,
    'Non-bailable where tax evaded exceeds ₹5 crore. Prosecution before Magistrate of First Class. Prior sanction of Commissioner required under s.132(6).',
    'CGST Act, 2017, s.132',
    'Finance Act 2023 removed s.132(1)(i) offence (wilful misstatement in return) from the list of cognizable/non-bailable offences. Fake invoice cases remain the focus of enforcement under this section.',
  ),
];

// ── Customs Act, 1962 ────────────────────────────────────────────────────────

export const CUSTOMS_SECTION_FINDER_DATA: SectionFinderEntry[] = [
  taxEntry(
    'customs-act', '12',
    'Dutiable goods',
    'Foundational charging section. Customs duty is levied on goods imported into or exported from India at rates specified in the Customs Tariff Act, 1975. Exemptions may be granted by the Central Government by notification under s.25.',
    'N/A — charging section; no penalty',
    false, true,
    'Civil. Duty liability is determined by the proper officer based on the tariff classification and customs valuation rules.',
    'Customs Act, 1962, s.12',
    'Customs duty includes Basic Customs Duty (BCD), IGST on imports (under Customs Tariff Act), Social Welfare Surcharge, and other applicable levies. Dutiable goods are those specified in the Customs Tariff Act.',
  ),
  taxEntry(
    'customs-act', '46',
    'Entry of goods on importation (Bill of Entry)',
    'Requires the importer (or their agent) to present a Bill of Entry in the prescribed form for goods imported by sea, air, or land for home consumption or warehousing. Self-assessment of duty was introduced in 2011. Risk-based examination / faceless assessment through ICEGATE portal.',
    'Late presentation of Bill of Entry: ₹5,000–₹50,000 per day under s.46(3)',
    false, true,
    'Civil compliance requirement. Faceless assessment by National Assessment Centres since 2020. Physical examination only on a risk-basis.',
    'Customs Act, 1962, s.46',
    'Time limit for filing Bill of Entry: within 30 days of arrival (sea), 7 days (air) under s.46(3). Late filing attracts interest-like charge under s.47(2). ICEGATE portal is the primary interface for import compliance.',
  ),
  taxEntry(
    'customs-act', '111',
    'Confiscation of improperly imported goods',
    'Provides for confiscation of goods that are imported contrary to any prohibition under the Customs Act or any other Act. Includes goods imported without a valid licence, by misdeclaration, or with counterfeit marks. Owner may redeem confiscated goods on payment of redemption fine under s.125 (option to pay fine in lieu of confiscation).',
    'Confiscation of goods; redemption fine under s.125 (in lieu of confiscation)',
    true, false,
    'Quasi-criminal adjudication. Show-cause notice by customs officer → adjudication order → Commissioner (Appeals) → CESTAT → High Court. Confiscation order is separate from criminal prosecution under s.135.',
    'Customs Act, 1962, s.111',
    'Even where goods are confiscated, the importer can apply for redemption by paying a fine (not exceeding the market value of goods minus the duty payable). Confiscation proceedings and criminal prosecution under s.135 can run simultaneously.',
  ),
  taxEntry(
    'customs-act', '135',
    'Evasion of duty or prohibitions',
    'Criminal provision. Any person who, in relation to any goods, does/omits anything contrary to the Customs Act or abets another in doing so with intent to evade duty is punishable. Where market value exceeds ₹20 crore or goods are prohibited: RI 1–7 years + fine. Other cases: RI up to 3 years or fine or both.',
    'RI 1–7 years + fine (value > ₹20 crore or prohibited goods); RI up to 3 years or fine (other cases)',
    true, false,
    'Non-bailable where value exceeds ₹20 crore or goods are prohibited. Cognizable offence. Prosecution before Magistrate of First Class. Prior sanction of customs officer of gazetted rank required.',
    'Customs Act, 1962, s.135',
    'Offences under this section are cognizable (DRI/Customs can arrest without warrant in specified cases under s.104). Arrested persons must be produced before a Magistrate within 24 hours. Bail governed by CrPC/BNSS. Offences compoundable under s.137.',
  ),
];

export const TAX_ACTS_SECTION_FINDER_DATA: SectionFinderEntry[] = [
  ...INCOME_TAX_SECTION_FINDER_DATA,
  ...CGST_SECTION_FINDER_DATA,
  ...CUSTOMS_SECTION_FINDER_DATA,
];
