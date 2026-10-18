import { normalizeIndiaDraftStatutes } from '@/ai/india-draft/india-draft-statute-normalizer';

describe('normalizeIndiaDraftStatutes', () => {
  const screenshotWrong =
    'The petitioner seeks maintenance under Section 125 of the Code of Criminal Procedure, 1973 ' +
    '(now Section 125 of the Bharatiya Nyaya Sanhita, 2023) for herself and her minor child.';

  it('fixes CrPC §125 maintenance mapped to BNS §125 (screenshot regression)', () => {
    const result = normalizeIndiaDraftStatutes(screenshotWrong, {
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Wife seeking interim maintenance from employed husband',
    });

    expect(result.text).toContain('Section 125 of the Code of Criminal Procedure, 1973');
    expect(result.text).toContain('Section 144 of the Bharatiya Nagarik Suraksha Sanhita, 2023');
    expect(result.text).not.toMatch(/Bharatiya Nyaya Sanhita.*125/i);
    expect(result.corrections.length).toBeGreaterThan(0);
    expect(result.corrections.some((c) => c.source === 'schedule1_crosswalk')).toBe(true);
  });

  it('fixes BNS §125 cited in maintenance context', () => {
    const input =
      'Maintenance is claimable under BNS §125 as the successor to CrPC maintenance provisions.';
    const result = normalizeIndiaDraftStatutes(input, {
      kind: 'india_maintenance_application_bnss_144_family',
      caseDetails: 'Maintenance for wife and children',
    });

    expect(result.text).toMatch(/BNSS\s*§?\s*144/i);
    expect(result.text).not.toMatch(/BNS\s*§?\s*125/i);
  });

  it('does not rewrite BNS §125 outside maintenance context', () => {
    const input = 'The accused is charged under BNS §125 for rash or negligent act endangering life.';
    const result = normalizeIndiaDraftStatutes(input, {
      kind: 'india_criminal_appeal',
      caseDetails: 'Appeal against conviction for endangering life',
    });

    expect(result.text).toContain('BNS §125');
    expect(result.corrections).toHaveLength(0);
  });

  it('is idempotent after first pass', () => {
    const first = normalizeIndiaDraftStatutes(screenshotWrong, {
      kind: 'india_maintenance_application_bnss_144',
    });
    const second = normalizeIndiaDraftStatutes(first.text, {
      kind: 'india_maintenance_application_bnss_144',
    });
    expect(second.text).toBe(first.text);
    expect(second.corrections).toHaveLength(0);
  });

  it('fixes BNS §144 cited for maintenance in divorce petition (screenshot regression)', () => {
    const input =
      'Prayer item 2: maintenance under Section 144 of the Bharatiya Nyaya Sanhita, 2023 for the wife.';
    const result = normalizeIndiaDraftStatutes(input, {
      kind: 'india_divorce_petition_s13',
      caseDetails: 'Wife Neha Mehta seeking divorce and alimony from husband Rohan Mehta',
    });

    expect(result.text).toMatch(/Hindu Marriage Act, 1955/i);
    expect(result.text).not.toMatch(/Bharatiya Nyaya Sanhita.*144/i);
    expect(result.corrections.some((c) => c.from.includes('BNS §144') || c.reason.includes('BNS §144'))).toBe(
      true,
    );
  });
});
