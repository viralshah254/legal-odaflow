import { Injectable } from '@nestjs/common';
import type { ClaimBlock, LegalResearchDraft } from '@/ai/legal-research/legal-research-draft.types';
import type { LegalEvidencePack } from '@/ai/legal-research/legal-evidence-pack.service';
import { linkApplicationClaims } from '@/ai/legal-research/application-claim-linking';
import { CitationResolutionService } from './citation-resolution.service';

export interface ExtractedProposition extends ClaimBlock {
  materiality: 'MATERIAL' | 'SUPPORTING';
}

const MAX_MATERIAL = 20;
const MAX_SUPPORTING = 10;

@Injectable()
export class PropositionExtractionService {
  constructor(private readonly citationResolution: CitationResolutionService) {}

  fromMarkdown(markdown: string, pack: LegalEvidencePack): LegalResearchDraft {
    const propositions = this.extract(markdown, pack);
    return {
      directAnswer: {
        text: propositions[0]?.text ?? markdown.slice(0, 500),
        confidence: propositions.length > 0 ? 0.65 : 0.2,
      },
      issues: [
        {
          issueId: 'issue_1',
          heading: 'Extracted propositions',
          conclusion: propositions[0]?.text ?? 'No atomic legal propositions could be extracted.',
          propositions,
        },
      ],
      practicalSteps: [],
      limitations: propositions.length === 0 ? ['No verifiable propositions were extracted from the output.'] : [],
      unansweredQuestions: [],
      scopeNote: 'Post-hoc proposition extraction from generated prose.',
    };
  }

  extract(markdown: string, pack: LegalEvidencePack): ExtractedProposition[] {
    const cleaned = markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];

    const candidates = cleaned
      .split(/(?<=[.!?])\s+(?=[A-Z(])/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 24)
      .slice(0, 80)
      .map((sentence, index) => {
        const resolved = this.citationResolution.resolveText(sentence, pack);
        const evidenceIds = [...new Set(resolved.flatMap((r) => r.evidenceIds))];
        const type = this.classify(sentence, evidenceIds);
        const factIds =
          type === 'APPLICATION' ? this.matchFactIds(sentence, pack.matterFacts) : undefined;
        const materiality = this.resolveMateriality(type, evidenceIds, factIds);
        return {
          claimId: `prop_${index + 1}`,
          text: sentence,
          type,
          evidenceIds,
          factIds,
          basedOnClaimIds: undefined,
          confidence: evidenceIds.length > 0 ? 0.65 : 0.35,
          materiality,
        } satisfies ExtractedProposition;
      })
      // Drop connective / disclaimer noise that is neither material nor useful supporting context.
      .filter((p) => !this.isNoiseSentence(p));

    const material = candidates.filter((p) => p.materiality === 'MATERIAL').slice(0, MAX_MATERIAL);
    const supporting = candidates
      .filter((p) => p.materiality === 'SUPPORTING')
      .slice(0, MAX_SUPPORTING);

    // Prefer material claims; keep a small supporting set for context without blocker inflation.
    const selected = [...material, ...supporting];
    const renumbered = selected.map((p, index) => ({
      ...p,
      claimId: `prop_${index + 1}`,
    }));
    return linkApplicationClaims(renumbered, pack.matterFacts);
  }

  private resolveMateriality(
    type: ClaimBlock['type'],
    evidenceIds: string[],
    factIds?: string[],
  ): 'MATERIAL' | 'SUPPORTING' {
    if (type === 'LIMITATION' || type === 'PROCEDURE') return 'SUPPORTING';
    if (type === 'RULE' || type === 'HOLDING') {
      return evidenceIds.length > 0 ? 'MATERIAL' : 'SUPPORTING';
    }
    // APPLICATION: material only when tied to matter facts (or cited authority).
    if ((factIds?.length ?? 0) > 0 || evidenceIds.length > 0) return 'MATERIAL';
    return 'SUPPORTING';
  }

  private isNoiseSentence(p: ExtractedProposition): boolean {
    if (/this (?:is|memo|answer)|not (?:legal advice|verified)|lawyer review|disclaimer|subject to confirmation/i.test(p.text)) {
      return true;
    }
    // Pure connective sentences with no legal signal.
    if (
      p.materiality === 'SUPPORTING' &&
      p.evidenceIds.length === 0 &&
      (p.type === 'PROCEDURE' || p.type === 'LIMITATION') &&
      !/section|article|held|court|bail|offence|offense|statute|act\b/i.test(p.text)
    ) {
      return true;
    }
    return false;
  }

  private matchFactIds(
    sentence: string,
    matterFacts: Array<{ factId: string; description: string }>,
  ): string[] | undefined {
    if (!matterFacts.length) return undefined;
    const lower = sentence.toLowerCase();
    const matched = matterFacts
      .filter((f) => {
        const tokens = f.description
          .toLowerCase()
          .split(/\W+/)
          .filter((t) => t.length >= 4);
        if (tokens.length === 0) return false;
        const hits = tokens.filter((t) => lower.includes(t)).length;
        return hits >= Math.min(2, tokens.length) || lower.includes(f.description.toLowerCase().slice(0, 40));
      })
      .map((f) => f.factId);
    return matched.length > 0 ? matched : undefined;
  }

  private classify(sentence: string, evidenceIds: string[]): ClaimBlock['type'] {
    if (/therefore|accordingly|on these facts|in the present case|the applicant|the petitioner|the plaintiff/i.test(sentence)) {
      return 'APPLICATION';
    }
    if (/held|observed|ruled|supreme court|high court|scc|air\s+\d{4}/i.test(sentence)) {
      return 'HOLDING';
    }
    if (/must|shall|may|requires|prohibits|section|article|rule|burden|standard/i.test(sentence)) {
      return evidenceIds.length > 0 ? 'RULE' : 'PROCEDURE';
    }
    if (/limitation|subject to|however|unless|not verified|review/i.test(sentence)) {
      return 'LIMITATION';
    }
    return evidenceIds.length > 0 ? 'HOLDING' : 'APPLICATION';
  }
}
