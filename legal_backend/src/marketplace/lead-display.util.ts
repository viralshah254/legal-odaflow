const JUNK_TITLES = new Set(['na', 'n/a', 'n.a.', 'tbd', 'none', 'untitled', '-', '—']);

const INTERNAL_LINE_PREFIXES = [
  'slaEscalated:',
  'leadScore:',
  'reviewRequestId:',
  'Rejected:',
];

function isJunkTitle(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = value.trim().toLowerCase();
  return JUNK_TITLES.has(normalized);
}

function stripInlineInternalTokens(text: string): string {
  return text
    .replace(/\bslaEscalated:(true|false)\b/gi, '')
    .replace(/\bleadScore:\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInternalLines(text: string): string {
  return stripInlineInternalTokens(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !INTERNAL_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)))
      .filter((line) => line !== 'slaEscalated:true')
      .join('\n')
      .trim(),
  );
}

/** Parse firm-intake summary: Client: … — Ref: … — {title} — notes */
function parseFirmIntakeTitle(summary: string): string | null {
  const cleaned = stripInternalLines(summary);
  if (!cleaned) return null;

  const parts = cleaned.split(' — ').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // Client: X — Ref: Y — Title — Notes → title is index 2 when prefixed
  if (parts[0]?.startsWith('Client:')) {
    if (parts.length >= 3 && !parts[2].startsWith('Ref:')) {
      const candidate = parts[2];
      return isJunkTitle(candidate) ? null : candidate;
    }
    if (parts.length === 2 && !parts[1].startsWith('Ref:')) {
      const candidate = parts[1];
      return isJunkTitle(candidate) ? null : candidate;
    }
    return null;
  }

  // Single segment or last meaningful segment without internal metadata
  const last = parts[parts.length - 1];
  if (last.includes(' — Completed consumer case')) {
    return null;
  }
  return isJunkTitle(last) ? null : last;
}

export function sanitizeLeadTitleCandidate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const cleaned = stripInternalLines(value.trim());
  if (!cleaned || isJunkTitle(cleaned)) return null;
  return cleaned;
}

export function getLeadDisplayTitle(
  lead: { summary?: string | null; issueType: string },
  consumerCase?: { title?: string | null } | null,
): string {
  const fromCase = sanitizeLeadTitleCandidate(consumerCase?.title);
  if (fromCase) return fromCase;

  if (lead.summary) {
    const fromSummary = parseFirmIntakeTitle(lead.summary);
    if (fromSummary) return fromSummary;

    const stripped = sanitizeLeadTitleCandidate(stripInternalLines(lead.summary));
    if (stripped) return stripped;
  }

  return `${lead.issueType} intake`;
}

export function buildMatterTitleFromLead(input: {
  issueType: string;
  consumerCaseTitle?: string | null;
  clientName?: string | null;
}): string {
  const subject =
    sanitizeLeadTitleCandidate(input.consumerCaseTitle) ?? `${input.issueType} intake`;
  const client = input.clientName?.trim() || 'New Client';
  return `${subject} — ${client}`;
}
