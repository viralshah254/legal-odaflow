import { Injectable, Logger, Optional } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { TavilySearchConnector } from '@/legal-sources/connectors/tavily-search.connector';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import {
  actFamiliesCompatible,
  isMalformedCitation,
  normalizeActFamily,
} from './act-family.util';

export type TripleCheckPass = 'corpus' | 'connector' | 'web';

export type AuthorityVerificationState = 'verified' | 'corrected' | 'unverified';

export interface ExtractedAuthorityRef {
  raw: string;
  kind: 'case' | 'statute_section' | 'quote' | 'other';
  actHint?: string;
  sectionHint?: string;
}

export interface PassHit {
  pass: TripleCheckPass;
  hit: boolean;
  evidence?: string;
  preferredText?: string;
}

export interface TripleCheckedAuthority {
  raw: string;
  kind: ExtractedAuthorityRef['kind'];
  state: AuthorityVerificationState;
  agreementCount: number;
  checks: Record<TripleCheckPass, boolean>;
  evidence: PassHit[];
  /** Replacement text when corrected. */
  correctedTo?: string;
}

export interface TripleCheckResult {
  authorities: TripleCheckedAuthority[];
  verifiedCount: number;
  correctedCount: number;
  unverifiedCount: number;
  /** Markdown appendix for Verification Notes. */
  appendixMarkdown: string;
  /** Apply corrections into the memo body. */
  repairedMarkdown: string;
}

const CASE_PATTERNS: RegExp[] = [
  /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.']+){0,4}\s+v\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.']+){0,4})\b/g,
  /\[\d{4}\]\s+(?:UKSC|UKHL|EWCA|EWHC|e?KLR|KE(?:SC|CA|HC))\s+\w+/gi,
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/gi,
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/gi,
];

