import { KenyaLawQueryBuilderService } from './kenya-law-query-builder.service';

describe('KenyaLawQueryBuilderService', () => {
  const service = new KenyaLawQueryBuilderService();

  it('builds citation-aware and court-aware queries', () => {
    const plan = service.build({
      query: 'unfair dismissal under Employment Act [2024] KEELRC 12',
      countryCode: 'KE',
      legalDomain: 'EMPLOYMENT',
      jurisdiction: 'ELRC',
      legalIssues: ['unfair dismissal'],
      statuteSections: ['Employment Act s.45'],
    });

    expect(plan.caseLawQuery).toContain('KEELRC');
    expect(plan.allQueries.some((q) => /Employment Act/i.test(q))).toBe(true);
    expect(plan.bindingQuery.toLowerCase()).toContain('kesc');
  });

  it('extracts party-name queries', () => {
    const plan = service.build({
      query: 'Giella v Cassman Brown injunction principles',
      countryCode: 'KE',
    });
    expect(plan.allQueries.some((q) => /Giella/i.test(q) && /Cassman/i.test(q))).toBe(true);
  });

  it('builds relaxation tiers', () => {
    const tiers = service.buildRelaxationTiers({
      query: 'constitutional petition Article 47',
      countryCode: 'KE',
      doctrines: ['fair administrative action'],
    });
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[0].tier).toBe('exact');
  });

  it('adds CRB / DPA / digital credit phrases for Aisha-class facts', () => {
    const plan = service.build({
      query:
        'Aisha Kamau fraudulent digital loan listed on CRB without consent Kenya Safaricom',
      countryCode: 'KE',
    });
    const blob = plan.allQueries.join('\n');
    expect(plan.statuteQuery).toMatch(/Data Protection Act/i);
    expect(blob).toMatch(/credit reference bureau|CRB/i);
    expect(blob).toMatch(/Data Protection Act/i);
    expect(blob).toMatch(/digital credit|digital loan/i);
  });
});
