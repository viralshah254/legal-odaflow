import { Injectable } from '@nestjs/common';
import type { JurisdictionForm } from '@prisma/client';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { scoreTextMatch, listCuratedDraftEntries } from '@/ai/draft-intent/draft-intent.helpers';
import { getExcludePracticeAreas } from './matter-taxonomy-routing';
import { getLegalAssetMetadata, scoreMetadataMatch, LEGAL_ASSET_METADATA } from './legal-asset-metadata';
import { SelectionTrackingService } from './selection-tracking.service';
import type { MatterProfile } from './matter-intelligence.types';

export interface RetrievedAsset {
  id: string;
  type: 'official_form' | 'curated_draft' | 'template';
  label: string;
  confidence: number;
  metadataScore: number;
  semanticScore: number;
  combinedScore: number;
  practiceArea?: string;
  form?: JurisdictionForm;
  curatedKind?: string;
}

export interface RetrievalOptions {
  query: string;
  profile: MatterProfile;
  countryCode?: string;
  jurisdiction?: string;
  limit?: number;
}

const WEIGHTS = {
  metadata: 0.4,
  taxonomy: 0.25,
  semantic: 0.15,
  popularity: 0.1,
  userBehaviour: 0.1,
};

const RETRIEVAL_CONFIDENCE_THRESHOLD = 0.85;

