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

  it('does not infer contradiction from an unrelated negative on the same opinion page', () => {
    const result = service.assess('The cases were restored to the docket for further argument on appropriate relief.', ['This disposition makes unnecessary discussion of due process. The cases were restored to the docket for further argument on appropriate relief. No implementation timetable was ordered.']);
    expect(result).not.toBe('CONTRADICTED');
  });

  it('does not oppose a notice rule to its matching longer-notice exception', () => {
    const claim = 'A monthly-paid contract is terminable by either party after twenty-eight days written notice. That default does not apply where the contract requires a longer written notice period.';
    const source = 'A contract not being a contract to perform specific work shall be terminable by either party after twenty-eight days written notice where wages are paid monthly. Subsection (1) shall not apply where the contract provides a greater written notice period.';
    expect(service.assess(claim, [source])).not.toBe('CONTRADICTED');
  });

  it('still rejects an actual contrary rule in a compound claim', () => {
    expect(service.assess('Notice is required. The employee cannot resign.', ['Notice is required. The employee can resign.'])).toBe('CONTRADICTED');
  });

  it('distinguishes a missing notice period from a prohibition on notice', () => {
    expect(service.assess('Notice is prescribed by the employment terms; if no period is prescribed, reasonable notice must be given.', ['The notice period depends on the employment terms and if no period is prescribed, a reasonable time must be given.'])).not.toBe('CONTRADICTED');
    expect(service.assess('No notice is required.', ['Written notice is required.'])).toBe('CONTRADICTED');
  });
  it('does not treat an unrelated negative purpose or an equivalent negative paraphrase as opposition', () => {
    expect(service.assess('The employee must give notice enabling alternative arrangements.', ['The employee must give notice enabling alternative arrangements so that work does not suffer.'])).not.toBe('CONTRADICTED');
    expect(service.assess('A resignation tendered under duress or coercion is not a voluntary act.', ['A resignation must be voluntarily tendered; if tendered on account of duress or coercion, it ceases to be a voluntary act.'])).not.toBe('CONTRADICTED');
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
