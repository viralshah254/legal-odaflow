import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthorityReference, LegalProposition } from './research.types';

// Patterns for common citation formats
const CITATION_PATTERNS = [
  /\(\d{4}\)\s+\d+\s+\w+\s+\d+/g,             // (2024) 1 SCR 100
  /\[\d{4}\]\s+\w+\s+\d+/g,                    // [2024] SC 100
  /\d{4}\s+SCC\s+\(\w+\)\s+\d+/g,             // 2024 SCC (Civ) 100
  /AIR\s+\d{4}\s+\w+\s+\d+/g,                 // AIR 2024 SC 100
  /\d+\s+U\.S\.\s+\d+/g,                       // 410 U.S. 113
  /\d+\s+F\.\d+d?\s+\d+/g,                     // 347 F.3d 200
];

@Injectable()
export class CitationBindingService {
  /** Bind a single paragraph (audit reproduction / tests). */
  bindParagraphPropositions(
    paragraph: string,
    authorities: AuthorityReference[],
  ): LegalProposition[] {
    const foundCitations = this.extractCitations(paragraph);
    const matchedAuthorities = this.matchAuthorities(foundCitations, paragraph, authorities);
    const supportStatus = this.determineSupportStatus(matchedAuthorities, paragraph);
    return [
      {
        id: uuidv4(),
        text: paragraph,
        authorityIds: matchedAuthorities.map((a) => a.id),
        factIds: [],
        confidence:
          supportStatus === 'verified'
            ? 0.9
            : supportStatus === 'partially_supported'
              ? 0.6
              : 0.3,
        supportStatus,
      },
    ];
  }

  bindCitations(text: string, authorities: AuthorityReference[]): LegalProposition[] {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs.map((paragraph) => {
      const foundCitations = this.extractCitations(paragraph);
      const matchedAuthorities = this.matchAuthorities(foundCitations, paragraph, authorities);
      const supportStatus = this.determineSupportStatus(matchedAuthorities, paragraph);

      return {
        id: uuidv4(),
        text: paragraph,
        authorityIds: matchedAuthorities.map((a) => a.id),
        factIds: [],
        confidence: supportStatus === 'verified' ? 0.9 : supportStatus === 'partially_supported' ? 0.6 : 0.3,
        supportStatus,
      } satisfies LegalProposition;
    });
  }

  validateCitation(citation: string, authorityId: string): boolean {
    if (!citation || !authorityId) return false;
    return CITATION_PATTERNS.some((pattern) => {
      const fresh = new RegExp(pattern.source, pattern.flags);
      return fresh.test(citation);
    });
  }

  private extractCitations(text: string): string[] {
    const found: string[] = [];
    for (const pattern of CITATION_PATTERNS) {
      const fresh = new RegExp(pattern.source, pattern.flags);
      const matches = text.match(fresh);
      if (matches) found.push(...matches);
    }
    return [...new Set(found)];
  }

  private matchAuthorities(
    citations: string[],
    paragraph: string,
    authorities: AuthorityReference[],
  ): AuthorityReference[] {
    const matched = new Set<AuthorityReference>();

    for (const auth of authorities) {
      if (auth.citation && citations.some((c) => this.citationMatches(c, auth.citation!))) {
        matched.add(auth);
        continue;
      }
      if (auth.title && paragraph.toLowerCase().includes(auth.title.toLowerCase())) {
        matched.add(auth);
      }
    }

    return Array.from(matched);
  }

  private citationMatches(extracted: string, authoritycitation: string): boolean {
    const normalise = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    return normalise(extracted) === normalise(authoritycitation);
  }

  private determineSupportStatus(
    matched: AuthorityReference[],
    _paragraph: string,
  ): LegalProposition['supportStatus'] {
    if (matched.length === 0) return 'unsupported';

    const hasOverruled = matched.some(
      (a) => a.treatmentStatus === 'overruled' || a.treatmentStatus === 'repealed',
    );
    const hasGoodLaw = matched.some((a) => a.treatmentStatus === 'good_law');

    if (hasOverruled && hasGoodLaw) return 'conflicted';
    if (hasOverruled) return 'unsupported';
    // Citation co-occurrence is extraction only — legal support requires admission elsewhere.
    if (matched.length >= 1) return 'partially_supported';
    return 'unsupported';
  }
}
