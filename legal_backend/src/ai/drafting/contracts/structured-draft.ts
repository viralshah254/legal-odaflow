/** Structured draft with atomic claim metadata for entailment audit */

export type AtomicClaimType =
  | 'case_fact'
  | 'party_position'
  | 'legal_rule'
  | 'legal_application'
  | 'inference';

export interface AtomicDraftClaim {
  id: string;
  sentenceId: string;
  claimText: string;
  claimType: AtomicClaimType;
  supportingFactIds: string[];
  supportingAuthorityIds: string[];
  playbookRuleId?: string;
}

export interface StructuredDraftSection {
  id: string;
  title: string;
  playbookSectionId: string;
  markdown: string;
  claims: AtomicDraftClaim[];
  order: number;
}

export interface StructuredDraft {
  id: string;
  caseRecordId: string;
  caseRecordVersion: number;
  caseRecordHash: string;
  playbookId: string;
  playbookVersion: string;
  documentKind: string;
  sections: StructuredDraftSection[];
  fullMarkdown: string;
  createdAt: string;
  issuePlanId?: string;
  lineage?: DraftGenerationLineage;
}

export interface DraftGenerationLineage {
  model?: string;
  promptVersion?: string;
  retrievalVersion?: string;
  playbookVersion: string;
  validatorVersions: Record<string, string>;
  adapterKind: string;
  generatedAt: string;
}

export function flattenDraftText(draft: StructuredDraft): string {
  return draft.fullMarkdown || draft.sections.map((s) => s.markdown).join('\n\n');
}
