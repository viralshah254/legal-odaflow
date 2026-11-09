jest.mock('fs', () => ({
  existsSync: () => true,
  readFileSync: () => JSON.stringify({ generatedAt: '', acts: { sample: {
    manifestActId: 'sample', sourcePdf: 'sample.pdf', coverage: 'EXTRACTED_READABLE_PROVISIONS', sectionCount: 1,
    structure: { sections: { count: 1, ids: ['1'] }, orders: { count: 1, ids: ['I'] }, schedules: { count: 1, ids: ['1'] } },
  } } }),
}));
import { isProvisionIdValid } from './act-structure.loader';

describe('bundled provision coverage', () => {
  it.each(['2', 'order-II', 'schedule-2'])('reports %s as an extraction gap without asserting nonexistent law', key => {
    const result = isProvisionIdValid('sample', key);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('unavailable in the bundled source extraction');
    expect(result.message).not.toContain('does not exist');
  });
  it.each(['1', 'order-I', 'schedule-1'])('accepts present provision %s', key => {
    expect(isProvisionIdValid('sample', key).valid).toBe(true);
  });
});
