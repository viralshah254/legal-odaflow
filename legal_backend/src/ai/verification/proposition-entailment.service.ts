import { Inject, Injectable, Optional } from '@nestjs/common';
import type { PassageSupport } from '@/ai/legal-research/legal-research-draft.types';

export const PROPOSITION_SEMANTIC_SCORER = Symbol('PROPOSITION_SEMANTIC_SCORER');

/**
 * Dependency-safe adapter for a pre-computed embedding or local NLI scorer.
 * Implementations must be synchronous: network LLM calls belong in the async
 * verification pipeline, not this deterministic claim gate.
 */
export interface PropositionSemanticScorer {
  score(claimText: string, passageText: string): number | undefined;
}

/**
 * Entailment judge with an optional semantic scorer and a deterministic fallback.
 * Fail-closed: semantic similarity alone cannot override an explicit contradiction.
 */
@Injectable()
export class PropositionEntailmentService {
  constructor(
    @Optional()
    @Inject(PROPOSITION_SEMANTIC_SCORER)
    private readonly semanticScorer?: PropositionSemanticScorer,
  ) {}

  assess(claimText: string, passageTexts: string[]): PassageSupport {
    const claimTokens = this.legalTokens(claimText);
    if (claimTokens.length === 0) return 'INDETERMINATE';
    if (passageTexts.length === 0) return 'INDETERMINATE';

    let bestScore = 0;
    let sawUsablePassage = false;
    let sawContradiction = false;
    for (const passage of passageTexts) {
      const passageTokens = this.legalTokens(passage);
      if (passageTokens.length === 0) continue;
      sawUsablePassage = true;
      const passageSet = new Set(passageTokens);
      const overlap = claimTokens.filter((token) => passageSet.has(token)).length;
      const lexicalRecall = overlap / claimTokens.length;
      const lexicalPrecision = overlap / passageTokens.length;
      const lexicalF1 =
        lexicalRecall + lexicalPrecision > 0
          ? (2 * lexicalRecall * lexicalPrecision) / (lexicalRecall + lexicalPrecision)
          : 0;
      const phraseScore = this.sharedPhraseScore(claimText, passage);
      const conceptScore = this.conceptOverlap(claimText, passage);
      const deterministicScore =
        lexicalRecall * 0.4 + lexicalF1 * 0.1 + phraseScore * 0.15 + conceptScore * 0.35;
      const semanticScore = this.clampScore(this.semanticScorer?.score(claimText, passage));
      // Semantic evidence can rescue paraphrases, but never dominates the grounded text signal.
      const combinedScore =
        semanticScore == null
          ? deterministicScore
          : deterministicScore * 0.55 + semanticScore * 0.45;

      if (this.hasMaterialContradiction(claimText, passage, Math.max(lexicalRecall, conceptScore))) {
        sawContradiction = true;
        continue;
      }
      bestScore = Math.max(bestScore, combinedScore);
    }

    if (!sawUsablePassage) return 'INDETERMINATE';
    // Calibrated to require strong multi-signal support. Borderline semantic matches
    // remain PARTIAL so downstream text is narrowed rather than silently accepted.
    if (bestScore >= 0.62) return 'SUPPORTED';
    if (bestScore >= 0.35) return 'PARTIAL';
    if (sawContradiction && bestScore < 0.2) return 'CONTRADICTED';
    return 'UNSUPPORTED';
  }

  private sharedPhraseScore(claim: string, passage: string): number {
    const claimNorm = claim.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const passageNorm = passage.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (claimNorm.length < 12 || passageNorm.length < 12) return 0;
    const words = claimNorm.split(' ').filter((w) => w.length > 3);
    if (words.length < 3) return 0;
    let best = 0;
    for (let len = Math.min(8, words.length); len >= 3; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (passageNorm.includes(phrase)) {
          best = Math.max(best, len / words.length);
        }
      }
    }
    return best;
  }

  private legalTokens(text: string): string[] {
    const stop = new Set([
      'the', 'and', 'that', 'this', 'with', 'from', 'into', 'for', 'shall', 'must', 'may', 'can',
      'court', 'section', 'under', 'where', 'there', 'been', 'being', 'have', 'has', 'are', 'was',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stop.has(token))
      .map((token) => this.stem(token));
  }

  private conceptOverlap(claim: string, passage: string): number {
    const claimConcepts = this.legalConcepts(claim);
    if (claimConcepts.size === 0) return 0;
    const passageConcepts = this.legalConcepts(passage);
    const overlap = [...claimConcepts].filter((concept) => passageConcepts.has(concept)).length;
    return overlap / claimConcepts.size;
  }

  private legalConcepts(text: string): Set<string> {
    const normalized = this.normalize(text);
    const concepts = new Set<string>();
    const groups: Record<string, string[]> = {
      custody: ['bail', 'release', 'liberty', 'detention', 'custody'],
      absconding: ['flight risk', 'abscond', 'flee', 'evade justice'],
      interference: ['witness tamper', 'tamper witness', 'influence witness', 'obstruct justice'],
      history: ['antecedent', 'prior conviction', 'criminal history'],
      seriousness: ['gravity', 'seriousness', 'severity', 'nature of accusation'],
      mandatory: ['mandatory', 'compulsory', 'shall require', 'no discretion'],
      discretionary: ['discretion', 'case by case', 'may grant', 'relevant factor'],
    };
    for (const [concept, phrases] of Object.entries(groups)) {
      if (phrases.some((phrase) => normalized.includes(phrase))) concepts.add(`concept:${concept}`);
    }
    return concepts;
  }

  private hasMaterialContradiction(claim: string, passage: string, relatedness: number): boolean {
    if (relatedness < 0.35) return false;
    const claimNorm = this.normalize(claim);
    const passageNorm = this.normalize(passage);
    const isCharacterization =
      /\b(?:default rule|modifiable|non-waivable|party choice|characteriz|contract out|waivable|void agreement|notice to quit|notice period|determination of lease|premature (?:notice|vacate|termination))\b/i.test(
        claimNorm,
      );
    const claimNegated = /\b(?:not|never|no|cannot|prohibit|barred|unless)\b/.test(claimNorm);
    const passageNegated = /\b(?:not|never|no|cannot|prohibit|barred|unless)\b/.test(passageNorm);
    if (isCharacterization) {
      return claimNegated !== passageNegated;
    }
    const modalityConflict =
      (/\b(?:mandatory|must|always|shall require|no discretion)\b/.test(claimNorm) &&
        /\b(?:discretion|case by case|not mandatory|may)\b/.test(passageNorm)) ||
      (/\b(?:mandatory|must|always|shall require|no discretion)\b/.test(passageNorm) &&
        /\b(?:discretion|case by case|not mandatory|may)\b/.test(claimNorm));
    return claimNegated !== passageNegated || modalityConflict;
  }

  private stem(token: string): string {
    return token
      .replace(/(ments?|ations?|ingly|edly|ness|able|ible)$/i, '')
      .replace(/(ing|ed|es|s)$/i, '');
  }

  private normalize(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private clampScore(score: number | undefined): number | undefined {
    if (score == null || !Number.isFinite(score)) return undefined;
    return Math.max(0, Math.min(1, score));
  }
}
