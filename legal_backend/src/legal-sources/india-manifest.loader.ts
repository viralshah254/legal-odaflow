import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  IndiaManifestActEntry,
  IndiaSourcesManifest,
  YourLordshipsMirrorManifest,
} from './india-manifest.types';

const CORPUS_DIR = resolve(process.cwd(), 'corpus/in');

const EMPTY_MANIFEST: IndiaSourcesManifest = {
  version: 0,
  countryCode: 'IN',
  acts: [],
};

const EMPTY_MIRROR_MANIFEST: YourLordshipsMirrorManifest = {
  version: 0,
  baseUrl: '',
  catalogPage: '',
  mirrors: [],
};

let cachedManifest: IndiaSourcesManifest | null = null;
let cachedMirrorManifest: YourLordshipsMirrorManifest | null = null;

export function indiaManifestExists(): boolean {
  return existsSync(resolve(CORPUS_DIR, 'sources.manifest.json'));
}

export function loadIndiaSourcesManifest(): IndiaSourcesManifest {
  if (cachedManifest) return cachedManifest;
  const manifestPath = resolve(CORPUS_DIR, 'sources.manifest.json');
  if (!existsSync(manifestPath)) {
    cachedManifest = EMPTY_MANIFEST;
    return cachedManifest;
  }
  const raw = readFileSync(manifestPath, 'utf8');
  cachedManifest = JSON.parse(raw) as IndiaSourcesManifest;
  return cachedManifest;
}

export function loadYourLordshipsMirrorManifest(): YourLordshipsMirrorManifest {
  if (cachedMirrorManifest) return cachedMirrorManifest;
  const mirrorPath = resolve(CORPUS_DIR, 'yourlordships-mirror.manifest.json');
  if (!existsSync(mirrorPath)) {
    cachedMirrorManifest = EMPTY_MIRROR_MANIFEST;
    return cachedMirrorManifest;
  }
  const raw = readFileSync(mirrorPath, 'utf8');
  cachedMirrorManifest = JSON.parse(raw) as YourLordshipsMirrorManifest;
  return cachedMirrorManifest;
}

export function findManifestAct(actId: string): IndiaManifestActEntry | undefined {
  const manifest = loadIndiaSourcesManifest();
  return manifest.acts.find((entry) => entry.actId === actId);
}

export function resolvePrimaryPdfUrl(entry: IndiaManifestActEntry): string | undefined {
  return entry.primaryPdfUrl ?? entry.fallbackPdfUrl ?? entry.mirrorPdfUrl;
}

export function resolveMirrorPdfUrl(actId: string): string | undefined {
  const sources = findManifestAct(actId);
  if (sources?.mirrorPdfUrl) {
    return sources.mirrorPdfUrl;
  }

  const mirrorManifest = loadYourLordshipsMirrorManifest();
  const mirror = mirrorManifest.mirrors.find((m) => m.actId === actId);
  if (!mirror) return undefined;
  return `${mirrorManifest.baseUrl}${mirror.pdfFile}`;
}
