/** Recognize official Indian judgment URLs for case-law promotion. */
export function isOfficialIndianJudgmentUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('indiankanoon.org/doc/') ||
    u.includes('scr.sci.gov.in') ||
    u.includes('main.sci.gov.in') ||
    u.includes('api.sci.gov.in') ||
    u.includes('judgments.ecourts.gov.in') ||
    u.includes('caselaw.shcilex.com') ||
    /\/doc\/\d+\/?$/i.test(u)
  );
}

export function inferJudgmentProvider(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('indiankanoon.org')) return 'india-kanoon';
  if (u.includes('scr.sci.gov.in') || u.includes('main.sci.gov.in') || u.includes('api.sci.gov.in')) {
    return 'e-scr';
  }
  if (u.includes('judgments.ecourts.gov.in')) return 'e-courts';
  return null;
}

export function extractIndiaKanoonDocId(url: string): string | null {
  const match = url.match(/indiankanoon\.org\/doc\/(\d+)/i);
  return match ? `ik-${match[1]}` : null;
}
