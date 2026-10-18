import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmbeddingService } from '../src/embeddings/embedding.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    const embeddings = app.get(EmbeddingService);
    const authorities = await prisma.legalAuthority.findMany({
      where: {
        countryCode: 'IN',
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        reviewedByHuman: true,
      },
      select: {
        id: true,
        title: true,
        citation: true,
        neutralCitation: true,
        summary: true,
        holding: true,
        fullText: true,
        jurisdiction: true,
      },
    });
    let embedded = 0;
    for (const authority of authorities) {
      const content = [
        authority.title,
        authority.citation,
        authority.neutralCitation,
        authority.summary,
        authority.holding,
        authority.fullText,
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 6000);
      const stored = await embeddings.storeChunks([
        {
          sourceType: 'LEGAL_AUTHORITY',
          sourceId: authority.id,
          chunkIndex: 0,
          content,
          countryCode: 'IN',
          jurisdiction: authority.jurisdiction ?? undefined,
          modelName: embeddings.getEmbeddingModel(),
          metadata: { corpus: 'india-caselaw' },
        },
      ]);
      await prisma.legalAuthority.update({
        where: { id: authority.id },
        data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
      });
      embedded += stored.stored > 0 ? 1 : 0;
    }
    console.log(`Embedded ${embedded} of ${authorities.length} pending reviewed Indian authorities.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
