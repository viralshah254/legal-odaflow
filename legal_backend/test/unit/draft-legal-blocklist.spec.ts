import {
  detectLegalSafetyViolations,
  stripAuditFooters,
  authoritiesOnPointForKind,
} from '@/ai/drafting/draft-legal-blocklist';

describe('draft-legal-blocklist', () => {
  it('detects Article 133 on maintenance revision', () => {
    const violations = detectLegalSafetyViolations({
      draft: 'This appeal is preferred under Article 133 of the Constitution.',
      recommendedKind: 'india_maintenance_order_revision',
      causeTitleVehicle: 'CRIMINAL REVISION PETITION',
    });
    expect(violations.some((v) => v.id === 'article_133_hc_maintenance')).toBe(true);
  });

  it('strips counsel certification footers', () => {
    const { text, stripped } = stripAuditFooters(
      'GROUNDS\n\n## COUNSEL\'S CERTIFICATION\nI certify bona fide grounds.',
    );
    expect(text).not.toContain('COUNSEL');
    expect(stripped).toContain('audit_footer');
  });

  it('checks maintenance authorities on-point', () => {
    expect(
      authoritiesOnPointForKind(
        [{ title: 'BSA s.311 evidence', summary: 'witness examination' }],
        'india_maintenance_order_revision',
        '125 crpc maintenance',
      ),
    ).toBe(false);
    expect(
      authoritiesOnPointForKind(
        [{ title: 'Rajnesh v Neha', summary: 'maintenance under Section 125 CrPC' }],
        'india_maintenance_order_revision',
        '125 crpc maintenance',
      ),
    ).toBe(true);
  });
});
