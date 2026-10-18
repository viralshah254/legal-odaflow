import {
  DEFAULT_PRIVACY_ASSESSMENT,
  evaluatePrivacyAssessment,
} from './privacy-controls';

describe('Kenya privacy controls', () => {
  it('blocks unresolved residency, transfer, and sensitive-data requirements', () => {
    const status = evaluatePrivacyAssessment({
      countryCode: 'KE',
      dataRegion: null,
      assessment: { ...DEFAULT_PRIVACY_ASSESSMENT },
    });

    expect(status.processingAllowed).toBe(false);
    expect(status.trainingAllowed).toBe(false);
    expect(status.integrationsAllowed).toBe(false);
    expect(status.blockers).toEqual(
      expect.arrayContaining([
        'SENSITIVE_DATA_UNASSESSED',
        'TRANSFER_UNASSESSED',
        'RESIDENCY_UNCONFIRMED',
        'DATA_REGION_NOT_PERMITTED',
      ]),
    );
  });

  it('allows processing after no-transfer and no-sensitive-data answers are documented', () => {
    const status = evaluatePrivacyAssessment({
      countryCode: 'KE',
      dataRegion: 'af-south-1',
      assessment: {
        sensitiveDataHandled: false,
        crossBorderTransfers: false,
        transferSafeguard: 'NOT_APPLICABLE',
        residencyConfirmed: true,
        dpiaCompleted: false,
      },
    });

    expect(status.status).toBe('READY');
    expect(status.blockers).toEqual([]);
    expect(status.trainingAllowed).toBe(true);
  });

  it('requires both a DPIA and a documented safeguard for high-risk transfers', () => {
    const unresolved = evaluatePrivacyAssessment({
      countryCode: 'KE',
      dataRegion: 'af-south-1',
      assessment: {
        sensitiveDataHandled: true,
        crossBorderTransfers: true,
        transferSafeguard: 'UNASSESSED',
        residencyConfirmed: true,
        dpiaCompleted: false,
      },
    });
    expect(unresolved.blockers).toEqual(
      expect.arrayContaining([
        'SENSITIVE_DATA_DPIA_REQUIRED',
        'TRANSFER_SAFEGUARD_REQUIRED',
      ]),
    );

    const resolved = evaluatePrivacyAssessment({
      countryCode: 'KE',
      dataRegion: 'af-south-1',
      assessment: {
        sensitiveDataHandled: true,
        crossBorderTransfers: true,
        transferSafeguard: 'CONTRACTUAL_SAFEGUARDS',
        residencyConfirmed: true,
        dpiaCompleted: true,
      },
    });
    expect(resolved.processingAllowed).toBe(true);
  });
});
