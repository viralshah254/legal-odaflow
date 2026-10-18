import { DraftLegalRegisterService } from './draft-legal-register.service';
import { DraftArchetypeRouterService } from './archetypes/draft-archetype-router.service';

describe('DraftLegalRegisterService', () => {
  const service = new DraftLegalRegisterService(new DraftArchetypeRouterService());

  it('blocks Hon\'ble Police Station and non-bailable on stalking FIR', () => {
    const findings = service.evaluate({
      draft: `
To the Hon'ble Police Station
MOST RESPECTFULLY SHOWETH
The offence is non-bailable and the police must arrest the accused.
IPC §354D
`,
      kind: 'india_fir_complaint',
      caseDetails: 'Mr K stalks Ms S. Neighbours. Police complaint.',
      countryCode: 'IN',
      offenceDate: '2025-03-01',
    });
    const ids = findings.map((f) => f.checkId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'register:honble_police',
        'register:court_showeth_on_fir',
        'bailability:stalking_non_bailable',
        'arrest:mandatory_in_fir',
        'code_family:ipc_post_cutoff',
      ]),
    );
  });

  it('blocks NI §138 routed as FIR vehicle', () => {
    const findings = service.evaluate({
      draft: 'Complaint under BNSS §173 for cheque bounce.',
      kind: 'india_fir_complaint',
      caseDetails: 'Cheque bounce NI Act section 138',
      countryCode: 'IN',
    });
    expect(findings.some((f) => f.checkId === 'vehicle:ni138_as_fir')).toBe(true);
  });

  it('blocks us_form_catalog for criminal facts', () => {
    const findings = service.evaluate({
      draft: 'Please investigate the assault.',
      kind: 'us_form_catalog',
      caseDetails: 'Victim of assault and battery seeks criminal complaint',
      countryCode: 'US',
    });
    expect(findings.some((f) => f.checkId === 'us_vehicle:form_catalog_criminal')).toBe(true);
  });
});
