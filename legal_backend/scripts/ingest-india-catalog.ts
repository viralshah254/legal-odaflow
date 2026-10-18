/**
 * Discover central acts from India Code browse and print or update sources.manifest.json.
 *
 * Run:
 *   npm run ingest:india-catalog
 *   npm run ingest:india-catalog -- --max-pages=2
 *   npm run ingest:india-catalog -- --update
 *   npm run ingest:india-catalog -- --search="Indian Penal Code"
 */
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IndiaCodeCatalogConnector } from '../src/legal-sources/connectors/india-code-catalog.connector';
import type {
  IndiaManifestActEntry,
  IndiaSourcesManifest,
} from '../src/legal-sources/india-manifest.types';

function parseArgs(argv: string[]) {
  const maxPages = Number(argv.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] ?? '500');
  const update = argv.includes('--update');
  const noResolve = argv.includes('--no-resolve-bitstreams');
  const search = argv.find((arg) => arg.startsWith('--search='))?.split('=')[1];
  return { maxPages, update, noResolve, search };
}

function manifestPath(): string {
  return path.join(__dirname, '../corpus/in/sources.manifest.json');
}

function loadManifest(): IndiaSourcesManifest {
  return JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) as IndiaSourcesManifest;
}

function actKey(entry: { externalId?: string; primaryPdfUrl?: string; actId: string }): string {
  if (entry.externalId) return entry.externalId;
  if (entry.primaryPdfUrl) return entry.primaryPdfUrl;
  return entry.actId;
}

function toManifestEntry(discovered: {
  actId: string;
  title: string;
  primaryPdfUrl: string;
  externalId?: string;
  year?: number;
}): IndiaManifestActEntry {
  return {
    actId: discovered.actId,
    sourceAuthority: 'india-code',
    sourceTier: 'primary',
    primaryPdfUrl: discovered.primaryPdfUrl,
    externalId: discovered.externalId,
    notes: discovered.title,
    editionDate: discovered.year ? `${discovered.year}-01-01` : undefined,
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

async function main() {
  const { maxPages, update, noResolve, search } = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const catalog = app.get(IndiaCodeCatalogConnector);
    const discovered = search
      ? await catalog.searchByTitle(search)
      : await catalog.discoverActs({
          maxPages,
          resolveBitstreams: !noResolve,
        });

    const summary = {
      mode: search ? 'search' : 'discover',
      query: search ?? null,
      discoveredCount: discovered.length,
      sample: discovered.slice(0, 5),
    };
    console.log(JSON.stringify(summary, null, 2));

    if (!update) {
      console.log(JSON.stringify({ acts: discovered }, null, 2));
      return;
    }

    const manifest = loadManifest();
    const existingKeys = new Set(
      manifest.acts.flatMap((entry) => [
        actKey(entry),
        entry.primaryPdfUrl ?? '',
        entry.actId,
      ]),
    );

    const additions: IndiaManifestActEntry[] = [];
    for (const act of discovered) {
      const key = actKey(act);
      if (existingKeys.has(key) || existingKeys.has(act.actId) || existingKeys.has(act.primaryPdfUrl)) {
        continue;
      }
      additions.push(toManifestEntry(act));
      existingKeys.add(key);
      existingKeys.add(act.actId);
      existingKeys.add(act.primaryPdfUrl);
    }

    manifest.acts.push(...additions);
    fs.writeFileSync(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(
      JSON.stringify(
        {
          updated: true,
          addedCount: additions.length,
          totalActs: manifest.acts.length,
          addedActIds: additions.map((entry) => entry.actId),
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
