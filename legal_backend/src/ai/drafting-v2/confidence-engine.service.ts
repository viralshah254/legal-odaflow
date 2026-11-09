/**
 * Stage 9 / Confidence Engine
 *
 * Computes per-paragraph `ConfidenceScore` and builds `EvidenceChain` for each
 * paragraph in a section. Uses `SentenceAuditService` for grounding detection
 * and cross-references retrieved authorities.
 *
 * Threshold policy (configurable via env):
 *   - DRAFT_V2_CONFIDENCE_THRESHOLD (default: 60)
 *   - Sections below threshold trigger auto-repair by `TargetedRepairService`
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentenceAuditService } from '@/legal-search/sentence-audit.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  SectionPlan,
  SectionType,
  ConfidenceScore,
  EvidenceChain,
  EvidenceItem,
} from './drafting-v2.types';

const DEFAULT_CONFIDENCE_THRESHOLD = 60;

function gradeFromScore(score: number): ConfidenceScore['grade'] {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 35) return 'low';
  return 'unverified';
}

/** Extract paragraph-level text blocks from markdown content. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30); // skip very short lines
}

/** Detect if a paragraph contains a case-law citation pattern. */
const CASE_CITATION_RE = /[A-Z][a-z]+ v\.?\s+[A-Z][a-z]+|AIR\s+\d{4}|SCC\s+\d{4}|\d{4}\s+\(\d+\)\s+SCC|\(\d{4}\)\s+\d+\s+SCC|Cr\.?L\.?J|BNSS\s*§|BNSS\s*s\./i;
const STATUTE_RE = /§\s*\d+|section\s+\d+|art\.\s*\d+|article\s+\d+/i;

@Injectable()
export class ConfidenceEngineService {
  private readonly threshold: number;

  constructor(
    private readonly sentenceAudit: SentenceAuditService,
    private readonly config: ConfigService,
  ) {
    this.threshold = Number(
      this.config.get<string>('DRAFT_V2_CONFIDENCE_THRESHOLD', String(DEFAULT_CONFIDENCE_THRESHOLD)),
    );
  }

  /** Threshold below which auto-repair is triggered. */
  get confidenceThreshold(): number {
    return this.threshold;
  }

  /**
   * Compute confidence for the content of a single section.
   * Returns the overall ConfidenceScore and per-paragraph EvidenceChains.
   */
  computeSectionConfidence(
    content: string,
    authorities: RetrievedAuthority[],
    section: SectionPlan,
  ): { confidence: ConfidenceScore; evidenceChains: EvidenceChain[] } {
    // Boilerplate sections always get maximum confidence
    if (section.boilerplateContent || section.type === 'verification' || section.type === 'heading' || section.type === 'parties') {
      return {
        confidence: this.perfectConfidence(),
        evidenceChains: [],
      };
    }

    const auditAuthorities = authorities.map((a) => ({
      id: a.id,
      title: a.title ?? a.id,
      citation: a.citation,
      fullText: a.fullText ?? null,
      summary: a.summary ?? null,
    }));

    const sentenceAuditResult = this.sentenceAudit.audit({
      outputMarkdown: content,
      authorities: auditAuthorities,
    });

    const paragraphs = splitParagraphs(content);
    const evidenceChains: EvidenceChain[] = paragraphs.map((paragraphText, idx) => {
      const statutes = this.extractStatuteItems(paragraphText, authorities);
      const caseLaw = this.extractCaseLawItems(paragraphText, authorities);
      const missingEvidence = section.requiredEvidence.filter(
        (ev) => !content.toLowerCase().includes(ev.toLowerCase().split(' ')[0]),
      );

      return {
        paragraphIndex: idx,
        paragraphText,
        statutes,
        caseLaw,
        clientEvidence: [],
        missingEvidence,
        whyIncluded: this.inferWhyIncluded(section.type, paragraphText),
        whichRule: this.extractRuleRef(paragraphText),
      };
    });

    // Compute signals
    const signals: string[] = [];
    if (sentenceAuditResult.coverageRate >= 0.7) {
      signals.push('High sentence-level grounding');
    } else if (sentenceAuditResult.coverageRate < 0.3 && section.type === 'grounds') {
      signals.push('Low grounding for grounds section');
    }

    const hasCitations = CASE_CITATION_RE.test(content);
    if (!hasCitations && ['grounds', 'arguments', 'law'].includes(section.type)) {
      signals.push('No case-law citations detected');
    }

    const hasStatutes = STATUTE_RE.test(content);
    if (!hasStatutes && ['grounds', 'maintainability', 'law'].includes(section.type)) {
      signals.push('No statute sections detected');
    }

    const contradictions = sentenceAuditResult.entries.filter(
      (e) => e.status === 'contradicted',
    ).length;
    if (contradictions > 0) {
      signals.push(`${contradictions} contradicted sentence(s)`);
    }

    // Score calculation
    let score = 50; // Base score

    // Coverage rate contribution (max 35 points)
    score += Math.round(sentenceAuditResult.coverageRate * 35);

    // Citation bonus/penalty (max 15 points)
    if (hasCitations) score += 10;
    if (hasStatutes) score += 5;

    // Penalties
    score -= contradictions * 10;
    score -= Math.min(sentenceAuditResult.ungroundedCount * 3, 20);

    // Boilerplate sections shouldn't be penalized for no citations
    if (['prayer', 'annexures', 'verification'].includes(section.type)) {
      score = Math.max(score, 75);
    }

    if (authorities.length === 0) {
      score = Math.min(score, 34);
      signals.push('No retrieved authorities — legal propositions remain unverified');
    }
    score = Math.min(100, Math.max(0, score));

    return {
      confidence: {
        score,
        grade: gradeFromScore(score),
        citationVerified: false, // Pattern detection and lexical overlap do not verify citations.
        groundedSentenceRate: sentenceAuditResult.coverageRate,
        ungroundedCount: sentenceAuditResult.ungroundedCount,
        contradictions,
        signals,
      },
      evidenceChains,
    };
  }

