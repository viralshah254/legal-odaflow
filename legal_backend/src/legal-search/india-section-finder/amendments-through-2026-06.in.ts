import type { SectionAmendmentOverlay } from './section-finder.types';

/**
 * Post-July-2024 amendment overlays verified through 30 June 2026.
 * Overlay wins on conflict with curated / Schedule I / corpus results.
 */
export const AMENDMENTS_THROUGH_2026_06: SectionAmendmentOverlay[] = [
  {
    actId: 'bns',
    sectionNumber: '106',
    effectiveAsOf: '2024-07-01',
    lastVerifiedAt: '2026-06-15',
    amendingInstrument: 'BNS, 2023, s.106(2) — notification-dependent commencement',
    changeType: 'commencement_pending',
    summaryDelta:
      'BNS s.106(2) (hit-and-run / failure to report after rash or negligent driving causing death) ' +
      'carries enhanced punishment; operational commencement has been subject to gazette notification. ' +
      'Verify current notification status before relying on the stricter limb.',
    sourceUrl: 'https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BNS2023.pdf',
  },
  {
    actId: 'bnss',
    sectionNumber: '105',
    effectiveAsOf: '2024-07-01',
    lastVerifiedAt: '2026-06-15',
    amendingInstrument: 'BNSS, 2023, s.105',
    changeType: 'amended',
    summaryDelta:
      'Search and seizure may be recorded through audio-video electronic means; ' +
      'read with BNSS investigation procedure amendments effective from 1 July 2024.',
    sourceUrl:
      'https://prsindia.org/files/bills_acts/bills_parliament/2023/Bharatiya_Nagarik_Suraksha_Sanhita,_2023.pdf',
  },
  {
    actId: 'bnss',
    sectionNumber: '176',
    effectiveAsOf: '2024-07-01',
    lastVerifiedAt: '2026-06-15',
    amendingInstrument: 'BNSS, 2023, s.176(3)',
    changeType: 'amended',
    summaryDelta:
      'Forensic examination and videography of scene of crime for offences punishable with 7 years or more.',
  },
  {
    actId: 'pocso',
    sectionNumber: '4',
    effectiveAsOf: '2024-08-01',
    lastVerifiedAt: '2026-06-10',
    amendingInstrument: 'Protection of Children from Sexual Offences (Amendment) Act, 2019',
    changeType: 'amended',
    summaryDelta: 'Aggravated penetrative sexual assault penalties retained; verify latest Rules and Special Courts.',
  },
  {
    actId: 'ndps',
    sectionNumber: '27',
    effectiveAsOf: '2024-01-01',
    lastVerifiedAt: '2026-06-10',
    amendingInstrument: 'NDPS Act as amended; PITNDPS overlay',
    changeType: 'amended',
    summaryDelta: 'Consumption offences — punishment and bail posture subject to quantity and prior conviction.',
  },
  {
    actId: 'pmla',
    sectionNumber: '45',
    effectiveAsOf: '2024-07-01',
    lastVerifiedAt: '2026-06-10',
    amendingInstrument: 'PMLA as amended through Finance Acts',
    changeType: 'amended',
    summaryDelta: 'Bail under s.45 remains twin-test; ED investigation timelines per 2024–2025 jurisprudence.',
  },
  {
    actId: 'constitution',
    sectionNumber: '330A',
    effectiveAsOf: '2026-04-16',
    lastVerifiedAt: '2026-06-10',
    amendingInstrument: '106th Constitutional Amendment Act, 2023',
    changeType: 'inserted',
    summaryDelta:
      "Women's reservation framework (Articles 330A, 332A, 334A) commenced 16 April 2026; " +
      'operational implementation subject to census and delimitation.',
    sourceUrl: 'https://lddashboard.legislative.gov.in/constitution-of-india',
  },
];

const OVERLAY_INDEX = new Map<string, SectionAmendmentOverlay>();
for (const o of AMENDMENTS_THROUGH_2026_06) {
  OVERLAY_INDEX.set(`${o.actId}:${o.sectionNumber.toUpperCase()}`, o);
}

export function findAmendmentOverlay(
  actId: string,
  sectionNumber: string,
): SectionAmendmentOverlay | undefined {
  return OVERLAY_INDEX.get(`${actId}:${sectionNumber.toUpperCase()}`);
}
