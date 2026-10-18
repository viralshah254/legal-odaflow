import { expandQuery, parseStatuteQuery, resolveAcronym } from '@/legal-search/statute-registry';
import { SectionAlignmentService } from '@/legal-search/section-alignment.service';
import { SentenceAuditService } from '@/legal-search/sentence-audit.service';
import {
  findManifestAct,
  loadIndiaSourcesManifest,
  loadYourLordshipsMirrorManifest,
} from '@/legal-sources/india-manifest.loader';
import { PRIORITY_STATUTE_SECTIONS } from '@/legal-sources/statute-sections.seed';
import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';
import { buildIndiaOverlayPromptBlock } from '@/config/jurisdictions/in-overlays';
import { parseConstitutionTextIntoSections } from '@/legal-sources/parsers/india-act-text.parser';

describe('statute-lookup golden queries', () => {
  const goldenQueries: Array<{
    country: string;
    query: string;
    expectedActId: string;
    expectedSection?: string;
  }> = [
    { country: 'IN', query: 'section 101 bnss', expectedActId: 'bnss', expectedSection: '101' },
    { country: 'IN', query: 'crpc 98', expectedActId: 'crpc', expectedSection: '98' },
    { country: 'IN', query: 'crpc 125 maintenance', expectedActId: 'crpc', expectedSection: '125' },
    { country: 'IN', query: 'bns 302', expectedActId: 'bns' },
    { country: 'IN', query: 'article 21 constitution', expectedActId: 'constitution', expectedSection: '21' },
    { country: 'IN', query: 'article 330A', expectedActId: 'constitution', expectedSection: '330A' },
    { country: 'IN', query: 'iea 65B electronic evidence', expectedActId: 'iea' },
    {
      country: 'IN',
      query: 'section 3 dowry prohibition act',
      expectedActId: 'dowry-prohibition',
      expectedSection: '3',
    },
    {
      country: 'IN',
      query: 'dv act section 12 protection order',
      expectedActId: 'domestic-violence',
      expectedSection: '12',
    },
    {
      country: 'IN',
      query: 'family courts act section 7',
      expectedActId: 'family-courts',
      expectedSection: '7',
    },
    {
      country: 'IN',
      query: 'special marriage act section 13 divorce',
      expectedActId: 'special-marriage',
      expectedSection: '13',
    },
    {
      country: 'IN',
      query: 'section 80C income tax act',
      expectedActId: 'income-tax',
      expectedSection: '80C',
    },
    { country: 'US', query: 'FLSA overtime', expectedActId: 'flsa' },
    { country: 'KE', query: 'Cap 63 murder', expectedActId: 'cap-63' },
    { country: 'GB', query: 'ERA 1996 unfair dismissal', expectedActId: 'era-1996' },
  ];

  it.each(goldenQueries)(
    'resolves $query ($country) to expected act',
    ({ country, query, expectedActId, expectedSection }) => {
      const parsed = parseStatuteQuery(query, country);
      if (expectedSection) {
        expect(parsed.section).toBe(expectedSection);
      }
      expect(parsed.statute?.id ?? resolveAcronym(query.split(' ')[0], country)?.id).toBeTruthy();
      const expansion = expandQuery(query, country);
      expect(expansion.isBareActQuery || expansion.searchTopics.length > 0).toBe(true);
      if (parsed.statute) {
        expect(parsed.statute.id).toBe(expectedActId);
      } else {
        expect(resolveAcronym(expectedActId, country)?.id).toBe(expectedActId);
      }
    },
  );

  it('includes BNSS section 101 in priority seed corpus', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'bnss' && s.section === '101',
    );
    expect(hit).toBeDefined();
    expect(hit?.title).toMatch(/restoration of abducted females/i);
    expect(hit?.fullText).toMatch(/District Magistrate/i);
    expect(hit?.fullText).not.toMatch(/High Court.*writ/i);
    expect(hit?.sourceUrl).toMatch(/prsindia\.org/i);
  });

  it('remaps crpc 98 to bnss 101 in expansion', () => {
    const result = expandQuery('crpc section 98', 'IN');
    expect(result.remappedSection).toEqual(
      expect.objectContaining({ actId: 'bnss', section: '101' }),
    );
  });

  it('includes Constitution article 21 in priority seed corpus', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'constitution' && s.section === '21',
    );
    expect(hit).toBeDefined();
    expect(hit?.fullText).toMatch(/protection of life and personal liberty/i);
  });

  it('includes Constitution article 330A for 106th Amendment', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'constitution' && s.section === '330A',
    );
    expect(hit).toBeDefined();
    expect(hit?.fullText).toMatch(/330A|women/i);
    expect(hit?.summary).toMatch(/106th Amendment/i);
  });

  it('includes Constitution article 332A for state assembly women reservation', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'constitution' && s.section === '332A',
    );
    expect(hit).toBeDefined();
    expect(hit?.fullText).toMatch(/Legislative Assembl/i);
    expect(hit?.summary).toMatch(/106th Amendment/i);
    expect(hit?.topics).toContain('106th-amendment');
  });

  it('includes Constitution article 334A for reservation duration and delimitation', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'constitution' && s.section === '334A',
    );
    expect(hit).toBeDefined();
    expect(hit?.fullText).toMatch(/delimitation|census/i);
    expect(hit?.summary).toMatch(/fifteen years|census/i);
    expect(hit?.topics).toContain('delimitation');
  });

  it('does not include 131st Bill text as current law in seeds', () => {
    const badSeeds = PRIORITY_STATUTE_SECTIONS.filter(
      (s) =>
        s.actId === 'constitution' &&
        /131st|815 seats|lok sabha expansion/i.test(s.fullText + s.summary),
    );
    expect(badSeeds).toHaveLength(0);
  });

  it('loads India sources manifest with COI_2024 primary PDF', () => {
    const manifest = loadIndiaSourcesManifest();
    expect(manifest.acts.length).toBeGreaterThanOrEqual(6);
    const constitution = findManifestAct('constitution');
    expect(constitution?.primaryPdfUrl).toMatch(/COI_2024\.pdf/i);
    expect(constitution?.editionDate).toBe('2024-05-01');
    expect(constitution?.amendmentCount).toBe(106);
    expect(constitution?.pendingAmendments?.[0]?.bill).toMatch(/131st/i);
  });

  it('rejects 131st Bill as pending-only in manifest', () => {
    const constitution = findManifestAct('constitution');
    const pending = constitution?.pendingAmendments?.[0];
    expect(pending?.status).toMatch(/negatived|introduced/i);
    expect(pending?.note).toMatch(/Do not ingest/i);
  });

  it('parses Constitution article headings', () => {
    const text = `
Article 21
Protection of life and personal liberty.—No person shall be deprived of his life or personal liberty except according to procedure established by law.

Article 330A
Reservation of seats for women in the House of the People.—Seats shall be reserved for women.
    `.trim();

    const sections = parseConstitutionTextIntoSections(text);
    expect(sections.map((s) => s.section)).toEqual(expect.arrayContaining(['21', '330A']));
  });

  it('detects BNSS s.101 substance drift (High Court writ vs District Magistrate)', () => {
    const service = new SubstanceVerificationService();
    const authority = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'bnss' && s.section === '101',
    )!;

    const drift = service.checkBareActSubstance({
      query: 'section 101 bnss',
      outputMarkdown:
        'Apply to the High Court or Court of Session for a writ of habeas corpus to restore liberty.',
      authorities: [
        {
          id: 'statute-in-bnss-s101',
          title: authority.title,
          fullText: authority.fullText,
          summary: authority.summary,
          sourceName: authority.sourceName,
        },
      ],
      isBareActQuery: true,
    });

    expect(drift.passed).toBe(false);
    expect(drift.warnings.join(' ')).toMatch(/Substance drift/i);
  });

  it('injects J&K overlay into prompt block', () => {
    const block = buildIndiaOverlayPromptBlock('Jammu & Kashmir');
    expect(block).toMatch(/Jammu & Kashmir/i);
    expect(block).toMatch(/Appendix II/i);
  });

  it('includes Dowry Prohibition Act section 3 in priority seed corpus', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'dowry-prohibition' && s.section === '3',
    );
    expect(hit).toBeDefined();
    expect(hit?.title).toMatch(/penalty for giving or taking dowry/i);
  });

  it('includes Domestic Violence Act section 12 in priority seed corpus', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'domestic-violence' && s.section === '12',
    );
    expect(hit).toBeDefined();
    expect(hit?.title).toMatch(/application to magistrate/i);
  });

  it('includes Income-tax Act section 80C in priority seed corpus', () => {
    const hit = PRIORITY_STATUTE_SECTIONS.find(
      (s) => s.actId === 'income-tax' && s.section === '80C',
    );
    expect(hit).toBeDefined();
    expect(hit?.topics).toContain('section-80c');
  });

  it('remaps crpc 125 to bnss 144 in expansion', () => {
    const result = expandQuery('crpc section 125', 'IN');
    expect(result.remappedSection).toEqual(
      expect.objectContaining({ actId: 'bnss', section: '144' }),
    );
  });
});

