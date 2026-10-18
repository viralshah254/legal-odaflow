import {
  RBI_REGULATION_MANIFEST,
  RbiRegulationConnector,
  isAllowedRbiUrl,
} from './rbi-regulation.connector';

describe('RbiRegulationConnector', () => {
  afterEach(() => jest.restoreAllMocks());

  it('curates verified RBI metadata for customer protection and digital lending', () => {
    expect(RBI_REGULATION_MANIFEST).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title:
            'Customer Protection – Limiting Liability of Customers in Unauthorised Electronic Banking Transactions',
          instrumentNumber: 'DBR.No.Leg.BC.78/09.07.005/2017-18',
          issueDate: '2017-07-06',
          regulator: 'Reserve Bank of India',
        }),
        expect.objectContaining({
          title: 'Reserve Bank of India (Digital Lending) Directions, 2025',
          instrumentNumber: 'DOR.STR.REC.19/21.07.001/2025-26',
          issueDate: '2025-05-08',
        }),
      ]),
    );
    expect(RBI_REGULATION_MANIFEST.every((entry) => isAllowedRbiUrl(entry.sourceUrl))).toBe(true);
  });

  it('strictly allows official HTTPS RBI hosts', () => {
    expect(isAllowedRbiUrl('https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11040')).toBe(
      true,
    );
    expect(isAllowedRbiUrl('http://www.rbi.org.in/example')).toBe(false);
    expect(isAllowedRbiUrl('https://rbi.org.in.evil.example/document')).toBe(false);
    expect(isAllowedRbiUrl('https://evil.example/?next=https://rbi.org.in')).toBe(false);
  });

  it('extracts official HTML and paragraph references', async () => {
    const text = Array.from(
      { length: 8 },
      (_, index) =>
        `<p>${index + 1}. Banks shall maintain controls for unauthorised electronic banking transactions and customer protection.</p>`,
    ).join('');
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(`<html><body>${text}</body></html>`, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const connector = new RbiRegulationConnector();
    const document = await connector.fetchDocument(RBI_REGULATION_MANIFEST[0]);
    expect(document.authorityType).toBe('REGULATION');
    expect(document.fullText).toContain('customer protection');
    expect(document.paragraphReferences[0]).toEqual(
      expect.objectContaining({ paragraph: '1' }),
    );
  });

  it('fails safely when an RBI document cannot be retrieved', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    const result = await new RbiRegulationConnector().fetchCorpus();
    expect(result.documents).toEqual([]);
    expect(result.gaps).toHaveLength(RBI_REGULATION_MANIFEST.length);
    expect(result.gaps[0].entry.sourceUrl).toMatch(/^https:\/\/(?:www\.)?rbi\.org\.in\//i);
  });
});
