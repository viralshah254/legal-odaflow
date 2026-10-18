import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type {
  IndiaCaselawCorpusFile,
  IndiaCaselawCorpusManifest,
  IndiaCaselawEntry,
} from '../src/legal-sources/india-caselaw-corpus.types';

const corpusDir = join(__dirname, '..', 'data', 'india-caselaw-corpus');
const bundleDir = join(corpusDir, 'bundles');

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bv(?:ersus)?\.?\b/g, 'v')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function mergeKey(entry: IndiaCaselawEntry): string {
  return normalize(entry.citation || entry.neutralCitation || entry.dedupeKey);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function richer(first: IndiaCaselawEntry, second: IndiaCaselawEntry): IndiaCaselawEntry {
  const preferred = second.summary.length > first.summary.length ? second : first;
  const other = preferred === first ? second : first;
  return {
    ...other,
    ...preferred,
    titleAliases: unique([...(first.titleAliases ?? []), ...(second.titleAliases ?? []), first.title, second.title]),
    sourceBundle: unique([first.sourceBundle, second.sourceBundle]).join('+'),
    sourcePdf: unique([first.sourcePdf ?? '', second.sourcePdf ?? '']).join(', ') || undefined,
    sourcePageRange: unique([first.sourcePageRange ?? '', second.sourcePageRange ?? '']).join(', ') || undefined,
    neutralCitation: first.neutralCitation ?? second.neutralCitation,
    citation: first.citation || second.citation,
    holding: first.holding && first.holding.length >= (second.holding?.length ?? 0) ? first.holding : second.holding,
    topics: unique([...first.topics, ...second.topics]),
    practiceAreas: unique([...first.practiceAreas, ...second.practiceAreas]),
    draftKinds: unique([...first.draftKinds, ...second.draftKinds]),
    enrichAreas: unique([...(first.enrichAreas ?? []), ...(second.enrichAreas ?? [])]),
    sectionsCited: unique([...(first.sectionsCited ?? []), ...(second.sectionsCited ?? [])]),
    keyParagraphs: unique([...(first.keyParagraphs ?? []), ...(second.keyParagraphs ?? [])]),
    reviewedByHuman: first.reviewedByHuman || second.reviewedByHuman,
    extractionConfidence:
      first.extractionConfidence === 'high' || second.extractionConfidence === 'high'
        ? 'high'
        : first.extractionConfidence === 'medium' || second.extractionConfidence === 'medium'
          ? 'medium'
          : 'needs_review',
  };
}

const bundles = readdirSync(bundleDir)
  .filter((file) => file.endsWith('.json'))
  .sort();
const entries = new Map<string, IndiaCaselawEntry>();

for (const bundle of bundles) {
  const parsed = JSON.parse(readFileSync(join(bundleDir, bundle), 'utf8')) as IndiaCaselawEntry[];
  for (const candidate of parsed) {
    const key = mergeKey(candidate);
    const existing = entries.get(key);
    entries.set(key, existing ? richer(existing, candidate) : candidate);
  }
}

const manifest: IndiaCaselawCorpusManifest = {
  version: '2026.07.1',
  corpusEdition: 'IN-Caselaw-2026.07',
  generatedAt: new Date().toISOString(),
  entryCount: entries.size,
  bundles,
};
const usedIds = new Set<string>();
const normalizedEntries = [...entries.values()]
  .sort((a, b) => a.title.localeCompare(b.title))
  .map((entry) => {
    let id = entry.id;
    if (usedIds.has(id)) {
      const suffix = normalize(entry.citation || entry.neutralCitation || entry.dedupeKey).slice(-12);
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);
    return { ...entry, id };
  });
const corpus: IndiaCaselawCorpusFile = {
  manifest,
  entries: normalizedEntries,
};

writeFileSync(join(corpusDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(corpusDir, 'india-caselaw-corpus.json'), `${JSON.stringify(corpus, null, 2)}\n`);
console.log(`Merged ${bundles.length} bundles into ${manifest.entryCount} unique authorities.`);
