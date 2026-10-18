import { Module } from '@nestjs/common';
import { SourceRegistryService } from './source-registry.service';
import { LegalAwareChunkerService } from './legal-aware-chunker.service';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { JobsModule } from '@/jobs/jobs.module';
import { OcrModule } from '@/ocr/ocr.module';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { UsSectionFinderService } from '@/legal-search/us-section-finder/us-section-finder.service';
import { KeSectionFinderService } from '@/legal-search/ke-section-finder/ke-section-finder.service';
import { SectionFinderService } from '@/legal-search/india-section-finder/section-finder.service';
import { SectionFinderProfileService } from '@/legal-search/india-section-finder/section-finder-profile.service';
import { SectionFinderPopularService } from '@/legal-search/india-section-finder/section-finder-popular.service';
import { SectionFinderTranslationService } from '@/legal-search/india-section-finder/section-finder-translation.service';
import { SectionFinderUnmatchedService } from '@/legal-search/india-section-finder/section-finder-unmatched.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { CourtListenerConnector } from './connectors/courtlistener.connector';
import { IndiaKanoonConnector } from './connectors/india-kanoon.connector';
import { IndiaCodeConnector } from './connectors/india-code.connector';
import { IndiaCodeCatalogConnector } from './connectors/india-code-catalog.connector';
import { IndiaManifestConnector } from './connectors/india-manifest.connector';
import { StateLawConnectorRegistry } from './connectors/state-law.connector';
import { LegislativeDeptConnector } from './connectors/legislative-dept.connector';
import { NcrbSankalanConnector } from './connectors/ncrb-sankalan.connector';
import { StatuteFetchConnector } from './connectors/statute-fetch.connector';
import { TavilySearchConnector } from './connectors/tavily-search.connector';
import { UsCodeConnector } from './connectors/us-code.connector';
import { UsStateConnector } from './connectors/us-state.connector';
import { EcfRConnector } from './connectors/ecfr.connector';
import { GovInfoUscConnector } from './connectors/govinfo-usc.connector';
import { UsLmConnector } from './connectors/uslm.connector';
import { KenyaLawConnector } from './connectors/kenya-law.connector';
import { KenyaLawCatalogConnector } from './connectors/kenya-law-catalog.connector';
import { KenyaLawJudgmentConnector } from './connectors/kenya-law-judgment.connector';
import { EscrConnector } from './connectors/escr.connector';
import { LicensedCaseLawConnector } from './connectors/licensed-case-law.connector';
import { AuthorityRecordRegistryService } from './authority-record-registry.service';
import { TreatmentEdgeParserService } from './treatment-edge-parser.service';
import { LawsAfricaConnector } from './connectors/laws-africa.connector';
import { LegislationGovUkConnector } from './connectors/legislation-gov-uk.connector';
import { SuperAdminGuard } from '@/admin/super-admin.guard';
import { LegalSourceController } from './legal-source.controller';
import { LegalSourceService } from './legal-source.service';
import { StatuteIngestService } from './statute-ingest.service';
import { HybridSearchService } from './search/hybrid-search.service';
import { OpenSearchAdapterService } from './search/opensearch-adapter.service';
import { SectionFinderResolveService } from './section-finder-resolve.service';
import { SectionFinderAiFallbackService } from '@/legal-search/section-finder-ai-fallback.service';
import { ResearchRetrievalGapService } from './research-retrieval-gap.service';
import { RbiRegulationConnector } from './connectors/rbi-regulation.connector';
import { RbiRegulationIngestService } from './connectors/rbi-regulation-ingest.service';
import { IndiaStatuteBackfillService } from './india-statute-backfill.service';
import { KenyaSourcePolicyService } from './kenya-source-policy.service';
import { LegalCorpusRegistryService } from './legal-corpus-registry.service';
import { KenyaGazetteConnector } from './connectors/kenya-gazette.connector';
import { KenyaGazetteEventExtractorService } from './kenya-gazette-event-extractor.service';
import { KenyaGazetteService } from './kenya-gazette.service';
import { KenyaExtendedCorpusService } from './kenya-extended-corpus.service';
import { KenyaOfficialCollectionsConnector } from './connectors/kenya-official-collections.connector';
import { KenyaIngestOpsService } from './kenya-ingest-ops.service';
import { KenyaLegalCorpusOcrService } from './kenya-legal-corpus-ocr.service';
import { ResearchReadinessService } from './research-readiness.service';

