/**
 * Derives full Schedule I remap table from generated crosswalk.
 */
import { SCHEDULE1_CROSSWALK_ROWS } from '../india-section-finder/schedule1-crosswalk.in.generated';
import { SectionRemapEntry } from './types';

const HAND_CURATED: SectionRemapEntry[] = [
  {
    from: { actId: 'ipc', section: '302' },
    to: { actId: 'bns', section: '101' },
    note: 'Murder — punishment',
  },
  {
    from: { actId: 'ipc', section: '304' },
    to: { actId: 'bns', section: '103' },
    note: 'Culpable homicide not amounting to murder',
  },
  {
    from: { actId: 'ipc', section: '420' },
    to: { actId: 'bns', section: '318(4)' },
    note: 'Cheating and dishonestly inducing delivery of property',
  },
];

function fromCrosswalk(): SectionRemapEntry[] {
  const entries: SectionRemapEntry[] = [];
  const seen = new Set<string>();
  for (const row of SCHEDULE1_CROSSWALK_ROWS) {
    if (row.changeType === 'omitted' || !row.newSection || row.newActId === 'unchanged') continue;
    const key = `${row.legacyActId}:${row.legacySection}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      from: { actId: row.legacyActId, section: row.legacySection },
      to: { actId: row.newActId, section: row.newSection },
      note: row.legacyTitle,
    });
  }
  return entries;
}

const merged = new Map<string, SectionRemapEntry>();
for (const e of [...fromCrosswalk(), ...HAND_CURATED]) {
  merged.set(`${e.from.actId}:${e.from.section}`, e);
}

/** India new-code section remaps (legacy act → BNS/BNSS/BSA). Full Schedule I set. */
export const IN_SECTION_REMAPS: SectionRemapEntry[] = [...merged.values()];
