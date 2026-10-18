import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  IndiaCaselawCorpusFile,
  IndiaCaselawEntry,
} from './india-caselaw-corpus.types';

let cachedCorpus: IndiaCaselawCorpusFile | null = null;

function corpusPath(): string {
  const bundled = join(__dirname, '..', '..', 'data', 'india-caselaw-corpus', 'india-caselaw-corpus.json');
  if (existsSync(bundled)) return bundled;
  return join(process.cwd(), 'data', 'india-caselaw-corpus', 'india-caselaw-corpus.json');
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bv(?:ersus)?\.?\b/g, 'v')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function loadIndiaCaselawCorpusFile(): IndiaCaselawCorpusFile {
  if (cachedCorpus) return cachedCorpus;
  const parsed = JSON.parse(readFileSync(corpusPath(), 'utf8')) as IndiaCaselawCorpusFile;
  cachedCorpus = parsed;
  return parsed;
}

export function loadIndiaCaselawCorpus(): IndiaCaselawEntry[] {
  return loadIndiaCaselawCorpusFile().entries;
}

export function getIndiaCaselawCorpusEdition(): string {
  return loadIndiaCaselawCorpusFile().manifest.corpusEdition;
}

export function findIndiaCaselawByCitation(value: string): IndiaCaselawEntry | undefined {
  const target = normalise(value);
  return loadIndiaCaselawCorpus().find(
    (entry) =>
      normalise(entry.citation) === target ||
      (entry.neutralCitation ? normalise(entry.neutralCitation) === target : false),
  );
}

export function findIndiaCaselawByTitle(value: string): IndiaCaselawEntry[] {
  const target = normalise(value);
  if (!target) return [];
  return loadIndiaCaselawCorpus().filter((entry) =>
    [entry.title, ...(entry.titleAliases ?? [])].some((candidate) => {
      const normalizedCandidate = normalise(candidate);
      return normalizedCandidate.includes(target) || target.includes(normalizedCandidate);
    }),
  );
}

export function findIndiaCaselawByDraftKind(kind: string): IndiaCaselawEntry[] {
  return loadIndiaCaselawCorpus().filter((entry) => entry.draftKinds.includes(kind));
}

export function findIndiaCaselawByEnrichArea(area: string): IndiaCaselawEntry[] {
  return loadIndiaCaselawCorpus().filter((entry) => entry.enrichAreas?.includes(area));
}

export function toRetrievedAuthority(entry: IndiaCaselawEntry): RetrievedAuthority {
  const year = entry.decisionDate?.slice(0, 4) ?? entry.citation.match(/\b(19|20)\d{2}\b/)?.[0];
  return {
    id: `india-corpus-${entry.id}`,
    title: entry.title,
    citation: entry.citation,
    neutralCitation: entry.neutralCitation ?? null,
    sourceName: entry.sourceName,
    summary: entry.summary,
    fullText: entry.keyParagraphs?.join('\n\n') ?? entry.holding ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    score: entry.reviewedByHuman ? 0.98 : 0.82,
    treatmentStatus: entry.treatmentStatus,
    decisionYear: year ? Number(year) : undefined,
    courtTierRank: entry.courtLevel === 'supreme' ? 0 : entry.courtLevel === 'high' ? 1 : 2,
  };
}
