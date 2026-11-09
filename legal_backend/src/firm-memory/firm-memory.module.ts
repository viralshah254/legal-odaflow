import { DocumentsModule } from '@/documents/documents.module';
import { FirmKnowledgeService } from './firm-knowledge.service';
import { Module, forwardRef } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { FirmMemoryController } from './firm-memory.controller';
import { FirmMemoryService } from './firm-memory.service';

@Module({
  imports: [AccessModule, EmbeddingsModule, forwardRef(() => DocumentsModule)],
  controllers: [FirmMemoryController],
  providers: [FirmMemoryService, FirmKnowledgeService],
  exports: [FirmMemoryService, FirmKnowledgeService],
})
export class FirmMemoryModule {}
