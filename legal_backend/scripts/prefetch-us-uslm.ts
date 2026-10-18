/**
 * Prefetch U.S. Code USLM XML via GovInfo API into corpus/us/usc/.
 *
 * Run:
 *   GOVINFO_API_KEY=... npm run prefetch:us-uslm
 *   npm run prefetch:us-uslm -- --title=18
 *   npm run prefetch:us-uslm -- --force
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { GovInfoUscConnector } from '../src/legal-sources/connectors/govinfo-usc.connector';
import { USC_TITLE_NUMBERS } from '../src/legal-search/statute-registry/us.statutes.federal-bulk';

function loadEnvFile(): void {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

async function main() {
  const force = process.argv.includes('--force');
  const titleArg = process.argv.find((a) => a.startsWith('--title='));
  const titlesArg = process.argv.find((a) => a.startsWith('--titles='));
  const titleFilter = titleArg ? parseInt(titleArg.split('=')[1], 10) : undefined;
  const titlesList = titlesArg
    ? titlesArg.split('=')[1].split(',').map((t) => parseInt(t.trim(), 10)).filter((n) => !Number.isNaN(n))
    : null;
  const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg
    ? Math.max(1, parseInt(concurrencyArg.split('=')[1], 10))
    : 2;

  const govinfo = new GovInfoUscConnector();
  const apiKey = govinfo.getApiKey();
  if (apiKey === 'DEMO_KEY') {
    console.warn(
      '[prefetch:us-uslm] Using DEMO_KEY (low rate limits). Set GOVINFO_API_KEY in .env for production prefetch.',
    );
  }

  const probeOk = await govinfo.probe();
  if (!probeOk) {
    console.error(
      '[prefetch:us-uslm] GovInfo API unreachable. Check GOVINFO_API_KEY and network.',
    );
    process.exit(1);
  }

  const titles =
    titlesList && titlesList.length > 0
      ? titlesList
      : titleFilter && !Number.isNaN(titleFilter)
        ? [titleFilter]
        : USC_TITLE_NUMBERS;

  const failed: number[] = [];
  let ok = 0;

  for (let i = 0; i < titles.length; i += concurrency) {
    const batch = titles.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (titleNum) => {
        console.log(`[prefetch:us-uslm] Title ${titleNum}…`);
        const sections = await govinfo.fetchTitleSections(titleNum, { force });
        return { titleNum, ok: sections.length > 0, sections: sections.length };
      }),
    );
    for (const r of results) {
      if (r.ok) {
        ok += 1;
        console.log(`[prefetch:us-uslm] Title ${r.titleNum} — ${r.sections} sections cached (zip)`);
      } else failed.push(r.titleNum);
    }
  }

  console.log(
    JSON.stringify(
      {
        edition: process.env.GOVINFO_USCODE_EDITION ?? '2024',
        titlesRequested: titles.length,
        titlesCached: ok,
        failed,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
