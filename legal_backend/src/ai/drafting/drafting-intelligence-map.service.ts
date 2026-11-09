/**
 * Thin drafting wrapper around ResearchIntelligenceMapService.
 * Turns case details into issue labels, likely statutes, and retrieval queries
 * for draft grounding / planning — hypotheses, not verified law.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ResearchIntelligenceMapService } from '@/ai/legal-research/research-intelligence-map.service';
import type {
  CandidateAuthority,
  LegalIssueMapEntry,
  ResearchIntelligenceMap,
} from '@/ai/legal-research/research-intelligence-map.types';

export interface DraftingIntelligenceMapInput {
  caseDetails: string;
  countryCode?: string;
  jurisdiction?: string;
  kind?: string;
  practiceArea?: string;
}

export interface DraftingIntelligenceMapResult {
  issues: LegalIssueMapEntry[];
  likelyStatutes: CandidateAuthority[];
  /** Flattened retrieval queries for DraftResearchGroundingService. */
  researchQueries: string[];
  /** Candidate searchHints (statutes/cases/routes) for grounding. */
  searchHints: string[];
  /** Underlying research map when callers need richer fields. */
  raw: ResearchIntelligenceMap;
}

@Injectable()
export class DraftingIntelligenceMapService {
  private readonly logger = new Logger(DraftingIntelligenceMapService.name);

  constructor(private readonly researchMap: ResearchIntelligenceMapService) {}

  /**
   * Build a drafting-oriented intelligence map from case details.
   * Delegates to ResearchIntelligenceMapService.buildMap (LLM JSON or fallback).
   */
  async buildMap(input: DraftingIntelligenceMapInput): Promise<DraftingIntelligenceMapResult> {
    const query = input.caseDetails?.trim();
    if (!query) {
      const empty = this.researchMap.fallbackMap(
        { query: '', countryCode: input.countryCode ?? 'IN', jurisdiction: input.jurisdiction },
        'none',
        'empty caseDetails',
      );
      return this.toDraftingResult(empty);
    }

    try {
      const raw = await this.researchMap.buildMap({
        query,
        countryCode: input.countryCode ?? 'IN',
        jurisdiction: input.jurisdiction,
        legalDomain: input.kind,
        practiceArea: input.practiceArea,
        planningMode: 'draft',
      });
      return this.toDraftingResult(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Drafting intelligence map failed: ${message}`);
      const raw = this.researchMap.fallbackMap(
        {
          query,
          countryCode: input.countryCode ?? 'IN',
          jurisdiction: input.jurisdiction,
          legalDomain: input.kind,
        },
        'fallback',
        message,
      );
      return this.toDraftingResult(raw);
    }
  }

  private toDraftingResult(raw: ResearchIntelligenceMap): DraftingIntelligenceMapResult {
    const researchQueries = this.researchMap.expandRetrievalQueries(raw, 10);
    const searchHints = [
      ...new Set(
        [
          ...raw.likelyStatutes.flatMap((s) => s.searchHints),
          ...raw.likelyCases.flatMap((c) => c.searchHints),
          ...raw.likelyRegulations.flatMap((r) => r.searchHints),
          ...raw.likelyProceduralRoutes.flatMap((r) => r.searchHints),
          ...raw.likelyDoctrines.flatMap((d) => d.searchHints),
        ]
          .map((h) => h.trim())
          .filter(Boolean),
      ),
    ].slice(0, 16);

    return {
      issues: raw.issues,
      likelyStatutes: raw.likelyStatutes,
      researchQueries,
      searchHints,
      raw,
    };
  }
}
