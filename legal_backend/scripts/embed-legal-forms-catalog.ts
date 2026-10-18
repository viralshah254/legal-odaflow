/**
 * Embed all system jurisdiction forms for semantic Find & Draft search.
 *
 * Usage: npm run legal-forms:embed
 * Optional: --dry-run (count only, no API calls)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/embeddings/embedding.service';
import { retryDb } from '../src/common/utils/retry-db';
import {
  buildFormEmbedText,
  JURISDICTION_FORM_SOURCE_TYPE,
} from '../src/legal-forms/form-embed-text.util';

const BATCH = 25;

function parseArg(name: string): number | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const n = parseInt(arg.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const offset = parseArg('offset') ?? 0;
  const limit = parseArg('limit');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const embeddingService = app.get(EmbeddingService);

    const allForms = await prisma.jurisdictionForm.findMany({
      where: { isSystem: true },
      orderBy: { id: 'asc' },
    });

    const forms = limit != null ? allForms.slice(offset, offset + limit) : allForms.slice(offset);

    console.log(
      `Found ${allForms.length} system forms total; embedding ${forms.length} (offset=${offset}${limit != null ? ` limit=${limit}` : ''}).`,
    );

    if (dryRun) {
      console.log('Dry run — no embeddings written.');
      return;
    }

    if (!embeddingService.isRagEnabled()) {
      console.warn('AI_ENABLE_RAG is false or OPENAI_API_KEY missing — embeddings may be skipped.');
    }

    let stored = 0;
    let skipped = 0;

    for (let i = 0; i < forms.length; i += BATCH) {
      const batch = forms.slice(i, i + BATCH);
      const result = await retryDb(
        () =>
          embeddingService.storeChunks(
            batch.map((form) => ({
              sourceType: JURISDICTION_FORM_SOURCE_TYPE,
              sourceId: form.id,
              chunkIndex: 0,
              content: buildFormEmbedText(form),
              countryCode: form.countryCode,
              jurisdiction: form.jurisdiction ?? undefined,
              modelName: embeddingService.getEmbeddingModel(),
              metadata: {
                formNumber: form.formNumber,
                practiceArea: form.practiceArea,
                formName: form.formName,
              },
            })),
          ),
        { maxAttempts: 8, baseDelayMs: 3000 },
      );
      stored += result.stored;
      skipped += result.skipped;
      await prisma.$disconnect();
      await prisma.$connect();
      process.stdout.write(
        `\rEmbedded ${Math.min(i + BATCH, forms.length)}/${forms.length} (stored=${stored} skipped=${skipped})...`,
      );
    }

    console.log(`\nDone. stored=${stored} skipped=${skipped} totalForms=${forms.length}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
