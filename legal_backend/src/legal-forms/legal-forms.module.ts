import { Module } from '@nestjs/common';
import { LegalFormsController } from './legal-forms.controller';
import { LegalFormsService } from './legal-forms.service';
import { LegalFormsSearchService } from './legal-forms-search.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [PrismaModule, EmbeddingsModule],
  controllers: [LegalFormsController],
  providers: [LegalFormsService, LegalFormsSearchService],
  exports: [LegalFormsService, LegalFormsSearchService],
})
export class LegalFormsModule {}
