import { PropositionEntailmentService } from './proposition-entailment.service';

describe('PropositionEntailmentService', () => {
  const service = new PropositionEntailmentService();

  it('returns SUPPORTED for strong token overlap', () => {
    const claim =
      'Bail requires assessing flight risk, witness tampering, antecedents, and gravity of accusation.';
    const passage =
      'The court held that bail requires assessing flight risk, witness tampering, antecedents, and gravity of accusation before grant.';
    expect(service.assess(claim, [passage])).toBe('SUPPORTED');
  });

  it('fails closed to INDETERMINATE when passages are empty', () => {
    expect(service.assess('Bail depends on flight risk.', [])).toBe('INDETERMINATE');
  });

  it('returns CONTRADICTED/UNSUPPORTED for unrelated passage (fail-closed)', () => {
    const support = service.assess('Bail depends on flight risk and witness tampering.', [
      'Stamp duty is payable on conveyance deeds under the Stamp Act.',
    ]);
    expect(['UNSUPPORTED', 'CONTRADICTED']).toContain(support);
  });

  it('recognises legal paraphrases through deterministic concept signals', () => {
    expect(
      service.assess('The judge must consider whether the accused may abscond or influence witnesses.', [
        'Release on bail depends on flight risk and the likelihood of witness tampering.',
      ]),
    ).toBe('PARTIAL');
  });

  it('does not let a high semantic score override contradictory modality', () => {
    const semanticService = new PropositionEntailmentService({ score: () => 0.99 });
    expect(
      semanticService.assess('Bail is mandatory and the court has no discretion.', [
        'Bail is not mandatory; the court retains discretion in each case.',
      ]),
    ).toBe('CONTRADICTED');
  });

  it('uses a calibrated semantic score only alongside grounded lexical evidence', () => {
    const semanticService = new PropositionEntailmentService({ score: () => 0.95 });
    expect(
      semanticService.assess('Bail depends on risk of absconding and interference with witnesses.', [
        'Release requires consideration of flight risk and witness tampering.',
      ]),
    ).toBe('SUPPORTED');
  });
});
