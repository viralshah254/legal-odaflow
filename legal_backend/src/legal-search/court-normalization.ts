export interface NormalizedCourtMetadata {
  court: string | null;
  courtTierRank?: number;
}

const INDIA_HIGH_COURT_NAMES: Array<[RegExp, string]> = [
  [/\b(?:bombay|mumbai|maharashtra)\b/i, 'Bombay High Court'],
  [/\bdelhi\b/i, 'Delhi High Court'],
  [/\b(?:calcutta|kolkata|west bengal)\b/i, 'Calcutta High Court'],
  [/\b(?:madras|chennai|tamil nadu)\b/i, 'Madras High Court'],
  [/\b(?:allahabad|uttar pradesh)\b/i, 'Allahabad High Court'],
  [/\b(?:punjab|haryana|chandigarh)\b/i, 'Punjab and Haryana High Court'],
  [/\bkarnataka|bengaluru|bangalore\b/i, 'Karnataka High Court'],
  [/\bkerala\b/i, 'Kerala High Court'],
  [/\bgujarat\b/i, 'Gujarat High Court'],
  [/\brajasthan\b/i, 'Rajasthan High Court'],
  [/\bpatna|bihar\b/i, 'Patna High Court'],
  [/\bmadhya pradesh\b|\bmadhyapradesh\b/i, 'Madhya Pradesh High Court'],
  [/\borissa|odisha\b/i, 'Orissa High Court'],
  [/\bandhra pradesh\b/i, 'Andhra Pradesh High Court'],
  [/\btelangana\b/i, 'Telangana High Court'],
  [/\b(?:gauhati|assam)\b/i, 'Gauhati High Court'],
  [/\bjharkhand\b/i, 'Jharkhand High Court'],
  [/\buttarakhand\b/i, 'Uttarakhand High Court'],
  [/\bchhattisgarh\b|\bchattisgarh\b/i, 'Chhattisgarh High Court'],
  [/\bhimachal pradesh\b/i, 'Himachal Pradesh High Court'],
  [/\bjammu|kashmir|ladakh\b/i, 'High Court of Jammu & Kashmir and Ladakh'],
];

const KENYA_COURTS: Array<[RegExp, string, number]> = [
  [/\b(?:supreme court of kenya|kenya supreme court|kesc)\b/i, 'Supreme Court of Kenya', 0],
  [/\b(?:court of appeal(?: at [a-z ]+)?|kenya court of appeal|keca)\b/i, 'Court of Appeal of Kenya', 1],
  [/\b(?:environment and land court|elc|kelc)\b/i, 'Environment and Land Court of Kenya', 2],
  [/\b(?:employment and labour relations court|elrc|keelrc)\b/i, 'Employment and Labour Relations Court of Kenya', 2],
  [/\b(?:high court of kenya|kenya high court|kehc)\b/i, 'High Court of Kenya', 2],
  [/\b(?:chief magistrate|senior principal magistrate|principal magistrate|magistrates?'? court|kemc)\b/i, "Magistrates' Courts of Kenya", 3],
  [/\b(?:kadhi|kadhis)'?s? court\b/i, "Kadhis' Courts of Kenya", 3],
];

export function normalizeCourtMetadata(rawCourt?: string | null): NormalizedCourtMetadata {
  const value = rawCourt?.replace(/\s+/g, ' ').trim() ?? '';
  if (!value) return { court: null };
  const kenyaCourt = KENYA_COURTS.find(([pattern]) => pattern.test(value));
  if (kenyaCourt) {
    return { court: kenyaCourt[1], courtTierRank: kenyaCourt[2] };
  }
  if (/\bsupreme court\b/i.test(value)) {
    return { court: 'Supreme Court of India', courtTierRank: 0 };
  }
  if (/\bhigh court\b/i.test(value) || INDIA_HIGH_COURT_NAMES.some(([pattern]) => pattern.test(value))) {
    const canonical =
      INDIA_HIGH_COURT_NAMES.find(([pattern]) => pattern.test(value))?.[1] ??
      value;
    return { court: canonical, courtTierRank: 1 };
  }
  if (/\b(?:nclat|nclt|tribunal|commission|itat|cat|ngt|ncdrc)\b/i.test(value)) {
    return { court: value, courtTierRank: 2 };
  }
  if (/\b(?:district|sessions|magistrate|civil judge|commercial court)\b/i.test(value)) {
    return { court: value, courtTierRank: 3 };
  }
  return { court: value };
}
