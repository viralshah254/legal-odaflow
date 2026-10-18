/** Convert a Kenya Law public URL to a Laws.Africa FRBR URI (no leading slash). */
import type { KeLegislationNature, KeManifestActEntry } from './ke-manifest.types';

export function frbrUriFromKenyaLawUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.includes('kenyalaw.org')) return null;
    const path = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!path.startsWith('akn/')) return null;
    return path;
  } catch {
    return null;
  }
}

/** Public Kenya Law URL for an expression FRBR URI. */
export function publicUrlFromFrbrUri(frbrUri: string): string {
  const normalized = frbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
  return `https://new.kenyalaw.org/${normalized}`;
}

/** Work-level FRBR URI (drops language/date expression suffix). */
export function workFrbrUriFromExpression(expressionFrbrUri: string): string {
  const normalized = expressionFrbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = normalized.split('/');
  const langIndex = parts.findIndex((part) => /^[a-z]{3}@/.test(part));
  if (langIndex >= 0) {
    return parts.slice(0, langIndex).join('/');
  }
  return normalized;
}

/** Stable act slug for DB storage from a work or expression FRBR URI. */
export function actIdFromFrbrUri(frbrUri: string): string {
  const workUri = workFrbrUriFromExpression(frbrUri);
  const parts = workUri.split('/').filter(Boolean);
  // akn / ke / act / ...
  if (parts.length >= 5 && parts[0] === 'akn' && parts[1] === 'ke' && parts[2] === 'act') {
    const segment = parts[3];

    if (segment === 'ln' && parts.length >= 6) {
      return `ke-ln-${parts[4]}-${parts[5]}`.toLowerCase();
    }
    if (segment === 'gn' && parts.length >= 6) {
      return `ke-gn-${parts[4]}-${parts[5]}`.toLowerCase();
    }
    if (segment === 'corr' && parts.length >= 6) {
      return `ke-corr-${parts[4]}-${parts[5]}`.toLowerCase();
    }
    if (parts[4] === 'constitution') {
      return 'constitution-ke';
    }
    if (/^\d{4}$/.test(segment) && parts[4]) {
      return `ke-act-${segment}-${parts[4]}`.toLowerCase();
    }
  }
  return workUri.replace(/\//g, '-').toLowerCase();
}

/** Classify legislation type from a FRBR URI. */
export function natureFromFrbrUri(expressionFrbrUri: string): KeLegislationNature {
  const work = workFrbrUriFromExpression(expressionFrbrUri);
  if (work.includes('/constitution')) return 'constitution';
  if (work.includes('/act/ln/')) return 'legal_notice';
  if (work.includes('/act/gn/')) return 'gazette_notice';
  if (work.includes('/act/corr/')) return 'corrigenda';
  return 'act';
}

/** Build a manifest row from a Kenya Law FRBR URI. */
export function toKeManifestEntry(input: {
  actId?: string;
  title: string;
  expressionFrbrUri: string;
  capCitation?: string;
  nature?: KeLegislationNature;
}): KeManifestActEntry {
  const expressionFrbrUri = input.expressionFrbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
  const workFrbrUri = workFrbrUriFromExpression(expressionFrbrUri);
  const parts = workFrbrUri.split('/').filter(Boolean);
  const nature = input.nature ?? natureFromFrbrUri(expressionFrbrUri);

  let year: string | undefined;
  let number: string | undefined;
  if (parts[3] === 'ln' || parts[3] === 'gn' || parts[3] === 'corr') {
    year = parts[4];
    number = parts[5];
  } else if (parts.length >= 5) {
    year = parts[3];
    number = parts[4];
  }

  return {
    actId: input.actId ?? actIdFromFrbrUri(expressionFrbrUri),
    title: input.title,
    workFrbrUri,
    expressionFrbrUri,
    expressionDate: expressionDate(expressionFrbrUri) || undefined,
    publicUrl: publicUrlFromFrbrUri(expressionFrbrUri),
    nature,
    year,
    number,
  };
}

/** Pick the latest English expression per work from a paginated listing. */
export function dedupeLatestExpressions<
  T extends { frbr_uri: string; expression_frbr_uri: string; updated_at?: string },
>(rows: T[]): T[] {
  const byWork = new Map<string, T>();

  for (const row of rows) {
    const workUri = row.frbr_uri || workFrbrUriFromExpression(row.expression_frbr_uri);
    const existing = byWork.get(workUri);
    if (!existing) {
      byWork.set(workUri, row);
      continue;
    }

    const existingDate = expressionDate(existing.expression_frbr_uri);
    const candidateDate = expressionDate(row.expression_frbr_uri);
    if (candidateDate > existingDate) {
      byWork.set(workUri, row);
      continue;
    }
    if (
      candidateDate === existingDate &&
      (row.updated_at ?? '') > (existing.updated_at ?? '')
    ) {
      byWork.set(workUri, row);
    }
  }

  return [...byWork.values()];
}

export function expressionDate(expressionFrbrUri: string): string {
  const match = expressionFrbrUri.match(/@([0-9]{4}-[0-9]{2}-[0-9]{2})/);
  return match?.[1] ?? '0000-00-00';
}