@Injectable()
export class LegalAssetRetrievalService {
  constructor(
    private readonly legalFormsSearch: LegalFormsSearchService,
    private readonly selectionTracking: SelectionTrackingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async retrieve(options: RetrievalOptions): Promise<{
    assets: RetrievedAsset[];
    recommendationMode: 'matched' | 'low_confidence';
    topScore: number;
  }> {
    const { query, profile, countryCode, jurisdiction, limit = 12 } = options;
    const exclude = getExcludePracticeAreas(profile.practiceArea, profile.subPracticeArea);

    const [formHits, curatedAssets, templateAssets] = await Promise.all([
      this.searchForms(query, profile, countryCode, jurisdiction, exclude),
      this.searchCurated(query, profile, countryCode, exclude),
      this.searchTemplates(query, profile, countryCode),
    ]);

    const popularityBoost = await this.selectionTracking.popularityBoost(
      profile.practiceArea,
      profile.subPracticeArea,
    );

    const merged = [...curatedAssets, ...formHits, ...templateAssets]
      .map((asset) => ({
        ...asset,
        combinedScore: Math.min(
          1,
          asset.combinedScore +
            WEIGHTS.popularity *
              (asset.curatedKind
                ? popularityBoost
                : popularityBoost * 0.5),
        ),
        confidence: Math.min(
          1,
          asset.confidence +
            WEIGHTS.popularity *
              (asset.curatedKind
                ? popularityBoost
                : popularityBoost * 0.5),
        ),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    const topScore = merged[0]?.combinedScore ?? 0;
    const taxonomyMismatch =
      merged[0] &&
      merged[0].practiceArea &&
      merged[0].practiceArea !== profile.practiceArea &&
      topScore < 0.6;

    const recommendationMode =
      topScore < RETRIEVAL_CONFIDENCE_THRESHOLD || taxonomyMismatch
        ? 'low_confidence'
        : 'matched';

    return { assets: merged, recommendationMode, topScore };
  }

  private async searchForms(
    query: string,
    profile: MatterProfile,
    countryCode?: string,
    jurisdiction?: string,
    exclude: string[] = [],
  ): Promise<RetrievedAsset[]> {
    const hits = await this.legalFormsSearch.searchByIntent(query, {
      countryCode,
      jurisdiction,
      limit: 20,
      practiceArea: profile.practiceArea,
      excludePracticeAreas: exclude,
    });

    return hits.map((hit) => {
      const formMeta = this.formMetadata(hit.form);
      const metadataScore = scoreMetadataMatch(formMeta, profile, exclude);
      const semanticScore = hit.combinedScore;
      const combinedScore =
        WEIGHTS.metadata * metadataScore +
        WEIGHTS.semantic * semanticScore +
        WEIGHTS.taxonomy * (formMeta.practiceArea === profile.practiceArea ? 1 : 0);

      return {
        id: hit.form.id,
        type: 'official_form' as const,
        label: hit.form.formName,
        confidence: combinedScore,
        metadataScore,
        semanticScore,
        combinedScore,
        practiceArea: formMeta.practiceArea,
        form: hit.form,
      };
    });
  }

  private searchCurated(
    query: string,
    profile: MatterProfile,
    countryCode?: string,
    exclude: string[] = [],
  ): RetrievedAsset[] {
    const country = (countryCode ?? profile.country ?? 'IN').toUpperCase();
    const candidates = listCuratedDraftEntries().filter((e) => e.countryCode === country);

    const priorityKinds = new Set(profile.curatedKinds ?? []);
    const results: RetrievedAsset[] = [];

    for (const entry of candidates) {
      const meta = getLegalAssetMetadata(entry.kind);
      if (!meta) continue;

      const metadataScore = scoreMetadataMatch(meta, profile, exclude);
      if (metadataScore <= 0 && !priorityKinds.has(entry.kind)) continue;

      const semanticScore = scoreTextMatch(query, `${entry.label} ${entry.kind.replace(/_/g, ' ')}`);
      let combinedScore =
        WEIGHTS.metadata * metadataScore +
        WEIGHTS.semantic * semanticScore +
        WEIGHTS.taxonomy * (meta.practiceArea === profile.practiceArea ? 1 : 0);

      if (priorityKinds.has(entry.kind)) {
        combinedScore = Math.max(combinedScore, 0.96);
      }

      if (exclude.includes(meta.practiceArea) && !priorityKinds.has(entry.kind)) {
        combinedScore *= 0.15;
      }

      if (combinedScore < 0.2 && !priorityKinds.has(entry.kind)) continue;

      results.push({
        id: entry.kind,
        type: 'curated_draft',
        label: entry.label,
        confidence: combinedScore,
        metadataScore,
        semanticScore,
        combinedScore,
        practiceArea: meta.practiceArea,
        curatedKind: entry.kind,
      });
    }

    return results;
  }

  private async searchTemplates(
    query: string,
    profile: MatterProfile,
    countryCode?: string,
  ): Promise<RetrievedAsset[]> {
    if (!this.embeddingService.isRagEnabled()) return [];

    const chunks = await this.embeddingService.searchByVector(query, {
      countryCode,
      sourceType: 'DOCUMENT_TEMPLATE',
      practiceArea: profile.practiceArea,
      limit: 8,
    });

    return chunks.map((chunk, index) => {
      const metadataScore = scoreMetadataMatch(
        {
          practiceArea: profile.practiceArea,
          subPracticeArea: profile.subPracticeArea,
          nature: profile.nature,
        },
        profile,
        [],
      );
      const semanticScore = chunk.score;
      const combinedScore = WEIGHTS.metadata * metadataScore + WEIGHTS.semantic * semanticScore;

      return {
        id: chunk.sourceId,
        type: 'template' as const,
        label: chunk.content.split('\n')[0] ?? 'Template',
        confidence: combinedScore,
        metadataScore,
        semanticScore,
        combinedScore: combinedScore - index * 0.01,
        practiceArea: profile.practiceArea,
      };
    });
  }

  private formMetadata(form: JurisdictionForm) {
    const raw = (form as JurisdictionForm & { metadata?: unknown }).metadata;
    if (raw && typeof raw === 'object' && 'practiceArea' in (raw as object)) {
      return raw as ReturnType<typeof getLegalAssetMetadata> & object;
    }
    const fromRegistry = LEGAL_ASSET_METADATA[form.formName];
    if (fromRegistry) return fromRegistry;
    return {
      practiceArea: form.practiceArea,
      nature: 'dispute' as const,
    };
  }
}
