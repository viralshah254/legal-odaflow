import { buildLegalResearchProfile, domainAnchors } from './legal-domain-profile';

describe('legal-domain-profile', () => {
  it('derives India domain anchors from statute registry entries', () => {
    const profile = buildLegalResearchProfile({
      countryCode: 'IN',
      domains: ['EMPLOYMENT'],
    });

    expect(profile.statuteAnchors.map((statute) => statute.id)).toEqual(
      expect.arrayContaining(['industrial-disputes', 'sexual-harassment-act']),
    );
    expect(domainAnchors('EMPLOYMENT')).toEqual(
      expect.arrayContaining(['Industrial Disputes Act 1947', 'POSH Act 2013']),
    );
  });

  it('adds the registry-backed partnership anchor at an arbitration intersection', () => {
    const profile = buildLegalResearchProfile({
      countryCode: 'IN',
      domains: ['ARBITRATION'],
      entities: ['partnership agreement'],
    });

    expect(profile.statuteAnchors.map((statute) => statute.id)).toEqual(
      expect.arrayContaining(['partnership-act', 'arbitration-act']),
    );
  });

  it('keeps profiles jurisdiction-aware', () => {
    const profile = buildLegalResearchProfile({
      countryCode: 'US',
      domains: ['EMPLOYMENT'],
    });

    expect(profile.countryCode).toBe('US');
    expect(profile.statuteAnchors.every((statute) => statute.countryCode === 'US')).toBe(true);
    expect(profile.statuteAnchors.map((statute) => statute.id)).not.toContain(
      'industrial-disputes',
    );
  });

  it('prefers Kenya statutes for Kenya domain profiles', () => {
    const employment = buildLegalResearchProfile({
      countryCode: 'KE',
      domains: ['EMPLOYMENT'],
    });
    const property = buildLegalResearchProfile({
      countryCode: 'KE',
      domains: ['PROPERTY'],
    });

    expect(employment.statuteAnchors.slice(0, 2).map((statute) => statute.id)).toEqual([
      'employment-act-2007',
      'labour-relations-act',
    ]);
    expect(property.statuteAnchors.map((statute) => statute.id)).toEqual(
      expect.arrayContaining(['land-act-2012', 'land-registration-act']),
    );
    expect([...employment.statuteAnchors, ...property.statuteAnchors]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ countryCode: 'KE' }),
      ]),
    );
  });
});
