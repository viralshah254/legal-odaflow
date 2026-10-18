import { DraftFactFidelityService } from './draft-fact-fidelity.service';

describe('DraftFactFidelityService', () => {
  const service = new DraftFactFidelityService();

  it('flags invented CCTV and WhatsApp when not in intake', () => {
    const findings = service.evaluate({
      draft:
        'The accused was seen on CCTV loitering and sent WhatsApp messages causing severe anguish.',
      caseDetails: 'Mr K stalks Ms S. They are neighbours. No relationship.',
    });
    const ids = findings.map((f) => f.checkId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'fact_fidelity:invented:cctv',
        'fact_fidelity:invented:messages',
        'fact_fidelity:invented:mental',
        'fact_fidelity:invented:loitering',
      ]),
    );
  });

  it('marks thin facts and requires date blanks', () => {
    const intake = service.extractIntake('Mr K stalks Ms S neighbours');
    expect(intake.thinFacts).toBe(true);
    const findings = service.evaluate({
      draft: 'The accused stalked the complainant. '.repeat(200),
      caseDetails: 'Mr K stalks Ms S neighbours',
    });
    expect(findings.some((f) => f.checkId === 'fact_fidelity:thin_fact_bloat')).toBe(true);
  });
});
