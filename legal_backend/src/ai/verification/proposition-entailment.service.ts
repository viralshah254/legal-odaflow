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
    const clauses = claim.split(/(?<=[.!?;])\s+/).filter(text => this.legalTokens(text).length > 0);
    if (clauses.length > 1) {
      const sourceTokens = new Set(this.legalTokens(passage));
      return clauses.some(clause => {
        const tokens = this.legalTokens(clause);
        return this.hasMaterialContradiction(clause, passage, tokens.filter(token => sourceTokens.has(token)).length / Math.max(1, tokens.length));
      });
    }
    if (relatedness < 0.35) return false;
    const claimNorm = this.normalize(claim);
    // Compare negation/modality only within the best matching source sentence.
    // A page can contain unrelated negatives, quotations and remedy questions.
    const targetTokens = [...new Set(this.legalTokens(claim))];
    const candidates = passage.split(/(?<=[.!?;])\s+/).map(text => {
      const sourceTokens = new Set(this.legalTokens(text));
      return { text, overlap: targetTokens.filter(token => sourceTokens.has(token)).length / Math.max(1, targetTokens.length) };
    }).sort((a, b) => b.overlap - a.overlap);
    if (!candidates[0] || candidates[0].overlap < 0.5) return false;
    const passageNorm = this.normalize(candidates[0].text);
    // A scope exception ("not being a fixed-work contract ... shall") is not
    // a prohibition on the operative action. Compare like clauses, not a
    // negative exception in one sentence with a positive rule in another.
    const operative = (text: string) => text.replace(/\bnot being\b.{0,220}?(?=\b(?:shall|may|must)\b)/g, '');
    const negativePredicate = /\b(?:not|never|cannot|prohibit|barred)\b|\bno\s+(?:right|power|authority|discretion|obligation|duty|entitlement|liability)\b|\bno\s+(?:\w+\s+){0,3}(?:(?:is|are)\s+(?:required|permitted|allowed)|may|shall|can|must)\b/;
    const claimNegated = negativePredicate.test(operative(claimNorm));
    const passageNegated = negativePredicate.test(operative(passageNorm));
    const opposedPredicate = claimNegated !== passageNegated && this.hasOpposedPredicate(
      operative(claimNegated ? claimNorm : passageNorm),
      operative(claimNegated ? passageNorm : claimNorm),
    );
    const modalityConflict =
      (/\b(?:mandatory|must|always|shall require|no discretion)\b/.test(claimNorm) &&
        /\b(?:discretion|case by case|not mandatory|may)\b/.test(passageNorm)) ||
      (/\b(?:mandatory|must|always|shall require|no discretion)\b/.test(passageNorm) &&
        /\b(?:discretion|case by case|not mandatory|may)\b/.test(claimNorm));
    return opposedPredicate || modalityConflict;
  }

  private hasOpposedPredicate(negative: string, positive: string): boolean {
    const words = negative.split(' ');
    const noPredicate = /^no\s+(?:(?:right|power|authority|discretion|obligation|duty|entitlement|liability)\b|(?:\w+\s+){0,3}(?:(?:is|are)\s+(?:required|permitted|allowed)|may|shall|can|must)\b)/;
    const items = words.flatMap((word, position) => {
      const negated = /^(?:not|never|cannot)$/.test(word) || (word === 'no' && noPredicate.test(words.slice(position).join(' ')));
      return negated ? [{ word, position, negated }] : this.legalTokens(word).map(token => ({ word: token, position, negated: false }));
    });
    const content = items.filter(item => !item.negated);
    const target = this.legalTokens(positive);
    if (content.length < 2 || target.length < 2) return false;
    const contains = (haystack: string[], needle: string[]) => haystack.some((_, start) => needle.every((word, offset) => haystack[start + offset] === word));
    if (content.length <= target.length && contains(target, content.map(item => item.word))) return items.some(item => item.negated);
    for (let start = 0; start <= content.length - target.length; start++) {
      if (!target.every((word, offset) => content[start + offset].word === word)) continue;
      const first = content[start].position, last = content[start + target.length - 1].position;
      if (items.some(item => item.negated && item.position >= first - 1 && item.position <= last + 1)) return true;
    }
    return false;
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
