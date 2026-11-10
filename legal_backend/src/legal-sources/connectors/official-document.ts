import { createHash } from 'node:crypto';
import { parseDocument, DomUtils } from 'htmlparser2';
import { withinResearchBudget, researchRequestSignal } from '@/common/utils/research-execution-budget';
import type { RetrievedAuthority, RetrievedSourcePassage } from '@/legal-search/legal-retrieval.types';

const HOSTS: Record<string, string[]> = {
  IN: ['api.sci.gov.in', 'main.sci.gov.in', 'scr.sci.gov.in', 'judgments.ecourts.gov.in', 'indiacode.nic.in', 'labour.gov.in', 'legislative.gov.in'],
  KE: ['judiciary.go.ke', 'supremecourt.judiciary.go.ke', 'labour.go.ke', 'labourmarket.go.ke', 'bungomaassembly.go.ke', 'treasury.go.ke', 'cma.or.ke', 'centralbank.go.ke', 'parliament.go.ke', 'kra.go.ke', 'odpc.go.ke'],
  US: ['supremecourt.gov', 'govinfo.gov', 'tile.loc.gov', 'loc.gov', 'uscourts.gov', 'uscode.house.gov', 'congress.gov', 'eeoc.gov', 'dol.gov'],
};
export function isOfficialDocumentUrl(value: string, country: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (HOSTS[country] ?? []).includes(host);
  } catch { return false; }
}
/** Bracketed reporter years are not numbered judgment paragraphs. */
export function nativeParagraphMarker(text: string): string | undefined {
  const marker = text.match(/^\s*\[\s*([\d\s]+)\]/)?.[1]?.replace(/\s/g, '');
  if (!marker || marker.length > 4 || (Number(marker) >= 1800 && Number(marker) <= 2099)) return undefined;
  return marker;
}
function usReporterIdentity(value: string): { volume: string; page: string } | undefined {
  const url = new URL(value);
  const gov = url.hostname.replace(/^www\./, '') === 'govinfo.gov' && url.pathname.match(/^\/content\/pkg\/USREPORTS-(\d+)\/pdf\/USREPORTS-(\d+)-(\d+)\.pdf$/i);
  if (gov && gov[1] === gov[2]) return { volume: gov[1], page: gov[3] };
  const loc = url.hostname === 'tile.loc.gov' && url.pathname.match(/^\/storage-services\/service\/ll\/usrep\/usrep(\d+)\/usrep(\d+)\/usrep(\d+)\.pdf$/i);
  if (loc && loc[2] === loc[3] && loc[2].startsWith(loc[1]) && /^\d+$/.test(loc[2].slice(loc[1].length))) return { volume: loc[1], page: loc[2].slice(loc[1].length) };
  return undefined;
}
const cache = new Map<string, { expiresAt: number; authority: Partial<RetrievedAuthority> }>();
const MAX_BYTES = 32 * 1024 * 1024;

async function readPublicResponse(response: Response): Promise<Buffer> {
  if (!response.body || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) { await response.body?.cancel().catch(() => undefined); throw Error('Official document exceeds size limit'); }
  const reader = response.body.getReader();
  const chunks: Buffer[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw Error('Official document exceeds size limit');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks);
}

