import { BadRequestException } from '@nestjs/common';
import { KeSectionFinderService } from './ke-section-finder.service';

describe('KeSectionFinderService', () => {
  const prisma = {
    legalAuthority: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(12),
    },
    statuteSectionProfile: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const bareActLookup = {
    lookupExactSection: jest.fn().mockResolvedValue({
      found: true,
      actId: 'cap-63',
      section: '5',
      authority: {
        id: 'statute-ke-cap-63-s5',
        title: 'Section 5 — Test offence',
        citation: 'Penal Code s.5',
        fullText: 'Full section text for testing.',
        summary: 'Summary',
        sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/1930/10/eng@2023-12-11',
        sourceName: 'Kenya Law',
      },
    }),
  };
  const hybridSearch = {
    search: jest.fn().mockResolvedValue([]),
    searchStatuteSectionsPg: jest.fn().mockResolvedValue([]),
  };
  const statuteIngest = {
    resolveSectionOnDemand: jest.fn(),
    buildSectionId: jest.fn((country: string, actId: string, section: string) =>
      `statute-${country.toLowerCase()}-${actId}-s${section}`,
    ),
  };
  const popularService = {
    recordSearch: jest.fn().mockResolvedValue(undefined),
    getPopular: jest.fn().mockResolvedValue([]),
  };
  const profileService = {
    profileToEntry: jest.fn(),
  };

  const service = new KeSectionFinderService(
    prisma as never,
    bareActLookup as never,
    hybridSearch as never,
    statuteIngest as never,
    popularService as never,
    profileService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.legalAuthority.findMany.mockResolvedValue([]);
    prisma.legalAuthority.count.mockResolvedValue(12);
    bareActLookup.lookupExactSection.mockResolvedValue({
      found: true,
      actId: 'cap-63',
      section: '5',
      authority: {
        id: 'statute-ke-cap-63-s5',
        title: 'Section 5 — Test offence',
        citation: 'Penal Code s.5',
        fullText: 'Full section text for testing.',
        summary: 'Summary',
        sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/1930/10/eng@2023-12-11',
        sourceName: 'Kenya Law',
      },
    });
    hybridSearch.search.mockResolvedValue([]);
    hybridSearch.searchStatuteSectionsPg.mockResolvedValue([]);
    statuteIngest.resolveSectionOnDemand.mockResolvedValue(undefined);
  });

  it('rejects non-KE country codes', async () => {
    await expect(service.find({ q: 'Cap 63 s.5', countryCode: 'IN' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('finds an exact Kenya statute section from corpus', async () => {
    const result = await service.find({
      q: 'Penal Code s.5',
      countryCode: 'KE',
      actId: 'cap-63',
      section: '5',
    });

    expect(result.countryCode).toBe('KE');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].legacyActShort).toBe('Penal Code');
    expect(result.matches[0].legacySection).toBe('5');
    expect(result.matches[0].matchSource).toBe('corpus');
    expect(result.disclaimer).toContain('Kenya Law');
  });

  it('returns default popular queries for Kenya', async () => {
    const popular = await service.getPopular('KE', 3);
    expect(popular.length).toBe(3);
    expect(popular[0].displayLabel).toContain('Penal Code');
  });

  it('resolves "land s.179" via topic+section before hybrid search', async () => {
    prisma.legalAuthority.findMany.mockResolvedValueOnce([
      {
        id: 'statute-ke-ke-act-2019-1-s179',
        title: 'Section 179 — Compulsory acquisition of land',
        citation: 'KE-ACT-2019-1 s.179',
        fullText: 'Compulsory acquisition of land text.',
        summary: 'Compulsory acquisition of land',
        sourceUrl: 'https://new.kenyalaw.org/example',
        sourceName: 'Kenya Law',
        updatedAt: new Date(),
      },
    ]);
    bareActLookup.lookupExactSection.mockResolvedValue({ found: false });

    const result = await service.find({
      q: 'land s.179',
      countryCode: 'KE',
    });

    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].id).toBe('statute-ke-ke-act-2019-1-s179');
    expect(result.matches[0].legacySection).toBe('179');
    expect(hybridSearch.search).not.toHaveBeenCalled();
  });

  it('filters hybrid hits to the parsed section number only', async () => {
    prisma.legalAuthority.findMany.mockResolvedValueOnce([]);
    bareActLookup.lookupExactSection.mockResolvedValue({ found: false });
    hybridSearch.search.mockResolvedValueOnce([
      {
        id: 'statute-ke-crops-act-s4',
        title: 'Crops Act §4 — Guiding principles',
        citation: 'Crops Act s.4',
        fullText: 'agricultural land principles',
        summary: 'Guiding principles',
        sourceUrl: null,
        sourceName: 'Kenya Law',
      },
      {
        id: 'statute-ke-ke-act-2019-1-s179',
        title: 'Section 179 — Compulsory acquisition of land',
        citation: 'KE-ACT-2019-1 s.179',
        fullText: 'Compulsory acquisition of land text.',
        summary: 'Compulsory acquisition',
        sourceUrl: null,
        sourceName: 'Kenya Law',
      },
    ]);

    const result = await service.find({
      q: 'land s.179',
      countryCode: 'KE',
    });

    expect(hybridSearch.search).toHaveBeenCalled();
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('statute-ke-ke-act-2019-1-s179');
    expect(result.matches[0].legacySection).toBe('179');
  });

  it('rejects CPC §191 that only mentions 179 in the title for land s.179', async () => {
    prisma.legalAuthority.findMany.mockResolvedValueOnce([]);
    bareActLookup.lookupExactSection.mockResolvedValue({ found: false });
    hybridSearch.search.mockResolvedValueOnce([
      {
        id: 'statute-ke-cpc-kenya-s191',
        title: 'CPC Kenya §191 — Construction of sections 179 to 190',
        citation: 'CPC Kenya s.191',
        fullText: 'The provisions of sections 179 to 190…',
        summary: 'Construction of sections 179 to 190',
        sourceUrl: null,
        sourceName: 'Kenya Law',
      },
      {
        id: 'statute-ke-ke-act-2019-1-s179',
        title: 'Section 179 — Compulsory acquisition of land',
        citation: 'KE-ACT-2019-1 s.179',
        fullText: 'Compulsory acquisition of land text.',
        summary: 'Compulsory acquisition',
        sourceUrl: null,
        sourceName: 'Kenya Law',
      },
    ]);

    const result = await service.find({
      q: 'land s.179',
      countryCode: 'KE',
    });

    expect(result.matches.map((m) => m.id)).not.toContain('statute-ke-cpc-kenya-s191');
    expect(result.matches[0]?.id).toBe('statute-ke-ke-act-2019-1-s179');
    expect(result.matches[0]?.legacySection).toBe('179');
  });

  it('scores land-related §179 above unrelated §179 via topic', async () => {
    prisma.legalAuthority.findMany.mockResolvedValueOnce([
      {
        id: 'statute-ke-other-act-s179',
        title: 'Section 179 — Procedure for appeals',
        citation: 'Other Act s.179',
        fullText: 'Appeals procedure.',
        summary: 'Appeals',
        sourceUrl: null,
        sourceName: 'Kenya Law',
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'statute-ke-ke-act-2019-1-s179',
        title: 'Section 179 — Compulsory acquisition of land',
        citation: 'KE-ACT-2019-1 s.179',
        fullText: 'Compulsory acquisition of land text.',
        summary: 'Compulsory acquisition of land',
        sourceUrl: null,
        sourceName: 'Kenya Law',
        updatedAt: new Date('2024-06-01'),
      },
    ]);
    bareActLookup.lookupExactSection.mockResolvedValue({ found: false });

    const result = await service.find({
      q: 'land s.179',
      countryCode: 'KE',
    });

    expect(hybridSearch.search).not.toHaveBeenCalled();
    expect(result.matches[0].id).toBe('statute-ke-ke-act-2019-1-s179');
    expect(result.matches.map((m) => m.id)).not.toContain('statute-ke-other-act-s179');
  });

  it('runs topic+section resolve when exact actId lookup misses', async () => {
    bareActLookup.lookupExactSection.mockResolvedValue({ found: false });
    prisma.legalAuthority.findMany.mockResolvedValueOnce([
      {
        id: 'statute-ke-ke-act-2019-1-s179',
        title: 'Section 179 — Compulsory acquisition of land',
        citation: 'KE-ACT-2019-1 s.179',
        fullText: 'Compulsory acquisition of land text.',
        summary: 'Compulsory acquisition of land',
        sourceUrl: null,
        sourceName: 'Kenya Law',
        updatedAt: new Date(),
      },
    ]);

    const result = await service.find({
      q: 'land s.179',
      countryCode: 'KE',
      actId: 'missing-act',
      section: '179',
    });

    expect(result.matches[0]?.id).toBe('statute-ke-ke-act-2019-1-s179');
    expect(hybridSearch.search).not.toHaveBeenCalled();
  });
});
