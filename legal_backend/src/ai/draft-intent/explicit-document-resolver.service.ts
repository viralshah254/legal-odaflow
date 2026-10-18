import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';
import { resolveDocumentKind } from '@/config/templates/document-kinds';
import { INDIA_DRAFT_KINDS } from '@/ai/india-draft/india-draft-prompts';
import { US_DRAFT_KINDS } from '@/ai/us-draft/us-draft.dto';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { getExcludePracticeAreas } from '@/ai/matter-intelligence/matter-taxonomy-routing';
import {
  getLegalAssetMetadata,
  scoreMetadataMatch,
} from '@/ai/matter-intelligence/legal-asset-metadata';
import type { DraftIntentBundleItem } from './draft-intent-bundles';
import {
  documentKindToDraftKind,
  isExplicitDocumentKind,
  listCuratedDraftEntries,
  resolveCuratedDraftLabel,
  scoreTextMatch,
} from './draft-intent.helpers';
import {
  extractExplicitDocumentPhrases,
  mapPhraseToDraftKind,
} from './explicit-document-requests';
import type {
  ExplicitDocumentResolveOptions,
  ExplicitDocumentResolveResult,
  ExplicitDocumentResolution,
  ExplicitDocumentSuggestion,
  UnmappedExplicitPhrase,
} from './explicit-document-resolver.types';

const CATALOG_ACCEPT_THRESHOLD = 0.35;
const CATALOG_PROVISIONAL_MAX = 0.55;
const CATALOG_MIN_SUGGESTION = 0.15;

const DEFERRAL_PHRASE =
  /\b(?:appropriate\s+forum|as\s+applicable|if\s+required|correct\s+forum|proper\s+forum|in\s+the\s+appropriate)\b/i;

const WEIGHTS = { metadata: 0.4, semantic: 0.35, taxonomy: 0.25 };

const EXPLICIT_REASON_PREFIX = 'Requested in drafting instructions:';

function documentKindForCuratedKind(kind: string): string {
  const meta = getLegalAssetMetadata(kind);
  if (meta?.documentType) return meta.documentType;
  return kind.replace(/^(?:india_|us_)/, '');
}

function isProvisionalPhrase(phrase: string, confidence: number): boolean {
  return DEFERRAL_PHRASE.test(phrase) || confidence < CATALOG_PROVISIONAL_MAX;
}

function allowlistForCountry(countryCode: string): Set<string> {
  const cc = countryCode.toUpperCase();
  if (cc === 'US') return new Set(US_DRAFT_KINDS);
  return new Set(INDIA_DRAFT_KINDS);
}

interface CatalogCandidate extends ExplicitDocumentSuggestion {
  documentKind: string;
  combinedScore: number;
}

function scorePhraseAgainstCatalog(
  phrase: string,
  countryCode: string,
  matterProfile?: ExplicitDocumentResolveOptions['matterProfile'],
): CatalogCandidate[] {
  const country = (countryCode ?? matterProfile?.country ?? 'IN').toUpperCase();
  const cc = country === 'US' ? 'US' : country === 'GB' ? 'GB' : country === 'KE' ? 'KE' : 'IN';
  const candidates = listCuratedDraftEntries().filter((e) => e.countryCode === cc);

  const exclude = matterProfile
    ? getExcludePracticeAreas(matterProfile.practiceArea, matterProfile.subPracticeArea)
    : [];
  const priorityKinds = new Set(matterProfile?.curatedKinds ?? []);
  const results: CatalogCandidate[] = [];

  for (const entry of candidates) {
    const meta = getLegalAssetMetadata(entry.kind);
    if (!meta) continue;

    const metadataScore = matterProfile
      ? scoreMetadataMatch(meta, matterProfile, exclude)
      : 0.25;
    if (metadataScore <= 0 && !priorityKinds.has(entry.kind)) continue;

    const semanticScore = scoreTextMatch(
      phrase,
      `${entry.label} ${entry.kind.replace(/_/g, ' ')}`,
    );
    let combinedScore =
      WEIGHTS.metadata * metadataScore +
      WEIGHTS.semantic * semanticScore +
      WEIGHTS.taxonomy * (matterProfile && meta.practiceArea === matterProfile.practiceArea ? 1 : 0);

    if (priorityKinds.has(entry.kind)) {
      combinedScore = Math.max(combinedScore, 0.72);
    }
    if (exclude.includes(meta.practiceArea) && !priorityKinds.has(entry.kind)) {
      combinedScore *= 0.15;
    }
    if (combinedScore < CATALOG_MIN_SUGGESTION && !priorityKinds.has(entry.kind)) continue;

    results.push({
      kind: entry.kind,
      label: entry.label,
      confidence: combinedScore,
      documentKind: documentKindForCuratedKind(entry.kind),
      combinedScore,
    });
  }

  return results.sort((a, b) => b.combinedScore - a.combinedScore);
}

