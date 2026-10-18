const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/xml,text/xml,application/zip,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (compatible; LegalByOdaflow/1.0; +https://odaflow.com)',
};

export interface FetchWithRetryOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  minBytes?: number;
  validateXml?: boolean;
}

function fetchErrorCause(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return cause.code;
    if (cause?.message) return cause.message;
    return err.message;
  }
  return String(err);
}

/** Fetch with retries, timeout, and optional body validation. */
export async function fetchWithRetry(
  url: string,
  opts: FetchWithRetryOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 3;
  const headers = { ...DEFAULT_HEADERS, ...opts.headers };
  let lastErr: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers,
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (res.status >= 500 && attempt < retries - 1) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        return res;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
    }
  }

  throw new Error(`fetch failed for ${url}: ${fetchErrorCause(lastErr)}`);
}

export async function fetchTextWithRetry(
  url: string,
  opts: FetchWithRetryOptions = {},
): Promise<string | null> {
  const minBytes = opts.minBytes ?? 500;
  try {
    const res = await fetchWithRetry(url, opts);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < minBytes) return null;
    if (opts.validateXml !== false && !text.includes('<')) return null;
    return text;
  } catch {
    return null;
  }
}

export async function fetchBufferWithRetry(
  url: string,
  opts: FetchWithRetryOptions = {},
): Promise<Buffer | null> {
  const minBytes = opts.minBytes ?? 1024;
  try {
    const res = await fetchWithRetry(url, { ...opts, timeoutMs: opts.timeoutMs ?? 300_000 });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < minBytes) return null;
    return buf;
  } catch {
    return null;
  }
}

export { fetchErrorCause };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
