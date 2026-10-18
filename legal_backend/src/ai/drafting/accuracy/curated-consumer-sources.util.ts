/**
 * Shared curated consumer / medical-negligence authority bank for sync and unified v3 retrieval.
 */

export interface CuratedConsumerSource {
  id: string;
  title: string;
  citation: string;
  summary: string;
}

export const CURATED_CONSUMER_SOURCE_BANK: CuratedConsumerSource[] = [
  {
    id: 'curated__lucknow_dev_v_mk_gupta_1994',
    title: 'Lucknow Development Authority v. M.K. Gupta',
    citation: '(1994) 1 SCC 243',
    summary:
      'Deficiency in service includes delay, substandard performance, and failure to provide promised amenities. Consumer courts have jurisdiction over public bodies. Compensation can be awarded for mental agony beyond refund.',
  },
  {
    id: 'curated__national_insurance_v_nitin_khandelwal_2008',
    title: 'National Insurance Co. Ltd. v. Nitin Khandelwal',
    citation: '(2008) 11 SCC 259',
    summary:
      'Repudiation of insurance claim without proper investigation amounts to deficiency in service. Insurer cannot repudiate unless breach is fundamental. Consumer forum may award compensation for wrongful repudiation.',
  },
  {
    id: 'curated__ghaziabad_dev_v_balbir_singh_2004',
    title: 'Ghaziabad Development Authority v. Balbir Singh',
    citation: '(2004) 5 SCC 65',
    summary:
      'Compensation for mental agony and harassment is justified in consumer disputes. Consumer courts are not restricted to refund; they can award interest and solatium.',
  },
  {
    id: 'curated__spring_meadows_hospital_v_harjol_ahluwalia_1998',
    title: 'Spring Meadows Hospital v. Harjol Ahluwalia',
    citation: '(1998) 4 SCC 39',
    summary:
      'Medical negligence constitutes deficiency in service under Consumer Protection Act. Parents/guardians can file on behalf of minors. Hospital is vicariously liable for negligence of doctors and staff.',
  },
];

/**
 * Curated consumer research sources — mirrors getCuratedFallbackAuthorities research-memo branch.
 */
export function getCuratedConsumerResearchSources(
  kind: string,
  caseDetails = '',
): CuratedConsumerSource[] {
  const k = kind.toLowerCase();
  const isConsumerResearch =
    k === 'india_legal_research_memo' ||
    k === 'india_consumer_research_memo' ||
    k === 'india_case_strategy_memo' ||
    /consumer.*research_memo|research_memo.*consumer/i.test(k);

  const isConsumerComplaint =
    k === 'india_consumer_complaint' || k === 'india_consumer_medical_negligence';

  if (!isConsumerResearch && !isConsumerComplaint) return [];

  const hay = caseDetails.toLowerCase();
  const wantsInsurance =
    /\b(repudiat|claim\s+deni|denied\s+the\s+claim|wrongful\s+repudiation)\b/i.test(hay) ||
    (/\binsurance\s+claim\b/i.test(hay) && !/\bno\s+insurance\s+claim\b/i.test(hay));
  const medical =
    /\b(medical|negligence|hospital|consent|surgery|gallbladder|cholecystectomy|bile|deficiency\s+in\s+service)\b/i.test(
      hay,
    );

  if (isConsumerComplaint && !isConsumerResearch) {
    if (wantsInsurance) return [...CURATED_CONSUMER_SOURCE_BANK];
    return CURATED_CONSUMER_SOURCE_BANK.filter(
      (a) => a.id !== 'curated__national_insurance_v_nitin_khandelwal_2008',
    );
  }

  let authorities = medical
    ? CURATED_CONSUMER_SOURCE_BANK.filter(
        (a) =>
          a.id === 'curated__spring_meadows_hospital_v_harjol_ahluwalia_1998' ||
          a.id === 'curated__lucknow_dev_v_mk_gupta_1994' ||
          a.id === 'curated__ghaziabad_dev_v_balbir_singh_2004',
      )
    : CURATED_CONSUMER_SOURCE_BANK.slice(0, 2);

  if (wantsInsurance) {
    const insurance = CURATED_CONSUMER_SOURCE_BANK.find(
      (a) => a.id === 'curated__national_insurance_v_nitin_khandelwal_2008',
    );
    if (insurance && !authorities.some((a) => a.id === insurance.id)) {
      authorities = [...authorities, insurance];
    }
  }
  return authorities;
}
