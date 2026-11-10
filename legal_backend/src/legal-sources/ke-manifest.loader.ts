import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { findStatuteById } from '@/legal-search/statute-registry';
import type { StatuteEntry } from '@/legal-search/statute-registry/types';
import type { KeManifestActEntry, KeSourcesManifest } from './ke-manifest.types';

const CORPUS_DIR = resolve(process.cwd(), 'corpus/ke');

export function keManifestPath(): string {
  return resolve(CORPUS_DIR, 'sources.manifest.json');
}

export function keManifestExists(): boolean {
  return existsSync(keManifestPath());
}

export function loadKeSourcesManifest(): KeSourcesManifest {
  if (!keManifestExists()) {
    return {
      countryCode: 'KE',
      source: 'kenyalaw.org',
      builtAt: '',
      placeCode: 'ke',
      acts: [],
    };
  }
  const raw = readFileSync(keManifestPath(), 'utf8');
  return JSON.parse(raw) as KeSourcesManifest;
}

export function findKeManifestAct(actId: string): KeManifestActEntry | undefined {
  const manifest = loadKeSourcesManifest();
  const exact = manifest.acts.find((entry) => entry.actId === actId);
  if (exact) return exact;
  // Curated workflow slugs and bulk-catalog IDs identify the same enactment.
  // Match its FRBR work, never a title shared by a repealed predecessor.
  const registry = findStatuteById(actId);
  if (registry?.countryCode !== 'KE' || !registry.frbrUri) return undefined;
  const work = registry.frbrUri.replace(/^\/+/, '').replace(/\/[a-z]{3}@[^/]+.*$/, '').replace(/\/+$/, '');
  const entry = manifest.acts.find(candidate => candidate.workFrbrUri.replace(/^\/+|\/+$/g, '') === work);
  return entry ? { ...entry, actId } : undefined;
}

/** Resolve a Kenya act from the curated registry or the bulk manifest catalog. */
export function resolveKeActEntry(actId: string): StatuteEntry | undefined {
  const registry = findStatuteById(actId);
  if (registry?.countryCode === 'KE') return registry;

  const manifest = findKeManifestAct(actId);
  if (!manifest) return undefined;

  return {
    id: manifest.actId,
    countryCode: 'KE',
    acronyms: [],
    fullName: manifest.title,
    shortName: manifest.title.length > 48 ? `${manifest.title.slice(0, 45)}…` : manifest.title,
    year: manifest.year ? parseInt(manifest.year, 10) : undefined,
    practiceAreas: [],
    searchAliases: [manifest.title],
    sourceUrl: manifest.publicUrl,
    frbrUri: manifest.expressionFrbrUri,
    externalId: manifest.workFrbrUri,
    ingestPriority: 3,
  };
}
