import { Injectable } from '@nestjs/common';

export interface SentenceAuditEntry {
  sentence: string;
  status: 'grounded' | 'ungrounded' | 'citation_only' | 'contradicted';
  authorityId?: string;
  authorityTitle?: string;
  matchedSpan?: string;
}

export interface SentenceAuditResult {
  coverageRate: number;
  entries: SentenceAuditEntry[];
  ungroundedCount: number;
}

@Injectable()
export class SentenceAuditService {
  audit(params: {
    outputMarkdown: string;
    authorities: Array<{
      id: string;
      title: string;
      citation: string | null;
      fullText?: string | null;
      summary?: string | null;
    }>;
  }): SentenceAuditResult {
    const sentences = splitSentences(params.outputMarkdown);
    const corpus = params.authorities.map((a) => ({
      id: a.id,
      title: a.title,
      text: [a.fullText, a.summary, a.citation, a.title].filter(Boolean).join(' ').toLowerCase(),
    }));

    const entries: SentenceAuditEntry[] = [];
    for (const sentence of sentences) {
      if (isBoilerplate(sentence)) continue;

      const normalized = sentence.toLowerCase();
      let bestMatch: { id: string; title: string; span?: string } | undefined;
      let bestScore = 0;

      for (const auth of corpus) {
        const score = overlapScore(normalized, auth.text);
        if (score > bestScore && score >= 0.25) {
          bestScore = score;
          bestMatch = { id: auth.id, title: auth.title };
        }
      }

      const hasCitationPattern = /\b(section|article|s\.|bnss|bns|crpc|ipc|air|scc)\b/i.test(sentence);

      // Negation/contradiction detection: if the sentence denies a section exists
      // but the authority corpus contains act/section tokens matching that sentence,
      // the sentence contradicts the corpus — mark as contradicted (counts as ungrounded).
      if (bestMatch && isExistenceDenial(sentence)) {
        entries.push({
          sentence,
          status: 'contradicted',
          authorityId: bestMatch.id,
          authorityTitle: bestMatch.title,
        });
        continue;
      }

      if (bestMatch) {
        // For existence claims, require the authority citation to contain the exact
        // section number cited in the sentence, not just token overlap.
        if (hasCitationPattern) {
          const sectionToken = extractSectionToken(sentence);
          if (sectionToken) {
            const citingAuthority = params.authorities.find((a) => a.id === bestMatch!.id);
            const authCitationBlob = [citingAuthority?.citation, citingAuthority?.title]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            const sectionPresent = authCitationBlob.includes(sectionToken.toLowerCase());
            entries.push({
              sentence,
              status: sectionPresent ? 'grounded' : 'citation_only',
              authorityId: bestMatch.id,
              authorityTitle: bestMatch.title,
            });
            continue;
          }
        }
        entries.push({
          sentence,
          status: 'grounded',
          authorityId: bestMatch.id,
          authorityTitle: bestMatch.title,
        });
      } else if (hasCitationPattern) {
        entries.push({ sentence, status: 'citation_only' });
      } else if (isSubstantiveClaim(sentence)) {
        entries.push({ sentence, status: 'ungrounded' });
      }
    }

    const substantive = entries.filter((e) => e.status !== 'citation_only' || isSubstantiveClaim(e.sentence));
    const grounded = entries.filter((e) => e.status === 'grounded').length;
    const ungroundedCount = entries.filter(
      (e) => e.status === 'ungrounded' || e.status === 'contradicted',
    ).length;
    const coverageRate = substantive.length > 0 ? grounded / substantive.length : 1;

    return { coverageRate, entries, ungroundedCount };
  }
}

function splitSentences(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function isBoilerplate(sentence: string): boolean {
  return (
    /^#{1,6}\s/.test(sentence) ||
    /^>\s/.test(sentence) ||
    /^[-*]\s/.test(sentence) ||
    /disclaimer|not legal advice|consult a lawyer/i.test(sentence)
  );
}

function isSubstantiveClaim(sentence: string): boolean {
  return /\b(shall|must|may|court|magistrate|bail|punishment|procedure|forum|filed|complaint)\b/i.test(
    sentence,
  );
}

const NEGATION_PATTERNS = [
  /does not exist/i,
  /no such section/i,
  /not found in(?: the)? act/i,
  /doesn['']?t exist/i,
  /is not (?:a )?(?:section|provision) (?:in|of)/i,
  /section.*?does not appear/i,
  /no provision.*?for/i,
];

function isExistenceDenial(sentence: string): boolean {
  return NEGATION_PATTERNS.some((p) => p.test(sentence));
}

/** Extracts the first explicit section/article number token from a sentence, e.g. "s.101" → "101". */
function extractSectionToken(sentence: string): string | undefined {
  const m = sentence.match(/\b(?:section|s\.|art(?:icle)?\.?)\s*(\d+[A-Za-z]?)\b/i);
  return m ? m[1] : undefined;
}

function overlapScore(sentence: string, corpus: string): number {
  const tokens = sentence
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const token of tokens) {
    if (corpus.includes(token)) hits += 1;
  }
  return hits / tokens.length;
}
