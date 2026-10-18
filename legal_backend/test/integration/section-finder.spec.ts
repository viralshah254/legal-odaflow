import { SECTION_FINDER_DATA, SECTION_FINDER_INDEX, SECTION_FINDER_STATS } from '@/legal-search/india-section-finder/section-finder.index';
import { IN_SECTION_REMAPS } from '@/legal-search/statute-registry/section-remap.in';
import { LAW_CURRENCY_CUTOFF } from '@/legal-search/india-section-finder/section-finder.types';
import { findAmendmentOverlay } from '@/legal-search/india-section-finder/amendments-through-2026-06.in';

describe('India Section Finder data layer', () => {
  it('has 350+ crosswalk index entries', () => {
    expect(SECTION_FINDER_STATS.total).toBeGreaterThanOrEqual(350);
    expect(SECTION_FINDER_STATS.crosswalk).toBeGreaterThanOrEqual(300);
  });

  it('has full Schedule I remap table', () => {
    expect(IN_SECTION_REMAPS.length).toBeGreaterThanOrEqual(300);
  });

  it('resolves IPC 302 to BNS 101 without conflict', () => {
    const entry = SECTION_FINDER_INDEX.get('IPC-302');
    expect(entry).toBeDefined();
    expect(entry?.newSection).toBe('101');
    const remap = IN_SECTION_REMAPS.find(r => r.from.actId === 'ipc' && r.from.section === '302');
    expect(remap?.to.section).toBe('101');
  });

  it('resolves IPC 304 to BNS 103 without conflict', () => {
    const entry = SECTION_FINDER_INDEX.get('IPC-304');
    expect(entry?.newSection).toBe('103');
    const remap = IN_SECTION_REMAPS.find(r => r.from.actId === 'ipc' && r.from.section === '304');
    expect(remap?.to.section).toBe('103');
  });

  it('has single IPC 420 entry mapping to BNS 318(4)', () => {
    const all420 = SECTION_FINDER_DATA.filter(e => e.legacyActId === 'ipc' && e.legacySection === '420');
    expect(all420).toHaveLength(1);
    expect(all420[0].newSection).toBe('318(4)');
  });

  it('classifies IPC 124A as omitted with related BNS 152 successor', () => {
    const entry = SECTION_FINDER_INDEX.get('IPC-124A');
    expect(entry).toBeDefined();
    expect(entry?.changeType).toBe('omitted');
    expect(entry?.isInForce).toBe(false);
    expect(entry?.changeSummary.toLowerCase()).toContain('omitted');
    expect(entry?.successorSection).toBe('152');
    expect(entry?.punishment).toContain('Not applicable');
  });

  it('includes at least 5 Schedule I omitted rows', () => {
    const omitted = SECTION_FINDER_DATA.filter(
      e => e.legacyActId === 'ipc' && e.changeType === 'omitted',
    );
    expect(omitted.length).toBeGreaterThanOrEqual(5);
    for (const row of omitted.slice(0, 5)) {
      expect(row.isInForce).toBe(false);
      expect(row.changeSummary.toLowerCase()).toMatch(/omitted|no longer in force/);
    }
  });

  it('includes POCSO, NDPS, PMLA curated entries', () => {
    expect(SECTION_FINDER_INDEX.get('POCSO-4')).toBeDefined();
    expect(SECTION_FINDER_INDEX.get('NDPS-20')).toBeDefined();
    expect(SECTION_FINDER_INDEX.get('PMLA-45')).toBeDefined();
    expect(SECTION_FINDER_STATS.specialActs).toBeGreaterThanOrEqual(50);
  });

  it('includes NI Act 138, 141, 142, 143', () => {
    for (const s of ['138', '141', '142', '143']) {
      expect(SECTION_FINDER_INDEX.get(`NI_ACT-${s}`)).toBeDefined();
    }
  });

  it('exposes law currency cutoff June 2026', () => {
    expect(LAW_CURRENCY_CUTOFF).toBe('2026-06-30');
  });

  it('has amendment overlay for BNS 106 commencement-pending', () => {
    const overlay = findAmendmentOverlay('bns', '106');
    expect(overlay?.changeType).toBe('commencement_pending');
  });

  it('covers popular chip queries in curated index', () => {
    const chips = [
      'IPC-420', 'IPC-302', 'BNS-318(4)', 'BNS-101', 'IPC-376', 'IPC-498A',
      'BNSS-100', 'CRPC-438', 'CRPC-437', 'NI_ACT-138', 'IEA-65B',
    ];
    for (const key of chips) {
      expect(SECTION_FINDER_INDEX.has(key)).toBe(true);
    }
  });

  it('includes Income-tax Act section 59 (profits chargeable to tax)', () => {
    const entry = SECTION_FINDER_INDEX.get('INCOME-TAX-59');
    expect(entry).toBeDefined();
    expect(entry?.legacySection).toBe('59');
    expect(entry?.legacyTitle).toMatch(/Profits chargeable to tax/i);
    expect(entry?.legacyActShort).toBe('Income-tax Act');
  });
});

describe('US Section Finder cross-reference (see section-finder-us.spec.ts)', () => {
  it('includes plan priority lookups in curated index', () => {
    const { US_SECTION_FINDER_BY_ACT } = require('@/legal-search/us-section-finder/us-section-finder.index');
    expect(US_SECTION_FINDER_BY_ACT.get('flsa:207')).toBeDefined();
    expect(US_SECTION_FINDER_BY_ACT.get('bankruptcy-code:362')).toBeDefined();
    expect(US_SECTION_FINDER_BY_ACT.get('ca-penal-code:187')).toBeDefined();
  });
});