@Module({
  imports: [EmbeddingsModule, JobsModule, OcrModule],
  controllers: [LegalSourceController],
  providers: [
    SuperAdminGuard,
    CourtListenerConnector,
    IndiaKanoonConnector,
    IndiaCodeConnector,
    IndiaCodeCatalogConnector,
    IndiaManifestConnector,
    StateLawConnectorRegistry,
    LegislativeDeptConnector,
    NcrbSankalanConnector,
    StatuteFetchConnector,
    TavilySearchConnector,
    UsCodeConnector,
    UsStateConnector,
    EcfRConnector,
    GovInfoUscConnector,
    UsLmConnector,
    KenyaLawConnector,
    KenyaLawCatalogConnector,
    KenyaLawJudgmentConnector,
    EscrConnector,
    LicensedCaseLawConnector,
    AuthorityRecordRegistryService,
    TreatmentEdgeParserService,
    LawsAfricaConnector,
    LegislationGovUkConnector,
    HybridSearchService,
    BareActLookupService,
    LlmCompletionService,
    SectionFinderProfileService,
    SectionFinderPopularService,
    SectionFinderTranslationService,
    SectionFinderUnmatchedService,
    SectionFinderService,
    UsSectionFinderService,
    KeSectionFinderService,
    SectionFinderAiFallbackService,
    SectionFinderResolveService,
    LegalSourceService,
    StatuteIngestService,
    OpenSearchAdapterService,
    SourceRegistryService,
    LegalAwareChunkerService,
    ResearchRetrievalGapService,
    RbiRegulationConnector,
    RbiRegulationIngestService,
    IndiaStatuteBackfillService,
    KenyaSourcePolicyService,
    LegalCorpusRegistryService,
    KenyaGazetteConnector,
    KenyaGazetteEventExtractorService,
    KenyaGazetteService,
    KenyaExtendedCorpusService,
    KenyaOfficialCollectionsConnector,
    KenyaLegalCorpusOcrService,
    KenyaIngestOpsService,
    ResearchReadinessService,
  ],
  exports: [SourceRegistryService, LegalAwareChunkerService,
    CourtListenerConnector,
    IndiaKanoonConnector,
    IndiaCodeConnector,
    IndiaCodeCatalogConnector,
    IndiaManifestConnector,
    StateLawConnectorRegistry,
    LegislativeDeptConnector,
    NcrbSankalanConnector,
    StatuteFetchConnector,
    TavilySearchConnector,
    UsCodeConnector,
    UsStateConnector,
    EcfRConnector,
    GovInfoUscConnector,
    UsLmConnector,
    KenyaLawConnector,
    KenyaLawCatalogConnector,
    KenyaLawJudgmentConnector,
    EscrConnector,
    LicensedCaseLawConnector,
    AuthorityRecordRegistryService,
    TreatmentEdgeParserService,
    LawsAfricaConnector,
    LegislationGovUkConnector,
    HybridSearchService,
    BareActLookupService,
    SectionFinderUnmatchedService,
    SectionFinderService,
    UsSectionFinderService,
    KeSectionFinderService,
    SectionFinderAiFallbackService,
    SectionFinderResolveService,
    LegalSourceService,
    StatuteIngestService,
    OpenSearchAdapterService,
    ResearchRetrievalGapService,
    RbiRegulationConnector,
    RbiRegulationIngestService,
    IndiaStatuteBackfillService,
    KenyaSourcePolicyService,
    LegalCorpusRegistryService,
    KenyaGazetteConnector,
    KenyaGazetteEventExtractorService,
    KenyaGazetteService,
    KenyaExtendedCorpusService,
    KenyaOfficialCollectionsConnector,
    KenyaLegalCorpusOcrService,
    KenyaIngestOpsService,
    ResearchReadinessService,
  ],
})
export class LegalSourcesModule {}
