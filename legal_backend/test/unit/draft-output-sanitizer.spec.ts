import { sanitizeDraftOutput } from '@/ai/drafting/draft-output-sanitizer';

describe('draft-output-sanitizer', () => {
  it('strips PASS 2 headers and audit footers', () => {
    const input = `# PASS 2: ENRICHED APPEAL WITH VERIFIED AUTHORITIES

IN THE HIGH COURT OF GUJARAT

**END OF PASS 2: ENRICHED APPEAL WITH VERIFIED AUTHORITIES**`;

    const result = sanitizeDraftOutput(input, { documentClass: 'pleading', kind: 'india_criminal_appeal' });
    expect(result.text).not.toMatch(/PASS 2/i);
    expect(result.text).toContain('HIGH COURT OF GUJARAT');
    expect(result.removedSections).toContain('pass_artefact');
  });

  it('fixes BNSS defined as Nyaya Sanhita', () => {
    const input = '"BNSS" means the Bharatiya Nyaya Sanhita, 2023.';
    const result = sanitizeDraftOutput(input, { kind: 'india_maintenance_order_revision' });
    expect(result.text).toContain('Bharatiya Nagarik Suraksha Sanhita');
    expect(result.removedSections).toContain('bnss_acronym_fix');
  });

  it('removes contract sections from pleadings', () => {
    const input = `CAUSE TITLE

DEFINED TERMS

RECITALS

FACTS`;
    const result = sanitizeDraftOutput(input, { documentClass: 'pleading', kind: 'india_criminal_appeal' });
    expect(result.text).not.toMatch(/DEFINED TERMS/);
    expect(result.text).not.toMatch(/RECITALS/);
    expect(result.text).toContain('FACTS');
  });

  it('replaces Jurisdiction Confirmed language', () => {
    const input = 'Jurisdiction Confirmed: High Court of Gujarat, Civil Appeal';
    const result = sanitizeDraftOutput(input);
    expect(result.text).toContain('Jurisdiction (verified from facts)');
    expect(result.text).not.toContain('Jurisdiction Confirmed');
  });
});
