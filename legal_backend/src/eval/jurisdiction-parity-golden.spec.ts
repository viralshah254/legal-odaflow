import { buildAntiHallucinationContract } from '@/ai/citations/anti-hallucination-contract';
import { extractStatuteReferences } from '@/ai/citations/statute-reference';
import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import { UNVERIFIED_AUTHORITY_DISCLAIMER } from '@/ai/drafting/legal-accuracy-protocol';
import {
  buildOfficialJudgmentWebQuery,
  getOfficialCaseSources,
  hasOfficialCaseSources,
} from '@/ai/legal-research/official-case-sources';
import { stripOutputToCheckPack } from '@/ai/legal-research/named-authority-check-pack';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

/**
 * Cross-jurisdiction acceptance checks.
 *
 * The promise made to the user is the same in every country: a memo or draft
 * either shows a real citation or an honest gap, and never a fabricated one.
 * These cases run the deterministic layer of that promise — the part that holds
 * even if the model misbehaves — for India, the United States, England & Wales
 * and Kenya side by side, so no jurisdiction can silently lose protection.
 */

interface JurisdictionCase {
  countryCode: string;
  label: string;
  /** A realistic query a lawyer in this jurisdiction would ask. */
  query: string;
  /** A citation the model might plausibly invent for this jurisdiction. */
  fabricatedCitation: string;
  /** A real authority, as it would arrive from retrieval. */
  verifiedAuthority: RetrievedAuthority;
  /** A statute reference in this jurisdiction's own drafting style. */
  statuteText: string;
  expectedStatuteAct: RegExp;
}

function authority(
  id: string,
  title: string,
  citation: string,
  summary: string,
  sourceUrl: string,
): RetrievedAuthority {
  return {
    id,
    title,
    citation,
    summary,
    sourceUrl,
    sourceType: 'case',
    provider: 'test',
  } as unknown as RetrievedAuthority;
}

const CASES: JurisdictionCase[] = [
  {
    countryCode: 'IN',
    label: 'bail memorandum',
    query: 'Is bail available under BNSS section 480 for a first-time economic offence accused?',
    fabricatedCitation: 'AIR 2019 SC 4432',
    verifiedAuthority: authority(
      'in-1',
      'Arnesh Kumar v. State of Bihar',
      '(2014) 8 SCC 273',
      'The Supreme Court held that arrest must not be automatic where the offence carries less than seven years imprisonment, and directed magistrates to record satisfaction before authorising detention.',
      'https://main.sci.gov.in/judgment/arnesh-kumar',
    ),
    statuteText: 'Bail is governed by Section 480 of the Bharatiya Nagarik Suraksha Sanhita, 2023.',
    expectedStatuteAct: /nagarik suraksha|bnss/i,
  },
  {
    countryCode: 'US',
    label: 'federal habeas research query',
    query: 'What is the standard for federal habeas relief under 28 U.S.C. 2254(d) after a state court merits ruling?',
    fabricatedCitation: '592 U.S. 118',
    verifiedAuthority: authority(
      'us-1',
      'Harrington v. Richter',
      '562 U.S. 86',
      'Section 2254(d) requires a state prisoner to show the state court ruling was so lacking in justification that there was an error beyond any possibility for fairminded disagreement.',
      'https://www.supremecourt.gov/opinions/harrington-v-richter',
    ),
    statuteText: 'Relief is limited by 28 U.S.C. § 2254(d) as construed by the federal courts.',
    expectedStatuteAct: /u\.?s\.?c|28/i,
  },
  {
    countryCode: 'GB',
    label: 'England & Wales research query',
    query: 'When will the court grant relief from sanctions under CPR 3.9 in England and Wales?',
    fabricatedCitation: '[2021] EWCA Civ 9999',
    verifiedAuthority: authority(
      'gb-1',
      'Denton v TH White Ltd',
      '[2014] EWCA Civ 906',
      'The Court of Appeal set a three-stage approach: identify the seriousness of the breach, consider why the default occurred, and evaluate all the circumstances of the case.',
      'https://caselaw.nationalarchives.gov.uk/ewca/civ/2014/906',
    ),
    statuteText: 'The application is made under section 1 of the Theft Act 1968 for the related count.',
    expectedStatuteAct: /theft act/i,
  },
  {
    countryCode: 'KE',
    label: 'Kenya research query',
    query: 'Can a digital lender list a borrower with a credit reference bureau without notice under Kenyan law?',
    fabricatedCitation: '[2022] eKLR',
    verifiedAuthority: authority(
      'ke-1',
      'Republic v Communications Authority of Kenya',
      '[2018] eKLR',
      'The High Court held that a regulator must observe the constitutional right to privacy and afford a hearing before taking a step that adversely affects a data subject.',
      'https://kenyalaw.org/caselaw/cases/view/republic-v-communications-authority',
    ),
    statuteText: 'The listing engages section 26 of the Data Protection Act, 2019.',
    expectedStatuteAct: /data protection act/i,
  },
];

