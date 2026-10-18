import { readFileSync } from 'fs';
import { join } from 'path';
import type { IndiaCaselawCorpusFile, IndiaCaselawEntry } from '../src/legal-sources/india-caselaw-corpus.types';

const corpusPath = join(__dirname, '..', 'data', 'india-caselaw-corpus', 'india-caselaw-corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as IndiaCaselawCorpusFile;
const errors: string[] = [];
const citationOwners = new Map<string, string>();
const idOwners = new Map<string, string>();

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function validateEntry(entry: IndiaCaselawEntry, index: number): void {
  const label = `${entry.title || `entry ${index}`}`;
  if (!entry.id || !entry.title || !entry.summary || !entry.sourceBundle || !entry.dedupeKey) {
    errors.push(`${label}: missing id, title, summary, sourceBundle, or dedupeKey`);
  }
  if (entry.countryCode !== 'IN') errors.push(`${label}: countryCode must be IN`);
  if (!entry.topics || !entry.practiceAreas || !entry.draftKinds) {
    errors.push(`${label}: taxonomy arrays must be present`);
  }
  if (entry.extractionConfidence === 'high' && !entry.citation && !entry.neutralCitation) {
    errors.push(`${label}: high-confidence authority is missing a citation`);
  }
  if (entry.keyParagraphs?.some((paragraph) => paragraph.length > 550)) {
    errors.push(`${label}: a key paragraph exceeds 550 characters`);
  }
  const existingId = idOwners.get(entry.id);
  if (existingId) errors.push(`${label}: duplicate id also used by ${existingId}`);
  else idOwners.set(entry.id, label);

  const citation = normalize(entry.citation || entry.neutralCitation || '');
  if (citation) {
    const existing = citationOwners.get(citation);
    if (existing) errors.push(`${label}: duplicate citation also used by ${existing}`);
    else citationOwners.set(citation, label);
  }
}

corpus.entries.forEach(validateEntry);
if (corpus.manifest.entryCount !== corpus.entries.length) {
  errors.push(`manifest entryCount ${corpus.manifest.entryCount} does not match ${corpus.entries.length} entries`);
}

if (errors.length > 0) {
  console.error(`Caselaw corpus validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const reviewCount = corpus.entries.filter((entry) => entry.extractionConfidence === 'needs_review').length;
console.log(
  `Validated ${corpus.entries.length} Indian authorities (${reviewCount} held from production ingest pending review).`,
);
