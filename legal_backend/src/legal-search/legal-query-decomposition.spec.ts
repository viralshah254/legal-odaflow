import { LegalResearchClassifierService } from '@/ai/legal-research/legal-research-classifier.service';
import { decomposeLegalResearchQuery } from './legal-query-decomposition';

describe('decomposeLegalResearchQuery', () => {
  const classifier = new LegalResearchClassifierService(null as never);

  it('uses the authoritative survey task instead of legacy classifier intent', () => {
    const query =
      'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?';
    const classification = classifier.classify({ query, countryCode: 'IN' });
    const result = decomposeLegalResearchQuery({
      query,
      classification,
      taskKind: 'CASE_SURVEY',
    });

    expect(result.requestedAuthorityTypes).toEqual([
      'CASE_LAW',
      'BINDING_PRECEDENT',
    ]);
  });

  it('preserves intersecting entities, remedies, and requested case authority', () => {
    const query =
      'Compare cases enforcing arbitration clauses in partnership deeds for dissolution and rendition of accounts.';
    const classification = classifier.classify({ query, countryCode: 'IN' });
    const result = decomposeLegalResearchQuery({
      query,
      classification,
      taskKind: 'CASE_SURVEY',
    });

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'partnership', type: 'LEGAL_RELATIONSHIP' }),
      ]),
    );
    expect(result.remedies).toEqual(
      expect.arrayContaining(['dissolution', 'rendition of accounts']),
    );
    expect(result.requestedAuthorityTypes).toEqual(
      expect.arrayContaining(['CASE_LAW', 'BINDING_PRECEDENT']),
    );
    expect(result.issueDecomposition?.[0]?.subIssues).toEqual(
      expect.arrayContaining([
        'availability of dissolution',
        'availability of rendition of accounts',
      ]),
    );
  });

  it('requests adverse and binding authority for an adverse-authority question', () => {
    const query =
      'Identify adverse authority limiting enforcement of an unstamped arbitration agreement.';
    const classification = classifier.classify({ query, countryCode: 'IN' });
    const result = decomposeLegalResearchQuery({ query, classification });

    expect(result.requestedAuthorityTypes).toEqual(
      expect.arrayContaining(['ADVERSE_AUTHORITY', 'BINDING_PRECEDENT']),
    );
  });
});
