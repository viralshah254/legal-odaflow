import { researchRequestSignal } from '@/common/utils/research-execution-budget';
import { createHash } from 'crypto';

export interface PdfFetchResult {
  buffer: Buffer;
  text?: string;
  sha256: string;
  sourceUrl: string;
}

/**
 * DSpace repositories (e.g. indiacode.nic.in) issue a JSESSIONID cookie on the
 * first 302 redirect and expect it to be forwarded on the follow-up request.
 * Node's built-in fetch (undici) follows redirects automatically but strips
 * Cookie/Set-Cookie state between hops, causing an infinite 302 loop.
 *
 * This helper manually follows 3xx redirects while persisting a cookie jar,
 * which unblocks DSpace bitstream downloads.
 */
export async function fetchFollowingRedirects(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {},
): Promise<{ response: Response; finalUrl: string }> {
  const { headers = {}, timeoutMs = 60_000, maxRedirects = 12 } = options;

  const cookieJar = new Map<string, string>();
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const cookieHeader = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

    const res = await fetch(currentUrl, {
      redirect: 'manual',
      signal: researchRequestSignal(timeoutMs),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    // Persist all Set-Cookie headers into the jar
    for (const raw of getSetCookies(res.headers)) {
      const nameValue = raw.split(';')[0].trim();
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        cookieJar.set(nameValue.slice(0, eqIdx).trim(), nameValue.slice(eqIdx + 1).trim());
      }
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return { response: res, finalUrl: currentUrl };
  }

  throw new Error(`Max redirects (${maxRedirects}) exceeded for ${url}`);
}

function getSetCookies(headers: Headers): string[] {
  // getSetCookie() added in Node 18.14+ / undici 5.15+
  const h = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

export async function fetchPdfBuffer(
  url: string,
  timeoutMs = 60_000,
): Promise<PdfFetchResult> {
  const { response, finalUrl } = await fetchFollowingRedirects(url, {
    headers: { Accept: 'application/pdf,*/*;q=0.9' },
    timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`PDF fetch failed (${response.status}) for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  return { buffer, sha256, sourceUrl: finalUrl };
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const parsed = await pdfParse(buffer);
  return parsed.text ?? '';
}

export function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}
