import { resolveIndiaDraftPrompt } from '@/ai/drafting/templates/india-tier1';
import { INDIA_DRAFT_SYSTEM_PROMPTS } from './india-draft-prompts';

const EXPLICIT_INDIA_CATALOG_KINDS = new Set(
  Object.keys(INDIA_DRAFT_SYSTEM_PROMPTS).filter(
    (k) => k !== 'india_custom' && k !== 'india_form_catalog',
  ),
);

/** User picked a specific format from the India drafting catalog (not free-form custom). */
export function isExplicitIndiaCatalogKind(kind: string): boolean {
  return EXPLICIT_INDIA_CATALOG_KINDS.has(ensureIndiaDraftKind(kind));
}

/** Normalize draft kind slugs to the `india_*` registry form. */
export function ensureIndiaDraftKind(kind: string): string {
  const trimmed = kind.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('india_')) return trimmed;
  if (trimmed === 'india_custom' || trimmed === 'india_form_catalog') return trimmed;
  return `india_${trimmed}`;
}

export function resolveIndiaDraftFormatPrompt(
  kind: string,
  systemPrompts: Record<string, string>,
): string {
  const normalized = ensureIndiaDraftKind(kind);
  const base = systemPrompts[normalized] ?? systemPrompts[kind] ?? '';
  const fromTier1 = resolveIndiaDraftPrompt(normalized, base);
  if (fromTier1) return fromTier1;
  if (base) return base;
  return resolveIndiaDraftPrompt('india_custom', systemPrompts.india_custom ?? '');
}