  /** Whether this section should trigger a repair. */
  needsRepair(confidence: ConfidenceScore, section: SectionPlan): boolean {
    // Only trigger repair on content-heavy sections
    if (['heading', 'parties', 'verification', 'annexures', 'boilerplate'].includes(section.type)) {
      return false;
    }
    return confidence.score < this.threshold;
  }

  private perfectConfidence(): ConfidenceScore {
    return {
      score: 0,
      grade: 'unverified',
      citationVerified: false,
      groundedSentenceRate: 0,
      ungroundedCount: 0,
      contradictions: 0,
      signals: ['Structural section — substantive accuracy has not been verified'],
    };
  }

  private extractStatuteItems(
    text: string,
    authorities: RetrievedAuthority[],
  ): EvidenceItem[] {
    const items: EvidenceItem[] = [];
    const matches = text.match(/(?:Section|§)\s*(\d+[A-Z]?(?:\(\d+\))?)\s+(?:of\s+)?([A-Za-z\s]+Act[^,\n]*)/gi) ?? [];
    for (const match of matches.slice(0, 5)) {
      const auth = authorities.find(
        (a) => a.authorityType === 'statute' && (a.title ?? '').toLowerCase().includes(match.toLowerCase().slice(0, 20)),
      );
      items.push({
        type: 'statute',
        ref: match.trim(),
        source: auth?.sourceName,
        verified: !!auth,
        confidence: auth ? 90 : 50,
      });
    }
    return items;
  }

  private extractCaseLawItems(
    text: string,
    authorities: RetrievedAuthority[],
  ): EvidenceItem[] {
    const items: EvidenceItem[] = [];
    const matches = text.match(/[A-Z][a-z]+ v\.?\s+[A-Z][a-z]+[^,\n]*/g) ?? [];
    for (const match of matches.slice(0, 5)) {
      const auth = authorities.find(
        (a) => (a.title ?? '').toLowerCase().includes(match.toLowerCase().split(' v')[0].toLowerCase()),
      );
      items.push({
        type: 'case_law',
        ref: match.trim(),
        source: auth?.sourceName,
        jurisdiction: auth?.citation ?? undefined,
        verified: !!auth,
        confidence: auth ? 85 : 45,
        excerpt: auth?.summary?.slice(0, 100),
      });
    }
    return items;
  }

  private inferWhyIncluded(type: SectionPlan['type'], _text: string): string {
    const reasons: Partial<Record<SectionPlan['type'], string>> = {
      facts: 'Establishes the material facts required for the legal grounds',
      grounds: 'States the legal basis for the relief sought',
      arguments: 'Develops the legal argument with authority and factual application',
      prayer: 'Specifies the relief the court is asked to grant',
      maintainability: 'Establishes court jurisdiction and procedural competence',
      law: 'Sets out the statutory framework governing the dispute',
    };
    return reasons[type] ?? 'Required section of the document';
  }

  private extractRuleRef(text: string): string | undefined {
    const match = text.match(/(?:Rule|Order|Section)\s+\d+[A-Z]?\s+(?:of\s+)?[A-Z][A-Za-z\s]+(?:Rules|Code|Act)/);
    return match?.[0];
  }
}

