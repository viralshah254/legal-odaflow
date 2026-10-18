/**
 * Ingest a bare-act PDF into LegalAuthority + pgvector embeddings.
 *
 * Run:
 *   npm run ingest:bare-act-pdf -- --actId dowry-prohibition --pdf corpus/in/dowry-prohibition-act-1961.pdf
 *   npm run ingest:bare-act-pdf -- --actId income-tax --pdf corpus/in/income-tax-act-1961.pdf --priority-only
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { findStatuteById } from '../src/legal-search/statute-registry';
import {
  IN_INCOME_TAX_PRIORITY_SECTIONS,
  parseActTextIntoSections,
  parseConstitutionTextIntoSections,
} from '../src/legal-sources/parsers/india-act-text.parser';
import { truncateAtSentence } from '../src/legal-search/text-truncate';

interface CliArgs {
  actId: string;
  pdfPath: string;
  countryCode: string;
  priorityOnly: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const actId = get('--actId');
  const pdfPath = get('--pdf');
  const countryCode = get('--countryCode') ?? 'IN';
  const priorityOnly = argv.includes('--priority-only');

  if (!actId || !pdfPath) {
    console.error(
      'Usage: npm run ingest:bare-act-pdf -- --actId <id> --pdf <path> [--countryCode IN] [--priority-only]',
    );
    process.exit(1);
  }

  return { actId, pdfPath, countryCode, priorityOnly };
}

async function extractPdfText(filePath: string): Promise<string> {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`PDF not found: ${absolutePath}`);
  }

  const pdfParse = (await import('pdf-parse')).default;
  const buffer = readFileSync(absolutePath);
  const parsed = await pdfParse(buffer);
  return parsed.text ?? '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statute = findStatuteById(args.actId);

  if (!statute) {
    throw new Error(`Unknown actId: ${args.actId}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const rawText = await extractPdfText(args.pdfPath);

    const prioritySections =
      args.priorityOnly && args.actId === 'income-tax'
        ? IN_INCOME_TAX_PRIORITY_SECTIONS
        : undefined;

    const sections =
      args.actId === 'constitution'
        ? parseConstitutionTextIntoSections(rawText)
        : parseActTextIntoSections(rawText, { prioritySections });

    if (sections.length === 0) {
      throw new Error('No sections parsed from PDF — check file format and section headings');
    }

    const fetchResults = sections.map((section) => ({
      section: section.section,
      title: section.title,
      summary: truncateAtSentence(section.fullText, 400),
      fullText: section.fullText,
      sourceName: 'Bare Act PDF',
      sourceUrl: statute.sourceUrl,
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    }));

    const batch = await ingest.batchUpsertActSections(args.actId, args.countryCode, fetchResults, {
      sourceUrl: statute.sourceUrl,
    });

    const result = {
      actId: args.actId,
      countryCode: args.countryCode,
      pdfPath: args.pdfPath,
      sectionsParsed: sections.length,
      sectionsUpserted: batch.upserted,
      skippedUnchanged: batch.skipped,
      chunksStored: 0,
      errors: [] as string[],
    };

    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
