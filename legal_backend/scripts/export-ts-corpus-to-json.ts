import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CURATED_CASE_LAW_CORPUS } from '../src/legal-sources/curated-case-law-corpus';
import { PRACTICE_AREA_AUTHORITY_SEEDS } from '../src/legal-sources/practice-area-authority.seed';
import { getAllCuratedAuthoritiesForAudit } from '../src/ai/drafting/draft-research-grounding.service';
import { allCuratedEnrichBanks } from '../src/ai/unified-drafting/enrich/curated-enrich-banks';
import type { IndiaCaselawEntry } from '../src/legal-sources/india-caselaw-corpus.types';

const outputDir = join(__dirname, '..', 'data', 'india-caselaw-corpus', 'bundles');

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bv(?:ersus)?\.?\b/g, 'v')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function yearFrom(...values: Array<string | null | undefined>): number | undefined {
  for (const value of values) {
    const year = value?.match(/\b(19|20)\d{2}\b/)?.[0];
    if (year) return Number(year);
  }
  return undefined;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bv(?:ersus)?\.?\b/g, 'v')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupeKey(title: string, citation?: string | null): string {
  return `${normalize(title)}-${yearFrom(citation, title) ?? 'unknown'}`;
}

function toEntry(source: {
  id?: string;
  title: string;
  citation?: string | null;
  neutralCitation?: string | null;
  court?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  summary?: string | null;
  holding?: string | null;
  topics?: string[];
  practiceAreas?: string[];
  draftKinds?: string[];
  treatmentStatus?: string | null;
  decisionYear?: number | null;
  enrichAreas?: string[];
}): IndiaCaselawEntry {
  const citation = source.citation?.trim() ?? '';
  const title = source.title.trim();
  const year = source.decisionYear ?? yearFrom(citation, source.neutralCitation, title);
  return {
    id: source.id?.replace(/^curated__/, '') || `${slug(title)}-${year ?? 'undated'}`,
    title,
    citation,
    neutralCitation: source.neutralCitation ?? undefined,
    court: source.court ?? 'Supreme Court of India',
    courtLevel: /high court/i.test(source.court ?? '') ? 'high' : 'supreme',
    countryCode: 'IN',
    jurisdiction: 'IN',
    decisionDate: year ? `${year}-01-01` : undefined,
    sourceName: source.sourceName ?? 'Existing platform curated corpus',
    sourceUrl: source.sourceUrl ?? undefined,
    sourceBundle: 'platform_legacy',
    summary: source.summary?.trim() || source.holding?.trim() || 'Curated authority imported from the platform.',
    holding: source.holding?.trim() || undefined,
    topics: source.topics ?? [],
    practiceAreas: source.practiceAreas ?? [],
    draftKinds: source.draftKinds ?? [],
    enrichAreas: source.enrichAreas,
    treatmentStatus: (source.treatmentStatus ?? 'good_law') as IndiaCaselawEntry['treatmentStatus'],
    extractionConfidence: citation || source.neutralCitation ? 'high' : 'needs_review',
    reviewedByHuman: Boolean(citation || source.neutralCitation),
    dedupeKey: dedupeKey(title, citation || source.neutralCitation),
  };
}

function mergeEntries(entries: IndiaCaselawEntry[]): IndiaCaselawEntry[] {
  const output = new Map<string, IndiaCaselawEntry>();
  for (const entry of entries) {
    const key = normalize(entry.citation || entry.neutralCitation || entry.dedupeKey);
    const existing = output.get(key);
    if (!existing) {
      output.set(key, entry);
      continue;
    }
    output.set(key, {
      ...existing,
      titleAliases: [...new Set([...(existing.titleAliases ?? []), entry.title])],
      summary: entry.summary.length > existing.summary.length ? entry.summary : existing.summary,
      holding: existing.holding || entry.holding,
      topics: [...new Set([...existing.topics, ...entry.topics])],
      practiceAreas: [...new Set([...existing.practiceAreas, ...entry.practiceAreas])],
      draftKinds: [...new Set([...existing.draftKinds, ...entry.draftKinds])],
      enrichAreas: [...new Set([...(existing.enrichAreas ?? []), ...(entry.enrichAreas ?? [])])],
      reviewedByHuman: existing.reviewedByHuman || entry.reviewedByHuman,
    });
  }
  return [...output.values()].sort((a, b) => a.title.localeCompare(b.title));
}

const corpusEntries = CURATED_CASE_LAW_CORPUS.map((entry) => toEntry(entry));
const groundingEntries = getAllCuratedAuthoritiesForAudit().map((entry) =>
  toEntry({
    ...entry,
    court: entry.sourceName?.includes('High Court') ? 'High Court of India' : 'Supreme Court of India',
    topics: [],
    practiceAreas: [],
    draftKinds: [],
    decisionYear: entry.decisionYear,
  }),
);
const enrichEntries = allCuratedEnrichBanks().map((entry) =>
  toEntry({
    id: entry.caseId,
    title: entry.title,
    citation: entry.citation,
    court: entry.court,
    sourceName: 'Existing platform enrichment bank',
    summary: entry.proposition,
    holding: entry.proposition,
    topics: entry.areas,
    practiceAreas: [],
    draftKinds: [],
    treatmentStatus: entry.treatmentStatus,
    decisionYear: entry.decisionYear,
    enrichAreas: entry.areas,
  }),
);
const seedEntries = PRACTICE_AREA_AUTHORITY_SEEDS
  .filter((entry) => entry.countryCode === 'IN' && entry.authorityType === 'CASE_LAW')
  .map((entry) => toEntry(entry));

const entries = mergeEntries([...corpusEntries, ...groundingEntries, ...enrichEntries, ...seedEntries]);
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'existing-platform.json'), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Exported ${entries.length} unique Indian authorities to bundles/existing-platform.json`);
