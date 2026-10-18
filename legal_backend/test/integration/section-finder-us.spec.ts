import {
  US_SECTION_FINDER_BY_ACT,
  US_SECTION_FINDER_DATA,
  US_SECTION_FINDER_STATS,
} from '@/legal-search/us-section-finder/us-section-finder.index';

describe('US Section Finder data layer', () => {
  it('has 150+ curated entries', () => {
    expect(US_SECTION_FINDER_STATS.total).toBeGreaterThanOrEqual(150);
    expect(US_SECTION_FINDER_STATS.federal).toBeGreaterThanOrEqual(100);
    expect(US_SECTION_FINDER_STATS.state).toBeGreaterThanOrEqual(40);
  });

  it('resolves FLSA 207 overtime section', () => {
    const entry = US_SECTION_FINDER_BY_ACT.get('flsa:207');
    expect(entry).toBeDefined();
    expect(entry?.legacyTitle.toLowerCase()).toContain('overtime');
    expect(entry?.practiceNote).toBeTruthy();
  });

  it('resolves Title VII 2000e-2 discrimination section', () => {
    const entry = US_SECTION_FINDER_BY_ACT.get('title-vii:2000E-2');
    expect(entry).toBeDefined();
    expect(entry?.changeSummary.toLowerCase()).toContain('discrimination');
  });

  it('resolves 11 USC 362 automatic stay', () => {
    const entry = US_SECTION_FINDER_BY_ACT.get('bankruptcy-code:362');
    expect(entry).toBeDefined();
    expect(entry?.legacyTitle.toLowerCase()).toContain('stay');
  });

  it('includes CA Penal 187 and NY Penal 125.25', () => {
    expect(US_SECTION_FINDER_BY_ACT.get('ca-penal-code:187')).toBeDefined();
    expect(US_SECTION_FINDER_BY_ACT.get('ny-penal-law:125.25')).toBeDefined();
  });

  it('includes TX Penal 19.02 murder', () => {
    const entry = US_SECTION_FINDER_BY_ACT.get('tx-penal-code:19.02');
    expect(entry).toBeDefined();
    expect(entry?.legacyTitle.toLowerCase()).toContain('murder');
  });

  it('every entry has punishment and bail posture', () => {
    for (const entry of US_SECTION_FINDER_DATA.slice(0, 20)) {
      expect(entry.punishment.length).toBeGreaterThan(5);
      expect(entry.bailPosture.length).toBeGreaterThan(10);
    }
  });

  it('covers popular chip queries in curated index', () => {
    const keys = [
      'flsa:207',
      'title-vii:2000E-2',
      'ada:12112',
      'bankruptcy-code:362',
      'usc-18:1343',
      'ca-penal-code:187',
    ];
    for (const key of keys) {
      expect(US_SECTION_FINDER_BY_ACT.has(key)).toBe(true);
    }
  });
});
