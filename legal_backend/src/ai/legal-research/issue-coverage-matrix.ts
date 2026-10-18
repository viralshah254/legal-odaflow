import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  IssueCoverageCell,
  IssueCoverageMatrix,
  ResearchIntelligenceMap,
  ResearchQueryPlan,
} from './research-intelligence-map.types';
import { isCaseLawProviderFailureStatus } from './research-provider-gate';
import { isStatuteAuthority } from './similar-cases.service';

function isCaseLike(a: RetrievedAuthority): boolean {
  if (isStatuteAuthority(a)) return false;
  const tier = (a.sourceTier ?? '').toLowerCase();
  const type = (a.authorityType ?? '').toUpperCase();
  if (tier === 'case_law' || tier === 'aggregator') return true;
  if (type === 'CASE' || type === 'CASE_LAW' || type === 'JUDGMENT') return true;
  return /\bv\.?\s|\bvs\.?\s/i.test(a.title ?? '');
}

function authorityBlob(a: RetrievedAuthority): string {
  return `${a.title ?? ''} ${a.citation ?? ''} ${a.summary ?? ''} ${a.fullText ?? ''}`.toLowerCase();
}

function issueTokens(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3);
}

function issueHasLaw(issue: string, authorities: RetrievedAuthority[]): boolean {
  const tokens = issueTokens(issue);
  return authorities.some((a) => {
    if (!isStatuteAuthority(a) && a.authorityType !== 'REGULATION' && a.sourceTier !== 'primary') {
      // allow regulator / primary non-case
      if (!/regulation|guideline|circular|act|code|rule/i.test(a.title ?? '')) return false;
    }
    const blob = authorityBlob(a);
    return tokens.some((t) => blob.includes(t)) || tokens.length === 0;
  });
}

function issueHasCases(issue: string, authorities: RetrievedAuthority[]): boolean {
  const tokens = issueTokens(issue);
  const cases = authorities.filter(isCaseLike);
  if (cases.length === 0) return false;
  if (tokens.length === 0) return true;
  return cases.some((a) => {
    const blob = authorityBlob(a);
    return tokens.some((t) => blob.includes(t));
  });
}

function hasCurrentLawSignal(authorities: RetrievedAuthority[], map: ResearchIntelligenceMap): boolean {
  const blob = authorities.map(authorityBlob).join(' ');
  if (/\b(in force|amended|repealed|superseded|effective|current)\b/i.test(blob)) return true;
  // If map requested current_law queries and we have any primary statute, treat as attempted.
  const wantsCurrent = map.researchQueries.some((q) => q.purpose === 'current_law');
  return wantsCurrent && authorities.some((a) => a.sourceTier === 'primary' || isStatuteAuthority(a));
}

function hasContrarySignal(
  authorities: RetrievedAuthority[],
  map: ResearchIntelligenceMap,
  contraryAttempted: boolean,
): boolean {
  if (!contraryAttempted) return false;
  const blob = authorities.map(authorityBlob).join(' ');
  if (/\b(distinguish|overrul|criticiz|contra|dissent|limit)\b/i.test(blob)) return true;
  // Contrary search ran successfully even if no adverse hit — mark covered when attempted with hits.
  return contraryAttempted && authorities.length > 0;
}

