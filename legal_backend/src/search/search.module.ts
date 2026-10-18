import { Module } from '@nestjs/common';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { SearchController } from './search.controller';
import { SearchIndexService } from './search-index.service';
import { SearchService } from './search.service';

@Module({
  imports: [LegalSourcesModule],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexService],
  exports: [SearchService, SearchIndexService],
})
export class SearchModule {}
