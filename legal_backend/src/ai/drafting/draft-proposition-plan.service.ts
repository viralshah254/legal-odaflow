import { Injectable } from '@nestjs/common';
import type { ClaimBlock, LegalResearchDraft } from '@/ai/legal-research/legal-research-draft.types';
import type { LegalEvidencePack } from '@/ai/legal-research/legal-evidence-pack.service';
import type { ArchetypeRouteResult } from './archetypes/draft-archetype.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

export interface DraftPropositionPlanInput {
  kind: string;
  caseDetails: string;
  archetype?: ArchetypeRouteResult;
  groundingAuthorities: RetrievedAuthority[];
  evidencePack: LegalEvidencePack;
  countryCode: string;
  /** Learned constraints from prior claim-level verification failures for this kind */
  planningConstraints?: string[];
}

/**
 * Builds a grounds/facts proposition plan (ClaimBlock shape) before prose generation.
 * Unsupported grounds are marked LIMITATION so claim-level verification can strip/block certify.
 */
@Injectable()
export class DraftPropositionPlanService {
  build(input: DraftPropositionPlanInput): LegalResearchDraft {
    const packIds = this.allEvidenceIds(input.evidencePack);
    const factIds = input.evidencePack.matterFacts.map((f) => f.factId);
    const propositions: ClaimBlock[] = [];

    // Fact propositions from matter intake
    for (const fact of input.evidencePack.matterFacts.slice(0, 12)) {
      propositions.push({
        claimId: `fact_${fact.factId}`,
        text: fact.description,
        type: 'APPLICATION',
        evidenceIds: [],
        factIds: [fact.factId],
        confidence: 0.7,
      });
    }

    // Grounds from archetype governing sections + grounding authorities
    const sections = input.archetype?.governingSections ?? [];
    for (const [index, section] of sections.entries()) {
      const matched = this.matchEvidenceForSection(section.actId, section.section, packIds, input);
      propositions.push({
        claimId: `ground_statute_${index + 1}`,
        text: `${section.label ?? `${section.actId} §${section.section}`} applies to the pleaded facts.`,
        type: 'RULE',
        evidenceIds: matched,
        confidence: matched.length > 0 ? 0.75 : 0.35,
      });
      if (matched.length === 0) {
        propositions.push({
          claimId: `ground_statute_${index + 1}_gap`,
          text: `Governing section ${section.actId} §${section.section} was not found in the locked evidence pack — do not state as settled law.`,
          type: 'LIMITATION',
          evidenceIds: [],
          confidence: 0.9,
        });
      }
    }

    for (const [index, auth] of input.groundingAuthorities.slice(0, 8).entries()) {
      const evidenceIds = this.matchEvidenceForAuthority(auth.id, packIds, input.evidencePack);
      propositions.push({
        claimId: `ground_case_${index + 1}`,
        text: `${auth.title}${auth.citation ? ` (${auth.citation})` : ''} supports the pleaded ground.`,
        type: 'HOLDING',
        evidenceIds,
        basedOnClaimIds: evidenceIds.length > 0 ? undefined : undefined,
        confidence: evidenceIds.length > 0 ? 0.7 : 0.3,
      });
    }

    // Learned constraints from prior claim-level verification failures
    for (const [index, constraint] of (input.planningConstraints ?? []).slice(0, 5).entries()) {
      propositions.push({
        claimId: `learned_constraint_${index + 1}`,
        text: constraint,
        type: 'LIMITATION',
        evidenceIds: [],
        confidence: 0.85,
      });
    }

    // Application bridge
    if (propositions.some((p) => p.type === 'RULE' || p.type === 'HOLDING') && factIds.length > 0) {
      const ruleIds = propositions
        .filter((p) => p.type === 'RULE' || p.type === 'HOLDING')
        .map((p) => p.claimId)
        .slice(0, 4);
      propositions.push({
        claimId: 'application_bridge',
        text: 'On the pleaded facts, the governing provisions and authorities apply as set out in the grounds.',
        type: 'APPLICATION',
        evidenceIds: [],
        factIds: factIds.slice(0, 6),
        basedOnClaimIds: ruleIds,
        confidence: 0.65,
      });
    }

    const heading =
      input.archetype?.recommendedKind ??
      input.archetype?.archetype ??
      input.kind;

    return {
      directAnswer: {
        text: `Proposition plan for ${heading} — generate grounds only from verified evidenceIds.`,
        confidence: propositions.some((p) => p.evidenceIds.length > 0) ? 0.7 : 0.4,
      },
      issues: [
        {
          issueId: 'grounds',
          heading: 'Grounds and legal propositions',
          conclusion:
            'Material RULE/HOLDING propositions must cite locked evidence pack passages before export certification.',
          propositions,
        },
      ],
      practicalSteps: [],
      limitations: propositions
        .filter((p) => p.type === 'LIMITATION')
        .map((p) => p.text),
      unansweredQuestions: (input.archetype?.missingFacts ?? []).map(
        (f) => `Missing fact for certification: ${f}`,
      ),
      scopeNote: `Draft proposition plan (${input.countryCode}) — evidence-first.`,
    };
  }

