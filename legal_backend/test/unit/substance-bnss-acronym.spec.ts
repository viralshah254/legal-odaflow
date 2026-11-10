import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';

describe('SubstanceVerificationService BNSS/BNS acronyms', () => {
  let service: SubstanceVerificationService;

  beforeEach(() => {
    service = new SubstanceVerificationService();
  });

  it('does not mistake an enactment year or a case reporter for a requested section', () => {
    const result = service.checkBareActSubstance({
      query: 'Under the Kenya Employment Act 2007 explain notice and Kenfreight [2019] KESC 79.',
      outputMarkdown: 'Section 35 concerns notice; section 36 concerns payment in lieu.',
      authorities: [{ id: 'act', title: 'Employment Act 2007', fullText: 'Termination notice and payment in lieu.' }],
      isBareActQuery: true,
    });
    expect(result.warnings.join(' ')).not.toMatch(/Section substitution/);
  });

  it('still rejects replacing an expressly requested section', () => {
    const result = service.checkBareActSubstance({
      query: 'Explain section 35 of the Employment Act 2007',
      outputMarkdown: 'Section 36 concerns payment in lieu.',
      authorities: [{ id: 'act', title: 'Employment Act 2007', fullText: 'Termination notice and payment in lieu.' }],
      isBareActQuery: true,
    });
    expect(result.warnings.join(' ')).toMatch(/Section substitution/);
  });

  it('flags BNSS defined as Bharatiya Nyaya Sanhita', () => {
    const result = service.checkIndiaNiActAndBnss(
      '"BNSS" means the Bharatiya Nyaya Sanhita, 2023.',
    );
    expect(result.passed).toBe(false);
    expect(result.warnings[0]).toMatch(/Nagarik Suraksha/i);
  });

  it('flags BNS defined as Bharatiya Nagarik Suraksha Sanhita', () => {
    const result = service.checkIndiaNiActAndBnss(
      '"BNS" means the Bharatiya Nagarik Suraksha Sanhita, 2023.',
    );
    expect(result.passed).toBe(false);
    expect(result.warnings[0]).toMatch(/Nyaya Sanhita/i);
  });
});
