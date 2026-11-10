import {
  expandQuery,
  findStatuteByManifestActId,
  parseStatuteQuery,
  requestedSectionMissingFromAuthorities,
  resolveAcronym,
  resolveIngestActId,
} from './statute-registry';

describe('statute-registry', () => {
  describe('expandQuery — India', () => {
    const cases = [
      'section 101 bnss',
      'BNSS section 101',
      'bns 302 murder',
      'ipc 376',
      'crpc 125 maintenance',
      'crpc 438 anticipatory bail',
      'iea 65B electronic evidence',
      'pocso section 4',
      'rera registration',
      'ibc insolvency petition',
    ];

    it.each(cases)('expands IN bare-act query: %s', (query) => {
      const result = expandQuery(query, 'IN');
      expect(result.isBareActQuery).toBe(true);
      expect(result.expandedQueries.length).toBeGreaterThan(1);
    });

    it('expands BNSS section 101 with full statute names', () => {
      const { expandedQueries, isBareActQuery } = expandQuery('section 101 bnss', 'IN');
      expect(isBareActQuery).toBe(true);
      expect(expandedQueries).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Bharatiya Nagarik Suraksha Sanhita/i),
        ]),
      );
    });

    it('remaps CrPC 125 to BNSS 144', () => {
      const result = expandQuery('crpc 125 maintenance', 'IN');
      expect(result.remappedSection).toEqual(
        expect.objectContaining({ actId: 'bnss', section: '144' }),
      );
    });

    it('remaps IPC 302 to BNS 101', () => {
      const result = expandQuery('ipc section 302', 'IN');
      expect(result.remappedSection).toEqual(
        expect.objectContaining({ actId: 'bns', section: '101' }),
      );
    });

    it('expands court and tribunal abbreviations from India glossary', () => {
      const imageList = [
        'SC bail order',
        'HC writ petition',
        'NCLT insolvency',
        'ITAT appeal',
        'CrPC anticipatory bail',
        'CPC order 7 rule 11',
        'IPC section 420',
      ];
      for (const query of imageList) {
        const result = expandQuery(query, 'IN');
        expect(result.expandedQueries.length).toBeGreaterThan(1);
        expect(result.searchTopics.length).toBeGreaterThan(0);
      }
    });

    it('expands NCLT to National Company Law Tribunal and links IBC topics', () => {
      const result = expandQuery('NCLT admission', 'IN');
      expect(result.expandedQueries).toEqual(
        expect.arrayContaining([expect.stringMatching(/National Company Law Tribunal/i)]),
      );
      expect(result.searchTopics).toEqual(expect.arrayContaining(['ibc']));
    });
  });

  describe('expandQuery — United States', () => {
    const cases = [
      'FLSA overtime rules',
      'ADA reasonable accommodation',
      'FMLA leave entitlement',
      'Title VII discrimination',
      'UCC Article 2 sales',
      'FRCP Rule 12 motion',
      '18 USC fraud',
      'Bankruptcy Code chapter 7',
      'INA visa requirements',
      'Copyright Act fair use',
    ];

    it.each(cases)('expands US query: %s', (query) => {
      const result = expandQuery(query, 'US');
      expect(result.expandedQueries.length).toBeGreaterThan(0);
      expect(result.searchTopics.length).toBeGreaterThan(0);
    });

    it('resolves FLSA acronym', () => {
      const statute = resolveAcronym('flsa', 'US');
      expect(statute?.fullName).toMatch(/Fair Labor Standards Act/i);
    });
  });

  describe('expandQuery — Kenya', () => {
    const cases = [
      'Cap 63 murder',
      'Cap 75 criminal procedure',
      'Employment Act 2007 termination',
      'Companies Act 2015 directors',
      'Land Act 2012 lease',
      'Constitution of Kenya Article 47',
      'Cap 160 succession',
      'VAT Act 2013 registration',
      'Arbitration Act 1995',
      'Cap 470 income tax',
    ];

    it.each(cases)('expands KE query: %s', (query) => {
      const result = expandQuery(query, 'KE');
      expect(result.expandedQueries.length).toBeGreaterThan(0);
    });

    it('resolves Cap 63 to Penal Code', () => {
      const statute = resolveAcronym('cap 63', 'KE');
      expect(statute?.fullName).toMatch(/Penal Code/i);
    });
  });

  describe('expandQuery — United Kingdom', () => {
    const cases = [
      'ERA 1996 unfair dismissal',
      'Equality Act 2010 discrimination',
      'Companies Act 2006 directors duties',
      'PACE 1984 stop and search',
      'Theft Act 1968 burglary',
      'Housing Act 1988 section 21',
      'Consumer Rights Act 2015 refund',
      'Children Act 1989 welfare',
      'Limitation Act 1980 contract',
      'Data Protection Act 2018 GDPR',
    ];

    it.each(cases)('expands GB query: %s', (query) => {
      const result = expandQuery(query, 'GB');
      expect(result.expandedQueries.length).toBeGreaterThan(0);
    });

    it('resolves ERA 1996', () => {
      const statute = resolveAcronym('era 1996', 'GB');
      expect(statute?.fullName).toMatch(/Employment Rights Act 1996/i);
    });
  });

  describe('parseStatuteQuery', () => {
    it('parses section and act from BNSS query', () => {
      const parsed = parseStatuteQuery('section 101 bnss', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.statute?.id).toBe('bnss');
      expect(parsed.isBareActQuery).toBe(true);
    });

    it('parses reverse pattern "101 bnss" (number before act)', () => {
      const parsed = parseStatuteQuery('101 bnss', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.statute?.id).toBe('bnss');
      expect(parsed.isBareActQuery).toBe(true);
    });

    it('parses "101 BNSS explain to me"', () => {
      const parsed = parseStatuteQuery('101 BNSS explain to me', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.statute?.id).toBe('bnss');
    });

    it('parses "explain 101 bnss" (number after regular word)', () => {
      const parsed = parseStatuteQuery('explain 101 bnss', 'IN');
      expect(parsed.section).toBe('101');
      expect(parsed.statute?.id).toBe('bnss');
    });

    it('does not false-match "within 30 days" as a bare-act statute query', () => {
      const parsed = parseStatuteQuery('appeal filed within 30 days of the order', 'IN');
      // "days"/"within" are not statute acronyms — no statute should resolve
      expect(parsed.statute).toBeUndefined();
      expect(parsed.actId).toBeUndefined();
    });

    it('does not resolve IN acronyms for US country', () => {
      const parsed = parseStatuteQuery('bnss bail provisions', 'US');
      expect(parsed.statute).toBeUndefined();
    });

    it('parses "Land Act s.179" to land-act-2012 with section 179', () => {
      const parsed = parseStatuteQuery('Land Act s.179', 'KE');
      expect(parsed.section).toBe('179');
      expect(parsed.actId).toBe('land-act-2012');
      expect(parsed.statute?.id).toBe('land-act-2012');
      expect(parsed.isBareActQuery).toBe(true);
    });

    it('parses "land s.179" with section 179 but without forcing land-act-2012', () => {
      const parsed = parseStatuteQuery('land s.179', 'KE');
      expect(parsed.section).toBe('179');
      // Bare "land" is intentionally not an act acronym (ambiguous).
      expect(parsed.actId).toBeUndefined();
      expect(parsed.statute).toBeUndefined();
    });
  });

  describe('requestedSectionMissingFromAuthorities', () => {
    it('detects when BNSS s.101 is absent from retrieved authorities', () => {
      const gap = requestedSectionMissingFromAuthorities('section 101 bnss', 'IN', [
        { title: 'BNSS s.96', citation: 'BNSS s.96', summary: 'Search warrant provisions' },
        { title: 'BNSS s.1', citation: 'BNSS s.1', summary: 'Short title' },
      ]);
      expect(gap.missing).toBe(true);
      expect(gap.section).toBe('101');
      expect(gap.statuteShortName).toBe('BNSS');
    });

    it('returns missing=false when the requested section is present', () => {
      const gap = requestedSectionMissingFromAuthorities('section 101 bnss', 'IN', [
        {
          title: 'Power to compel restoration of abducted females',
          citation: 'BNSS s.101',
          fullText: 'Section 101 BNSS 2023 — Power to compel restoration of abducted females.',
        },
      ]);
      expect(gap.missing).toBe(false);
    });
  });

  describe('manifest actId resolution', () => {
    it.each([
      ['negotiable-instruments', 'nia'],
      ['companies-act-2013', 'companies-act'],
      ['contract-act-1872', 'contract-act'],
      ['pocso-act-2012', 'pocso'],
      ['domestic-violence-act-2005', 'domestic-violence'],
      ['motor-vehicles-act-1988', 'mva'],
      ['gst-act-2017', 'gst-act'],
      ['ibc-2016', 'ibc'],
    ])('maps manifest %s to registry %s', (manifestActId, registryId) => {
      expect(resolveIngestActId(manifestActId, 'IN')).toBe(registryId);
      expect(findStatuteByManifestActId(manifestActId, 'IN')?.id).toBe(registryId);
    });

    it('resolves direct registry ids unchanged', () => {
      expect(resolveIngestActId('bnss', 'IN')).toBe('bnss');
      expect(resolveIngestActId('ipc', 'IN')).toBe('ipc');
    });
  });
});

 it('does not mistake an enactment year for a section number', () => {
   const parsed = parseStatuteQuery('Under the Kenya Employment Act 2007 what notice applies?', 'KE');
   expect(parsed.actId).toBe('employment-act-2007');
   expect(parsed.section).toBeUndefined();
   expect(parseStatuteQuery('Companies Act section 2007', 'GB').section).toBe('2007');
 });


it('distinguishes US Code title numbers from section numbers and enactment years', () => {
  expect(parseStatuteQuery('42 USC 1983', 'US')).toMatchObject({ section: '1983', actId: 'section-1983' });
  expect(parseStatuteQuery('18 U.S.C. § 1343', 'US').section).toBe('1343');
});


it('does not treat dates in a US case question as statute sections', () => {
  expect(parseStatuteQuery('Historical research as of 17 May 1954: explain Brown v. Board of Education, 347 U.S. 483 (1954).', 'US').section).toBeUndefined();
});
