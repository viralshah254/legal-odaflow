import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { JobsModule } from '@/jobs/jobs.module';
import { CourtListenerConnector } from './connectors/courtlistener.connector';
import { LegalSourceController } from './legal-source.controller';
import { LegalSourceService } from './legal-source.service';
import { HybridSearchService } from './search/hybrid-search.service';

@Module({
  imports: [EmbeddingsModule, JobsModule],
  controllers: [LegalSourceController],
  providers: [CourtListenerConnector, HybridSearchService, LegalSourceService],
  exports: [CourtListenerConnector, HybridSearchService, LegalSourceService],
})
export class LegalSourcesModule {}
