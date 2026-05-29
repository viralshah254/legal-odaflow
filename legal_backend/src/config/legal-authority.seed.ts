export interface LegalAuthoritySeed {
  countryCode: string;
  jurisdiction?: string;
  authorityType: string;
  title: string;
  citation?: string;
  court?: string;
  courtLevel?: string;
  sourceName: string;
  sourceUrl?: string;
  summary?: string;
  holding?: string;
  topics: string[];
  practiceAreas: string[];
}

const US_JURISDICTIONS = [
  'California',
  'New York',
  'Texas',
  'Florida',
  'Illinois',
  'Federal',
];

const IN_JURISDICTIONS = [
  'Delhi',
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'West Bengal',
  'Gujarat',
];

const KE_JURISDICTIONS = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Nakuru',
  'Eldoret',
];

const GB_JURISDICTIONS = ['England & Wales', 'Scotland', 'Northern Ireland'];

function buildSeeds(
  countryCode: 'US' | 'IN' | 'KE' | 'GB',
  jurisdictions: string[],
  prefix: string,
): LegalAuthoritySeed[] {
  const seeds: LegalAuthoritySeed[] = [];

  for (let index = 1; index <= 22; index += 1) {
    const jurisdiction = jurisdictions[index % jurisdictions.length];
    seeds.push({
      countryCode,
      jurisdiction,
      authorityType: index % 3 === 0 ? 'STATUTE' : index % 2 === 0 ? 'REGULATION' : 'CASE',
      title: `${prefix} Authority ${index}: ${jurisdiction} Legal Reference`,
      citation: `${countryCode}-${jurisdiction.slice(0, 3).toUpperCase()}-${1000 + index}`,
      court: index % 2 === 0 ? `${jurisdiction} High Court` : `${jurisdiction} Appellate Court`,
      courtLevel: index % 2 === 0 ? 'APPELLATE' : 'TRIAL',
      sourceName:
        countryCode === 'US'
          ? 'CourtListener Seed'
          : countryCode === 'IN'
            ? 'India Kanoon Seed'
            : countryCode === 'KE'
              ? 'Kenya Law Reports Seed'
              : 'UK Legislation Seed',
      sourceUrl: `https://example.com/${countryCode.toLowerCase()}/authority/${index}`,
      summary: `Seed summary for ${prefix} authority ${index} covering ${jurisdiction} procedural and substantive rules.`,
      holding: index % 3 === 0 ? undefined : `Holding summary for ${prefix} authority ${index}.`,
      topics: [`topic-${index}`, jurisdiction.toLowerCase().replace(/\s+/g, '-')],
      practiceAreas: [
        index % 2 === 0 ? 'Litigation' : 'Corporate',
        index % 3 === 0 ? 'Employment' : 'Contract',
      ],
    });
  }

  return seeds;
}

export const LEGAL_AUTHORITY_SEEDS: LegalAuthoritySeed[] = [
  ...buildSeeds('US', US_JURISDICTIONS, 'US'),
  ...buildSeeds('IN', IN_JURISDICTIONS, 'IN'),
  ...buildSeeds('KE', KE_JURISDICTIONS, 'KE'),
  ...buildSeeds('GB', GB_JURISDICTIONS, 'GB'),
];