describe.each(CASES)('$countryCode — $label', (testCase) => {
  const { countryCode, query, fabricatedCitation, verifiedAuthority } = testCase;

  it('strips a citation the retrieval pack cannot back and leaves an honest disclaimer', () => {
    const memo = [
      `## Executive answer`,
      `The position is governed by ${verifiedAuthority.title}, ${verifiedAuthority.citation}.`,
      `A further authority is reported at ${fabricatedCitation}.`,
    ].join('\n');

    const result = stripOutputToCheckPack(memo, [verifiedAuthority], query, countryCode);

    expect(result.text).not.toContain(fabricatedCitation);
    expect(result.strippedCitations).toContain(fabricatedCitation);
    expect(result.text).toContain(UNVERIFIED_AUTHORITY_DISCLAIMER);
  });

  it('keeps the verified citation visible rather than stripping everything', () => {
    const memo = `The controlling authority is ${verifiedAuthority.title}, ${verifiedAuthority.citation}.`;

    const result = stripOutputToCheckPack(memo, [verifiedAuthority], query, countryCode);

    expect(result.text).toContain(verifiedAuthority.citation);
    expect(result.strippedCitations).toHaveLength(0);
  });

  it('strips every citation when retrieval returned nothing, leaving a gap not an invention', () => {
    const memo = `The position is settled by ${fabricatedCitation}.`;

    const result = stripUnverifiedCitations(memo, [], [], 'strip');

    expect(result.text).not.toContain(fabricatedCitation);
    expect(result.text).toContain(UNVERIFIED_AUTHORITY_DISCLAIMER);
  });

  it('parses this jurisdiction\'s own statute style without India-specific rules', () => {
    const refs = extractStatuteReferences(testCase.statuteText, countryCode);

    expect(refs.length).toBeGreaterThan(0);
    expect(refs.some((ref) => testCase.expectedStatuteAct.test(ref.act))).toBe(true);
  });

  it('knows where this jurisdiction\'s official judgments live', () => {
    expect(hasOfficialCaseSources(countryCode)).toBe(true);

    const sources = getOfficialCaseSources(countryCode);
    expect(sources.judgmentDomains.length).toBeGreaterThan(0);

    const webQuery = buildOfficialJudgmentWebQuery(query, countryCode);
    for (const domain of sources.judgmentDomains) {
      expect(webQuery).toContain(domain);
    }
  });

  it('carries the anti-hallucination contract into both flows for this jurisdiction', () => {
    for (const flow of ['research', 'drafting'] as const) {
      const contract = buildAntiHallucinationContract({ flow, countryCode });
      expect(contract).toContain(`Jurisdiction for this task: ${countryCode}`);
      expect(contract).toMatch(/\[AUTHORITY GAP\]/);
    }
  });
});

describe('no jurisdiction is protected less than another', () => {
  it('strips a fabricated citation from every jurisdiction, not just India', () => {
    const survivors = CASES.filter((testCase) => {
      const result = stripUnverifiedCitations(
        `See ${testCase.fabricatedCitation} on this point.`,
        [],
        [],
        'strip',
      );
      return result.text.includes(testCase.fabricatedCitation);
    });

    expect(survivors.map((s) => s.countryCode)).toEqual([]);
  });

  it('does not let one jurisdiction\'s authority vouch for another\'s citation', () => {
    const indiaCase = CASES.find((c) => c.countryCode === 'IN')!;
    const usCase = CASES.find((c) => c.countryCode === 'US')!;

    const result = stripUnverifiedCitations(
      `See ${usCase.verifiedAuthority.citation}.`,
      [
        {
          id: indiaCase.verifiedAuthority.id,
          title: indiaCase.verifiedAuthority.title,
          citation: indiaCase.verifiedAuthority.citation,
          summary: indiaCase.verifiedAuthority.summary,
        },
      ],
      [],
      'strip',
    );

    expect(result.text).not.toContain(usCase.verifiedAuthority.citation);
  });
});
