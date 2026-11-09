import { SentenceAuditService } from './sentence-audit.service';

describe('sentence audit evidence requirements', () => {
  const service = new SentenceAuditService();
  it('does not assign perfect coverage to an empty evidence-free answer', () => {
    expect(service.audit({ outputMarkdown: '# Answer', authorities: [] }).coverageRate).toBe(0);
  });
  it('audits legal claims inside bullets and block quotes', () => {
    for (const prefix of ['- ', '> ', '1. ']) {
      const result = service.audit({ outputMarkdown: `${prefix}The court must award damages in every complaint.`, authorities: [] });
      expect(result.coverageRate).toBe(0);
      expect(result.ungroundedCount).toBe(1);
    }
  });
});
