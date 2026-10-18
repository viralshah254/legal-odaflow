import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';
import { AuthorityIdentityService } from './authority-identity.service';

describe('AuthorityIdentityService', () => {
  const pack = new LegalEvidencePackService().buildFromAuthorities({
    jurisdiction: 'IN',
    authorities: [
      {
        id: 'case_1',
        title: 'State v. Arjun Singh',
        citation: '(2024) 1 SCC 101',
        sourceName: 'Supreme Court of India',
        sourceTier: 'case_law',
        summary: 'A bail decision.',
      },
    ],
    matterFacts: [],
  });

  it('matches normalized reporter citations and title variants', () => {
    const service = new AuthorityIdentityService();
    expect(
      service.resolveFromPack(
        { title: 'State versus Arjun Singh', citation: '2024 1 S.C.C. 101' },
        pack,
      ),
    ).toEqual(expect.objectContaining({ authorityId: 'case_1', state: 'PASS' }));
  });

  it('accepts only high-confidence semantic matches to pack records', () => {
    const service = new AuthorityIdentityService({
      match: () => ({ authorityId: 'case_1', confidence: 0.91 }),
    });
    expect(
      service.resolveFromPack({ title: 'Arjun bail matter' }, pack),
    ).toEqual(expect.objectContaining({ authorityId: 'case_1', state: 'PASS' }));
  });

  it('keeps uncertain semantic identity indeterminate', () => {
    const service = new AuthorityIdentityService({
      match: () => ({ authorityId: 'case_1', confidence: 0.8 }),
    });
    expect(
      service.resolveFromPack({ title: 'Possibly related matter' }, pack),
    ).toEqual(expect.objectContaining({ authorityId: 'case_1', state: 'INDETERMINATE' }));
  });

  it('does not accept a hallucinated semantic authority outside the pack', () => {
    const service = new AuthorityIdentityService({
      match: () => ({ authorityId: 'invented_case', confidence: 1 }),
    });
    expect(service.resolveFromPack({ title: 'Invented case' }, pack).state).toBe('FAIL');
  });
});
