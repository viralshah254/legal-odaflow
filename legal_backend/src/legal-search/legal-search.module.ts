import { Module } from '@nestjs/common';
import { FirmMemoryModule } from '@/firm-memory/firm-memory.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { TrainingDatasetsModule } from '@/training-datasets/training-datasets.module';
import { AuthorityTrustModule } from '@/ai/feedback/authority-trust.module';
import { LegalSearchPlanService } from './legal-search-plan.service';
import { BareActLookupService } from './bare-act-lookup.service';
import { KnowledgeStackService } from './knowledge-stack.service';
import { LegalRerankerService } from './legal-reranker.service';
import { LegalRetrievalOrchestrator } from './legal-retrieval-orchestrator.service';
import { CitationFirstLookupService } from './citation-first-lookup.service';
import { AuthorityThreadService } from './authority-thread.service';
import { SentenceAuditService } from './sentence-audit.service';
import { SectionAlignmentService } from './section-alignment.service';
import { VerifyClassifierService } from './verify-classifier.service';
import { PreferenceFlywheelService } from './preference-flywheel.service';
import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from '@/ai/legal-research/kenya-law-query-builder.service';

@Module({
  imports: [LegalSourcesModule, FirmMemoryModule, TrainingDatasetsModule, AuthorityTrustModule],
  providers: [
    LegalSearchPlanService,
    BareActLookupService,
    KnowledgeStackService,
    LegalRerankerService,
    CitationFirstLookupService,
    LegalRetrievalOrchestrator,
    AuthorityThreadService,
    SentenceAuditService,
    SectionAlignmentService,
    VerifyClassifierService,
    PreferenceFlywheelService,
    IndiaKanoonQueryBuilderService,
    KenyaLawQueryBuilderService,
  ],
  exports: [
    LegalSearchPlanService,
    BareActLookupService,
    KnowledgeStackService,
    LegalRerankerService,
    CitationFirstLookupService,
    LegalRetrievalOrchestrator,
    AuthorityThreadService,
    SentenceAuditService,
    SectionAlignmentService,
    VerifyClassifierService,
    PreferenceFlywheelService,
    IndiaKanoonQueryBuilderService,
    KenyaLawQueryBuilderService,
  ],
})
export class LegalSearchModule {}
