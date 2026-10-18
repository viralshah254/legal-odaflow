import { StatuteVersionCheckerService } from './statute-version-checker.service';

describe('StatuteVersionCheckerService', () => {
  const service = new StatuteVersionCheckerService();

  it('flags old-vs-new code risk when query mixes IPC and BNS', () => {
    const result = service.check({
      query: 'is IPC 302 the same as BNS section 103 for murder',
      countryCode: 'IN',
    });
    expect(result.oldVsNewRisk).toBe(true);
    expect(result.detected).toEqual(expect.arrayContaining(['IPC, 1860']));
    expect(result.promptBlock).toContain('STATUTORY VERSION CHECK');
  });

  it('adds tax currency guidance for tax queries', () => {
    const result = service.check({
      query: 'GST rate applicable on legal services',
      countryCode: 'IN',
    });
    expect(result.detected).toEqual(expect.arrayContaining(['Tax (version-sensitive)']));
  });

  it('provides a default block for non-India jurisdictions', () => {
    const result = service.check({ query: 'breach of contract', countryCode: 'US' });
    expect(result.promptBlock).toContain('in-force version');
    expect(result.oldVsNewRisk).toBe(false);
  });
});