function resolveViaDocumentKindHeuristic(
  phrase: string,
  countryCode: string,
): ExplicitDocumentResolution | undefined {
  const documentKind = resolveDocumentKind(undefined, phrase);
  if (!isExplicitDocumentKind(documentKind, phrase)) return undefined;

  const draftKind = documentKindToDraftKind(documentKind, countryCode);
  if (draftKind === 'india_form_catalog' || draftKind === 'us_form_catalog') return undefined;

  const { label } = resolveCuratedDraftLabel(documentKind, draftKind, phrase);
  return {
    phrase,
    kind: draftKind,
    label,
    documentKind,
    confidence: 0.62,
    source: 'catalog',
    provisional: isProvisionalPhrase(phrase, 0.62),
  };
}

function resolveViaCatalog(
  phrase: string,
  countryCode: string,
  matterProfile?: ExplicitDocumentResolveOptions['matterProfile'],
): { resolution?: ExplicitDocumentResolution; suggestions: ExplicitDocumentSuggestion[] } {
  const heuristic = resolveViaDocumentKindHeuristic(phrase, countryCode);
  if (heuristic) {
    return { resolution: heuristic, suggestions: [] };
  }

  const ranked = scorePhraseAgainstCatalog(phrase, countryCode, matterProfile);
  const suggestions: ExplicitDocumentSuggestion[] = ranked.slice(0, 3).map((r) => ({
    kind: r.kind,
    label: r.label,
    confidence: r.combinedScore,
  }));

  const top = ranked[0];
  if (!top || top.combinedScore < CATALOG_ACCEPT_THRESHOLD) {
    return { suggestions };
  }

  const provisional = isProvisionalPhrase(phrase, top.combinedScore);
  const alts = ranked.slice(1, 3).map((r) => ({
    kind: r.kind,
    label: r.label,
    confidence: r.combinedScore,
  }));

  return {
    resolution: {
      phrase,
      kind: top.kind,
      label: top.label,
      documentKind: top.documentKind,
      confidence: top.combinedScore,
      source: 'catalog',
      provisional,
      alternatives: alts.length ? alts : undefined,
    },
    suggestions,
  };
}

function buildBundleFromResolutions(
  resolutions: ExplicitDocumentResolution[],
): DraftIntentBundleItem[] {
  const items: DraftIntentBundleItem[] = [];
  const seenKinds = new Set<string>();

  for (const res of resolutions) {
    if (seenKinds.has(res.kind)) continue;
    seenKinds.add(res.kind);
    items.push({
      kind: res.kind,
      label: res.label,
      documentKind: res.documentKind,
      order: items.length + 1,
      selectedByDefault: res.confidence >= 0.55 && !res.provisional,
      defaultReason: `${EXPLICIT_REASON_PREFIX} "${res.phrase}"`,
      confidence: res.confidence,
      provisional: res.provisional,
    });
  }

  return items;
}

interface LlmPhraseMapping {
  phrase: string;
  kind: string | 'unmapped';
  confidence: number;
  alternatives?: string[];
}

@Injectable()
export class ExplicitDocumentResolverService {
  private readonly logger = new Logger(ExplicitDocumentResolverService.name);

