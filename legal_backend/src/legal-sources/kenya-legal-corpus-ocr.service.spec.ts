import { KenyaLegalCorpusOcrService } from './kenya-legal-corpus-ocr.service';

describe('KenyaLegalCorpusOcrService', () => {
  it('marks OCR pages below the automatic law-update threshold', async () => {
    const azureOcr = {
      extractTextFromBuffer: jest.fn().mockResolvedValue('LEGAL NOTICE NO. 1'),
    };
    const service = new KenyaLegalCorpusOcrService(azureOcr as never);

    const pages = await service.extractGazettePages(Buffer.from('pdf'));

    expect(pages[0].extractionMethod).toBe('OCR');
    expect(pages[0].extractionConfidence).toBeLessThan(0.9);
  });
});
