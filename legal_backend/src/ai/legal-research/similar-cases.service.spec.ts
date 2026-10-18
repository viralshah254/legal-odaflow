import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { SimilarCasesService } from './similar-cases.service';

describe('SimilarCasesService', () => {
  const service = new SimilarCasesService();
  const query =
    'What are similar cases where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?';
  const authority = (
    id: string,
    title: string,
    summary: string,
  ): RetrievedAuthority => ({
    id,
    title,
    citation: `(2020) ${id.length} SCC 1`,
    sourceName: 'Supreme Court e-SCR',
    summary: `${summary} Official e-SCR excerpt recorded for quotation and source verification of the reported judgment. `,
    sourceUrl: `https://scr.sci.gov.in/judgment/${id}`,
    sourceTier: 'case_law',
    authorityType: 'CASE',
  });

  it('returns only directly relevant cases and does not pad to three', () => {
    const result = service.extractAndRank(
      [
        authority(
          'direct',
          'Partner A v. Partner B',
          'The court enforced the arbitration clause in the parties partnership deed.',
        ),
        authority(
          'adjacent',
          'Company A v. Company B',
          'A non-signatory was bound to an arbitration agreement.',
        ),
        authority(
          'unrelated',
          'Landlord v. Tenant',
          'The court ordered eviction for rent arrears.',
        ),
      ],
      query,
      'IN',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.authorityId).toBe('direct');
  });
});