/** Fetch only publicly accessible official publications. No challenge bypass or snippet promotion. */
export async function hydrateOfficialDocument(input: { url: string; country: string; title: string }): Promise<Partial<RetrievedAuthority> | null> {
  if (!isOfficialDocumentUrl(input.url, input.country)) return null;
  const existing = cache.get(input.url);
  if (existing && existing.expiresAt > Date.now()) return existing.authority;
  return withinResearchBudget(10000, async () => {
    let url = input.url;
    for (let hop = 0; hop < 4; hop++) {
      if (!isOfficialDocumentUrl(url, input.country)) return null;
      const response = await fetch(url, { redirect: 'manual', signal: researchRequestSignal(9000), headers: { 'User-Agent': 'UmbrellaLegal/1.0 (+https://okaylegal.ai)', Accept: 'application/pdf,text/html' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return null;
        url = new URL(location, url).toString(); continue;
      }
      if (response.status !== 200) { await response.body?.cancel(); return null; }
      const buffer = await readPublicResponse(response);
      if (!/%PDF-\d\.\d/.test(buffer.subarray(0, 1024).toString('latin1'))) {
        const html = buffer.toString('utf8');
        // Follow a publication download from its official landing page, never arbitrary navigation.
        const links = DomUtils.findAll(node => node.name === 'a' && Boolean(node.attribs?.['data-downloadurl'] || node.attribs?.href), parseDocument(html).children);
        const hrefOf = (node: typeof links[number]) => node.attribs['data-downloadurl'] || node.attribs.href;
        const link = links.find(node => /\.pdf(?:$|[?#])|[?&]wpdmdl=|[?&]download=|\/datalake\/download\//i.test(hrefOf(node)) &&
          isOfficialDocumentUrl(new URL(hrefOf(node), url).toString(), input.country));
        if (!link) return null;
        url = new URL(hrefOf(link), url).toString(); continue;
      }
      const authority = await parseOfficialPdf(buffer, { ...input, url });
      if (authority) {
        if (cache.size >= 8) cache.delete(cache.keys().next().value!);
        cache.set(input.url, { authority, expiresAt: Date.now() + 30 * 60_000 });
      }
      return authority;
    }
    return null;
  }).catch(() => null);
}

export async function parseOfficialPdf(buffer: Buffer, input: { url: string; country: string; title: string }): Promise<Partial<RetrievedAuthority> | null> {
  const pdfParse = (await import('pdf-parse')).default;
  const pages: Array<{ page: number; text: string }> = [];
  const parsed = await pdfParse(buffer, { pagerender: async (page: any) => {
    const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
    let lastY: number | undefined; let text = '';
    for (const item of content.items) {
      text += (lastY === undefined || lastY === item.transform[5] ? ' ' : '\n') + item.str;
      lastY = item.transform[5];
    }
    text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
    pages.push({ page: page.pageNumber, text }); return text;
  } });
  if (!parsed.numpages || pages.length !== parsed.numpages || parsed.text.trim().length < 200) return null;
  const missingPages = pages.filter(page => page.text.trim().length < 20).map(page => page.page);
  const fullText = parsed.text;
  const flat = fullText.replace(/\s+/g, ' ');
  const reporter = input.country === 'US' ? usReporterIdentity(input.url) : undefined;
  const usReports = Boolean(reporter);
  const isCourt = usReports || /(?:sci\.gov\.in|judiciary\.go\.ke|supremecourt\.gov|uscourts\.gov)/i.test(new URL(input.url).hostname);
  let passages: RetrievedSourcePassage[] = pages.flatMap(page => page.text.split(/\n\s*\n|\n(?=\s*(?:\[\s*[\d\s]+\]|\d{1,3}[.)]\s))/)
    .map(text => ({ text: text.replace(/\s+/g, ' ').trim(), page: page.page, paragraph: nativeParagraphMarker(text), sourcePinpoint: true, ...(/\b(?:dissent(?:ing)?|concurr(?:ing|ence))\b/i.test(page.text.slice(0, 1200)) ? { classification: (/dissent/i.test(page.text.slice(0, 1200)) ? 'DISSENT' : 'CONCURRENCE') as 'DISSENT' | 'CONCURRENCE', classificationConfidence: 0.98 } : {}) }))
    .filter(p => p.text.length > 60));
  let title = input.title.replace(/^Microsoft\s+Word\s*[-–:]\s*/i, '').split(/[|•]/)[0].trim();
  let citation: string | null = null;
  const petitioner = flat.match(/PETITIONER:\s*(.*?)\s+(?:Vs\.?|VERSUS)\s*RESPONDENT:\s*(.*?)\s*(?:DATE OF JUDGMENT|DATE:|BENCH:)/i);
  if (petitioner) title = `${petitioner[1].trim()} v ${petitioner[2].trim()}`;
  const kenyaParties = input.country === 'KE' ? flat.match(/BETWEEN\s*[-–]?\s*(.{3,180}?)\s*\.{2,}[\s.]*APPELLANT\s+AND\s+(.{3,180}?)\s*\.{2,}[\s.]*RESPONDENT/i) : null;
  if (kenyaParties) title = `${kenyaParties[1].trim()} v ${kenyaParties[2].trim()}`;
  const air = flat.match(/CITATION:\s*(\d{4})\s+AIR\s+(\d+)/i);
  citation = air ? `AIR ${air[1]} SC ${air[2]}` : flat.slice(0, 1200).match(/\[\d{4}\]\s+KE[A-Z]+\s+\d+(?:\s*\(KLR\))?/)?.[0] ?? null;
  const caseNumber = input.country === 'KE' ? flat.slice(0, 1800).match(/\b(PETITION|CIVIL APPEAL|CRIMINAL APPEAL|CIVIL APPLICATION)\s+(?:NO\.?\s*)?([A-Z]?\d+)\s+OF\s+(\d{4})/i) : null;
  if (!citation && caseNumber) citation = `${caseNumber[1].replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/^./, c => c.toUpperCase())} ${caseNumber[2]} of ${caseNumber[3]}`;
  const usCaption = usReports ? flat.slice(0, 2400).match(/Syllabus\.\s*(.*?)\s+NO\.\s*\d+/i)?.[1] : undefined;
  if (usCaption && /\sv\.\s/i.test(usCaption)) title = usCaption.trim();
  if (reporter) citation = `${reporter.volume} U.S. ${reporter.page}`;
  const indianDate = flat.match(/DATE OF JUDGMENT\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const usDate = flat.match(/Decided\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  const kenyaDate = input.country === 'KE' ? flat.match(/DATED\s+and\s+DELIVERED.{0,100}?this\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s+Day\s+of\s+([A-Za-z]+),?\s+((?:\d\s*){4})/i) : null;
  const decisionDate = kenyaDate ? new Date(`${kenyaDate[2]} ${kenyaDate[1]}, ${kenyaDate[3].replace(/\s/g, '')} UTC`) : indianDate ? new Date(`${indianDate[3]}-${indianDate[2]}-${indianDate[1]}T00:00:00Z`) : usDate ? new Date(usDate[1] + ' UTC') : null;
  const dispositionComplete = !isCourt || (input.country === 'US' && /Opinion of the Court/i.test(flat) && /It is so ordered/i.test(flat)) || /(?:appeal|petition|application|claim|suit).{0,150}(?:dismissed|allowed|affirmed|reversed|vacated|remanded)|(?:orders accordingly|it is so ordered|we (?:therefore )?hold)/i.test(flat.slice(-18000));
  const statuteTitle = title.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const isStatute = !isCourt && /\b(?:act|code)\b/i.test(title) && !/draft|bill|brochure/i.test(title) && statuteTitle.length > 8 && flat.slice(0, 6000).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').includes(statuteTitle);
  if (isStatute) {
    const sections = [...fullText.matchAll(/^\s*(\d{1,3}[A-Z]?)\.\s+(?=\(\d+\)|[A-Z])/gm)];
    const sectionPassages = sections.map((match, index) => {
      const preceding = fullText.slice(Math.max(0, match.index! - 400), match.index).trim();
      const heading = preceding.split(/\n\s*\n/).at(-1)?.replace(/\s+/g, ' ').trim();
      const body = fullText.slice(match.index, sections[index + 1]?.index ?? fullText.length).trim();
      const text = heading && heading.length <= 160 && !/^\d+$/.test(heading) ? `${heading}\n\n${body}` : body;
      const page = pages.find(page => page.text.includes(match[0].trim()))?.page;
      return { text, paragraph: `Section ${match[1]}`, page, sourcePinpoint: true };
    }).filter(passage => passage.text.length > 80 && passage.page);
    if (sectionPassages.length) passages = sectionPassages;
  }

  const sourceUrl = new URL(input.url); sourceUrl.searchParams.delete('refresh');
  return { title, citation, decisionDate: decisionDate && !Number.isNaN(decisionDate.getTime()) ? decisionDate : undefined, fullText, sourceUrl: sourceUrl.toString(), sourcePassages: passages,
    sourceTier: isCourt ? 'case_law' : isStatute ? 'primary' : 'web', authorityType: isCourt ? 'CASE' : isStatute ? 'STATUTE' : undefined,
    sourceName: new URL(input.url).hostname,
    courtTierRank: isCourt && /SUPREME COURT/i.test(flat.slice(0, 1500)) ? 0 : undefined,
    court: isCourt ? (input.country === 'IN' && /SUPREME COURT OF INDIA/i.test(flat) ? 'Supreme Court of India' : input.country === 'US' && (usReports || /SUPREME COURT OF THE UNITED STATES/i.test(flat)) ? 'Supreme Court of the United States' : input.country === 'KE' && /SUPREME COURT/i.test(flat) ? 'Supreme Court of Kenya' : null) : null,
    sourceProvenance: { provider: new URL(input.url).hostname, retrievedAt: new Date().toISOString(), canonicalUrl: input.url,
      canonicalIdentity: input.url, documentHash: createHash('sha256').update(buffer).digest('hex'), pageCount: parsed.numpages,
      missingPages, completeness: 'COMPLETE', extractionMethod: 'NATIVE_TEXT', authoritativeStatus: 'OFFICIAL',
      paragraphNumberingIntegrity: 'UNKNOWN', dispositionComplete },
  };
}
