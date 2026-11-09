/**
 * Manage India Code PDF corpus: inventory, bundle, generate structure reference, patch manifest.
 *
 *   npm run corpus:india-inventory
 *   npm run corpus:india-bundle
 *   npm run generate:india-act-structure
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import pdfParse from 'pdf-parse';
import {
  INDIA_ACTS_SOURCE_DIR,
  PDF_FILENAME_TO_MANIFEST_ACT_ID,
  SKIP_PDF_FILES,
  bundledPdfRelativePath,
} from '../src/legal-sources/india-act-pdf-map';
import {
  parseActTextIntoProvisions,
  type ActStructureProfile,
} from '../src/legal-sources/parsers/india-act-structure.parser';
import { loadIndiaSourcesManifest } from '../src/legal-sources/india-manifest.loader';
import { resolveIngestActId } from '../src/legal-search/statute-registry';
import { SGST_STATE_ACTS } from '../src/legal-sources/sgst-states';

const CORPUS_DIR = resolve(process.cwd(), 'corpus/in/india-code');
const MAP_PATH = resolve(process.cwd(), 'corpus/in/india-code/pdf-manifest.map.json');
const STRUCTURE_PATH = resolve(process.cwd(), 'corpus/in/act-structure.reference.json');
const MANIFEST_PATH = resolve(process.cwd(), 'corpus/in/sources.manifest.json');

interface PdfMapEntry {
  filename: string;
  manifestActId: string;
  registryActId?: string;
  bundledPath: string;
  sourceAuthority: 'india-code-local';
  skipped?: boolean;
  skipReason?: string;
}

interface StructureReferenceEntry {
  sourceSha256: string;
  coverage: 'EXTRACTED_READABLE_PROVISIONS';
  manifestActId: string;
  registryActId?: string;
  sourcePdf: string;
  structure: ActStructureProfile;
  sectionCount: number;
  orderCount?: number;
  scheduleCount?: number;
  articleCount?: number;
}

function command(): string {
  return process.argv[2] ?? 'inventory';
}

async function parsePdfStructure(absPath: string, documentType?: 'constitution') {
  const buffer = readFileSync(absPath);
  const parsed = await pdfParse(buffer);
  const { provisions, structure } = parseActTextIntoProvisions(parsed.text, { documentType });
  return { provisions, structure, charCount: parsed.text.length };
}

export async function runInventory(): Promise<PdfMapEntry[]> {
  if (!existsSync(INDIA_ACTS_SOURCE_DIR)) {
    throw new Error(`Source directory not found: ${INDIA_ACTS_SOURCE_DIR}`);
  }

  const files = readdirSync(INDIA_ACTS_SOURCE_DIR).filter((f) => f.endsWith('.pdf')).sort();
  const entries: PdfMapEntry[] = [];
  const unmapped: string[] = [];

  for (const filename of files) {
    if (SKIP_PDF_FILES.has(filename)) {
      entries.push({
        filename,
        manifestActId: PDF_FILENAME_TO_MANIFEST_ACT_ID[filename] ?? 'skipped',
        bundledPath: '',
        sourceAuthority: 'india-code-local',
        skipped: true,
        skipReason: 'duplicate',
      });
      continue;
    }

    const manifestActId = PDF_FILENAME_TO_MANIFEST_ACT_ID[filename];
    if (!manifestActId) {
      unmapped.push(filename);
      continue;
    }

    entries.push({
      filename,
      manifestActId,
      registryActId: resolveIngestActId(manifestActId, 'IN'),
      bundledPath: bundledPdfRelativePath(manifestActId),
      sourceAuthority: 'india-code-local',
    });
  }

  if (unmapped.length > 0) {
    console.warn(`[corpus:inventory] Unmapped PDFs (${unmapped.length}):`);
    unmapped.forEach((f) => console.warn(`  - ${f}`));
  }

  mkdirSync(CORPUS_DIR, { recursive: true });
  writeFileSync(
    MAP_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: INDIA_ACTS_SOURCE_DIR,
        totalFiles: files.length,
        mapped: entries.filter((e) => !e.skipped).length,
        skipped: entries.filter((e) => e.skipped).length,
        unmapped,
        entries,
      },
      null,
      2,
    ),
  );

  console.log(
    `[corpus:inventory] ${entries.filter((e) => !e.skipped).length} mapped, ` +
      `${entries.filter((e) => e.skipped).length} skipped, ${unmapped.length} unmapped → ${MAP_PATH}`,
  );
  return entries;
}

export async function runBundle(): Promise<void> {
  const mapRaw = existsSync(MAP_PATH)
    ? JSON.parse(readFileSync(MAP_PATH, 'utf8'))
    : { entries: await runInventory() };
  const entries: PdfMapEntry[] = mapRaw.entries ?? mapRaw;

  mkdirSync(CORPUS_DIR, { recursive: true });
  let copied = 0;

  for (const entry of entries) {
    if (entry.skipped) continue;
    const src = join(INDIA_ACTS_SOURCE_DIR, entry.filename);
    const dest = resolve(process.cwd(), entry.bundledPath);
    if (!existsSync(src)) {
      console.warn(`[corpus:bundle] Missing source: ${src}`);
      continue;
    }
    copyFileSync(src, dest);
    copied += 1;
  }

  console.log(`[corpus:bundle] Copied ${copied} PDFs → ${CORPUS_DIR}`);
}

export async function runGenerateStructure(): Promise<void> {
  const mapRaw = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const entries: PdfMapEntry[] = (mapRaw.entries ?? []).filter((e: PdfMapEntry) => !e.skipped);

  const reference: Record<string, StructureReferenceEntry> = {};

  for (const entry of entries) {
    const absPath = resolve(process.cwd(), entry.bundledPath);
    if (!existsSync(absPath)) {
      console.warn(`[generate:structure] Bundled PDF missing: ${entry.bundledPath}`);
      continue;
    }

    const documentType =
      entry.manifestActId === 'constitution' ? ('constitution' as const) : undefined;
    const { provisions, structure } = await parsePdfStructure(absPath, documentType);

    reference[entry.manifestActId] = {
      manifestActId: entry.manifestActId,
      registryActId: entry.registryActId ?? resolveIngestActId(entry.manifestActId, 'IN'),
      sourcePdf: entry.bundledPath,
      sourceSha256: createHash('sha256').update(readFileSync(absPath)).digest('hex'),
      coverage: 'EXTRACTED_READABLE_PROVISIONS',
      structure,
      sectionCount: structure.sections?.count ?? structure.articles?.count ?? provisions.length,
      orderCount: structure.orders?.count,
      scheduleCount: structure.schedules?.count,
      articleCount: structure.articles?.count,
    };

    console.log(
      `[generate:structure] ${entry.manifestActId}: ` +
        `${structure.sections?.count ?? 0} sections, ` +
        `${structure.articles?.count ?? 0} articles, ` +
        `${structure.orders?.count ?? 0} orders, ` +
        `${structure.schedules?.count ?? 0} schedules`,
    );
  }

  writeFileSync(
    STRUCTURE_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), acts: reference }, null, 2),
  );
  console.log(`[generate:structure] Wrote ${Object.keys(reference).length} acts → ${STRUCTURE_PATH}`);
}

export function runPatchManifest(): void {
  const mapRaw = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const entries: PdfMapEntry[] = (mapRaw.entries ?? []).filter((e: PdfMapEntry) => !e.skipped);
  const manifest = loadIndiaSourcesManifest();
  const byActId = new Map(manifest.acts.map((a) => [a.actId, a]));

  let patched = 0;
  for (const entry of entries) {
    const act = byActId.get(entry.manifestActId);
    if (!act) continue;
    act.sourceAuthority = 'india-code';
    act.localPdfPath = entry.bundledPath;
    patched += 1;
  }

  // Fix wrong primaries for tier-1 acts
  const tier1Fixes: Record<string, Partial<{ sourceAuthority: string; mirrorPdfUrl?: string }>> = {
    bnss: { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    bns: { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    bsa: { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    ipc: { sourceAuthority: 'india-code' },
    'gst-act-2017': { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    'motor-vehicles-act-1988': { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    cpc: { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    'arbitration-conciliation-act-1996': { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    'rera-2016': { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
    'specific-relief-act-1963': { sourceAuthority: 'india-code', mirrorPdfUrl: undefined },
  };

  for (const [actId, fixes] of Object.entries(tier1Fixes)) {
    const act = byActId.get(actId);
    if (!act) continue;
    Object.assign(act, fixes);
    if (fixes.mirrorPdfUrl === undefined) delete act.mirrorPdfUrl;
  }

  // Add merchant-shipping-act-2025 if missing
  if (!byActId.has('merchant-shipping-act-2025')) {
    manifest.acts.push({
      actId: 'merchant-shipping-act-2025',
      sourceAuthority: 'india-code',
      sourceTier: 'primary',
      localPdfPath: bundledPdfRelativePath('merchant-shipping-act-2025'),
      primaryPdfUrl: 'https://www.indiacode.nic.in/',
      notes: 'Merchant Shipping Act 2025 (Act 24 of 2025). Supersedes Merchant Shipping Act 1958.',
    });
  }

  const extraManifestActs: Array<{ actId: string; notes: string }> = [
    {
      actId: 'maintenance-and-welfare-of-parents-act',
      notes: 'Maintenance and Welfare of Parents and Senior Citizens Act 2007.',
    },
    {
      actId: 'gujarat-court-fees-act',
      notes: 'Gujarat Court Fees Act (state act bundled from local corpus).',
    },
    {
      actId: 'prevention-of-insults-national-honour-act',
      notes: 'Prevention of Insults to National Honour Act 1971.',
    },
    {
      actId: 'transplantation-of-human-organs-act',
      notes: 'Transplantation of Human Organs and Tissues Act 1994.',
    },
    {
      actId: 'black-money-act',
      notes: 'Black Money (Undisclosed Foreign Income and Assets) Act 2015.',
    },
  ];

  for (const extra of extraManifestActs) {
    if (byActId.has(extra.actId)) continue;
    manifest.acts.push({
      actId: extra.actId,
      sourceAuthority: 'india-code',
      sourceTier: 'primary',
      localPdfPath: bundledPdfRelativePath(extra.actId),
      primaryPdfUrl: 'https://www.indiacode.nic.in/',
      notes: extra.notes,
    });
    byActId.set(extra.actId, manifest.acts[manifest.acts.length - 1]);
  }

  let sgstAdded = 0;
  for (const { actId, stateName } of SGST_STATE_ACTS) {
    if (byActId.has(actId)) continue;
    manifest.acts.push({
      actId,
      sourceAuthority: 'gst-council',
      sourceTier: 'fallback',
      primaryPdfUrl: 'http://gstcouncil.gov.in/sgst-act',
      notes: `State GST Act — ${stateName}. Fetch PDF from GST Council when not bundled locally.`,
    });
    sgstAdded += 1;
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `[corpus:patch-manifest] Patched localPdfPath on ${patched} acts, ` +
      `added ${sgstAdded} SGST entries → ${MANIFEST_PATH}`,
  );
}

async function main() {
  const cmd = command();
  switch (cmd) {
    case 'inventory':
      await runInventory();
      break;
    case 'bundle':
      if (!existsSync(MAP_PATH)) await runInventory();
      await runBundle();
      break;
    case 'generate-structure':
      if (!existsSync(MAP_PATH)) await runInventory();
      await runBundle();
      await runGenerateStructure();
      break;
    case 'patch-manifest':
      if (!existsSync(MAP_PATH)) await runInventory();
      runPatchManifest();
      break;
    case 'all':
      await runInventory();
      await runBundle();
      runPatchManifest();
      await runGenerateStructure();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
