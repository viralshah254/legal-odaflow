import { hydrateOfficialDocument, isOfficialDocumentUrl, parseOfficialPdf, nativeParagraphMarker } from './official-document';
import { SourceIntegrityService } from '@/ai/legal-research/source-integrity.service';

jest.mock('pdf-parse', () => ({ __esModule: true, default: jest.fn(async (_buffer, options) => {
  const texts = _buffer.toString().includes('BROWN') ? ['BROWN v. BOARD OF EDUCATION. 483 Syllabus. BROWN ET AL. v. BOARD OF EDUCATION OF TOPEKA et al. NO. 1. APPEAL Decided May 17, 1954.', 'Opinion of the Court. We therefore hold that segregation denies equal protection. It is so ordered.'] : _buffer.toString().includes('KENYA') ? ['SUPREME COURT OF KENYA - BETWEEN - KENFREIGHT (E.A) LIMITED................APPELLANT AND BENSON K. NGUTI................RESPONDENT', '[ 4 1 ] We find that the statutory remedy governs. The appeal is dismissed. DATED and DELIVERED at NAIROBI this 23 rd Day of July, 201 9.'] : ['SUPREME COURT OF INDIA PETITIONER: Employer Vs. RESPONDENT: Employee DATE OF JUDGMENT 27/07/1990 CITATION: 1990 AIR 1808', 'We therefore hold that the governing notice provision applies. The appeal is dismissed with costs.'];
  for (let i = 0; i < texts.length; i++) await options.pagerender({ pageNumber: i + 1, getTextContent: async () => ({ items: [{ str: texts[i], transform: [0, 0, 0, 0, 0, 1] }] }) });
  return { numpages: 2, text: texts.join('\n\n') };
}) }));

describe('Official document retrieval and integrity', () => {
  it('keeps a reporter year out of paragraph pinpoints', () => {
    expect(nativeParagraphMarker('[1986] 3 SCC 156')).toBeUndefined();
    expect(nativeParagraphMarker('[ 4 1 ] We find that')).toBe('41');
  });
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('rejects lookalikes, cross-country URLs, credentials and private hosts', () => {
    for (const url of ['http://api.sci.gov.in/a.pdf', 'https://api.sci.gov.in.attacker.example/a.pdf', 'https://user@api.sci.gov.in/a.pdf', 'https://127.0.0.1/a.pdf']) expect(isOfficialDocumentUrl(url, 'IN')).toBe(false);
    expect(isOfficialDocumentUrl('https://www.supremecourt.gov/opinions/test.pdf', 'KE')).toBe(false);
  });
  it('reads the Kenyan parties and decision date from the document rather than a generic index title', async () => {
    const result = await parseOfficialPdf(Buffer.from('KENYA'), { country: 'KE', title: 'Supreme Court of Kenya - Nairobi', url: 'https://supremecourt.judiciary.go.ke/case.pdf' });
    expect(result?.title).toBe('KENFREIGHT (E.A) LIMITED v BENSON K. NGUTI');
    expect(result?.decisionDate).toEqual(new Date('2019-07-23T00:00:00.000Z'));
    expect(result?.sourcePassages?.[1].paragraph).toBe('41');
  });
  it('takes US caption, reporter and date from the official report instead of the search query', async () => {
    const result = await parseOfficialPdf(Buffer.from('BROWN'), { country: 'US', title: 'Historical research question', url: 'https://www.govinfo.gov/content/pkg/USREPORTS-347/pdf/USREPORTS-347-483.pdf' });
    expect(result?.title).toBe('BROWN ET AL. v. BOARD OF EDUCATION OF TOPEKA et al.');
    expect(result?.citation).toBe('347 U.S. 483');
    expect(result?.decisionDate).toEqual(new Date('1954-05-17T00:00:00.000Z'));
  });
  it('recognizes the independent Library of Congress copy with the same canonical reporter identity', async () => {
    const result = await parseOfficialPdf(Buffer.from('BROWN'), { country: 'US', title: 'Official report', url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf' });
    expect(result?.citation).toBe('347 U.S. 483');
    expect(result?.court).toBe('Supreme Court of the United States');
    expect(result?.sourceProvenance?.completeness).toBe('COMPLETE');
  });
  it('does not follow a redirect to an unapproved source', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }));
    expect(await hydrateOfficialDocument({ country: 'IN', url: 'https://api.sci.gov.in/redirect-test.pdf', title: 'Test' })).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps real PDF pages and provenance without inventing paragraph numbers', async () => {
    const result = await parseOfficialPdf(Buffer.from('%PDF-1.3'), { country: 'IN', title: 'Search index header', url: 'https://api.sci.gov.in/judgment.pdf' });
    expect(result?.title).toBe('Employer v Employee');
    expect(result?.citation).toBe('AIR 1990 SC 1808');
    expect(result?.sourcePassages?.[1]).toMatchObject({ page: 2, sourcePinpoint: true });
    expect(result?.sourcePassages?.[1].paragraph).toBeUndefined();
    expect(new SourceIntegrityService().assess(result?.sourceProvenance).state).toBe('PASS');
    expect(new SourceIntegrityService().assess({ ...result!.sourceProvenance!, missingPages: [2] }).state).toBe('FAIL');
    expect(new SourceIntegrityService().assess({ ...result!.sourceProvenance!, extractionMethod: 'WEB_SCRAPE' }).state).toBe('INDETERMINATE');
  });
});
