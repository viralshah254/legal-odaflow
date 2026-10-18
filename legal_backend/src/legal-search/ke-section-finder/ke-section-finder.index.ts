/** Kenya Section Finder constants — official text via Kenya Law (kenyalaw.org). */

export const KE_LAW_CURRENCY_CUTOFF = '2026-08-01';

export const KE_DISCLAIMER =
  'Statute text is sourced from Kenya Law (National Council for Law Reporting). ' +
  'Consolidated point-in-time versions apply. Verify commencement, amendments, and subsidiary legislation ' +
  'against the official Gazette and current Kenya Law expression before filing or advising.';

/** Default popular section queries when no telemetry exists yet. */
export const KE_POPULAR_QUERIES: Array<{ q: string; actId: string; label: string }> = [
  { q: 'Penal Code s.5', actId: 'cap-63', label: 'Penal Code §5' },
  { q: 'Employment Act 2007 s.41', actId: 'employment-act-2007', label: 'Employment Act §41' },
  { q: 'Land Registration Act s.26', actId: 'land-registration-act-2012', label: 'LRA 2012 §26' },
  { q: 'Companies Act 2015 s.2', actId: 'companies-act-2015', label: 'Companies Act §2' },
  { q: 'Constitution Article 47', actId: 'constitution-ke', label: 'Constitution Art. 47' },
  { q: 'Limitation of Actions Act s.4', actId: 'cap-22', label: 'Limitation Act §4' },
];