export function buildIssueCoverageMatrix(input: {
  map: ResearchIntelligenceMap;
  authorities: RetrievedAuthority[];
  contrarySearchAttempted?: boolean;
  loopsRun?: number;
  /** When case-law connectors are known-down, do not schedule case-gap retrieves. */
  caseLawSearchStatus?: string | null;
}): IssueCoverageMatrix {
  const contraryAttempted = input.contrarySearchAttempted ?? false;
  const currentOk = hasCurrentLawSignal(input.authorities, input.map);
  const caseLawProviderFailed = isCaseLawProviderFailureStatus(input.caseLawSearchStatus);

  const cells: IssueCoverageCell[] = input.map.issues.map((issue) => {
    const law = issueHasLaw(issue.label, input.authorities);
    const cases = issueHasCases(issue.label, input.authorities);
    // Current/contrary are research-wide dimensions attached to each issue.
    return {
      issueId: issue.id,
      issueLabel: issue.label,
      law,
      cases,
      current: currentOk || law,
      contrary: hasContrarySignal(input.authorities, input.map, contraryAttempted),
    };
  });

  // If map has no issues, synthesize one from query coverage.
  if (cells.length === 0) {
    cells.push({
      issueId: 'issue-default',
      issueLabel: 'Primary research question',
      law: input.authorities.some((a) => isStatuteAuthority(a) || a.sourceTier === 'primary'),
      cases: input.authorities.some(isCaseLike),
      current: currentOk,
      contrary: contraryAttempted,
    });
  }

  const redCells: IssueCoverageMatrix['redCells'] = [];
  const providerLimitedDimensions = new Set<'cases' | 'law' | 'current' | 'contrary'>();
  for (const cell of cells) {
    const dims: Array<'law' | 'cases' | 'current' | 'contrary'> = [
      'law',
      'cases',
      'current',
      'contrary',
    ];
    for (const dim of dims) {
      if (cell[dim]) continue;
      const nonRetryable =
        dim === 'cases' && caseLawProviderFailed;
      if (nonRetryable) {
        providerLimitedDimensions.add('cases');
        redCells.push({
          issueId: cell.issueId,
          dimension: dim,
          suggestedQueries: [],
          nonRetryable: true,
          reason: `Case-law provider failure (${input.caseLawSearchStatus}) — SEARCH_INCOMPLETE / PROVIDER_FAILURE`,
        });
        continue;
      }
      redCells.push({
        issueId: cell.issueId,
        dimension: dim,
        suggestedQueries: suggestQueriesForGap(input.map, cell.issueId, dim),
      });
    }
  }

  return {
    cells,
    redCells,
    // Complete only when every dimension is covered; provider-limited cases remain incomplete.
    complete: redCells.length === 0,
    loopsRun: input.loopsRun ?? 0,
    providerLimitedDimensions:
      providerLimitedDimensions.size > 0 ? [...providerLimitedDimensions] : undefined,
  };
}

/** Red cells that may still trigger coverage-loop retrieves. */
export function retryableCoverageRedCells(
  matrix: IssueCoverageMatrix,
): IssueCoverageMatrix['redCells'] {
  return matrix.redCells.filter((cell) => !cell.nonRetryable && cell.suggestedQueries.length > 0);
}

function suggestQueriesForGap(
  map: ResearchIntelligenceMap,
  issueId: string,
  dimension: 'law' | 'cases' | 'current' | 'contrary',
): string[] {
  const issue = map.issues.find((i) => i.id === issueId);
  const label = issue?.label ?? 'legal issue';
  const purposeMap: Record<typeof dimension, ResearchQueryPlan['purpose']> = {
    law: 'statute',
    cases: 'case',
    current: 'current_law',
    contrary: 'contrary',
  };
  const purpose = purposeMap[dimension];
  const fromPlan = [
    ...map.researchQueries,
    ...map.contraryAuthorityQueries,
  ]
    .filter((q) => q.purpose === purpose || q.issueIds?.includes(issueId))
    .map((q) => q.query);

  const defaults = [
    `${label} ${purpose === 'case' ? 'case law judgment' : purpose === 'contrary' ? 'contrary distinguished overruled' : purpose === 'current_law' ? 'current law amended repealed' : 'statute regulation'}`,
  ];

  if (dimension === 'law') {
    for (const s of map.likelyStatutes) {
      defaults.push([s.title, s.citation, ...(s.searchHints ?? [])].filter(Boolean).join(' '));
    }
    for (const r of map.likelyRegulations) {
      defaults.push([r.title, r.citation, ...(r.searchHints ?? [])].filter(Boolean).join(' '));
    }
  }
  if (dimension === 'cases') {
    for (const c of map.likelyCases) {
      defaults.push([c.title, c.citation, ...(c.searchHints ?? [])].filter(Boolean).join(' '));
    }
  }

  return [...new Set([...fromPlan, ...defaults].filter(Boolean))].slice(0, 4);
}

export function coverageMatrixPromptBlock(matrix: IssueCoverageMatrix): string {
  const header =
    'ISSUE                       LAW     CASES    CURRENT    CONTRARY';
  const rows = matrix.cells.map((c) => {
    const mark = (v: boolean) => (v ? '✓' : '✗');
    const label = c.issueLabel.slice(0, 26).padEnd(26);
    return `${label} ${mark(c.law).padEnd(7)} ${mark(c.cases).padEnd(8)} ${mark(c.current).padEnd(10)} ${mark(c.contrary)}`;
  });
  const providerNote = matrix.providerLimitedDimensions?.length
    ? ` Provider-limited: ${matrix.providerLimitedDimensions.join(', ')} (do not invent case law).`
    : '';
  return [
    '## Issue coverage matrix',
    header,
    ...rows,
    matrix.complete
      ? 'Coverage: complete within budget.'
      : `Coverage: ${matrix.redCells.length} red cell(s); loopsRun=${matrix.loopsRun}.${providerNote}`,
  ].join('\n');
}
