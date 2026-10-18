import { KenyaGazetteEventExtractorService } from './kenya-gazette-event-extractor.service';

describe('KenyaGazetteEventExtractorService', () => {
  const extractor = new KenyaGazetteEventExtractorService();

  it('extracts a commencement event but keeps it in review without an affected work URI', () => {
    const [event] = extractor.extract({
      text: 'LEGAL NOTICE NO. 12. The Act shall come into operation on 1 August 2026.',
      sourceConfidence: 0.99,
    });

    expect(event.eventType).toBe('COMMENCEMENT');
    expect(event.effectiveDate?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(event.requiresHumanReview).toBe(true);
  });

  it('never auto-accepts low-confidence OCR', () => {
    const [event] = extractor.extract({
      text: 'akn/ke/act/2024/7 is revoked with effect from 2 July 2026.',
      sourceConfidence: 0.62,
    });

    expect(event.eventType).toBe('REVOCATION');
    expect(event.affectedWorkUris).toEqual(['akn/ke/act/2024/7']);
    expect(event.requiresHumanReview).toBe(true);
  });
});
