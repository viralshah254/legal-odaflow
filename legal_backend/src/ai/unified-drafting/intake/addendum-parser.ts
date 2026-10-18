const ADDENDUM_HEADER = /\n\nAdditional information provided:\n/gi;

/** Parse all "Additional information provided" blocks from user text. */
export function parseAddendumEntries(rawFacts: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const parts = rawFacts.split(ADDENDUM_HEADER);
  for (let i = 1; i < parts.length; i++) {
    for (const line of parts[i].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const key = normalizeAddendumKey(trimmed.slice(0, colonIdx));
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key && value) entries[key] = value;
    }
  }
  return entries;
}

export function stripAddendumBlocks(rawFacts: string): string {
  const idx = rawFacts.search(/\n\nAdditional information provided:\n/i);
  return idx === -1 ? rawFacts.trim() : rawFacts.slice(0, idx).trimEnd();
}

function normalizeAddendumKey(label: string): string {
  return label
    .replace(/^required input missing:\s*/i, '')
    .replace(/\s+(not specified|not provided|not given)\.?$/i, '')
    .replace(/\s*(appears|is|needs).+$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function addendumValue(entries: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (entries[normalized]?.trim()) return entries[normalized].trim();
  }
  return undefined;
}

export function extractAccusedFromAddendum(rawFacts: string): string | undefined {
  const entries = parseAddendumEntries(rawFacts);
  return addendumValue(
    entries,
    'petitioner_accused_name',
    'petitioner_accused',
    'accused_name',
    'accused_full_name',
    'petitioner_name',
    'applicant_name',
  );
}
