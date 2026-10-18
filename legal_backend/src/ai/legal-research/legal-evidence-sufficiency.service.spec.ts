import { LegalEvidenceSufficiencyService } from './legal-evidence-sufficiency.service';

describe('LegalEvidenceSufficiencyService', () => {
  const service = new LegalEvidenceSufficiencyService();
  const query =
    'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?';

  it('does not treat an adjacent non-signatory arbitration case as issue coverage', () => {
    const result = service.evaluate({
      query,
      authorities: [
        {
          id: 'cheran',
          title: 'Cheran Properties Ltd. v. Kasturi and Sons Ltd.',
          citation: '(2018) 16 SCC 413',
          sourceTier: 'case_law',
          summary: 'Whether a non-signatory may be bound under the group of companies doctrine.',
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.criticalGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ missingDimension: 'BINDING_AUTHORITY' }),
      ]),
    );
  });

  it('recognises a partnership-deed arbitration judgment as application support', () => {
    const result = service.evaluate({
      query,
      threshold: 50,
      taskKind: 'CASE_SURVEY',
      authorities: [
        {
          id: 'partnership-arbitration',
          title: 'Supreme Court decision on arbitration under a partnership deed',
          citation: 'verified citation',
          sourceTier: 'case_law',
          summary:
            'The partners disputed enforcement of the arbitration clause in their partnership agreement.',
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.coverage.issues[0]?.bindingAuthorityCovered).toBe(true);
    expect(result.criticalGaps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ missingDimension: 'CURRENT_TREATMENT' }),
      ]),
    );
  });

  it('does not treat Kenya Law search snippets as complete evidence', () => {
    const result = service.evaluate({
      query: 'Was termination without a hearing unfair under the Employment Act in Kenya?',
      jurisdiction: 'KE',
      threshold: 50,
      authorities: [
        {
          id: 'ke-employment',
          title: 'Kenya employment termination hearing decision',
          citation: '[2025] KEELRC 12 (KLR)',
          sourceTier: 'case_law',
          sourceName: 'Kenya Law',
          summary: 'The court considered termination without an employment hearing.',
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.coverage.issues[0]?.fullTextCovered).toBe(false);
    expect(result.criticalGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ missingDimension: 'COMPLETENESS' }),
      ]),
    );
  });

  it('accepts fetched Kenya Law judgment text as complete evidence', () => {
    const result = service.evaluate({
      query: 'Was termination without a hearing unfair under the Employment Act in Kenya?',
      jurisdiction: 'KE',
      threshold: 50,
      authorities: [
        {
          id: 'ke-employment',
          title: 'Kenya employment termination hearing decision',
          citation: '[2025] KEELRC 12 (KLR)',
          sourceTier: 'case_law',
          sourceName: 'Kenya Law',
          summary: 'The court considered termination without an employment hearing.',
          fullText:
            'The court considered termination without a hearing under the Employment Act. '.repeat(
              3,
            ),
        },
      ],
    });

    expect(result.coverage.issues[0]?.fullTextCovered).toBe(true);
    expect(result.criticalGaps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ missingDimension: 'COMPLETENESS' }),
      ]),
    );
  });
});
