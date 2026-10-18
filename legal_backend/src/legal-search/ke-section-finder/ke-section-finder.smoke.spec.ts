/**
 * Smoke coverage for high-traffic Kenya Section Finder query patterns.
 * These assert query routing / act-id resolution conventions used by the UI.
 */
import { KE_STATUTES } from '@/legal-search/statute-registry/ke.statutes';

describe('Kenya Section Finder smoke conventions', () => {
  it('has unique statute registry ids', () => {
    const ids = KE_STATUTES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes Tier-1 Cap / Employment / Constitution acts', () => {
    const byId = new Map(KE_STATUTES.map((s) => [s.id, s]));
    expect(byId.get('cap-63')?.fullName).toMatch(/Penal Code/i);
    expect(byId.get('employment-act-2007')?.fullName).toMatch(/Employment Act/i);
    expect(byId.get('constitution-ke')?.fullName).toMatch(/Constitution/i);
    expect(byId.get('companies-act-2015')?.fullName).toMatch(/Companies Act/i);
  });

  it('maps Cap 63 and Employment Act aliases for finder queries', () => {
    const penal = KE_STATUTES.find((s) => s.id === 'cap-63');
    const employment = KE_STATUTES.find((s) => s.id === 'employment-act-2007');
    expect(penal?.acronyms.some((a) => /cap\.?\s*63|penal code/i.test(a))).toBe(true);
    expect(employment?.acronyms.some((a) => /employment act/i.test(a))).toBe(true);
  });
});
