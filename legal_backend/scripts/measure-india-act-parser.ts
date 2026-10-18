import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import pdfParse from 'pdf-parse';
import {
  assessActSectionQuality,
  isHeadingOnlySection,
} from '../src/legal-sources/parsers/india-act-text.parser';
import {
  findArrangementBodyBoundary,
  parseActTextIntoProvisions,
  provisionsToLegacySections,
} from '../src/legal-sources/parsers/india-act-structure.parser';

interface ActMeasurement {
  actId: string;
  sectionCount: number;
  headingOnlyCount: number;
  stubRatio: number;
  arrangementStart: number | null;
  arrangementBoundary: number | null;
  arrangementPosition: number | null;
  textLength: number;
}

interface MeasurementReport {
  generatedAt: string;
  corpusDir: string;
  acts: ActMeasurement[];
}

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function measurePdf(pdfPath: string): Promise<ActMeasurement> {
  const parsed = await pdfParse(readFileSync(pdfPath));
  const text = parsed.text ?? '';
  const parseResult = parseActTextIntoProvisions(text);
  const legacySections = provisionsToLegacySections(
    parseResult.provisions,
  ).filter((section) => /^\d+[A-Z]{0,3}$/i.test(section.section));
  const quality = assessActSectionQuality(legacySections, {
    additionalHeadingOnly: parseResult.quality.rejectedHeadingOnlySections,
  });
  const arrangementStart = text.search(/ARRANGEMENT OF (?:SECTIONS|ARTICLES|ORDERS)/i);
  const arrangementBoundary =
    arrangementStart >= 0 ? findArrangementBodyBoundary(text) : null;

  return {
    actId: basename(pdfPath, '.pdf'),
    sectionCount: legacySections.length,
    headingOnlyCount:
      legacySections.filter(isHeadingOnlySection).length +
      parseResult.quality.rejectedHeadingOnlySections,
    stubRatio: Number(quality.stubRatio.toFixed(4)),
    arrangementStart: arrangementStart >= 0 ? arrangementStart : null,
    arrangementBoundary,
    arrangementPosition:
      arrangementStart >= 0 && text.length > 0
        ? Number((arrangementStart / text.length).toFixed(4))
        : null,
    textLength: text.length,
  };
}

function compareReports(before: MeasurementReport, after: MeasurementReport): string[] {
  const failures: string[] = [];
  const beforeByAct = new Map(before.acts.map((act) => [act.actId, act]));
  for (const current of after.acts) {
    const previous = beforeByAct.get(current.actId);
    if (!previous) continue;
    if (current.sectionCount < previous.sectionCount) {
      failures.push(
        `${current.actId}: section count regressed ${previous.sectionCount} -> ${current.sectionCount}`,
      );
    }
    if (current.stubRatio > previous.stubRatio + 0.01) {
      failures.push(
        `${current.actId}: stub ratio regressed ${previous.stubRatio} -> ${current.stubRatio}`,
      );
    }
  }
  return failures;
}

async function main(): Promise<void> {
  const corpusDir = resolve(
    process.cwd(),
    argumentValue('corpus') ?? 'corpus/in/india-code',
  );
  if (!existsSync(corpusDir)) {
    throw new Error(`India Code corpus directory not found: ${corpusDir}`);
  }

  const pdfs = readdirSync(corpusDir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort()
    .map((name) => resolve(corpusDir, name));
  if (pdfs.length === 0) {
    throw new Error(`No PDFs found in ${corpusDir}`);
  }

  const acts: ActMeasurement[] = [];
  for (const pdfPath of pdfs) {
    acts.push(await measurePdf(pdfPath));
  }
  const report: MeasurementReport = {
    generatedAt: new Date().toISOString(),
    corpusDir,
    acts,
  };

  console.table(
    acts.map((act) => ({
      act: act.actId,
      sections: act.sectionCount,
      stubs: act.headingOnlyCount,
      stubRatio: act.stubRatio,
      arrangementPosition: act.arrangementPosition ?? '-',
      arrangementBoundary: act.arrangementBoundary ?? '-',
    })),
  );

  const output = argumentValue('output');
  if (output) {
    writeFileSync(resolve(process.cwd(), output), `${JSON.stringify(report, null, 2)}\n`);
  }

  const compare = argumentValue('compare');
  if (compare) {
    const before = JSON.parse(
      readFileSync(resolve(process.cwd(), compare), 'utf8'),
    ) as MeasurementReport;
    const failures = compareReports(before, report);
    if (failures.length > 0) {
      throw new Error(`Parser acceptance failed:\n${failures.join('\n')}`);
    }
    console.log(`Acceptance passed against ${compare}`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
