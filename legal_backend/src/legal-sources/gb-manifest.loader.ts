import * as fs from 'fs';
import * as path from 'path';

export interface GbManifestAct {
  actId: string;
  title: string;
  publicUrl: string;
  externalId?: string;
}

export interface GbSourcesManifest {
  countryCode: 'GB';
  source: string;
  builtAt: string;
  acts: GbManifestAct[];
}

const MANIFEST_PATH = path.join(
  process.cwd(),
  'corpus',
  'gb',
  'sources.manifest.json',
);

export function gbManifestExists(): boolean {
  return fs.existsSync(MANIFEST_PATH);
}

export function loadGbSourcesManifest(): GbSourcesManifest {
  if (!gbManifestExists()) {
    return {
      countryCode: 'GB',
      source: 'missing',
      builtAt: '',
      acts: [],
    };
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw) as GbSourcesManifest;
}