const SECTION_PATTERNS: RegExp[] = [
  /\b((?:BNSS|BNS|BSA|IPC|CrPC|CPC|IBC|NI Act|Evidence Act|Contracts? Act|FIDIC)[^\n,]{0,40}?)\s*(?:s(?:ection)?\.?\s*|§\s*)(\d+[A-Za-z]?)/gi,
  /\b(Section|s\.|§)\s*(\d+[A-Za-z]?)\s+(?:of\s+)?([A-Z][A-Za-z0-9\s,'()-]{3,60}Act)/gi,
];

@Injectable()
export class AuthorityTripleCheckService {
  private readonly logger = new Logger(AuthorityTripleCheckService.name);

  constructor(
    @Optional() private readonly bareActLookup?: BareActLookupService,
    @Optional() private readonly tavily?: TavilySearchConnector,
  ) {}

  extract(markdown: string): ExtractedAuthorityRef[] {
    const found = new Map<string, ExtractedAuthorityRef>();

    for (const pattern of CASE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of markdown.matchAll(pattern)) {
        const raw = match[0].trim();
        if (raw.length < 5 || found.has(raw.toLowerCase())) continue;
        found.set(raw.toLowerCase(), { raw, kind: 'case' });
      }
    }

    for (const pattern of SECTION_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of markdown.matchAll(pattern)) {
        const raw = match[0].trim();
        if (found.has(raw.toLowerCase())) continue;
        const sectionHint = match[2] ?? match[2];
        const actHint = match[1] || match[3];
        found.set(raw.toLowerCase(), {
          raw,
          kind: 'statute_section',
          actHint: actHint?.trim(),
          sectionHint: sectionHint?.trim(),
        });
      }
    }

    return [...found.values()].slice(0, 40);
  }

  async check(input: {
    markdown: string;
    countryCode: string;
    query?: string;
    legalIssues?: string[];
    statuteSections?: string[];
    propositionPhrases?: string[];
    corpusAuthorities: Array<{
      title?: string | null;
      citation?: string | null;
      summary?: string | null;
      fullText?: string | null;
      sourceName?: string | null;
      sourceUrl?: string | null;
      sourceTier?: string | null;
    }>;
  }): Promise<TripleCheckResult> {
    const refs = this.extract(input.markdown);
    const authorities: TripleCheckedAuthority[] = [];
    const relevanceCtx = {
      query: input.query ?? '',
      countryCode: input.countryCode,
      legalIssues: input.legalIssues,
      statuteSections: input.statuteSections,
      propositionPhrases: input.propositionPhrases,
    };

    let webChecksUsed = 0;
    for (const ref of refs) {
      const evidence: PassHit[] = [];

      const corpusHit = this.matchCorpus(ref, input.corpusAuthorities);
      evidence.push(corpusHit);

      const connectorHit = await this.matchConnector(ref, input.countryCode, input.corpusAuthorities);
      evidence.push(connectorHit);

      const alreadyAgreed = corpusHit.hit && connectorHit.hit;
      const webHit =
        alreadyAgreed || webChecksUsed >= 6
          ? ({ pass: 'web' as const, hit: false } satisfies PassHit)
          : await this.matchWeb(ref, input.countryCode);
      if (!alreadyAgreed && webChecksUsed < 6) webChecksUsed += 1;
      evidence.push(webHit);

      const checks = {
        corpus: corpusHit.hit,
        connector: connectorHit.hit,
        web: webHit.hit,
      };
      const agreementCount = Object.values(checks).filter(Boolean).length;
      const preferred =
        (corpusHit.hit && corpusHit.preferredText) ||
        (connectorHit.hit && connectorHit.preferredText) ||
        (webHit.hit && webHit.preferredText) ||
        undefined;

      let state: AuthorityVerificationState = 'unverified';
      let correctedTo: string | undefined;
      if (agreementCount >= 2) {
        if (preferred && preferred !== ref.raw) {
          state = 'corrected';
          correctedTo = preferred;
        } else {
          state = 'verified';
        }
      } else if (corpusHit.hit && preferred && preferred !== ref.raw) {
        state = 'corrected';
        correctedTo = preferred;
      }

      // Proposition relevance: existence alone is not enough for cases.
      if (
        ref.kind === 'case' &&
        state !== 'unverified' &&
        !this.isRelevantCaseRef(ref, input.corpusAuthorities, relevanceCtx)
      ) {
        state = 'unverified';
        correctedTo = undefined;
      }

      // Reject cross-act or malformed citation corrections.
      if (
        correctedTo &&
        (isMalformedCitation(correctedTo) ||
          !this.correctionActFamilyOk(ref, correctedTo))
      ) {
        correctedTo = undefined;
        state = corpusHit.hit || connectorHit.hit || webHit.hit ? 'verified' : 'unverified';
        if (state === 'verified' && preferred === ref.raw) {
          state = 'verified';
        } else if (state === 'verified') {
          state = 'unverified';
        }
      }

      if (state === 'unverified' && ref.kind === 'case') {
        continue;
      }

      authorities.push({
        raw: ref.raw,
        kind: ref.kind,
        state,
        agreementCount,
        checks,
        evidence,
        correctedTo,
      });
    }

    let repairedMarkdown = input.markdown;
    for (const auth of authorities) {
      if (auth.state === 'corrected' && auth.correctedTo && auth.correctedTo !== auth.raw) {
        if (auth.raw.length < 12 && refNeedsActHint(auth.raw)) continue;
        repairedMarkdown = this.safeReplaceCitation(
          repairedMarkdown,
          auth.raw,
          auth.correctedTo,
        );
      }
    }

    const verifiedCount = authorities.filter((a) => a.state === 'verified').length;
    const correctedCount = authorities.filter((a) => a.state === 'corrected').length;
    const unverifiedCount = authorities.filter((a) => a.state === 'unverified').length;

    return {
      authorities,
      verifiedCount,
      correctedCount,
      unverifiedCount,
      appendixMarkdown: this.buildAppendix(authorities),
      repairedMarkdown,
    };
  }

  private matchCorpus(
    ref: ExtractedAuthorityRef,
    corpus: TripleCheckResult['authorities'] extends never ? never : Array<{
      title?: string | null;
      citation?: string | null;
      summary?: string | null;
      fullText?: string | null;
      sourceName?: string | null;
    }>,
  ): PassHit {
    const needle = ref.raw.toLowerCase();
    for (const auth of corpus) {
      const blob = [auth.title, auth.citation, auth.summary, auth.sourceName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!blob) continue;
      const sectionOk =
        !ref.sectionHint ||
        blob.includes(ref.sectionHint.toLowerCase()) ||
        (auth.fullText ?? '').toLowerCase().includes(`section ${ref.sectionHint}`.toLowerCase());
      const nameOk =
        ref.kind === 'statute_section'
          ? this.statuteRefMatchesCorpus(ref, needle, blob, sectionOk)
          : blob.includes(needle) || this.partyNameTokenHits(needle, blob) >= 2;
      const actFamilyOk =
        ref.kind !== 'statute_section' ||
        !ref.actHint ||
        actFamiliesCompatible(ref.actHint, auth.title ?? auth.citation ?? '');
      if (nameOk && sectionOk && actFamilyOk) {
        const preferred =
          auth.citation?.trim() ||
          auth.title?.trim() ||
          ref.raw;
        return {
          pass: 'corpus',
          hit: true,
          evidence: auth.title ?? auth.citation ?? 'corpus hit',
          preferredText: preferred,
        };
      }
    }
    return { pass: 'corpus', hit: false };
  }

  private async matchConnector(
    ref: ExtractedAuthorityRef,
    countryCode: string,
    corpus: Array<{
      title?: string | null;
      citation?: string | null;
      sourceTier?: string | null;
      sourceUrl?: string | null;
      fullText?: string | null;
    }>,
  ): Promise<PassHit> {
    // Live connector results already merged into corpusAuthorities often carry
    // case_law / web tiers or external URLs — treat those as connector hits.
    const needle = ref.raw.toLowerCase();
    for (const auth of corpus) {
      const tier = (auth.sourceTier ?? '').toLowerCase();
      const url = auth.sourceUrl ?? '';
      const isConnector =
        tier === 'case_law' ||
        tier === 'web' ||
        /indiankanoon|kenyalaw|courtlistener|ulii|bailii|legislation/i.test(url);
      if (!isConnector) continue;
      const blob = [auth.title, auth.citation].filter(Boolean).join(' ').toLowerCase();
      const sectionOk =
        !ref.sectionHint ||
        blob.includes(ref.sectionHint.toLowerCase()) ||
        (auth.fullText ?? '').toLowerCase().includes(`section ${ref.sectionHint}`.toLowerCase());
      const matches =
        ref.kind === 'statute_section'
          ? this.statuteRefMatchesCorpus(ref, needle, blob, sectionOk)
          : blob.includes(needle) || this.partyNameTokenHits(needle, blob) >= 2;
      if (matches) {
        return {
          pass: 'connector',
          hit: true,
          evidence: auth.sourceUrl ?? auth.citation ?? 'connector hit',
          preferredText: auth.citation ?? auth.title ?? ref.raw,
        };
      }
    }

    // Bare-act lookup for statute sections (IN/KE style).
    if (ref.kind === 'statute_section' && this.bareActLookup && ref.sectionHint) {
      try {
        const actId = this.inferActId(ref.actHint);
        if (actId) {
          const exact = await this.bareActLookup.lookupExactSection(
            actId,
            ref.sectionHint,
            countryCode,
          );
          if (exact.found) {
            return {
              pass: 'connector',
              hit: true,
              evidence: exact.authority?.citation ?? 'bare-act lookup',
              preferredText: exact.authority?.citation ?? ref.raw,
            };
          }
        }
        if (!actId) {
          const fuzzy = await this.bareActLookup.lookupSection(
            `${ref.actHint ?? ''} section ${ref.sectionHint}`.trim(),
            countryCode,
          );
          if (fuzzy.length > 0) {
            return {
              pass: 'connector',
              hit: true,
              evidence: fuzzy[0]?.citation ?? 'bare-act section lookup',
              preferredText: fuzzy[0]?.citation ?? ref.raw,
            };
          }
        }
      } catch (err) {
        this.logger.debug(
          `bare-act lookup skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { pass: 'connector', hit: false };
  }

  private inferActId(actHint?: string): string | undefined {
    if (!actHint) return undefined;
    const h = actHint.toLowerCase();
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

  private isRelevantCaseRef(
    ref: ExtractedAuthorityRef,
    corpus: Array<{
      title?: string | null;
      citation?: string | null;
      summary?: string | null;
      fullText?: string | null;
    }>,
    ctx: {
      query: string;
      countryCode: string;
      legalIssues?: string[];
      statuteSections?: string[];
      propositionPhrases?: string[];
    },
  ): boolean {
    const matched = corpus.find((auth) => {
      const blob = [auth.title, auth.citation].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(ref.raw.toLowerCase()) || this.partyNameTokenHits(ref.raw, blob) >= 2;
    });
    const candidate = {
      title: matched?.title ?? ref.raw,
      citation: matched?.citation ?? null,
      summary: matched?.summary ?? null,
      fullText: matched?.fullText ?? null,
      sourceTier: 'case_law' as const,
      authorityType: 'CASE' as const,
    };
    const blob = `${candidate.title} ${candidate.summary ?? ''} ${candidate.fullText ?? ''}`.toLowerCase();
    const privateTenancy =
      /\b(?:landlord|tenant|tenancy|lessee|lease)\b/i.test(ctx.query) &&
      !/\b(?:state|municipal|pavement|slum|article 21)\b/i.test(ctx.query);
    if (
      privateTenancy &&
      /\bolga tellis|article 21|pavement dweller|bombay municipal\b/i.test(blob)
    ) {
      return false;
    }
    const relevance = assessCandidateRelevance(candidate, ctx);
    return relevance.admitted;
  }

  private correctionActFamilyOk(ref: ExtractedAuthorityRef, correctedTo: string): boolean {
    if (ref.kind !== 'statute_section') return true;
    const refFamily = normalizeActFamily(ref.actHint);
    const correctedFamily = normalizeActFamily(correctedTo);
    if (!refFamily) return true;
    return actFamiliesCompatible(ref.actHint, correctedTo) && refFamily === correctedFamily;
  }

  private statuteRefMatchesCorpus(
    ref: ExtractedAuthorityRef,
    needle: string,
    blob: string,
    sectionOk: boolean,
  ): boolean {
    if (blob.includes(needle)) return sectionOk;
    const actNeedle = ref.actHint?.toLowerCase().trim();
    if (!actNeedle || !sectionOk) return false;
    const actRoot = actNeedle.replace(/\s+act$/i, '').trim();
    return (
      blob.includes(actNeedle) ||
      (!!actRoot && blob.includes(actRoot))
    );
  }

  private partyNameTokenHits(needle: string, blob: string): number {
    const stop = new Set(['ors', 'and', 'the', 'state', 'union', 'india']);
    const tokens = needle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w));
    return tokens.filter((w) => blob.includes(w)).length;
  }

  private safeReplaceCitation(markdown: string, raw: string, correctedTo: string): string {
    if (isMalformedCitation(correctedTo)) return markdown;
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return markdown.replace(new RegExp(`\\b${escaped}\\b`, 'g'), correctedTo);
  }

  private async matchWeb(ref: ExtractedAuthorityRef, countryCode: string): Promise<PassHit> {
    if (!this.tavily?.isConfigured()) {
      return { pass: 'web', hit: false };
    }
    try {
      const results = await this.tavily.search({
        query: `"${ref.raw}" ${ref.actHint ?? ''} ${ref.sectionHint ?? ''}`.trim(),
        countryCode,
        limit: 3,
      });
      if (results.length === 0) return { pass: 'web', hit: false };
      const top = results[0];
      const blob = `${top.title} ${top.summary ?? ''}`.toLowerCase();
      const needle = ref.raw.toLowerCase();
      const agrees =
        blob.includes(needle) ||
        needle.split(/\s+/).filter((w) => w.length > 3).some((w) => blob.includes(w));
      return {
        pass: 'web',
        hit: agrees,
        evidence: top.sourceUrl || top.title,
        preferredText: agrees ? ref.raw : undefined,
      };
    } catch (err) {
      this.logger.warn(`Tavily triple-check failed: ${err instanceof Error ? err.message : String(err)}`);
      return { pass: 'web', hit: false };
    }
  }

  private buildAppendix(authorities: TripleCheckedAuthority[]): string {
    if (authorities.length === 0) {
      return [
        '## Triple-check verification',
        '',
        'No case/act/section citations were extracted for multi-pass verification.',
      ].join('\n');
    }
    const lines = [
      '## Triple-check verification',
      '',
      'Each authority is checked against corpus, live connectors, and the internet. Verified requires ≥2 agreeing passes.',
      '',
    ];
    for (const auth of authorities) {
      const badges = [
        auth.checks.corpus ? 'Corpus' : null,
        auth.checks.connector ? 'Connector' : null,
        auth.checks.web ? 'Web' : null,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(
        `- **${auth.raw}** — ${auth.state.toUpperCase()} (${auth.agreementCount}/3${badges ? `: ${badges}` : ''})${
          auth.correctedTo ? ` → ${auth.correctedTo}` : ''
        }`,
      );
    }
    return lines.join('\n');
  }
}

function refNeedsActHint(raw: string): boolean {
  return /^(?:section|s\.|§)\s*\d+/i.test(raw.trim()) && raw.trim().length < 20;
}
