/**
 * Embed system + tenant document templates for MI retrieval (P20-04).
 *
 * Usage: npm run templates:embed
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/embeddings/embedding.service';
import { getTemplateMetadata } from '../src/config/templates/template-legal-asset-metadata';

export const DOCUMENT_TEMPLATE_SOURCE_TYPE = 'DOCUMENT_TEMPLATE';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const embeddingService = app.get(EmbeddingService);

    const systemTemplates = await prisma.systemDocumentTemplate.findMany();
    const tenantTemplates = await prisma.documentTemplate.findMany({
      where: { systemTemplateId: null },
    });

    const rows = [
      ...systemTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        documentKind: t.documentKind,
        countryCode: t.countryCode,
        practiceArea: t.practiceArea,
        description: t.description ?? '',
        scope: 'system' as const,
      })),
      ...tenantTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        documentKind: t.documentKind,
        countryCode: t.countryCode,
        practiceArea: t.practiceArea,
        description: t.description ?? '',
        scope: 'tenant' as const,
      })),
    ];

    console.log(`Found ${rows.length} templates to embed.`);
    if (dryRun) return;

    let stored = 0;
    for (const row of rows) {
      const meta = getTemplateMetadata(row.documentKind);
      const content = [row.name, row.description, row.documentKind, row.practiceArea]
        .filter(Boolean)
        .join('\n');

      await embeddingService.storeChunks([
        {
          sourceType: DOCUMENT_TEMPLATE_SOURCE_TYPE,
          sourceId: row.id,
          chunkIndex: 0,
          content,
          countryCode: row.countryCode,
          modelName: embeddingService.getEmbeddingModel(),
          metadata: {
            documentKind: row.documentKind,
            practiceArea: meta?.practiceArea ?? row.practiceArea,
            subPracticeArea: meta?.subPracticeArea,
            nature: meta?.nature,
            scope: row.scope,
            templateName: row.name,
          },
        },
      ]);
      stored += 1;
    }

    console.log(`Embedded ${stored} templates.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
