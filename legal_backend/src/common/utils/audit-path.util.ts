const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_SEGMENT = /^c[a-z0-9]{24}$/i;
const EMAIL_SEGMENT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_ID_SEGMENT = /^\d+$/;
const LONG_HEX_SEGMENT = /^[0-9a-f]{16,}$/i;
const TOKEN_LIKE_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;

const HIGH_VOLUME_AUDIT_PATTERNS: Array<{
  method?: string;
  path: RegExp;
  sampleRate: number;
}> = [
  { method: 'GET', path: /^\/health(\/|$)/, sampleRate: 0.05 },
  { method: 'GET', path: /^\/$/, sampleRate: 0.05 },
  { method: 'GET', path: /^\/me\/counts$/, sampleRate: 0.1 },
  { method: 'GET', path: /^\/notifications$/, sampleRate: 0.1 },
];

function redactPathSegment(segment: string): string {
  if (!segment) {
    return segment;
  }

  if (
    UUID_SEGMENT.test(segment) ||
    CUID_SEGMENT.test(segment) ||
    NUMERIC_ID_SEGMENT.test(segment) ||
    LONG_HEX_SEGMENT.test(segment) ||
    TOKEN_LIKE_SEGMENT.test(segment)
  ) {
    return ':id';
  }

  if (EMAIL_SEGMENT.test(segment)) {
    return ':email';
  }

  try {
    const decoded = decodeURIComponent(segment);
    if (decoded !== segment && EMAIL_SEGMENT.test(decoded)) {
      return ':email';
    }
  } catch {
    // Ignore malformed percent-encoding.
  }

  return segment;
}

/** Strip query strings and replace identifier-like path segments before audit persistence. */
export function redactAuditPath(path: string): string {
  const [pathname] = path.split('?');
  const segments = pathname.split('/').map(redactPathSegment);
  const redacted = segments.join('/') || '/';
  return path.includes('?') ? `${redacted}?[redacted]` : redacted;
}

/** Normalize route/path values for sampling rules (drops global API prefix). */
export function normalizeAuditPath(path: string): string {
  const pathname = path.split('?')[0];
  const withoutPrefix = pathname.replace(/^\/api\/v1(?=\/|$)/, '');
  return withoutPrefix || '/';
}

export function resolveHighVolumeAuditSampleRate(
  method: string,
  path: string,
): number | null {
  const normalizedPath = normalizeAuditPath(path);

  for (const pattern of HIGH_VOLUME_AUDIT_PATTERNS) {
    if (pattern.method && pattern.method !== method) {
      continue;
    }
    if (pattern.path.test(normalizedPath)) {
      return pattern.sampleRate;
    }
  }

  return null;
}

export function shouldLogAuditRequest(
  method: string,
  path: string,
  random: () => number = Math.random,
): boolean {
  const sampleRate = resolveHighVolumeAuditSampleRate(method, path);
  if (sampleRate === null) {
    return true;
  }

  return random() < sampleRate;
}
