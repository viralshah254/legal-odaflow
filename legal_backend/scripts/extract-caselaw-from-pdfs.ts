import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { IndiaCaselawEntry } from '../src/legal-sources/india-caselaw-corpus.types';

const corpusDir = join(__dirname, '..', 'data', 'india-caselaw-corpus');
const pdfDir = join(corpusDir, 'source-pdfs');
const bundleDir = join(corpusDir, 'bundles');

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bv(?:ersus)?\.?\b/g, 'v')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\bv(?:ersus)?\.?\b/g, 'v').replace(/[^a-z0-9]/g, '');
}

function entry(input: Partial<IndiaCaselawEntry> & Pick<IndiaCaselawEntry, 'title' | 'citation'>): IndiaCaselawEntry {
  const year = input.decisionDate?.slice(0, 4) ?? input.citation.match(/\b(19|20)\d{2}\b/)?.[0];
  return {
    ...input,
    id: input.id ?? `${slug(input.title)}-${year ?? 'undated'}`,
    title: input.title,
    citation: input.citation,
    court: input.court ?? 'Supreme Court of India',
    courtLevel: input.courtLevel ?? 'supreme',
    countryCode: 'IN',
    jurisdiction: 'IN',
    sourceName: input.sourceName ?? 'User-provided case-law PDF',
    sourceBundle: input.sourceBundle ?? 'pdf_extract',
    summary: input.summary ?? 'Case identified from the source PDF; requires citation review before production retrieval.',
    topics: input.topics ?? [],
    practiceAreas: input.practiceAreas ?? [],
    draftKinds: input.draftKinds ?? [],
    treatmentStatus: input.treatmentStatus ?? 'good_law',
    extractionConfidence: input.extractionConfidence ?? 'needs_review',
    reviewedByHuman: input.reviewedByHuman ?? false,
    dedupeKey: input.dedupeKey ?? `${normalize(input.title)}-${year ?? 'unknown'}`,
  };
}

