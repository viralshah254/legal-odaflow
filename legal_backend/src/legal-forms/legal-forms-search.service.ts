import { Injectable } from '@nestjs/common';
import type { JurisdictionForm } from '@prisma/client';
import { EmbeddingService } from '@/embeddings/embedding.service';
import {
  expandSearchTokens,
  scoreTextMatch,
} from '@/ai/draft-intent/draft-intent.helpers';
import { LegalFormsService } from './legal-forms.service';
import {
  formSearchText,
  JURISDICTION_FORM_SOURCE_TYPE,
} from './form-embed-text.util';
import { isIndiaCommercialRecoveryQuery } from '@/ai/draft-intent/india-commercial-recovery-route';

export const HYBRID_VECTOR_WEIGHT = 0.65;
export const HYBRID_LEXICAL_WEIGHT = 0.35;
export const MIN_COMBINED_SCORE = 0.35;

function refineLexicalScore(
  query: string,
  form: JurisdictionForm,
  score: number,
): number {
  const q = query.toLowerCase();
  const name = form.formName.toLowerCase();
  let adjusted = score;

  if (/\bcomplaint\b|\ballegation|\battacked\b|\bharm\b/.test(q)) {
    if (/allegation|harm.*domestic|domestic violence.*harm/.test(name)) {
      adjusted += 0.12;
    }
    if (/\bcomplaint\b/.test(q) && /^application for/i.test(name) && !/complaint|allegation/i.test(name)) {
      adjusted -= 0.08;
    }
  }

  return Math.min(1, adjusted);
}

export interface FormSearchHit {
  form: JurisdictionForm;
  combinedScore: number;
  vectorScore: number;
  lexicalScore: number;
}

export interface FormIntentSearchOptions {
  countryCode?: string;
  jurisdiction?: string;
  limit?: number;
  practiceArea?: string;
  excludePracticeAreas?: string[];
}

