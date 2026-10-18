import { buildDomainChecklistBlock } from './domain-checklists';

describe('buildDomainChecklistBlock', () => {
  it('prepends Kenya-specific statutes and forum checks', () => {
    const block = buildDomainChecklistBlock('EMPLOYMENT', 'KE');

    expect(block).toContain('DOMAIN RESEARCH CHECKLIST — EMPLOYMENT (KE)');
    expect(block).toContain('Employment Act 2007 ss. 41, 43, 45 and 49');
    expect(block).toContain('ELRC jurisdiction');
  });

  it('does not inject Kenya requirements into another jurisdiction', () => {
    expect(buildDomainChecklistBlock('EMPLOYMENT', 'IN')).not.toContain(
      'ELRC jurisdiction',
    );
  });
});