function pdfText(filename: string, firstPage?: number, lastPage?: number): string {
  const file = join(pdfDir, filename);
  if (!existsSync(file)) return '';
  const args = ['-layout'];
  if (firstPage) args.push('-f', String(firstPage));
  if (lastPage) args.push('-l', String(lastPage));
  args.push(file, '-');
  return execFileSync('pdftotext', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function writeBundle(name: string, entries: IndiaCaselawEntry[]): void {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, name), `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`${name}: ${entries.length} entries`);
}

function extractRecentJudgments(): IndiaCaselawEntry[] {
  return [
    entry({
      title: 'Pooja Ramesh Singh v. Jammu and Kashmir Bank Ltd. and Anr.',
      titleAliases: ['Pooja Ramesh Singh v. J&K Bank', 'Pooja Ramesh Singh'],
      citation: '2026 INSC 668',
      neutralCitation: '2026 INSC 668',
      decisionDate: '2026-07-02',
      caseNumber: 'Civil Appeal No. 11950 of 2025',
      sourcePdf: '523382025_2026-07-02.pdf',
      sourcePageRange: '1-11',
      sourceName: 'Supreme Court of India',
      sourceBundle: 'sc_judgment_2026',
      summary: 'The Court set aside NCLT and NCLAT orders that relied on non-existent or falsely attributed AI-generated precedent and asked the Bar Council of India to consider measures on fabricated AI authorities submitted by advocates.',
      holding: 'AI may assist adjudication but cannot displace human legal verification. A judicial or tribunal decision cannot rely on untraceable authorities or paragraphs falsely attributed to genuine judgments.',
      topics: ['artificial intelligence', 'hallucinated citations', 'NCLT', 'IBC section 7', 'professional responsibility', 'adjudication integrity'],
      practiceAreas: ['Commercial', 'Corporate', 'Insolvency'],
      draftKinds: ['india_legal_research_memo', 'india_writ_petition_hc'],
      keyParagraphs: [
        'The judgments relied upon by the NCLT were non-existent, incorrectly cited, or attributed with non-existent paragraphs.',
        'The Court set aside the impugned decisions and directed the Bar Council of India to consider measures addressing fabricated AI-generated authorities.',
      ],
      extractionConfidence: 'high',
      reviewedByHuman: true,
    }),
    entry({
      title: 'Association for Democratic Reforms and Ors. v. Election Commission of India and Ors.',
      titleAliases: ['ADR v. Election Commission of India', 'Association for Democratic Reforms v. ECI'],
      citation: '2026 INSC 564',
      neutralCitation: '2026 INSC 564',
      decisionDate: '2026-05-27',
      caseNumber: 'Writ Petition (Civil) No. 640 of 2025 and connected matters',
      sourcePdf: '357852025_2026-05-27.pdf',
      sourcePageRange: '1-124',
      sourceName: 'Supreme Court of India',
      sourceBundle: 'sc_judgment_2026',
      summary: 'The Court upheld the Special Intensive Revision of Bihar electoral rolls as compatible with the Representation of the People Act and 1960 Rules, subject to the prescribed process and judicial-review remedies for erroneous deletions.',
      holding: 'A limited citizenship enquiry for electoral-roll eligibility is an administrative electoral exercise, not a strict citizenship adjudication. It does not divest citizenship claims or foreclose determination by the competent authority.',
      topics: ['electoral rolls', 'Election Commission', 'citizenship', 'constitutional law', 'voter registration'],
      practiceAreas: ['Constitutional', 'Election'],
      draftKinds: ['india_writ_petition_hc', 'india_legal_research_memo'],
      keyParagraphs: [
        'The Special Intensive Revision was held not to conflict with the Representation of the People Act or the 1960 Rules.',
        'A person wrongly deleted on citizenship grounds may pursue the prescribed process and judicial review.',
      ],
      extractionConfidence: 'high',
      reviewedByHuman: true,
    }),
    entry({
      title: 'Harish Rana v. Union of India and Ors.',
      titleAliases: ['Harish Rana end of life treatment case', 'Harish Rana'],
      citation: '2026 INSC 222',
      neutralCitation: '2026 INSC 222',
      decisionDate: '2026-03-11',
      caseNumber: 'Miscellaneous Application No. 2238 of 2025 in SLP (C) No. 18225 of 2024',
      sourcePdf: '609802025_2026-03-11.pdf',
      sourcePageRange: '1-338',
      sourceName: 'Supreme Court of India',
      sourceBundle: 'sc_judgment_2026',
      summary: 'Applying Common Cause, the Court held clinically assisted nutrition and hydration to be medical treatment and permitted withdrawal after both Medical Boards concurred that continuation was not in the patient’s best interests.',
      holding: 'Clinically assisted nutrition and hydration is medical treatment under the Common Cause framework and may be withheld or withdrawn for an incompetent patient where the best-interests assessment and safeguards require it.',
      topics: ['right to die with dignity', 'passive euthanasia', 'withdrawal of treatment', 'CANH', 'medical boards', 'Common Cause', 'Article 21'],
      practiceAreas: ['Constitutional', 'Medical'],
      draftKinds: ['india_writ_petition_hc', 'india_legal_research_memo'],
      keyParagraphs: [
        'Clinically assisted nutrition and hydration constitutes medical treatment for the Common Cause framework.',
        'The consequences prescribed in Common Cause were directed to operate after both Medical Boards concurred.',
      ],
      extractionConfidence: 'high',
      reviewedByHuman: true,
    }),
    entry({
      title: 'In Re: Order dated 17.03.2025 Passed by the High Court of Judicature at Allahabad in Criminal Revision No. 1449 of 2024 and Ancillary Issues',
      titleAliases: ['Allahabad High Court ancillary issues suo motu', 'Suo Moto Writ Petition Criminal No. 1 of 2025'],
      citation: '2026 INSC 165',
      neutralCitation: '2026 INSC 165',
      decisionDate: '2026-02-10',
      caseNumber: 'Suo Moto Writ Petition (Criminal) No. 1 of 2025',
      sourcePdf: '156812025_2026-02-10.pdf',
      sourcePageRange: '1-13',
      sourceName: 'Supreme Court of India',
      sourceBundle: 'sc_judgment_2026',
      summary: 'The Court set aside the Allahabad High Court order that diluted summons and charges in a POCSO matter, confirmed interim protection, and constituted a Committee of Experts to develop guidelines for sexual-offence and similarly sensitive cases.',
      holding: 'Guidance for sexual-offence and similarly sensitive criminal cases must be comprehensive, context-sensitive, and accessible across linguistic and legal-proficiency differences.',
      topics: ['criminal procedure', 'sexual offences', 'guidelines', 'access to justice', 'language'],
      practiceAreas: ['Criminal', 'Constitutional'],
      draftKinds: ['india_criminal_appeal', 'india_legal_research_memo'],
      keyParagraphs: [
        'The Allahabad High Court order dated 17 March 2025 was set aside.',
        'A Committee of Experts was directed to prepare draft guidelines for handling sexual-offence cases.',
      ],
      extractionConfidence: 'high',
      reviewedByHuman: true,
    }),
    entry({
      title: 'The Deputy Commissioner and Special Land Acquisition Officer v. M/s S.V. Global Mill Limited',
      titleAliases: ['S.V. Global Mill land acquisition', 'Deputy Commissioner v. S.V. Global Mill'],
      citation: '2026 INSC 138',
      neutralCitation: '2026 INSC 138',
      decisionDate: '2026-02-09',
      caseNumber: 'Civil Appeal arising out of SLP (C) Nos. 215-216 of 2023 and connected matters',
      sourcePdf: '366642022_2026-02-09.pdf',
      sourcePageRange: '1-136',
      sourceName: 'Supreme Court of India',
      sourceBundle: 'sc_judgment_2026',
      summary: 'The Court clarified the application of section 24(1)(a) of the 2013 land-acquisition Act, including awards after commencement and the appellate route under section 74.',
      holding: 'For section 24(1)(a), awards must follow the 2013 Act except for rehabilitation and resettlement entitlements; first appeals are governed by section 74 rather than section 54 of the 1894 Act.',
      topics: ['land acquisition', 'Right to Fair Compensation Act 2013', 'section 24', 'compensation', 'section 74'],
      practiceAreas: ['Property', 'Civil'],
      draftKinds: ['india_civil_appeal', 'india_legal_research_memo'],
      sectionsCited: ['Right to Fair Compensation and Transparency in Land Acquisition Act 2013 s.24', 'Right to Fair Compensation and Transparency in Land Acquisition Act 2013 s.74'],
      keyParagraphs: [
        'Section 24(1)(a) applies where awards are passed after commencement of the 2013 Act.',
        'First appeals before High Courts are to be treated under section 74 of the 2013 Act, not section 54 of the 1894 Act.',
      ],
      extractionConfidence: 'high',
      reviewedByHuman: true,
    }),
  ];
}

function readExistingEntries(): IndiaCaselawEntry[] {
  const file = join(bundleDir, 'existing-platform.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as IndiaCaselawEntry[]) : [];
}

function matchingExisting(title: string, existing: IndiaCaselawEntry[]): IndiaCaselawEntry | undefined {
  const target = normalize(title);
  return existing.find((entry) => normalize(entry.title) === target);
}

function extractBulletTitles(text: string): string[] {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^[^A-Za-z]*[•·\uF0B7]?\s*/, '')
        .replace(/\s{2,}\d{3,5}\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((title) => /\b(?:v\.?|vs\.?|versus)\s+/i.test(title) && title.length > 8);
}

function extractCaseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*\d+\.\s*/, '')
        .replace(/\s{2,}(?:Civil Appeal|SLP|Writ Petition|Transferred|AIR|\(\d{4}\)).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((title) => /\b(?:v\.?|vs\.?|versus)\s+/i.test(title) && title.length > 8);
}

function toReviewEntries(
  titles: string[],
  bundle: string,
  pdf: string,
  existing: IndiaCaselawEntry[],
): IndiaCaselawEntry[] {
  return [...new Set(titles)].map((title) => {
    const matched = matchingExisting(title, existing);
    if (matched) {
      return {
        ...matched,
        sourceBundle: `${matched.sourceBundle}+${bundle}`,
        sourcePdf: pdf,
        reviewedByHuman: true,
      };
    }
    return entry({
      title,
      citation: '',
      sourceBundle: bundle,
      sourcePdf: pdf,
      extractionConfidence: 'needs_review',
      reviewedByHuman: false,
    });
  });
}

const existing = readExistingEntries();
writeBundle('sc-judgments-2026.json', extractRecentJudgments());
writeBundle(
  'landmark-sc-pdf.json',
  toReviewEntries(
    extractBulletTitles(pdfText('Landmark-Cases-SC.pdf', 1, 15)),
    'landmark_sc_pdf',
    'Landmark-Cases-SC.pdf',
    existing,
  ),
);
writeBundle(
  'scf-rti.json',
  toReviewEntries(
    extractCaseLines(pdfText('SCF final_merged.pdf', 1, 8)),
    'scf_rti',
    'SCF final_merged.pdf',
    existing,
  ),
);
writeBundle(
  'hr-policing.json',
  toReviewEntries(
    [...pdfText('1619069016Human Rights Judgments on Human Rights and Policing in India.pdf', 1, 100).matchAll(
      /\b([A-Z][A-Za-z.&'() ]{2,80}\s+v\.?\s+[A-Z][A-Za-z.&'() ]{2,80})\b/g,
    )].map((match) => match[1].replace(/\s+/g, ' ').trim()),
    'hr_policing',
    '1619069016Human Rights Judgments on Human Rights and Policing in India.pdf',
    existing,
  ),
);
writeBundle(
  'tnsja-2012-04.json',
  toReviewEntries(
    extractCaseLines(pdfText('ej_apr2012.pdf')),
    'tnsja_2012_04',
    'ej_apr2012.pdf',
    existing,
  ),
);
writeBundle(
  'tnsja-2018-05.json',
  toReviewEntries(
    extractCaseLines(pdfText('ej_may2018.pdf')),
    'tnsja_2018_05',
    'ej_may2018.pdf',
    existing,
  ),
);
