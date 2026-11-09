import type { PrismaService } from '@/prisma/prisma.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

type SimilarCaseLike = {
  authorityId?: unknown;
  title?: unknown;
  citation?: unknown;
  neutralCitation?: unknown;
  court?: unknown;
  summary?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  verificationStatus?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pushAuthority(
  out: RetrievedAuthority[],
  seen: Set<string>,
  input: {
    id: string;
    title: string;
    citation: string | null;
    sourceName: string;
    summary: string | null;
    sourceTier: RetrievedAuthority['sourceTier'];
    authorityType: string;
    court?: string | null;
    sourceUrl?: string | null;
    neutralCitation?: string | null;
    section?: string | null;
    actName?: string | null;
  },
): void {
  const key = [input.citation, input.title, input.section, input.actName]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push({
    id: input.id,
    title: input.title,
    citation: input.citation,
    neutralCitation: input.neutralCitation ?? null,
    sourceName: input.sourceName,
    summary: input.summary,
    sourceUrl: input.sourceUrl ?? null,
    sourceTier: input.sourceTier,
    authorityType: input.authorityType,
    court: input.court ?? null,
    section: input.section ?? null,
    actName: input.actName ?? null,
  });
}

function addVerifiedSimilarCases(
  out: RetrievedAuthority[],
  seen: Set<string>,
  raw: unknown,
): void {
  for (const item of asList(raw)) {
    const row = asObject(item) as SimilarCaseLike | null;
    if (!row) continue;
    if (row.verificationStatus !== 'verified') continue;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const citation = typeof row.citation === 'string' ? row.citation.trim() : '';
    if (!title || !citation) continue;
    pushAuthority(out, seen, {
      id: typeof row.authorityId === 'string' ? row.authorityId : `saved-case:${citation}`,
      title,
      citation,
      sourceName: typeof row.sourceName === 'string' ? row.sourceName : 'Saved research',
      summary: typeof row.summary === 'string' ? row.summary : null,
      sourceTier: 'case_law',
      authorityType: 'CASE',
      court: typeof row.court === 'string' ? row.court : null,
      sourceUrl: typeof row.sourceUrl === 'string' ? row.sourceUrl : null,
      neutralCitation: typeof row.neutralCitation === 'string' ? row.neutralCitation : null,
    });
  }
}

function addVerifiedStatutes(
  out: RetrievedAuthority[],
  seen: Set<string>,
  raw: unknown,
): void {
  for (const item of asList(raw)) {
    const row = asObject(item);
    if (!row) continue;
    const authorityType = String(row.authorityType ?? row.sourceTier ?? '').toUpperCase();
    const isStatute =
      authorityType === 'STATUTE' ||
      authorityType === 'RULE' ||
      authorityType === 'REGULATION' ||
      row.sourceTier === 'primary';
    if (!isStatute) continue;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const citation =
      (typeof row.citation === 'string' && row.citation.trim()) ||
      [row.actName, row.section].filter((part) => typeof part === 'string').join(' § ') ||
      null;
    if (!title && !citation) continue;
    pushAuthority(out, seen, {
      id: typeof row.id === 'string' ? row.id : `saved-statute:${citation ?? title}`,
      title: title || citation || 'Statute',
      citation,
      sourceName: typeof row.sourceName === 'string' ? row.sourceName : 'Saved research',
      summary: typeof row.summary === 'string' ? row.summary : null,
      sourceTier: 'primary',
      authorityType: 'STATUTE',
      section: typeof row.section === 'string' ? row.section : null,
      actName: typeof row.actName === 'string' ? row.actName : null,
      sourceUrl: typeof row.sourceUrl === 'string' ? row.sourceUrl : null,
    });
  }
}

/**
 * Pin named statutes and Similar Cases that survived verification.
 * Connector failure is not treated as absence of law — unverified rows are omitted.
 */
export function extractVerifiedAuthoritiesFromSavedResearch(
  researchJsonList: unknown[],
): RetrievedAuthority[] {
  const out: RetrievedAuthority[] = [];
  const seen = new Set<string>();

  for (const json of researchJsonList) {
    const root = asObject(json);
    if (!root) continue;
    addVerifiedStatutes(out, seen, root.citations);
    addVerifiedStatutes(out, seen, root.authorities);
    addVerifiedSimilarCases(out, seen, root.similarCases);
    const citations = asObject(root.citations);
    if (citations) {
      addVerifiedSimilarCases(out, seen, citations.similarCases);
      addVerifiedStatutes(out, seen, citations.statutes);
    }
  }

  return out.slice(0, 12);
}

/** Caller must first authorize the matter. Client-edited SavedResearch JSON is
 * a note, never the source of a verified authority flag. Read the canonical
 * server output with the current verification result instead. */
export async function loadVerifiedMatterResearchAuthorities(
  prisma: Pick<PrismaService, 'savedResearch' | 'aIOutput'>,
  actor: { tenantId: string; userId: string; matterId: string },
): Promise<RetrievedAuthority[]> {
  const rows = await prisma.savedResearch.findMany({
    where: { tenantId: actor.tenantId, matterId: actor.matterId }, orderBy: { createdAt: 'desc' }, take: 8,
    select: { aiOutputId: true },
  });
  const ids = [...new Set(rows.flatMap(row => row.aiOutputId ? [row.aiOutputId] : []))];
  if (!ids.length) return [];
  const outputs = await prisma.aIOutput.findMany({
    where: { id: { in: ids }, tenantId: actor.tenantId, taskType: 'LEGAL_RESEARCH', verified: true, requiresLawyerReview: false,
      OR: [{ matterId: actor.matterId }, { matterId: null, userId: actor.userId }] },
    select: { verified: true, requiresLawyerReview: true, citations: true },
  });
  return extractVerifiedAuthoritiesFromSavedResearch(outputs.flatMap(output => {
    if (!output.verified || output.requiresLawyerReview) return [];
    const canonical = asObject(output.citations);
    if (!canonical) return [];
    const payload = asObject(canonical.cachePayload);
    return [payload ?? { citations: canonical.items, similarCases: canonical.similarCases }];
  }));
}
