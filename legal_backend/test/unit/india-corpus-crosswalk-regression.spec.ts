import { readFileSync } from 'fs';
import { join } from 'path';
import { SCHEDULE1_CROSSWALK_ROWS } from '@/legal-search/india-section-finder/schedule1-crosswalk.in.generated';

describe('India corpus and Schedule I regression coverage', () => {
  it('keeps BNSS and BNS India Code PDF ingest paths in the manifest', () => {
    const manifestPath = join(
      process.cwd(),
      'corpus/in/india-code/pdf-manifest.map.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      entries: Array<{ registryActId: string; bundledPath: string }>;
    };

    expect(manifest.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ registryActId: 'bnss', bundledPath: 'corpus/in/india-code/bnss.pdf' }),
        expect.objectContaining({ registryActId: 'bns', bundledPath: 'corpus/in/india-code/bns.pdf' }),
      ]),
    );
  });

  it('keeps CrPC trial-track mappings aligned to BNSS chapters', () => {
    const lookup = new Map(
      SCHEDULE1_CROSSWALK_ROWS
        .filter((row) => row.legacyActId === 'crpc')
        .map((row) => [row.legacySection, row.newSection]),
    );

    expect(lookup.get('227')).toBe('250');
    expect(lookup.get('228')).toBe('251');
    expect(lookup.get('229')).toBe('252');
    expect(lookup.get('239')).toBe('262');
    expect(lookup.get('240')).toBe('263');
    expect(lookup.get('241')).toBe('264');
    expect(lookup.get('251')).toBe('274');
    expect(lookup.get('252')).toBe('275');
  });
});
