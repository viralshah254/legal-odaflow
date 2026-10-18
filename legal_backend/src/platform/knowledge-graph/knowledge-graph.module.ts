import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { KgEntityExtractorService } from './kg-entity-extractor.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => AiModule)],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService, KgEntityExtractorService],
  exports: [KnowledgeGraphService, KgEntityExtractorService],
})
export class KnowledgeGraphModule {}
