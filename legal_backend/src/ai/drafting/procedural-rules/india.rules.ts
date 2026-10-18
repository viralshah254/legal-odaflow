/** Config-driven India procedural routing rules — testable without LLM. */

export interface IndiaProceduralRule {
  id: string;
  matchFacts: RegExp;
  matchKind?: RegExp;
  recommendedKind: string;
  causeTitleVehicle: string;
  governingSections: Array<{ actId: string; section: string; label: string }>;
  note: string;
}

export const INDIA_PROCEDURAL_RULES: IndiaProceduralRule[] = [
  {
    id: 'maintenance-interim-revision',
    matchFacts: /interim maintenance|interim order.*maintenance|maintenance.*interim|crpc\s*125|bnss\s*144|125\s+crpc/i,
    recommendedKind: 'india_maintenance_order_revision',
    causeTitleVehicle: 'CRIMINAL REVISION PETITION',
    governingSections: [
      { actId: 'bnss', section: '144', label: 'BNSS §144 (maintenance)' },
      { actId: 'bnss', section: '438', label: 'BNSS §438 (criminal revision)' },
    ],
    note: 'Interim maintenance orders are typically challenged by criminal revision under BNSS §438, not appeal.',
  },
  {
    id: 'ni138-complaint',
    matchFacts: /cheque bounce|ni act|section\s+138|dishonour of cheque/i,
    recommendedKind: 'india_cheque_bounce_complaint_ni138',
    causeTitleVehicle: 'COMPLAINT UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT',
    governingSections: [{ actId: 'ni_act', section: '138', label: 'NI Act §138' }],
    note: 'Cheque dishonour complaints lie under NI Act §138 — not BNS §138.',
  },
  {
    id: 'stalking-fir',
    matchFacts: /\bstalk(?:ing|s|ed)?\b|cyber.?stalk|repeated(?:ly)?\s+follow/i,
    matchKind: /fir|police|complaint/i,
    recommendedKind: 'india_fir_complaint',
    causeTitleVehicle: 'COMPLAINT FOR REGISTRATION OF FIR',
    governingSections: [
      { actId: 'bns', section: '78', label: 'BNS §78 (stalking)' },
      { actId: 'bnss', section: '173', label: 'BNSS §173 (information in cognizable cases)' },
    ],
    note: 'Stalking FIR uses BNS §78 + BNSS §173 when facts match; do not pin §78 on unrelated FIRs.',
  },
  {
    id: 'theft-fir',
    matchFacts: /\btheft\b|\bstole\b|\bstolen\b/i,
    matchKind: /fir|police|complaint/i,
    recommendedKind: 'india_fir_complaint',
    causeTitleVehicle: 'COMPLAINT FOR REGISTRATION OF FIR',
    governingSections: [
      { actId: 'bns', section: '303', label: 'BNS §303 (theft)' },
      { actId: 'bnss', section: '173', label: 'BNSS §173' },
    ],
    note: 'Theft FIR grounds BNS §303 + BNSS §173 from facts.',
  },
  {
    id: 'dv-pwdva',
    matchFacts: /domestic\s+violence|pwdva|protection\s+of\s+women\s+from\s+domestic/i,
    recommendedKind: 'india_domestic_violence_petition',
    causeTitleVehicle: 'APPLICATION UNDER THE PROTECTION OF WOMEN FROM DOMESTIC VIOLENCE ACT',
    governingSections: [
      { actId: 'pwdva', section: '12', label: 'PWDVA §12' },
      { actId: 'pwdva', section: '18', label: 'PWDVA §18' },
    ],
    note: 'PWDVA petition is a protective-order vehicle — not a generic FIR-only draft.',
  },
  {
    id: 'ndps-bail-bar',
    matchFacts: /ndps|narcotic drugs|ganja|charas|heroin|cocaine|psychotropic/i,
    matchKind: /bail/i,
    recommendedKind: 'india_ndps_bail_application',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [{ actId: 'ndps', section: '37', label: 'NDPS Act §37 (special bail bar)' }],
    note: 'NDPS bail requires satisfaction of twin conditions under §37.',
  },
  {
    id: 'pocso-bail-bar',
    matchFacts: /pocso|minor victim|child sexual|child.*rape/i,
    matchKind: /bail/i,
    recommendedKind: 'india_pocso_bail_application',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [
      { actId: 'pocso', section: '29', label: 'POCSO Act §29 (presumption)' },
      { actId: 'pocso', section: '30', label: 'POCSO Act §30 (culpable mental state)' },
    ],
    note: 'POCSO bail requires attention to statutory presumptions and victim age; do not draft as a generic BNSS bail application.',
  },
  {
    id: 'pmla-bail-bar',
    matchFacts: /pmla|money laundering|enforcement directorate|\bed\b/i,
    matchKind: /bail/i,
    recommendedKind: 'india_pmla_bail_application',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [
      { actId: 'pmla', section: '45', label: 'PMLA §45 (bail conditions)' },
    ],
    note: 'PMLA bail must address §45 conditions; do not draft as a generic BNSS bail application.',
  },
  {
    id: 'murder-bail-sessions',
    matchFacts: /murder|ipc\s*302|bns\s*101|attempt to murder|ipc\s*307|bns\s*109/i,
    matchKind: /bail/i,
    recommendedKind: 'india_regular_bail_bnss_480',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [
      { actId: 'bns', section: '101', label: 'BNS §101 / IPC §302 (murder — verify offence date)' },
      { actId: 'bnss', section: '483', label: 'BNSS §483 (Sessions/High Court bail power)' },
    ],
    note: 'Murder/attempt-murder bail is ordinarily serious Sessions-track litigation; confirm forum and offence date before relying on IPC/BNS successor sections.',
  },
  {
    id: 'rape-bail-sessions',
    matchFacts: /rape|ipc\s*376|bns\s*63/i,
    matchKind: /bail/i,
    recommendedKind: 'india_regular_bail_bnss_480',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [
      { actId: 'bns', section: '63', label: 'BNS §63 / IPC §376 (rape — verify offence date)' },
      { actId: 'bnss', section: '483', label: 'BNSS §483 (Sessions/High Court bail power)' },
    ],
    note: 'Rape bail requires Sessions/High Court forum attention and exact offence-date code selection.',
  },
  {
    id: 'robbery-bail-sessions',
    matchFacts: /robbery|dacoity|ipc\s*392|ipc\s*395|ipc\s*397|bns\s*309|bns\s*310|bns\s*311/i,
    matchKind: /bail/i,
    recommendedKind: 'india_regular_bail_bnss_480',
    causeTitleVehicle: 'BAIL APPLICATION',
    governingSections: [
      { actId: 'bns', section: '309', label: 'BNS §309 (robbery — verify exact subsection/offence date)' },
      { actId: 'bnss', section: '483', label: 'BNSS §483 (Sessions/High Court bail power where forum fits)' },
    ],
    note: 'Robbery/dacoity bail must verify weapon, hurt/grievous hurt, number of accused, and forum before selecting sections.',
  },
  {
    id: 'writ-vs-revision-hint',
    matchFacts: /writ petition|article 226|certiorari|mandamus/i,
    recommendedKind: 'india_writ_petition_hc',
    causeTitleVehicle: 'WRIT PETITION',
    governingSections: [],
    note: 'Writ maintainability depends on forum and alternative remedy — verify before filing.',
  },
];

export function findMatchingIndiaRules(
  facts: string,
  kind: string,
): IndiaProceduralRule[] {
  const factsLower = facts.toLowerCase();
  const kindLower = kind.toLowerCase();
  return INDIA_PROCEDURAL_RULES.filter((rule) => {
    if (!rule.matchFacts.test(factsLower)) return false;
    if (rule.matchKind && !rule.matchKind.test(kindLower)) return false;
    return true;
  });
}
