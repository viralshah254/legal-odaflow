/** Normalize act hints to a stable family id for cross-act collision guards. */
export function normalizeActFamily(actHint?: string | null): string | undefined {
  if (!actHint) return undefined;
  const h = actHint.toLowerCase().replace(/\s+/g, ' ');
  if (/\bcontract/i.test(h)) return 'contract-act';
  if (/\bincome.?tax/i.test(h)) return 'income-tax';
  if (/\bspecific relief/i.test(h)) return 'specific-relief';
  if (/\bbnss\b/.test(h)) return 'bnss';
  if (/\bbns\b/.test(h)) return 'bns';
  if (/\bbsa\b/.test(h)) return 'bsa';
  if (/\bipc\b/.test(h)) return 'ipc';
  if (/\bcrpc\b/.test(h)) return 'crpc';
  if (/\bcpc\b/.test(h)) return 'cpc';
  if (/\bibc\b/.test(h)) return 'ibc';
  if (/\bni act\b/.test(h)) return 'ni_act';
  return undefined;
}

export function actFamiliesCompatible(
  left?: string | null,
  right?: string | null,
): boolean {
  const a = normalizeActFamily(left);
  const b = normalizeActFamily(right);
  if (!a || !b) return true;
  return a === b;
}

export function isMalformedCitation(text: string): boolean {
  return (
    /s\.schedule-[a-z]+[a-z]{2,}/i.test(text) ||
    /schedule-vi[a-z]/i.test(text) ||
    /\bs\.\s*schedule-[a-z]+\s*[a-z]{3,}/i.test(text)
  );
}
