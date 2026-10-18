import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

export interface UsStateManifestActEntry {
  actId: string;
  title: string;
  sourceAuthority: 'cornell-lii' | 'state-portal';
  sourceTier?: 'primary' | 'mirror' | 'fallback';
  primaryPdfUrl?: string;
  externalId?: string;
  notes?: string;
}

export interface UsStateSourcesManifest {
  version: number;
  stateCode: string;
  stateName: string;
  acts: UsStateManifestActEntry[];
}

const CORPUS_US_STATES_DIR = resolve(process.cwd(), 'corpus/us/states');

export function loadUsStateManifest(stateCode: string): UsStateSourcesManifest | undefined {
  const path = resolve(CORPUS_US_STATES_DIR, `${stateCode.toLowerCase()}.manifest.json`);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as UsStateSourcesManifest;
}

export function loadAllUsStateManifests(): UsStateSourcesManifest[] {
  if (!existsSync(CORPUS_US_STATES_DIR)) return [];
  return readdirSync(CORPUS_US_STATES_DIR)
    .filter((f) => f.endsWith('.manifest.json'))
    .map((f) => {
      const raw = readFileSync(resolve(CORPUS_US_STATES_DIR, f), 'utf8');
      return JSON.parse(raw) as UsStateSourcesManifest;
    });
}

export function findUsStateManifestAct(
  stateCode: string,
  actId: string,
): UsStateManifestActEntry | undefined {
  const manifest = loadUsStateManifest(stateCode);
  return manifest?.acts.find((a) => a.actId === actId);
}
