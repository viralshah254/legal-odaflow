import { StatuteEntry } from './types';

/** USC title numbers with enacted positive-law titles (subset flagged priority 2). */
const USC_PRIORITY_TITLES = new Set([
  1, 5, 8, 11, 15, 18, 28, 29, 42,
]);

const USC_TITLE_NAMES: Record<number, string> = {
  1: 'General Provisions',
  2: 'The Congress',
  3: 'The President',
  4: 'Flag and Seal, Seat of Government, and the States',
  5: 'Government Organization and Employees',
  6: 'Domestic Security',
  7: 'Agriculture',
  8: 'Aliens and Nationality',
  9: 'Arbitration',
  10: 'Armed Forces',
  11: 'Bankruptcy',
  12: 'Banks and Banking',
  13: 'Census',
  14: 'Coast Guard',
  15: 'Commerce and Trade',
  16: 'Conservation',
  17: 'Copyrights',
  18: 'Crimes and Criminal Procedure',
  19: 'Customs Duties',
  20: 'Education',
  21: 'Food and Drugs',
  22: 'Foreign Relations and Intercourse',
  23: 'Highways',
  24: 'Hospitals and Asylums',
  25: 'Indians',
  26: 'Internal Revenue Code',
  27: 'Intoxicating Liquors',
  28: 'Judiciary and Judicial Procedure',
  29: 'Labor',
  30: 'Mineral Lands and Mining',
  31: 'Money and Finance',
  32: 'National Guard',
  33: 'Navigation and Navigable Waters',
  34: 'Crime Control and Law Enforcement',
  35: 'Patents',
  36: 'Patriotic and National Observances, Ceremonies, and Organizations',
  37: 'Pay and Allowances of the Uniformed Services',
  38: "Veterans' Benefits",
  39: 'Postal Service',
  40: 'Public Buildings, Property, and Works',
  41: 'Public Contracts',
  42: 'The Public Health and Welfare',
  43: 'Public Lands',
  44: 'Public Printing and Documents',
  45: 'Railroads',
  46: 'Shipping',
  47: 'Telecommunications',
  48: 'Territories and Insular Possessions',
  49: 'Transportation',
  50: 'War and National Defense',
  51: 'National and Commercial Space Programs',
  52: 'Voting and Elections',
  54: 'National Park Service and Related Programs',
};

const CFR_TITLE_NAMES: Record<number, string> = {
  1: 'General Provisions',
  2: 'Federal Financial Assistance',
  3: 'The President',
  4: 'Accounts',
  5: 'Administrative Personnel',
  6: 'Domestic Security',
  7: 'Agriculture',
  8: 'Aliens and Nationality',
  9: 'Animals and Animal Products',
  10: 'Energy',
  11: 'Federal Elections',
  12: 'Banks and Banking',
  13: 'Business Credit and Assistance',
  14: 'Aeronautics and Space',
  15: 'Commerce and Foreign Trade',
  16: 'Commercial Practices',
  17: 'Commodity and Securities Exchanges',
  18: 'Conservation of Power and Water Resources',
  19: 'Customs Duties',
  20: 'Employees Benefits',
  21: 'Food and Drugs',
  22: 'Foreign Relations',
  23: 'Highways',
  24: 'Housing and Urban Development',
  25: 'Indians',
  26: 'Internal Revenue',
  27: 'Alcohol, Tobacco Products and Firearms',
  28: 'Judicial Administration',
  29: 'Labor',
  30: 'Mineral Resources',
  31: 'Money and Finance: Treasury',
  32: 'National Defense',
  33: 'Navigation and Navigable Waters',
  34: 'Education',
  35: 'Panama Canal',
  36: 'Patriotic and National Observances, Ceremonies, and Organizations',
  37: 'Patents, Trademarks, and Copyrights',
  38: 'Pensions, Bonuses, and Veterans Relief',
  39: 'Postal Service',
  40: 'Protection of Environment',
  41: 'Public Contracts and Property Management',
  42: 'Public Health',
  43: 'Public Lands: Interior',
  44: 'Emergency Management and Assistance',
  45: 'Public Welfare',
  46: 'Shipping',
  47: 'Telecommunication',
  48: 'Transportation Regulations',
  49: 'Transportation',
  50: 'Wildlife and Fisheries',
};

export const USC_TITLE_NUMBERS = Object.keys(USC_TITLE_NAMES).map((n) => parseInt(n, 10));

export const CFR_TITLE_NUMBERS = Object.keys(CFR_TITLE_NAMES).map((n) => parseInt(n, 10));

export function buildUsUscTitleStatutes(): StatuteEntry[] {
  return USC_TITLE_NUMBERS.map((titleNumber) => {
    const name = USC_TITLE_NAMES[titleNumber] ?? `Title ${titleNumber}`;
    return {
      id: `usc-title-${titleNumber}`,
      countryCode: 'US',
      acronyms: [`title ${titleNumber}`, `${titleNumber} u.s.c`, `${titleNumber} usc`, `usc ${titleNumber}`],
      fullName: `United States Code, Title ${titleNumber} — ${name}`,
      shortName: `${titleNumber} U.S.C.`,
      practiceAreas: ['federal'],
      searchAliases: [`${titleNumber} U.S.C.`, `Title ${titleNumber}`, `USC Title ${titleNumber}`],
      sourceUrl: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNumber}`,
      externalId: `usc-title-${titleNumber}`,
      ingestPriority: USC_PRIORITY_TITLES.has(titleNumber) ? 2 : 4,
    };
  });
}

export function buildUsCfrTitleStatutes(): StatuteEntry[] {
  return CFR_TITLE_NUMBERS.map((titleNumber) => {
    const name = CFR_TITLE_NAMES[titleNumber] ?? `Title ${titleNumber}`;
    return {
      id: `cfr-title-${titleNumber}`,
      countryCode: 'US',
      acronyms: [`cfr ${titleNumber}`, `${titleNumber} cfr`, `title ${titleNumber} cfr`],
      fullName: `Code of Federal Regulations, Title ${titleNumber} — ${name}`,
      shortName: `${titleNumber} C.F.R.`,
      practiceAreas: ['federal', 'regulatory'],
      searchAliases: [`${titleNumber} C.F.R.`, `CFR Title ${titleNumber}`],
      sourceUrl: `https://www.ecfr.gov/current/title-${titleNumber}`,
      externalId: `cfr-${titleNumber}`,
      ingestPriority: titleNumber <= 5 ? 3 : 4,
    };
  });
}

export const US_FEDERAL_BULK_STATUTES: StatuteEntry[] = [
  ...buildUsUscTitleStatutes(),
  ...buildUsCfrTitleStatutes(),
];