  /** Prompt block injected into pass-1 drafting. */
  buildPromptBlock(plan: LegalResearchDraft): string {
    const lines = [
      '=== PROPOSITION PLAN (cite ONLY these evidenceIds; do not invent authorities) ===',
      plan.directAnswer.text,
    ];
    for (const issue of plan.issues) {
      lines.push(`Issue: ${issue.heading}`);
      for (const p of issue.propositions) {
        const refs =
          p.evidenceIds.length > 0
            ? `evidenceIds=[${p.evidenceIds.join(', ')}]`
            : p.factIds?.length
              ? `factIds=[${p.factIds.join(', ')}]`
              : 'NO_EVIDENCE';
        lines.push(`- [${p.type}] ${p.claimId}: ${p.text} (${refs})`);
      }
    }
    if (plan.limitations.length > 0) {
      lines.push('Limitations:');
      for (const lim of plan.limitations) lines.push(`- ${lim}`);
    }
    lines.push('=== END PROPOSITION PLAN ===');
    return lines.join('\n');
  }

  private allEvidenceIds(pack: LegalEvidencePack): Set<string> {
    const ids = new Set<string>();
    for (const s of pack.statutes) ids.add(s.evidenceId);
    for (const c of pack.authorities) {
      ids.add(c.evidenceId);
      for (const p of c.passages) ids.add(p.evidenceId);
    }
    for (const o of pack.officialMaterials) ids.add(o.evidenceId);
    return ids;
  }

  private matchEvidenceForSection(
    actId: string,
    section: string,
    packIds: Set<string>,
    input: DraftPropositionPlanInput,
  ): string[] {
    const needle = `${actId} ${section}`.toLowerCase();
    const hits: string[] = [];
    for (const s of input.evidencePack.statutes) {
      const hay = `${s.actId} ${s.section} ${s.heading ?? ''}`.toLowerCase();
      if (hay.includes(section.toLowerCase()) || hay.includes(needle) || packIds.has(s.evidenceId)) {
        if (
          hay.includes(section.toLowerCase()) ||
          hay.includes(actId.toLowerCase().slice(0, 8))
        ) {
          hits.push(s.evidenceId);
        }
      }
    }
    return hits.slice(0, 3);
  }

  private matchEvidenceForAuthority(
    authorityId: string,
    packIds: Set<string>,
    pack: LegalEvidencePack,
  ): string[] {
    const hits: string[] = [];
    for (const c of pack.authorities) {
      if (c.authorityId === authorityId || c.evidenceId.includes(authorityId.slice(0, 12))) {
        hits.push(...c.passages.map((p) => p.evidenceId));
        if (packIds.has(c.evidenceId)) hits.push(c.evidenceId);
      }
    }
    return [...new Set(hits)].slice(0, 4);
  }
}
