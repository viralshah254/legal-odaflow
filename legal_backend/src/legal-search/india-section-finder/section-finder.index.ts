import type { SectionFinderEntry } from './section-finder.types';
import { ENRICHED_SECTION_FINDER_DATA, LITIGATION_PRIORITY_IDS } from './litigation-enriched.in';
import { SCHEDULE1_CROSSWALK_ROWS } from './schedule1-crosswalk.in.generated';
import { SPECIAL_ACTS_SECTION_FINDER_DATA } from './special-acts.in';
import { TAX_ACTS_SECTION_FINDER_DATA } from './tax-acts.in';

const LEGACY_ACT_META: Record<string, { short: string; full: string }> = {
  ipc: { short: 'IPC', full: 'Indian Penal Code, 1860' },
  crpc: { short: 'CrPC', full: 'Code of Criminal Procedure, 1973' },
  iea: { short: 'IEA', full: 'Indian Evidence Act, 1872' },
  ni_act: { short: 'NI Act', full: 'Negotiable Instruments Act, 1881' },
  pocso: { short: 'POCSO', full: 'Protection of Children from Sexual Offences Act, 2012' },
  ndps: { short: 'NDPS', full: 'Narcotic Drugs and Psychotropic Substances Act, 1985' },
  pmla: { short: 'PMLA', full: 'Prevention of Money Laundering Act, 2002' },
  cpc: { short: 'CPC', full: 'Code of Civil Procedure, 1908' },
};

const NEW_ACT_META: Record<string, { short: string; full: string }> = {
  bns: { short: 'BNS', full: 'Bharatiya Nyaya Sanhita, 2023' },
  bnss: { short: 'BNSS', full: 'Bharatiya Nagarik Suraksha Sanhita, 2023' },
  bsa: { short: 'BSA', full: 'Bharatiya Sakshya Adhiniyam, 2023' },
  unchanged: { short: '', full: '' },
};

function hydrateCrosswalkRow(
  row: Omit<
    SectionFinderEntry,
    | 'legacyActShort'
    | 'legacyActFull'
    | 'newActShort'
    | 'newActFull'
    | 'trialCourt'
    | 'trialCourtLabel'
    | 'transitionDate'
  >,
): SectionFinderEntry {
  const la = LEGACY_ACT_META[row.legacyActId] ?? { short: row.legacyActId.toUpperCase(), full: row.legacyActId };
  const na = NEW_ACT_META[row.newActId] ?? { short: '', full: '' };
  const isProcedural = row.legacyActId === 'crpc' || row.newActId === 'bnss';
  return {
    ...row,
    legacyActShort: la.short,
    legacyActFull: la.full,
    newActShort: na.short,
    newActFull: na.full,
    trialCourt: isProcedural ? 'magistrate_first_class' : 'sessions',
    trialCourtLabel: isProcedural ? 'Judicial Magistrate' : 'Court of Session',
    transitionDate: '2024-07-01',
    isInForce: row.isInForce ?? row.changeType !== 'omitted',
  };
}

function upgradeToEnriched(row: SectionFinderEntry): SectionFinderEntry {
  const isProcedural = row.legacyActId === 'crpc' || row.newActId === 'bnss';
  const isEvidence = row.legacyActId === 'iea' || row.newActId === 'bsa';
  const omitted = row.changeType === 'omitted' || row.isInForce === false;
  return {
    ...row,
    tier: 'enriched',
    punishment: omitted
      ? row.punishment
      : isProcedural || isEvidence
        ? 'N/A — procedural / evidence provision'
        : row.punishment,
    bailPosture: omitted
      ? row.bailPosture
      : isProcedural
        ? 'Procedural provision — bail posture depends on substantive offence charged.'
        : row.bailPosture,
    effectiveAsOf: row.effectiveAsOf ?? '2024-07-01',
    lastVerifiedAt: row.lastVerifiedAt ?? '2026-06-15',
  };
}

function mergeSectionFinderData(): SectionFinderEntry[] {
  const byId = new Map<string, SectionFinderEntry>();

  for (const row of SCHEDULE1_CROSSWALK_ROWS) {
    const hydrated = hydrateCrosswalkRow(row);
    byId.set(
      row.id,
      LITIGATION_PRIORITY_IDS.has(row.id) ? upgradeToEnriched(hydrated) : hydrated,
    );
  }

  for (const row of SPECIAL_ACTS_SECTION_FINDER_DATA) {
    byId.set(row.id, row);
  }

  for (const row of TAX_ACTS_SECTION_FINDER_DATA) {
    byId.set(row.id, row);
  }

  for (const row of ENRICHED_SECTION_FINDER_DATA) {
    byId.set(row.id, row);
  }

  return [...byId.values()].sort((a, b) => {
    const actCmp = a.legacyActShort.localeCompare(b.legacyActShort);
    if (actCmp !== 0) return actCmp;
    const na = parseInt(a.legacySection, 10) || 0;
    const nb = parseInt(b.legacySection, 10) || 0;
    return na - nb || a.legacySection.localeCompare(b.legacySection);
  });
}

export const SECTION_FINDER_DATA: SectionFinderEntry[] = mergeSectionFinderData();

export const SECTION_FINDER_INDEX = new Map<string, SectionFinderEntry>();
for (const e of SECTION_FINDER_DATA) {
  SECTION_FINDER_INDEX.set(e.id, e);
  if (e.newActId !== 'unchanged' && e.newActShort && e.newSection) {
    SECTION_FINDER_INDEX.set(`${e.newActShort.toUpperCase()}-${e.newSection.toUpperCase()}`, e);
  }
}

export const SECTION_FINDER_STATS = {
  total: SECTION_FINDER_DATA.length,
  enriched: SECTION_FINDER_DATA.filter(e => e.tier === 'enriched').length,
  crosswalk: SECTION_FINDER_DATA.filter(e => e.tier === 'crosswalk').length,
  omitted: SECTION_FINDER_DATA.filter(e => e.changeType === 'omitted' || e.isInForce === false).length,
  specialActs: SPECIAL_ACTS_SECTION_FINDER_DATA.length,
  taxActs: TAX_ACTS_SECTION_FINDER_DATA.length,
};
