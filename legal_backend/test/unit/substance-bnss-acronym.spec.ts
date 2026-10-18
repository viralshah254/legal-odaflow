import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';

describe('SubstanceVerificationService BNSS/BNS acronyms', () => {
  let service: SubstanceVerificationService;

  beforeEach(() => {
    service = new SubstanceVerificationService();
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
