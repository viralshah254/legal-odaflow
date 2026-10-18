/**
 * Utilities for splitting long legal documents into overlapping chunks for
 * map-reduce analysis, and merging per-chunk partial results into a single
 * DocumentReviewResult.
 */

import type {
  DocumentReviewResult,
  DocumentReviewRisk,
  DocumentReviewClause,
  DocumentReviewAmendment,
  DocumentReviewPro,
  DocumentReviewCon,
  DocumentReviewParty,
  DocumentReviewKeyDate,
} from './ai-gateway.service';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SINGLE_PASS_LIMIT = 80_000;
export const CHUNK_SIZE = 60_000;
export const CHUNK_OVERLAP = 2_000;
export const MAX_CHUNKS = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentChunk {
  index: number;
  total: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface AnalysisCoverage {
  totalChars: number;
  analyzedChars: number;
  chunkCount: number;
  /** false when the doc exceeded MAX_CHUNKS and trailing sections were dropped */
  fullCoverage: boolean;
}

/** Lightweight result returned by a single-chunk analysis pass */
export interface PartialReviewResult {
  sectionSummary: string;
  parties: DocumentReviewParty[];
  keyDates: DocumentReviewKeyDate[];
  pros: DocumentReviewPro[];
  cons: DocumentReviewCon[];
  risks: DocumentReviewRisk[];
  keyClauses: DocumentReviewClause[];
  amendments: DocumentReviewAmendment[];
}

// ─── Splitting ────────────────────────────────────────────────────────────────

/**
 * Split a document into overlapping chunks suitable for parallel analysis.
 *
 * Chunk boundaries are snapped to the nearest preceding `\n\n` (paragraph
 * boundary) within a 500-char search window so clauses are not cut mid-sentence.
 */
export function splitDocumentForReview(
  text: string,
  opts: { chunkSize?: number; overlap?: number; maxChunks?: number } = {},
): { chunks: DocumentChunk[]; coverage: Omit<AnalysisCoverage, 'chunkCount'> } {
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;
  const maxChunks = opts.maxChunks ?? MAX_CHUNKS;

  const totalChars = text.length;
  const chunks: DocumentChunk[] = [];
  let offset = 0;

  while (offset < text.length && chunks.length < maxChunks) {
    const rawEnd = Math.min(offset + chunkSize, text.length);

    // Snap to nearest paragraph break within 500 chars before rawEnd
    let end = rawEnd;
    if (rawEnd < text.length) {
      const searchFrom = Math.max(rawEnd - 500, offset + 1);
      const lastBreak = text.lastIndexOf('\n\n', rawEnd);
      if (lastBreak > searchFrom) {
        end = lastBreak + 2; // include the newlines in the preceding chunk
      }
    }

    chunks.push({ index: chunks.length, total: -1, text: text.slice(offset, end), startOffset: offset, endOffset: end });

    // If the chunk consumed through the end of the document, stop.
    if (end >= text.length) break;

    offset = end - overlap;
  }

  // Fill in the correct total now that we know it
  const total = chunks.length;
  for (const c of chunks) c.total = total;

  const lastChunk = chunks[chunks.length - 1];
  const analyzedChars = lastChunk ? lastChunk.endOffset : 0;
  const fullCoverage = analyzedChars >= totalChars;

  return { chunks, coverage: { totalChars, analyzedChars, fullCoverage } };
}

// ─── Merging ──────────────────────────────────────────────────────────────────

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = normKey(keyFn(item));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function riskScore(label: 'Low' | 'Moderate' | 'High' | 'Critical'): number {
  return { Low: 1, Moderate: 2, High: 3, Critical: 4 }[label] ?? 0;
}

export interface MergedPartialResult {
  documentType: string;
  parties: DocumentReviewParty[];
  keyDates: DocumentReviewKeyDate[];
  pros: DocumentReviewPro[];
  cons: DocumentReviewCon[];
  risks: DocumentReviewRisk[];
  keyClauses: DocumentReviewClause[];
  amendments: DocumentReviewAmendment[];
  overallRiskScore: number;
  riskLabel: DocumentReviewResult['riskLabel'];
  complianceFlags: string[];
  analysisCoverage: AnalysisCoverage;
}

/**
 * Merge an array of partial results from chunk analysis into a single unified
 * set of findings. The final executive summary / recommendations / follow-up
 * questions are intentionally left empty here — they are filled in by the
 * reduce LLM synthesis call in `ai-gateway.service.ts`.
 */
export function mergePartialResults(
  partials: PartialReviewResult[],
  coverage: AnalysisCoverage,
): MergedPartialResult {
  const allRisks = dedupeByKey(
    partials.flatMap((p) => p.risks),
    (r) => r.title + (r.sourceText ?? '').slice(0, 40),
  );
  const allClauses = dedupeByKey(
    partials.flatMap((p) => p.keyClauses),
    (c) => c.title + c.originalText.slice(0, 40),
  );
  const allAmendments = dedupeByKey(
    partials.flatMap((p) => p.amendments),
    (a) => a.clauseRef + (a.originalText ?? '').slice(0, 40),
  );
  const allPros = dedupeByKey(
    partials.flatMap((p) => p.pros),
    (p) => p.title + (p.sourceText ?? '').slice(0, 30),
  );
  const allCons = dedupeByKey(
    partials.flatMap((p) => p.cons),
    (c) => c.title + (c.sourceText ?? '').slice(0, 30),
  );
  const allParties = dedupeByKey(
    partials.flatMap((p) => p.parties),
    (p) => p.name,
  );
  const allDates = dedupeByKey(
    partials.flatMap((p) => p.keyDates),
    (d) => d.date + d.description.slice(0, 20),
  );

  // Sort risks HIGH first
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  allRisks.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  // Risk score: worst-case from merged risks
  const highCount = allRisks.filter((r) => r.severity === 'HIGH').length;
  const medCount = allRisks.filter((r) => r.severity === 'MEDIUM').length;
  const overallRiskScore = Math.min(
    100,
    highCount * 18 + medCount * 8 + allRisks.filter((r) => r.severity === 'LOW').length * 3,
  );
  const riskLabel: DocumentReviewResult['riskLabel'] =
    overallRiskScore >= 76 ? 'Critical'
    : overallRiskScore >= 51 ? 'High'
    : overallRiskScore >= 26 ? 'Moderate'
    : 'Low';

  return {
    documentType: 'GENERAL',
    parties: allParties,
    keyDates: allDates,
    pros: allPros,
    cons: allCons,
    risks: allRisks,
    keyClauses: allClauses.slice(0, 12),
    amendments: allAmendments.slice(0, 10),
    overallRiskScore,
    riskLabel,
    complianceFlags: dedupeByKey(
      partials.flatMap((p) => (p as any).complianceFlags ?? []),
      (f: string) => f,
    ),
    analysisCoverage: coverage,
  };
}
