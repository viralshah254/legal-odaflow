import { canAnalyzeSuppliedDocuments } from './supplied-document-analysis.policy';
describe('source-bound explanation during incomplete external search', () => {
  it('allows explanation of the attached judgment only when a readable document exists', () => {
    expect(canAnalyzeSuppliedDocuments('Explain the attached Arnesh Kumar judgment and actual disposition', 1)).toBe(true);
    expect(canAnalyzeSuppliedDocuments('Explain the attached judgment', 0)).toBe(false);
  });
  it('retains the strict evidence gate for similar-case searches', () => {
    expect(canAnalyzeSuppliedDocuments('Using the attached judgment find similar cases', 1)).toBe(false);
    expect(canAnalyzeSuppliedDocuments('Find cases about arrest', 1)).toBe(false);
  });
});