describe('Your Lordships mirror catalog', () => {
  const YL_TIER2_ACTS = [
    'hindu-marriage',
    'hindu-adoption',
    'hindu-succession',
    'muslim-dissolution',
    'muslim-marriages-registration',
    'muslim-women-divorce',
    'limitation-act',
    'negotiable-instruments',
  ];

  it('has YL mirror entries in sources.manifest.json for all personal law acts', () => {
    const manifest = loadIndiaSourcesManifest();
    const manifestActIds = new Set(manifest.acts.map((a) => a.actId));
    for (const actId of YL_TIER2_ACTS) {
      expect(manifestActIds.has(actId)).toBe(true);
    }
  });

  it('marks YL personal law acts as tier-2 mirror, not primary', () => {
    const manifest = loadIndiaSourcesManifest();
    for (const actId of ['hindu-adoption', 'hindu-succession', 'muslim-dissolution', 'muslim-marriages-registration', 'muslim-women-divorce']) {
      const entry = manifest.acts.find((a) => a.actId === actId);
      expect(entry?.sourceAuthority).toBe('yourlordships-mirror');
      expect(entry?.sourceTier).toBe('mirror');
    }
  });

  it('YL mirror catalog has 19 PDFs covering all personal law acts', () => {
    const mirror = loadYourLordshipsMirrorManifest();
    expect(mirror.mirrors.length).toBeGreaterThanOrEqual(15);
    const mirrorActIds = new Set(mirror.mirrors.map((m) => m.actId));
    for (const actId of YL_TIER2_ACTS) {
      expect(mirrorActIds.has(actId)).toBe(true);
    }
  });

  it('YL constitution entry is flagged as outdated (not primary)', () => {
    const mirror = loadYourLordshipsMirrorManifest();
    const coiEntry = mirror.mirrors.find((m) => m.actId === 'constitution');
    expect(coiEntry?.constitutionPrimary).toBe(false);
    expect(coiEntry?.note).toMatch(/outdated|prefer COI_2024/i);
  });

  it('no YL act entry overrides Legislative Dept COI_2024 as primary', () => {
    const manifest = loadIndiaSourcesManifest();
    const constitutionEntry = manifest.acts.find((a) => a.actId === 'constitution');
    expect(constitutionEntry?.sourceAuthority).toBe('legislative-department');
    expect(constitutionEntry?.sourceTier).toBe('primary');
    expect(constitutionEntry?.primaryPdfUrl).toMatch(/COI_2024\.pdf/);
  });
});

