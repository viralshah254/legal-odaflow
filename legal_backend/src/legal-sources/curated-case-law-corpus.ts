/**
 * Compatibility export for the unified Indian caselaw corpus.
 *
 * All curated Indian authorities now live in
 * data/india-caselaw-corpus/india-caselaw-corpus.json.
 */
import {
  findIndiaCaselawByCitation,
  findIndiaCaselawByTitle,
  loadIndiaCaselawCorpus,
} from './load-india-caselaw-corpus';
import type { IndiaCaselawEntry } from './india-caselaw-corpus.types';

export type { IndiaCaselawEntry as CuratedCaseLawEntry } from './india-caselaw-corpus.types';

export const CURATED_CASE_LAW_CORPUS = loadIndiaCaselawCorpus();

/** Lookup curated corpus entries by citation or partial title for candidate verification. */
export function curatedCaseLawCorpusLookup(query: string): IndiaCaselawEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const byCitation = findIndiaCaselawByCitation(trimmed);
  if (byCitation) return [byCitation];
  return findIndiaCaselawByTitle(trimmed).slice(0, 3);
}

/** Topic fallback for discovery when a query names an issue rather than a case. */
export function curatedCaseLawTopicSearch(query: string): IndiaCaselawEntry[] {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .match(/[a-z]{4,}/g)
        ?.filter(
          (term) =>
            ![
              'what',
              'where',
              'which',
              'similar',
              'cases',
              'indian',
              'outcomes',
              'disputed',
              'enforced',
              'agreements',
            ].includes(term),
        ) ?? [],
    ),
  ];
  if (terms.length === 0) return [];
  return loadIndiaCaselawCorpus()
    .map((entry) => {
      const haystack = [
        entry.title,
        entry.summary,
        entry.holding ?? '',
        ...entry.topics,
        ...(entry.keyParagraphs ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return {
        entry,
        score: terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0),
      };
    })
    .filter(({ score }) => score >= Math.min(2, terms.length))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ entry }) => entry);
}