@Injectable()
export class LegalFormsSearchService {
  constructor(
    private readonly legalForms: LegalFormsService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async searchByIntent(
    query: string,
    options: FormIntentSearchOptions = {},
  ): Promise<FormSearchHit[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    const commercialRecovery = isIndiaCommercialRecoveryQuery(normalized);

    const limit = options.limit ?? 12;
    const countryCode =
      options.countryCode && options.countryCode !== 'ALL'
        ? options.countryCode.toUpperCase()
        : undefined;

    const candidateLimit = Math.max(limit * 3, 30);

    const [vectorHits, lexicalForms] = await Promise.all([
      this.searchVector(normalized, countryCode, candidateLimit),
      this.searchLexical(normalized, {
        countryCode,
        jurisdiction: options.jurisdiction,
        limit: candidateLimit,
      }),
    ]);

    const merged = new Map<
      string,
      { form: JurisdictionForm; vectorScore: number; lexicalScore: number }
    >();

    for (const form of lexicalForms) {
      const lexicalScore = refineLexicalScore(
        normalized,
        form,
        scoreTextMatch(normalized, formSearchText(form)),
      );
      merged.set(form.id, { form, vectorScore: 0, lexicalScore });
    }

    for (const hit of vectorHits) {
      const existing = merged.get(hit.form.id);
      if (existing) {
        existing.vectorScore = Math.max(existing.vectorScore, hit.vectorScore);
      } else {
        merged.set(hit.form.id, {
          form: hit.form,
          vectorScore: hit.vectorScore,
          lexicalScore: refineLexicalScore(
            normalized,
            hit.form,
            scoreTextMatch(normalized, formSearchText(hit.form)),
          ),
        });
      }
    }

    const results: FormSearchHit[] = [];
    for (const entry of merged.values()) {
      if (
        commercialRecovery &&
        !this.isCommercialRecoveryCandidate(entry.form)
      ) {
        continue;
      }
      const practicePenalty = this.practiceAreaPenalty(
        entry.form,
        options.practiceArea,
        options.excludePracticeAreas,
        normalized,
      );
      const combinedScore =
        (HYBRID_VECTOR_WEIGHT * entry.vectorScore +
          HYBRID_LEXICAL_WEIGHT * entry.lexicalScore) *
        practicePenalty;
      if (combinedScore < MIN_COMBINED_SCORE) {
        continue;
      }
      results.push({
        form: entry.form,
        combinedScore,
        vectorScore: entry.vectorScore,
        lexicalScore: entry.lexicalScore,
      });
    }

    return results
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  }

  private isCommercialRecoveryCandidate(form: JurisdictionForm): boolean {
    if (
      ['family_matrimonial', 'consumer', 'regulatory_compliance'].includes(
        form.practiceArea,
      )
    ) {
      return false;
    }
    const text = formSearchText(form);
    if (
      /\b(marriage|matrimonial|divorce|maintenance|custody|domestic violence|bail|criminal revision|fir|sebi|delisting|set[-\s]?off|counter[-\s]?claim)\b/i.test(
        text,
      )
    ) {
      return false;
    }
    return /\b(summary|order\s*(?:xxxvii|37)|recovery|commercial|plaint|money|debt|invoice|written contract)\b/i.test(
      text,
    );
  }

  private async searchVector(
    query: string,
    countryCode: string | undefined,
    limit: number,
  ): Promise<Array<{ form: JurisdictionForm; vectorScore: number }>> {
    const rows = await this.embeddingService.searchByVector(query, {
      countryCode,
      sourceType: JURISDICTION_FORM_SOURCE_TYPE,
      limit,
    });

    if (rows.length === 0) return [];

    const formIds = [...new Set(rows.map((r) => r.sourceId))];
    const forms = await this.legalForms.findByIds(formIds);
    const formById = new Map(forms.map((f) => [f.id, f]));

    const bestByForm = new Map<string, number>();
    for (const row of rows) {
      const prev = bestByForm.get(row.sourceId) ?? 0;
      bestByForm.set(row.sourceId, Math.max(prev, row.score));
    }

    const hits: Array<{ form: JurisdictionForm; vectorScore: number }> = [];
    for (const [id, vectorScore] of bestByForm) {
      const form = formById.get(id);
      if (form) hits.push({ form, vectorScore });
    }
    return hits;
  }

  private async searchLexical(
    query: string,
    options: { countryCode?: string; jurisdiction?: string; limit: number },
  ): Promise<JurisdictionForm[]> {
    const tokens = expandSearchTokens(query);
    if (tokens.length === 0) return [];

    const fetchLimit = Math.max(options.limit * 8, 120);
    const forms = await this.legalForms.searchByTokens(tokens, {
      countryCode: options.countryCode,
      jurisdiction: options.jurisdiction,
      limit: fetchLimit,
    });

    return forms
      .map((form) => ({
        form,
        lexicalScore: refineLexicalScore(
          query,
          form,
          scoreTextMatch(query, formSearchText(form)),
        ),
      }))
      .sort((a, b) => b.lexicalScore - a.lexicalScore)
      .slice(0, options.limit)
      .map((entry) => entry.form);
  }

  private practiceAreaPenalty(
    form: JurisdictionForm,
    practiceArea: string | undefined,
    excludePracticeAreas: string[] | undefined,
    query: string,
  ): number {
    let multiplier = 1;

    if (excludePracticeAreas?.includes(form.practiceArea)) {
      multiplier *= 0.12;
    }

    if (practiceArea) {
      if (form.practiceArea === practiceArea) {
        multiplier *= 1.15;
      } else if (
        !(
          practiceArea === 'corporate_commercial' &&
          form.practiceArea === 'litigation_disputes'
        )
      ) {
        // A confident practice-area route is a constraint, not merely a ranking hint.
        multiplier *= 0.05;
      }
    }

    if (
      practiceArea === 'employment_labour' &&
      /\barbitration\b/i.test(form.formName) &&
      /\b(wrongful|termination|labour|workman|reinstatement)\b/i.test(query)
    ) {
      multiplier *= 0.08;
    }

    return multiplier;
  }
}