describe('Bare-Act Section Accuracy Fix — unit checks', () => {
  describe('parseStatuteQuery reverse pattern', () => {
    it('parseStatuteQuery("101 bnss") → section=101, actId=bnss', () => {
      const parsed = parseStatuteQuery('101 bnss', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.actId).toBe('bnss');
      expect(parsed.isBareActQuery).toBe(true);
    });

    it('parseStatuteQuery("101 BNSS explain") → section=101, actId=bnss', () => {
      const parsed = parseStatuteQuery('101 BNSS explain to me', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.actId).toBe('bnss');
    });

    it('parseStatuteQuery("59 INCOME-TAX") → section=59, actId=income-tax', () => {
      const parsed = parseStatuteQuery('59 INCOME-TAX', 'IN');
      expect(parsed.section).toBe('59');
      expect(parsed.actId).toBe('income-tax');
      expect(parsed.isBareActQuery).toBe(true);
    });
  });

  describe('SectionAlignmentService', () => {
    const service = new SectionAlignmentService();

    it('detects false existence denial when exact section is in corpus', () => {
      const result = service.check({
        requestedActId: 'bnss',
        requestedSection: '101',
        statuteShortName: 'BNSS',
        outputMarkdown: 'BNSS section 101 does not exist in the Act.',
        authorities: [
          { id: 'statute-in-bnss-s101', title: 'BNSS s.101', citation: 'BNSS s.101' },
        ],
        exactSectionInCorpus: true,
      });
      expect(result.passed).toBe(false);
      expect(result.warnings[0]).toMatch(/does not exist/i);
    });

    it('detects section substitution (query=101, output cites 436)', () => {
      const result = service.check({
        requestedActId: 'bnss',
        requestedSection: '101',
        statuteShortName: 'BNSS',
        outputMarkdown: 'Under BNSS section 436, anticipatory bail may be granted by the court.',
        authorities: [
          { id: 'statute-in-bnss-s436', title: 'BNSS s.436', citation: 'BNSS s.436' },
        ],
        exactSectionInCorpus: false,
      });
      expect(result.passed).toBe(false);
      expect(result.warnings[0]).toMatch(/436/);
    });

    it('passes when output correctly cites the requested section', () => {
      const result = service.check({
        requestedActId: 'bnss',
        requestedSection: '101',
        statuteShortName: 'BNSS',
        outputMarkdown:
          'Under BNSS section 101, the District Magistrate may issue an order for complaint on oath.',
        authorities: [
          {
            id: 'statute-in-bnss-s101',
            title: 'BNSS s.101 — Power to compel restoration',
            citation: 'BNSS s.101',
          },
        ],
        exactSectionInCorpus: true,
      });
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('allows suggestion framing (different section is a suggestion, not the answer)', () => {
      const result = service.check({
        requestedActId: 'bnss',
        requestedSection: '101',
        statuteShortName: 'BNSS',
        outputMarkdown:
          'BNSS section 101 deals with restoration. Perhaps you meant BNSS section 100 as well.',
        authorities: [{ id: 'statute-in-bnss-s101', title: 'BNSS s.101', citation: 'BNSS s.101' }],
        exactSectionInCorpus: true,
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('SentenceAuditService negation detection', () => {
    const service = new SentenceAuditService();

    it('marks existence-denial sentence as contradicted when corpus has the section', () => {
      const result = service.audit({
        outputMarkdown: 'BNSS section 101 does not exist in the Act.',
        authorities: [
          {
            id: 'statute-in-bnss-s101',
            title: 'BNSS s.101 Power to compel',
            citation: 'BNSS s.101',
            fullText:
              'Section 101. Power to compel restoration of abducted females. — Any magistrate of the first class may, on complaint on oath, issue an order.',
            summary: null,
          },
        ],
      });
      const contradicted = result.entries.find((e) => e.status === 'contradicted');
      expect(contradicted).toBeDefined();
      expect(result.ungroundedCount).toBeGreaterThan(0);
    });

    it('does not mark factual sentences as contradicted', () => {
      const result = service.audit({
        outputMarkdown:
          'Under BNSS section 101, any Magistrate of the first class may issue orders. The complaint must be on oath.',
        authorities: [
          {
            id: 'statute-in-bnss-s101',
            title: 'BNSS s.101',
            citation: 'BNSS s.101',
            fullText:
              'Section 101 BNSS — Power to compel restoration. Magistrate of first class. Complaint on oath.',
            summary: null,
          },
        ],
      });
      expect(result.entries.some((e) => e.status === 'contradicted')).toBe(false);
    });
  });

  describe('Substance verification — section existence denial rule', () => {
    const service = new SubstanceVerificationService();

    it('fails when output denies existence while authority text was retrieved', () => {
      const result = service.checkBareActSubstance({
        query: '101 bnss explain',
        outputMarkdown:
          'There is no BNSS section 101. Section 436 governs bail provisions instead.',
        authorities: [
          {
            id: 'statute-in-bnss-s101',
            title: 'BNSS s.101',
            fullText:
              'Section 101. Power to compel restoration of abducted females. District Magistrate.',
            summary: null,
          },
        ],
        isBareActQuery: true,
      });
      expect(result.passed).toBe(false);
      expect(result.warnings.some((w) => /deny|does not exist|substitution|existence/i.test(w))).toBe(true);
    });

    it('passes when output correctly explains s.101 with authority text', () => {
      const result = service.checkBareActSubstance({
        query: '101 bnss explain',
        outputMarkdown:
          'BNSS section 101 empowers a District Magistrate to issue an order for the restoration of abducted females on receipt of a complaint on oath.',
        authorities: [
          {
            id: 'statute-in-bnss-s101',
            title: 'BNSS s.101',
            fullText:
              'Section 101. Power to compel restoration of abducted females. District Magistrate. Complaint on oath.',
            summary: null,
          },
        ],
        isBareActQuery: true,
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('Eval harness — bare-101-bnss golden case', () => {
    it('forbidInOutput patterns reject false denial and s.436 substitution', () => {
      const sectionForbidPattern = /does not exist|section 436|s\.436/i;
      const writForbidPattern = /high court writ/i;

      const denialOutput = 'BNSS section 101 does not exist. Section 436 BNSS governs bail.';
      const substitutionOutput = 'BNSS s.436 governs bail provisions.';
      const writOutput = 'Relief under BNSS s.101 requires a High Court writ petition.';
      const goodOutput =
        'BNSS section 101 empowers the District Magistrate to issue orders on complaint on oath for restoration of abducted females.';

      expect(sectionForbidPattern.test(denialOutput)).toBe(true);
      expect(sectionForbidPattern.test(substitutionOutput)).toBe(true);
      expect(writForbidPattern.test(writOutput)).toBe(true);

      expect(sectionForbidPattern.test(goodOutput)).toBe(false);
      expect(writForbidPattern.test(goodOutput)).toBe(false);
    });
  });
});
