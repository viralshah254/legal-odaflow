import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

/** Optional case-law links stored on JurisdictionForm.metadata.caseLaws */
export interface FormLinkedCaseLaw {
  citation: string;
  caseName?: string;
  holding?: string;
  court?: string;
}

export type PinnedSectionSource =
  | 'section_finder'
  | 'user_unresolved'
  | 'resolved_ingest';

export type PinnedCaseLawSource = 'user' | 'research' | 'form_metadata';

export interface PinnedSection {
  actId?: string;
  section: string;
  label?: string;
  authorityId?: string;
  textExcerpt?: string;
  source: PinnedSectionSource;
}

export interface PinnedCaseLaw {
  citation: string;
  caseName?: string;
  holding?: string;
  authorityId?: string;
  source: PinnedCaseLawSource;
}

export function parseFormCaseLaws(metadata: unknown): FormLinkedCaseLaw[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).caseLaws;
  if (!Array.isArray(raw)) return [];
  const out: FormLinkedCaseLaw[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const citation = typeof row.citation === 'string' ? row.citation.trim() : '';
    if (!citation) continue;
    out.push({
      citation,
      caseName: typeof row.caseName === 'string' ? row.caseName.trim() : undefined,
      holding: typeof row.holding === 'string' ? row.holding.trim() : undefined,
      court: typeof row.court === 'string' ? row.court.trim() : undefined,
    });
  }
  return out;
}

export function formLinkedToRetrievedAuthorities(
  linked: FormLinkedCaseLaw[],
  formNumber?: string,
): RetrievedAuthority[] {
  return linked.map((c, i) => ({
    id: `form__${(formNumber ?? 'unknown').replace(/\W+/g, '_').toLowerCase()}__${i}__${c.citation
      .replace(/\W+/g, '_')
      .toLowerCase()
      .slice(0, 48)}`,
    title: c.caseName?.trim() || c.citation,
    citation: c.citation,
    sourceName: c.court?.trim() || 'Form-linked authority',
    summary: c.holding?.trim() || `Form-linked precedent for form ${formNumber ?? ''}`.trim(),
    sourceTier: 'case_law' as const,
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law' as const,
    score: 0.95,
  }));
}

export function pinnedCaseLawsToRetrievedAuthorities(
  pins: PinnedCaseLaw[],
): RetrievedAuthority[] {
  return pins.map((p, i) => {
    const citation = p.citation.trim();
    const verified = Boolean(p.authorityId) || p.source === 'research' || p.source === 'form_metadata';
    return {
      id:
        p.authorityId?.trim() ||
        `pinned_case__${i}__${citation.replace(/\W+/g, '_').toLowerCase().slice(0, 48)}`,
      title: p.caseName?.trim() || citation,
      citation,
      sourceName: verified ? 'User-pinned (verified)' : 'User-pinned (unverified — prefer retrieval)',
      summary:
        p.holding?.trim() ||
        (verified
          ? 'User-requested authority — MUST cite where relevant.'
          : 'User-requested citation — treat as preferred retrieval query; do not invent holdings.'),
      sourceTier: 'case_law' as const,
      authorityType: 'CASE_LAW',
      treatmentStatus: 'good_law' as const,
      score: verified ? 0.99 : 0.5,
    };
  });
}

export function buildPinnedSectionsPromptBlock(pins: PinnedSection[]): string {
  if (!pins.length) return '';
  const lines = [
    'USER-PINNED STATUTE SECTIONS (MUST cite these where legally relevant — do not omit):',
  ];
  for (const p of pins) {
    const label =
      p.label?.trim() ||
      [p.actId?.toUpperCase(), p.section ? `§${p.section}` : ''].filter(Boolean).join(' ') ||
      p.section;
    const excerpt = p.textExcerpt?.trim()
      ? `: ${p.textExcerpt.trim().slice(0, 500)}`
      : '';
    const soft =
      p.source === 'user_unresolved'
        ? ' [UNVERIFIED — confirm via Section Finder / bare act before relying as sole authority]'
        : '';
    lines.push(`- ${label}${excerpt}${soft}`);
  }
  return lines.join('\n');
}

export function buildPinnedCaseLawsPromptBlock(pins: PinnedCaseLaw[]): string {
  if (!pins.length) return '';
  const lines = [
    'USER-PINNED CASE LAWS (MUST weave into grounds where on-point; prefer these over inventing cites):',
  ];
  for (const p of pins) {
    const name = p.caseName?.trim() ? `${p.caseName.trim()} ` : '';
    const holding = p.holding?.trim() ? ` — ${p.holding.trim().slice(0, 320)}` : '';
    const soft =
      p.source === 'user' && !p.authorityId
        ? ' [user-requested — verify before treating as sole ratio]'
        : '';
    lines.push(`- ${name}(${p.citation.trim()})${holding}${soft}`);
  }
  return lines.join('\n');
}

export function mergePinnedIntoVerifiedBlock(
  baseBlock: string,
  pinnedCaseLaws: PinnedCaseLaw[],
): string {
  const pinBlock = buildPinnedCaseLawsPromptBlock(pinnedCaseLaws);
  if (!pinBlock) return baseBlock;
  return `${pinBlock}\n\n${baseBlock}`;
}
