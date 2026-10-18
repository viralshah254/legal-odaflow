import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import type { LegalEvidencePack } from '@/ai/legal-research/legal-evidence-pack.service';
import type { CheckState, VerificationFinding } from './verification-finding.types';

export interface AuthorityIdentityResolution {
  authorityId: string;
  evidenceIds: string[];
  state: CheckState;
  explanation: string;
  aliases: string[];
}

export interface AuthorityLike {
  id?: string | null;
  title?: string | null;
  citation?: string | null;
  sourceName?: string | null;
}

export const AUTHORITY_IDENTITY_SEMANTIC_MATCHER = Symbol('AUTHORITY_IDENTITY_SEMANTIC_MATCHER');

export interface AuthorityIdentitySemanticMatch {
  authorityId: string;
  confidence: number;
}

/**
 * Optional adapter for a locally available semantic index. It may only select
 * a record already present in the locked evidence pack.
 */
export interface AuthorityIdentitySemanticMatcher {
  match(
    authority: AuthorityLike,
    candidates: ReadonlyArray<{ authorityId: string; aliases: string[] }>,
  ): AuthorityIdentitySemanticMatch | undefined;
}

@Injectable()
export class AuthorityIdentityService {
  constructor(
    @Optional()
    @Inject(AUTHORITY_IDENTITY_SEMANTIC_MATCHER)
    private readonly semanticMatcher?: AuthorityIdentitySemanticMatcher,
  ) {}

  resolveFromPack(
    authority: AuthorityLike,
    pack: LegalEvidencePack,
  ): AuthorityIdentityResolution {
    const candidates = this.indexPack(pack);
    const normalizedTitle = this.normalizeTitle(authority.title ?? '');
    const normalizedCitation = this.normalizeCitation(authority.citation ?? '');
    const matches = candidates.filter((candidate) => {
      if (authority.id && candidate.authorityId === authority.id) return true;
      if (
        normalizedCitation &&
        candidate.citations.some((citation) => citation === normalizedCitation)
      ) {
        return true;
      }
      if (!normalizedTitle) return false;
      return candidate.titles.some((title) => this.titleSimilarity(normalizedTitle, title) >= 0.82);
    });

    if (matches.length === 1) {
      return {
        ...matches[0],
        state: 'PASS',
        explanation: 'Authority identity confirmed against evidence pack metadata.',
      };
    }

    if (matches.length > 1) {
      return {
        authorityId: authority.id ?? this.stableAuthorityId(authority),
        evidenceIds: matches.flatMap((m) => m.evidenceIds),
        state: 'INDETERMINATE',
        explanation: 'Authority matched multiple evidence-pack records; review identity before relying.',
        aliases: matches.flatMap((m) => m.aliases),
      };
    }

    const semantic = this.semanticMatcher?.match(
      authority,
      candidates.map(({ authorityId, aliases }) => ({ authorityId, aliases })),
    );
    const semanticCandidate = semantic
      ? candidates.find((candidate) => candidate.authorityId === semantic.authorityId)
      : undefined;
    // High threshold is deliberate: a semantic suggestion cannot confirm an
    // authority outside the pack or turn a merely similar case name into PASS.
    if (semanticCandidate && semantic && semantic.confidence >= 0.9) {
      return {
        ...semanticCandidate,
        state: 'PASS',
        explanation: 'Authority identity confirmed by a high-confidence semantic match within the locked evidence pack.',
      };
    }
    if (semanticCandidate && semantic && semantic.confidence >= 0.72) {
      return {
        ...semanticCandidate,
        state: 'INDETERMINATE',
        explanation: 'Authority has a possible semantic match in the evidence pack, but confidence is insufficient for confirmation.',
      };
    }

    return {
      authorityId: authority.id ?? this.stableAuthorityId(authority),
      evidenceIds: [],
      state: 'FAIL',
      explanation: 'Authority could not be matched to a source in the locked evidence pack.',
      aliases: [authority.title, authority.citation].filter(Boolean) as string[],
    };
  }

  findingForResolution(
    resolution: AuthorityIdentityResolution,
    propositionId?: string,
  ): VerificationFinding {
    return {
      checkId: `identity:${resolution.authorityId}:${propositionId ?? 'authority'}`,
      state: resolution.state,
      severity: resolution.state === 'PASS' ? 'LOW' : resolution.state === 'FAIL' ? 'BLOCKER' : 'HIGH',
      dimension: 'identity',
      propositionId,
      authorityId: resolution.authorityId,
      evidenceIds: resolution.evidenceIds,
      explanation: resolution.explanation,
      repairAction: resolution.state === 'PASS' ? undefined : 'RETRIEVE',
      verifierVersion: 'authority-identity-v1',
    };
  }

  stableAuthorityId(authority: AuthorityLike): string {
    const raw = [authority.title, authority.citation, authority.sourceName].filter(Boolean).join('|');
    return `auth_${createHash('sha256').update(raw || 'unknown').digest('hex').slice(0, 16)}`;
  }

  private indexPack(pack: LegalEvidencePack): IndexedAuthority[] {
    const statutes = pack.statutes.map((s) => ({
      authorityId: s.actId,
      evidenceIds: [s.evidenceId],
      state: 'PASS' as CheckState,
      explanation: '',
      aliases: [s.actId, s.heading, s.section].filter((v): v is string => Boolean(v)).map((v) => this.normalize(v)),
      titles: [s.actId, s.heading].filter((v): v is string => Boolean(v)).map((v) => this.normalizeTitle(v)),
      citations: [`${s.actId} s ${s.section}`, `${s.actId} section ${s.section}`].map((v) => this.normalizeCitation(v)),
    }));
    const cases = pack.authorities.map((c) => ({
      authorityId: c.authorityId,
      evidenceIds: [c.evidenceId, ...c.passages.map((p) => p.evidenceId)],
      state: 'PASS' as CheckState,
      explanation: '',
      aliases: [c.title, c.citation].filter((v): v is string => Boolean(v)).map((v) => this.normalize(v)),
      titles: [c.title].filter((v): v is string => Boolean(v)).map((v) => this.normalizeTitle(v)),
      citations: [c.citation].filter((v): v is string => Boolean(v)).map((v) => this.normalizeCitation(v)),
    }));
    const materials = pack.officialMaterials.map((m) => ({
      authorityId: this.stableAuthorityId({ title: m.title, sourceName: m.sourceName }),
      evidenceIds: [m.evidenceId],
      state: 'PASS' as CheckState,
      explanation: '',
      aliases: [m.title, m.sourceName].filter((v): v is string => Boolean(v)).map((v) => this.normalize(v)),
      titles: [m.title].filter((v): v is string => Boolean(v)).map((v) => this.normalizeTitle(v)),
      citations: [],
    }));
    return [...statutes, ...cases, ...materials];
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private normalizeTitle(value: string): string {
    return this.normalize(value)
      .replace(/\b(?:versus|vs?|and another|and others|ors?|anr)\b/g, ' ')
      .replace(/\b(?:hon ble|the|state of|union of)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeCitation(value: string): string {
    return this.normalize(value)
      .replace(/\b(?:reported in|citation|at)\b/g, ' ')
      .replace(/\bsection\b/g, 's')
      .replace(/\s+/g, '');
  }

  private titleSimilarity(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;
    const leftTokens = new Set(left.split(' ').filter((token) => token.length > 1));
    const rightTokens = new Set(right.split(' ').filter((token) => token.length > 1));
    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    return (2 * intersection) / (leftTokens.size + rightTokens.size);
  }
}

interface IndexedAuthority extends AuthorityIdentityResolution {
  titles: string[];
  citations: string[];
}
