/**
 * @deprecated Use statute-registry/index.ts directly. Kept for backward compatibility.
 */
import {
  expandQuery,
  getSearchTopicsForStatute,
  resolveAcronym,
} from './statute-registry';

export { expandQuery as expandStatuteQuery } from './statute-registry';
export type { QueryExpansionResult } from './statute-registry';

/** @deprecated Use resolveAcronym from statute-registry */
export function resolveStatuteAliases(token: string, countryCode = 'IN'): string[] {
  const statute = resolveAcronym(token, countryCode);
  if (!statute) return [];
  return [
    statute.fullName,
    statute.shortName,
    ...statute.searchAliases,
    ...getSearchTopicsForStatute(statute),
  ];
}

/** @deprecated Use ALL_STATUTES from statute-registry */
export const IN_STATUTE_ALIASES: Record<string, string[]> = {};

// Re-export expandQuery under legacy name for callers using expandStatuteQuery
export function expandStatuteQueryLegacy(query: string, countryCode = 'IN') {
  return expandQuery(query, countryCode);
}
