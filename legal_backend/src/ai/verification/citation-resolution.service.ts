import { Injectable } from '@nestjs/common';
import type { LegalEvidencePack } from '@/ai/legal-research/legal-evidence-pack.service';
import { AuthorityIdentityService } from './authority-identity.service';

export interface ResolvedCitationSpan {
  text: string;
  start: number;
  end: number;
  authorityId?: string;
  evidenceIds: string[];
  resolved: boolean;
}

const INDIA_REPORTER_PATTERN =
  /\b(?:AIR\s+\d{4}\s+SC\s+\d+|\(\d{4}\)\s+\d+\s+SCC\s+\d+|\d{4}\s+SCC\s+OnLine\s+(?:SC|[A-Z][A-Za-z& ]+)\s+\d+)\b/g;

const STATUTE_PATTERN =
  /\b(?:Section|S\.|s\.)\s*\d+[A-Za-z-]*(?:\s+of\s+the\s+[A-Z][A-Za-z\s,.-]+(?:Act|Code|Sanhita|Constitution))?/g;

const COMPACT_STATUTE_PATTERN =
  /\b(?:BNS|BNSS|IPC|CrPC|NI\s+Act|NDPS|POCSO|PMLA)\s*(?:Act)?\s*(?:§|s\.?|sec(?:tion)?\.?)?\s*\d+[A-Za-z]?\b/gi;

const ACT_ALIASES: Record<string, string> = {
  bns: 'bns',
  bnss: 'bnss',
  ipc: 'ipc',
  crpc: 'crpc',
  'ni act': 'ni_act',
  ndps: 'ndps',
  pocso: 'pocso',
  pmla: 'pmla',
};

@Injectable()
export class CitationResolutionService {
  constructor(private readonly authorityIdentity: AuthorityIdentityService) {}

  resolveText(markdown: string, pack: LegalEvidencePack): ResolvedCitationSpan[] {
    const spans = [
      ...this.detect(markdown, INDIA_REPORTER_PATTERN),
      ...this.detect(markdown, STATUTE_PATTERN),
      ...this.detect(markdown, COMPACT_STATUTE_PATTERN),
    ];
    const seen = new Set<string>();
    return spans
      .filter((span) => {
        const key = `${span.start}:${span.end}:${span.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((span) => this.resolveSpan(span, pack));
  }

  private detect(markdown: string, pattern: RegExp): Array<Omit<ResolvedCitationSpan, 'evidenceIds' | 'resolved'>> {
    const matches: Array<Omit<ResolvedCitationSpan, 'evidenceIds' | 'resolved'>> = [];
    for (const match of markdown.matchAll(pattern)) {
      matches.push({
        text: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
    return matches;
  }

  private resolveSpan(
    span: Omit<ResolvedCitationSpan, 'evidenceIds' | 'resolved'>,
    pack: LegalEvidencePack,
  ): ResolvedCitationSpan {
    const caseMatch = pack.authorities.find((authority) =>
      this.sameCitation(authority.citation, span.text) || this.sameCitation(authority.title, span.text),
    );
    if (caseMatch) {
      return {
        ...span,
        authorityId: caseMatch.authorityId,
        evidenceIds: [caseMatch.evidenceId, ...caseMatch.passages.map((p) => p.evidenceId)],
        resolved: true,
      };
    }

    const compact = this.parseCompactStatute(span.text);
    const statuteMatch = pack.statutes.find((statute) => {
      if (
        compact &&
        statute.actId.toLowerCase() === compact.actId &&
        statute.section.toLowerCase() === compact.section.toLowerCase()
      ) {
        return true;
      }
      const haystack = `${statute.heading ?? ''} ${statute.actId} ${statute.section}`;
      return this.sameCitation(haystack, span.text);
    });
    if (statuteMatch) {
      return {
        ...span,
        authorityId: statuteMatch.actId,
        evidenceIds: [statuteMatch.evidenceId],
        resolved: true,
      };
    }

    const fallback = this.authorityIdentity.resolveFromPack({ citation: span.text }, pack);
    return {
      ...span,
      authorityId: fallback.state === 'PASS' ? fallback.authorityId : undefined,
      evidenceIds: fallback.evidenceIds,
      resolved: fallback.state === 'PASS',
    };
  }

  private sameCitation(a: string | undefined, b: string): boolean {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const left = normalize(a ?? '');
    const right = normalize(b);
    return !!left && !!right && (left.includes(right) || right.includes(left));
  }

  private parseCompactStatute(text: string): { actId: string; section: string } | null {
    const match = text.match(/\b(BNS|BNSS|IPC|CrPC|NI\s+Act|NDPS|POCSO|PMLA)\s*(?:Act)?\s*(?:§|s\.?|sec(?:tion)?\.?)?\s*(\d+[A-Za-z]?)\b/i);
    if (!match) return null;
    const actId = ACT_ALIASES[match[1].replace(/\s+/g, ' ').toLowerCase()];
    if (!actId) return null;
    return { actId, section: match[2].toUpperCase() };
  }
}
