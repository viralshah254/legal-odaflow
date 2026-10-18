import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { CaseRecord, CaseFact } from '../contracts/case-record';
import { isRenderableFact } from '../contracts/case-record';
import type { DraftPlaybook } from '../contracts/draft-playbook';
import type { IssuePlan } from '../contracts/issue-plan';
import type {
  AtomicDraftClaim,
  DraftGenerationLineage,
  StructuredDraft,
  StructuredDraftSection,
} from '../contracts/structured-draft';

export interface StructuredGenerateInput {
  caseRecord: CaseRecord;
  playbook: DraftPlaybook;
  issuePlan: IssuePlan;
  /** Optional LLM-produced section markdown keyed by playbook section id. */
  sectionMarkdown?: Record<string, string>;
  lineage?: Partial<DraftGenerationLineage>;
}

/**
 * Builds a StructuredDraft with AtomicDraftClaim metadata from playbook sections + issue plan.
 * When sectionMarkdown is absent, emits a deterministic skeleton (for gates / tests).
 */
@Injectable()
export class StructuredDraftGenerator {
  generate(input: StructuredGenerateInput): StructuredDraft {
    const { caseRecord, playbook, issuePlan } = input;
    const renderable = caseRecord.facts.filter(isRenderableFact);
    const sections: StructuredDraftSection[] = playbook.requiredSections.map((rule, order) => {
      const markdown =
        input.sectionMarkdown?.[rule.id] ??
        this.skeletonSection(rule.title, caseRecord, issuePlan, renderable, playbook);
      const claims = this.extractClaims(markdown, renderable, rule.id, issuePlan);
      return {
        id: `SEC_${rule.id}`,
        title: rule.title,
        playbookSectionId: rule.id,
        markdown,
        claims,
        order,
      };
    });

    const fullMarkdown = sections.map((s) => `## ${s.title}\n\n${s.markdown}`).join('\n\n');
    const id = `SD_${createHash('sha256')
      .update(`${caseRecord.metadata.caseRecordId}:${caseRecord.metadata.version}:${playbook.version}`)
      .digest('hex')
      .slice(0, 12)}`;

    return {
      id,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      caseRecordHash: caseRecord.metadata.sourceHash,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      documentKind: playbook.documentKind,
      sections,
      fullMarkdown,
      createdAt: new Date().toISOString(),
      issuePlanId: issuePlan.id,
      lineage: {
        playbookVersion: playbook.version,
        validatorVersions: {},
        adapterKind: playbook.documentKind,
        generatedAt: new Date().toISOString(),
        ...input.lineage,
      },
    };
  }

  /** Attach claims to externally generated markdown sections. */
  annotateExistingMarkdown(
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
    issuePlan: IssuePlan,
    fullMarkdown: string,
    lineage?: Partial<DraftGenerationLineage>,
  ): StructuredDraft {
    const byTitle: Record<string, string> = {};
    for (const rule of playbook.requiredSections) {
      const re = new RegExp(
        `(?:^|\\n)#{0,3}\\s*${rule.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|\\n## |$)`,
        'i',
      );
      const m = fullMarkdown.match(re);
      byTitle[rule.id] = m?.[1]?.trim() ?? '';
    }
    // Fallback: put entire draft in facts section
    if (Object.values(byTitle).every((v) => !v)) {
      const facts = playbook.requiredSections.find((s) => /fact/i.test(s.id));
      if (facts) byTitle[facts.id] = fullMarkdown;
    }
    return this.generate({
      caseRecord,
      playbook,
      issuePlan,
      sectionMarkdown: byTitle,
      lineage,
    });
  }

  private skeletonSection(
    title: string,
    record: CaseRecord,
    plan: IssuePlan,
    facts: CaseFact[],
    playbook: DraftPlaybook,
  ): string {
    if (/cause\s*title|parties/i.test(title)) {
      return record.parties.map((p) => `${p.role}: ${p.name}`).join('\n');
    }
    if (/fact/i.test(title)) {
      return facts
        .filter((f) => f.materiality !== 'background')
        .map((f) => `- ${f.proposition}`)
        .join('\n');
    }
    if (/ground/i.test(title)) {
      return plan.items
        .filter((i) => i.required)
        .map((i) => {
          const linked = i.supportingFactIds
            .map((id) => facts.find((f) => f.id === id)?.proposition)
            .filter(Boolean)
            .slice(0, 2);
          return `${i.label}: ${linked.join('; ') || 'see Case Record'}`;
        })
        .join('\n');
    }
    if (/prayer|demand/i.test(title)) {
      const remedy = playbook.remedyRules[0]?.label ?? 'relief as prayed';
      return `It is most respectfully prayed that this Hon'ble Court may be pleased to grant ${remedy}.`;
    }
    if (/verif/i.test(title)) {
      return 'Verified that the contents of this application are true to my knowledge.';
    }
    if (/payment|services|term|governing/i.test(title)) {
      return `${title} — terms per Case Record and playbook defaults.`;
    }
    return `${title} section.`;
  }

  private extractClaims(
    markdown: string,
    facts: CaseFact[],
    sectionId: string,
    plan: IssuePlan,
  ): AtomicDraftClaim[] {
    const sentences = markdown
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^[-*]\s*/, '').trim())
      .filter((s) => s.length > 15);
    return sentences.slice(0, 20).map((claimText, i) => {
      const supportingFactIds = facts
        .filter((f) => {
          const tokens = f.proposition.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
          const lower = claimText.toLowerCase();
          return tokens.some((t) => lower.includes(t));
        })
        .map((f) => f.id)
        .slice(0, 5);
      const disposition = plan.dispositions.find((d) => supportingFactIds.includes(d.factId));
      return {
        id: `CLAIM_${sectionId}_${i}`,
        sentenceId: `SENT_${sectionId}_${i}`,
        claimText,
        claimType: supportingFactIds.length > 0 ? 'case_fact' : 'legal_application',
        supportingFactIds,
        supportingAuthorityIds: [],
        playbookRuleId: disposition?.issuePlanItemId,
      };
    });
  }
}
