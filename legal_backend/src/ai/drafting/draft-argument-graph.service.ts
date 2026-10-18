import { Injectable } from '@nestjs/common';
import { AUTHORITY_GAP_TEXT } from '@/ai/citations/anti-hallucination-contract';
import type { VerifiedSource } from '@/ai/unified-drafting/contracts/verified-source';
import type { DraftCaseTheory } from './draft-case-theory.service';

export interface ArgumentGraphNode {
  groundId: string;
  label: string;
  issueId?: string;
  facts: string[];
  /** Verified source ids this ground may cite. Empty means it must be argued without authority. */
  authorityIds: string[];
  /** True when no verified authority supports the ground. */
  authorityGap: boolean;
}

export interface ArgumentGraph {
  nodes: ArgumentGraphNode[];
  /** Grounds with no verified authority — these must carry an explicit gap marker. */
  unsupportedGroundIds: string[];
  /** Verified sources not bound to any ground; still citable, just unallocated. */
  unallocatedSourceIds: string[];
}

/**
 * Words that appear in almost every ground and every authority. Left in, they
 * make unrelated sources look like matches — "authority on arrest necessity"
 * would bind to any source with the word "authority" in its title.
 */
const STOPWORDS = new Set(
  [
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'that', 'this',
    'is', 'are', 'was', 'were', 'be', 'been', 'as', 'at', 'from', 'it', 'its', 'has', 'have',
    'not', 'no', 'any', 'all', 'may', 'must', 'shall', 'should', 'would', 'can',
    'court', 'courts', 'case', 'cases', 'law', 'laws', 'legal', 'section', 'sections', 'act',
    'order', 'application', 'petition', 'ground', 'grounds', 'authority', 'authorities',
    'judgment', 'judgement', 'precedent', 'decision', 'ruling', 'holding', 'held', 'principle',
  ].map(stem),
);

/**
 * Crude but predictable stemmer: strips the common inflections and truncates, so
 * "recovery"/"recovered"/"recovering" collapse to one token. Good enough for
 * matching a ground to a source, and cheap enough to run on every pair.
 */
function stem(word: string): string {
  let out = word;
  for (const suffix of ['ations', 'ation', 'ements', 'ement', 'ments', 'ment', 'ings', 'ing', 'ies', 'ied', 'ed', 'es', 's']) {
    if (out.length - suffix.length >= 4 && out.endsWith(suffix)) {
      out = out.slice(0, -suffix.length);
      break;
    }
  }
  return out.slice(0, 6);
}

/**
 * Binds each pleaded ground to the specific facts it rests on and the specific
 * verified sources that support it, so generation cannot spray citations across
 * arguments they do not actually support — and so a ground with no authority is
 * flagged rather than quietly padded with one.
 *
 * Deterministic by design: the binding is evidence about the pack, not a further
 * model opinion that would need its own verification.
 */
@Injectable()
export class DraftArgumentGraphService {
  build(input: {
    theory: DraftCaseTheory;
    sources: VerifiedSource[];
    facts?: string[];
    /** Max verified sources bound to a single ground. */
    maxAuthoritiesPerGround?: number;
  }): ArgumentGraph {
    const maxPerGround = input.maxAuthoritiesPerGround ?? 3;
    const citable = input.sources.filter((s) => s.verificationStatus !== 'rejected');
    const sourceTokens = new Map(citable.map((s) => [s.id, this.tokenize(this.sourceText(s))]));
    const factPool = input.facts ?? [];
    const used = new Set<string>();

    const nodes: ArgumentGraphNode[] = input.theory.grounds.map((ground) => {
      const groundTokens = this.tokenize(`${ground.label} ${ground.authorityNeed}`);
      const issue = input.theory.issues.find((i) => i.id === ground.issueId);
      if (issue) {
        for (const token of this.tokenize(`${issue.label} ${issue.elements.join(' ')}`)) {
          groundTokens.add(token);
        }
      }

      const ranked = citable
        .map((source) => ({
          source,
          score: this.overlap(groundTokens, sourceTokens.get(source.id) ?? new Set()),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      // A source only counts as supporting this ground if it is in the same league
      // as the best match — one incidental shared word is a coincidence, not support.
      const bestScore = ranked[0]?.score ?? 0;
      const scored = ranked
        .filter((entry) => entry.score >= Math.max(1, bestScore / 2))
        .slice(0, maxPerGround);

      for (const entry of scored) used.add(entry.source.id);

      const facts =
        ground.supportingFacts.length > 0
          ? ground.supportingFacts
          : factPool.filter((fact) => this.overlap(groundTokens, this.tokenize(fact)) > 0).slice(0, 3);

      return {
        groundId: ground.id,
        label: ground.label,
        issueId: ground.issueId,
        facts,
        authorityIds: scored.map((entry) => entry.source.id),
        authorityGap: scored.length === 0,
      };
    });

    return {
      nodes,
      unsupportedGroundIds: nodes.filter((n) => n.authorityGap).map((n) => n.groundId),
      unallocatedSourceIds: citable.filter((s) => !used.has(s.id)).map((s) => s.id),
    };
  }

  buildPromptBlock(graph: ArgumentGraph, sources: VerifiedSource[]): string {
    if (graph.nodes.length === 0) return '';

    const byId = new Map(sources.map((s) => [s.id, s]));
    const lines: string[] = [
      'ARGUMENT GRAPH (each ground, the facts it rests on, and the only authorities that support it):',
    ];

    for (const node of graph.nodes) {
      lines.push(`- [${node.groundId}] ${node.label}`);
      for (const fact of node.facts) lines.push(`    fact: ${fact}`);
      if (node.authorityGap) {
        lines.push(
          `    authority: NONE VERIFIED — argue this ground from the facts and the statutory text only, and mark it ${AUTHORITY_GAP_TEXT}. Do not supply a case name from memory.`,
        );
      } else {
        for (const id of node.authorityIds) {
          const source = byId.get(id);
          if (!source) continue;
          const cite = source.citation ? ` ${source.citation}` : '';
          lines.push(`    authority: ${id} — ${source.title}${cite}`);
        }
      }
    }

    lines.push(
      'Argue each ground once, in this order, using only the authorities bound to it. Do not reuse one authority as if it decided a different ground.',
    );

    return lines.join('\n');
  }

  private sourceText(source: VerifiedSource): string {
    return [source.title, source.citation, source.section, source.proposition, source.text]
      .filter(Boolean)
      .join(' ');
  }

  private tokenize(value: string): Set<string> {
    return new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 3)
        .map(stem)
        .filter((token) => !STOPWORDS.has(token)),
    );
  }

  private overlap(a: Set<string>, b: Set<string>): number {
    let count = 0;
    for (const token of a) if (b.has(token)) count += 1;
    return count;
  }
}
