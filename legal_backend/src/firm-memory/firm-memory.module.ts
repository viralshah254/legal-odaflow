import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { FirmMemoryController } from './firm-memory.controller';
import { FirmMemoryService } from './firm-memory.service';

@Module({
  imports: [AccessModule, EmbeddingsModule],
  controllers: [FirmMemoryController],
  providers: [FirmMemoryService],
  exports: [FirmMemoryService],
})
export class FirmMemoryModule {}