  constructor(private readonly llm: LlmCompletionService) {}

  async resolve(
    options: ExplicitDocumentResolveOptions,
  ): Promise<ExplicitDocumentResolveResult> {
    const phrases = extractExplicitDocumentPhrases(options.query);
    const hasExplicitSection = phrases.length > 0;
    const countryCode = (options.countryCode ?? options.matterProfile?.country ?? 'IN').toUpperCase();

    if (!hasExplicitSection) {
      return { hasExplicitSection: false, resolutions: [], unmapped: [], bundle: [] };
    }

    const resolutions: ExplicitDocumentResolution[] = [];
    const unmapped: UnmappedExplicitPhrase[] = [];
    const pendingLlm: string[] = [];

    for (const phrase of phrases) {
      const regexMapped = mapPhraseToDraftKind(phrase);
      if (regexMapped) {
        resolutions.push({
          phrase,
          kind: regexMapped.kind,
          label: regexMapped.label,
          documentKind: regexMapped.documentKind,
          confidence: 1,
          source: 'regex',
        });
        continue;
      }

      const catalog = resolveViaCatalog(phrase, countryCode, options.matterProfile);
      if (catalog.resolution) {
        resolutions.push(catalog.resolution);
        continue;
      }

      pendingLlm.push(phrase);
      if (catalog.suggestions.length) {
        unmapped.push({ phrase, suggestions: catalog.suggestions });
      } else {
        unmapped.push({ phrase, suggestions: [] });
      }
    }

    if (pendingLlm.length > 0 && options.useLlm !== false) {
      const llmMapped = await this.mapPhrasesWithLlm(
        options.query,
        pendingLlm,
        countryCode,
        options.matterProfile,
      );

      for (const item of llmMapped) {
        const existingUnmapped = unmapped.find((u) => u.phrase === item.phrase);
        if (item.resolution) {
          resolutions.push(item.resolution);
          if (existingUnmapped) {
            const idx = unmapped.indexOf(existingUnmapped);
            unmapped.splice(idx, 1);
          }
        } else if (existingUnmapped && item.suggestions.length) {
          existingUnmapped.suggestions = item.suggestions;
        }
      }
    }

    return {
      hasExplicitSection,
      resolutions,
      unmapped,
      bundle: buildBundleFromResolutions(resolutions),
    };
  }

