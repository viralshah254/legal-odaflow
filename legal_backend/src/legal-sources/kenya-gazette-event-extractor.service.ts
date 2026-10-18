import { Injectable } from '@nestjs/common';
import { GazetteLegalEventType } from '@prisma/client';

export interface ExtractedGazetteLegalEvent {
  eventType: GazetteLegalEventType;
  affectedWorkUris: string[];
  effectiveDate?: Date;
  extractedText: string;
  extractionConfidence: number;
  requiresHumanReview: boolean;
  signals: string[];
}

const EVENT_SIGNALS: ReadonlyArray<{
  type: GazetteLegalEventType;
  patterns: RegExp[];
}> = [
  {
    type: 'COMMENCEMENT',
    patterns: [/\bcome(?:s)? into operation\b/i, /\bcommencement\b/i, /\bappoints? .* as the date\b/i],
  },
  {
    type: 'REVOCATION',
    patterns: [/\bis revoked\b/i, /\brevocation\b/i, /\brevoke[sd]?\b/i],
  },
  {
    type: 'AMENDMENT',
    patterns: [/\bis amended\b/i, /\bamendment\b/i, /\bdelete(?:d|s|ing)? and substitute\b/i],
  },
  {
    type: 'REGULATION',
    patterns: [/\bregulations?\b/i, /\brules?\b/i, /\bin exercise of the powers conferred\b/i],
  },
  {
    type: 'PRACTICE_DIRECTION',
    patterns: [/\bpractice directions?\b/i, /\bchief justice directs\b/i],
  },
  {
    type: 'CORRIGENDUM',
    patterns: [/\bcorrigendum\b/i, /\bcorrection notice\b/i],
  },
  {
    type: 'APPOINTMENT',
    patterns: [/\bis appointed\b/i, /\bappointment\b/i, /\bappoints?\b/i],
  },
];

@Injectable()
export class KenyaGazetteEventExtractorService {
  extract(input: {
    text: string;
    sourceConfidence: number;
  }): ExtractedGazetteLegalEvent[] {
    const text = normalize(input.text);
    if (!text) return [];

    const matches = EVENT_SIGNALS.map((candidate) => ({
      ...candidate,
      matched: candidate.patterns.filter((pattern) => pattern.test(text)),
    })).filter((candidate) => candidate.matched.length > 0);
    const selected = matches[0];
    const eventType = selected?.type ?? GazetteLegalEventType.OTHER;
    const signals = (selected?.matched ?? []).map((pattern) => pattern.source);
    const affectedWorkUris = extractWorkUris(text);
    const effectiveDate = extractEffectiveDate(text);

    let confidence = clamp(input.sourceConfidence);
    if (eventType === GazetteLegalEventType.OTHER) confidence -= 0.25;
    if (signals.length > 1) confidence += 0.08;
    if (affectedWorkUris.length > 0) confidence += 0.08;
    if (eventType === GazetteLegalEventType.COMMENCEMENT && !effectiveDate) confidence -= 0.2;
    confidence = clamp(confidence);

    return [
      {
        eventType,
        affectedWorkUris,
        effectiveDate,
        extractedText: text,
        extractionConfidence: confidence,
        requiresHumanReview:
          confidence < 0.9 ||
          eventType === GazetteLegalEventType.OTHER ||
          affectedWorkUris.length === 0,
        signals,
      },
    ];
  }
}

function extractWorkUris(text: string): string[] {
  const explicit = text.match(/\bakn\/ke\/act\/[a-z0-9@/_-]+/gi) ?? [];
  return [...new Set(explicit.map((uri) => uri.replace(/[.,;:)]+$/, '')))];
}

function extractEffectiveDate(text: string): Date | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return validDate(`${iso[1]}T00:00:00.000Z`);

  const written = text.match(
    /\b(?:on|from|with effect from|commencing on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/i,
  );
  if (!written) return undefined;
  return validDate(`${written[1]} ${written[2]} ${written[3]} UTC`);
}

function validDate(value: string): Date | undefined {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