  private async mapPhrasesWithLlm(
    fullQuery: string,
    phrases: string[],
    countryCode: string,
    matterProfile?: ExplicitDocumentResolveOptions['matterProfile'],
  ): Promise<
    Array<{
      phrase: string;
      resolution?: ExplicitDocumentResolution;
      suggestions: ExplicitDocumentSuggestion[];
    }>
  > {
    const allowlist = allowlistForCountry(countryCode);
    const allowlistSample = [...allowlist]
      .filter((k) => !k.endsWith('_form_catalog'))
      .slice(0, 120)
      .join(', ');

    const profileHint = matterProfile
      ? `Practice area: ${matterProfile.practiceArea}; forum: ${matterProfile.forum ?? 'unknown'}; curated kinds: ${(matterProfile.curatedKinds ?? []).join(', ') || 'none'}.`
      : '';

    const systemPrompt = `You map user-requested legal document phrases to curated draft template kinds.
Return ONLY valid JSON array. Each element:
{"phrase": string, "kind": string|"unmapped", "confidence": number, "alternatives": string[]}

Rules:
- kind MUST be exactly one allowed curated kind slug, or "unmapped".
- Do NOT assume labour court for every employment dispute — pick the kind matching stated or inferred forum.
- For ambiguous forum language ("appropriate forum"), pick the best provisional match and set confidence <= 0.6.
- alternatives: up to 2 other allowed kind slugs.
- Allowed kinds (sample): ${allowlistSample}`;

    const userPrompt = `${profileHint}

Case context (truncated):
${fullQuery.slice(0, 3500)}

Phrases to map:
${phrases.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

    try {
      if (this.llm.shouldUseMockForModel(DEFAULT_EXTRACT_MODEL)) {
        return phrases.map((phrase) => ({
          phrase,
          suggestions: scorePhraseAgainstCatalog(phrase, countryCode, matterProfile)
            .slice(0, 3)
            .map((r) => ({ kind: r.kind, label: r.label, confidence: r.combinedScore })),
        }));
      }

      const result = await this.llm.complete({
        modelName: DEFAULT_EXTRACT_MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        systemBlocks: [{ text: systemPrompt }],
        temperature: 0.1,
        maxTokens: 800,
      });

      const raw = result.content.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in LLM response');

      const parsed = JSON.parse(jsonMatch[0]) as LlmPhraseMapping[];
      const entries = listCuratedDraftEntries();
      const labelByKind = new Map(entries.map((e) => [e.kind, e.label]));

      return phrases.map((phrase) => {
        const row = parsed.find((p) => p.phrase === phrase) ?? parsed[phrases.indexOf(phrase)];
        if (!row || row.kind === 'unmapped' || !allowlist.has(row.kind)) {
          const suggestions = scorePhraseAgainstCatalog(phrase, countryCode, matterProfile)
            .slice(0, 3)
            .map((r) => ({ kind: r.kind, label: r.label, confidence: r.combinedScore }));
          return { phrase, suggestions };
        }

        const confidence = Math.min(1, Math.max(0.3, row.confidence ?? 0.65));
        const label = labelByKind.get(row.kind) ?? row.kind.replace(/_/g, ' ');
        const alts = (row.alternatives ?? [])
          .filter((k) => allowlist.has(k) && k !== row.kind)
          .slice(0, 2)
          .map((k) => ({
            kind: k,
            label: labelByKind.get(k) ?? k.replace(/_/g, ' '),
            confidence: confidence * 0.85,
          }));

        return {
          phrase,
          resolution: {
            phrase,
            kind: row.kind,
            label,
            documentKind: documentKindForCuratedKind(row.kind),
            confidence,
            source: 'llm' as const,
            provisional: confidence < 0.65 || isProvisionalPhrase(phrase, confidence),
            alternatives: alts.length ? alts : undefined,
          },
          suggestions: alts,
        };
      });
    } catch (err) {
      this.logger.warn(`LLM explicit phrase mapping failed: ${(err as Error).message}`);
      return phrases.map((phrase) => ({
        phrase,
        suggestions: scorePhraseAgainstCatalog(phrase, countryCode, matterProfile)
          .slice(0, 3)
          .map((r) => ({ kind: r.kind, label: r.label, confidence: r.combinedScore })),
      }));
    }
  }
}

/** Pure re-export for unit tests (catalog + regex tiers, no LLM). */
export async function resolveExplicitDocumentsWithoutLlm(
  options: ExplicitDocumentResolveOptions,
): Promise<ExplicitDocumentResolveResult> {
  const phrases = extractExplicitDocumentPhrases(options.query);
  const hasExplicitSection = phrases.length > 0;
  const countryCode = (options.countryCode ?? options.matterProfile?.country ?? 'IN').toUpperCase();

  if (!hasExplicitSection) {
    return { hasExplicitSection: false, resolutions: [], unmapped: [], bundle: [] };
  }

  const resolutions: ExplicitDocumentResolution[] = [];
  const unmapped: UnmappedExplicitPhrase[] = [];

  for (const phrase of phrases) {
    const regexMapped = mapPhraseToDraftKind(phrase);
    if (regexMapped) {
      resolutions.push({
        phrase,
        kind: regexMapped.kind,
        label: regexMapped.label,
        documentKind: regexMapped.documentKind,
        confidence: 1,
        source: 'regex',
      });
      continue;
    }

    const catalog = resolveViaCatalog(phrase, countryCode, options.matterProfile);
    if (catalog.resolution) {
      resolutions.push(catalog.resolution);
    } else {
      unmapped.push({
        phrase,
        suggestions: catalog.suggestions,
      });
    }
  }

  return {
    hasExplicitSection,
    resolutions,
    unmapped,
    bundle: buildBundleFromResolutions(resolutions),
  };
}
