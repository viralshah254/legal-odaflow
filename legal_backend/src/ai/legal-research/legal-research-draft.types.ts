import type {
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from '@/ai/verification/verification-finding.types';

/**
 * Structured synthesis output contract (Wave 2).
 *
 * The synthesis model generates this JSON rather than raw Markdown.
 * The backend renders Markdown after verification, inserting citations
 * from database metadata — never from generated model text.
 *
 * Anthropic specifically recommends structured outputs when
 * schema-conforming JSON is required.
 */

// ── Claim type ────────────────────────────────────────────────────────────────

export type ClaimType =
  | 'RULE'
  | 'HOLDING'
  | 'APPLICATION'
  | 'PROCEDURE'
  | 'LIMITATION'
  | 'GENERAL_PRINCIPLE';

// ── Claim block ───────────────────────────────────────────────────────────────

/**
 * A single legal proposition within an issue.
 *
 * RULE and HOLDING must have at least one evidenceId from the evidence pack.
 * APPLICATION may have evidenceIds empty when it derives purely from factual inference;
 * in that case factIds must identify the underlying matter facts.
 */
export interface ClaimBlock {
  claimId: string;
  text: string;
  type: ClaimType;
  /** References EvidencePassage.evidenceId or EvidenceStatute.evidenceId from the evidence pack. */
  evidenceIds: string[];
  /** IDs of MatterFact entries this APPLICATION claim is based on (no citation required). */
  factIds?: string[];
  /** IDs of RULE / HOLDING ClaimBlocks this APPLICATION derives its legal basis from. */
  basedOnClaimIds?: string[];
  confidence: number;
  /** When set, drives blocker vs advisory severity in claim-level verification. */
  materiality?: 'MATERIAL' | 'SUPPORTING';
}

// ── Issue block ───────────────────────────────────────────────────────────────

export interface IssueBlock {
  issueId: string;
  heading: string;
  /** Memo-facing IRAC fields. Legacy drafts may supply only propositions. */
  rule?: ClaimBlock[];
  application?: ClaimBlock[];
  /** Legacy drafts may supply a plain string. New drafts should provide calibrated fields. */
  conclusion: string | CalibratedConclusion;
  /** Canonical verification list, normalized from rule + application for new drafts. */
  propositions: ClaimBlock[];
}

export interface DraftAnswer {
  text: string;
  confidence: number;
}

export interface LegalFrameworkAuthority {
  /** References evidence in the evidence pack; display names are resolved by the backend. */
  evidenceId: string;
  authorityType: 'STATUTE' | 'REGULATION' | 'CASE' | 'OTHER';
  /** Claim IDs in the issue analysis that explain why this authority matters. */
  claimIds: string[];
}

export interface RiskAndDefence {
  risk: string;
  defence?: string;
}

export type ExpectedAnswerType =
  | 'YES_NO'
  | 'DATE'
  | 'DOCUMENT'
  | 'PERSON'
  | 'AMOUNT'
  | 'NARRATIVE'
  | 'LEGAL_STATUS'
  | 'OTHER';

export interface StructuredUnansweredQuestion {
  /** Stable within the draft and suitable for UI/state reconciliation. */
  id: string;
  question: string;
  whyItMatters: string;
  expectedAnswerType: ExpectedAnswerType;
  affectedIssueId?: string;
  affectedConclusion?: string;
  suggestedSource: string;
}

export type SafeActionType =
  | 'PRESERVE_EVIDENCE'
  | 'GATHER_INFORMATION'
  | 'VERIFY_AUTHORITY'
  | 'SEEK_LEGAL_ADVICE'
  | 'PREPARE_DRAFT'
  | 'CONSIDER_FILING'
  | 'CONSIDER_SETTLEMENT'
  | 'COMPLY_WITH_ORDER'
  | 'OTHER_SAFE';

export interface StructuredPracticalStep {
  /** Stable within the draft and suitable for UI/state reconciliation. */
  id: string;
  action: string;
  timing: string;
  purpose: string;
  evidenceNeeded: string[];
  dependsOnQuestionIds?: string[];
  safeActionType: SafeActionType;
  /** Required when the action depends on facts, advice, permission, or a legal test. */
  condition?: string;
}

export type ConclusionStrength = 'STRONG' | 'MODERATE' | 'TENTATIVE' | 'INSUFFICIENT';

export interface CalibratedConclusion {
  text: string;
  confidence: number;
  strength: ConclusionStrength;
  controllingReasons: string[];
  factualDependencies: string[];
  adverseConsiderations: string[];
}

export interface AuthorityReliedOn {
  /** References evidence in the evidence pack; citation text is resolved by the backend. */
  evidenceId: string;
  claimIds: string[];
}

// ── Legal research draft ──────────────────────────────────────────────────────

/**
 * Top-level structured output from the synthesis model.
 * The backend validates all evidenceIds against the evidence pack before rendering.
 */
export interface LegalResearchDraft {
  /** Memo-ready fields. Optional at the type boundary for legacy draft compatibility. */
  questionPresented?: string;
  shortAnswer?: DraftAnswer;
  /** Ordered with statutes first by both the model contract and renderer. */
  legalFramework?: LegalFrameworkAuthority[];
  directAnswer: {
    text: string;
    confidence: number;
  };
  issues: IssueBlock[];
  risksAndDefences?: RiskAndDefence[];
  practicalSteps: Array<string | StructuredPracticalStep>;
  authoritiesReliedOn?: AuthorityReliedOn[];
  limitations: string[];
  unansweredQuestions: Array<string | StructuredUnansweredQuestion>;
  /** Compact appendix only; verification caveats should not dominate the memo body. */
  verificationNotes?: string[];
  /** Model-declared research scope — used in the rendered disclaimer. */
  scopeNote?: string;
}

// ── Claim audit ───────────────────────────────────────────────────────────────

export type PassageSupport = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'CONTRADICTED' | 'INDETERMINATE';
export type ClaimAction = 'KEEP' | 'QUALIFY' | 'REPAIR' | 'REMOVE' | 'ESCALATE';

/**
 * Per-claim audit result produced by ClaimLevelVerificationService (Wave 3).
 */
export interface ClaimAudit {
  claimId: string;
  identityVerified: boolean | 'INDETERMINATE';
  relevanceValid?: boolean | 'INDETERMINATE';
  passageSupport: PassageSupport;
  pinpointValid?: boolean | 'INDETERMINATE';
  jurisdictionValid: boolean | 'INDETERMINATE';
  hierarchyValid: boolean | 'NOT_APPLICABLE' | 'INDETERMINATE';
  treatmentValid: boolean | 'NOT_APPLICABLE' | 'INDETERMINATE';
  currentLawValid: boolean | 'INDETERMINATE';
  confidence: number;
  action: ClaimAction;
  findings?: VerificationFinding[];
  notes?: string;
}

// ── Verified research draft ───────────────────────────────────────────────────

export interface VerifiedResearchDraft {
  draft: LegalResearchDraft;
  claimAudits: ClaimAudit[];
  verificationStatus: 'VERIFIED' | 'VERIFIED_WITH_LIMITATIONS' | 'FAILED' | 'INDETERMINATE';
  publicationState?: PublicationState;
  limitations: Array<{ issueId: string; message: string }>;
  renderedMarkdown: string;
  findings?: VerificationFinding[];
  propositions?: VerifiedPropositionSummary[];
  dimensions?: VerificationDimensions;
  evidencePackId?: string;
  outputHash?: string;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

/**
 * Renders a LegalResearchDraft to Markdown after all verifications have passed.
 * Citation strings are inserted from the evidence pack — never copied from model output.
 */
export function renderDraftToMarkdown(
  draft: LegalResearchDraft,
  citationMap: Map<string, string>,
): string {
  const lines: string[] = [];
  const allClaims = new Map(
    draft.issues.flatMap((issue) => issue.propositions).map((claim) => [claim.claimId, claim]),
  );
  const shortAnswer = draft.shortAnswer ?? draft.directAnswer;
  const verificationNotes = new Set([
    ...(draft.verificationNotes ?? []),
    ...draft.limitations,
  ]);

  lines.push('# Legal Research Memorandum');
  if (draft.questionPresented) {
    lines.push(`\n## Question Presented\n\n${draft.questionPresented}`);
  }
  lines.push(`\n## Short Answer\n\n${shortAnswer.text}`);

  const legalFramework = [...(draft.legalFramework ?? [])].sort((a, b) => {
    const rank = (type: LegalFrameworkAuthority['authorityType']) =>
      type === 'STATUTE' ? 0 : type === 'REGULATION' ? 1 : type === 'CASE' ? 2 : 3;
    return rank(a.authorityType) - rank(b.authorityType);
  });
  if (legalFramework.length > 0) {
    lines.push('\n## Legal Framework\n');
    for (const authority of legalFramework) {
      const citation = citationMap.get(authority.evidenceId);
      if (!citation) continue;
      const supportedClaims = authority.claimIds
        .map((claimId) => allClaims.get(claimId)?.text)
        .filter((text): text is string => Boolean(text));
      lines.push(
        `- **${citation}**${supportedClaims.length > 0 ? ` — ${supportedClaims.join(' ')}` : ''}`,
      );
    }
  }

  for (const issue of draft.issues) {
    lines.push(`\n## ${issue.heading}`);
    const ruleClaims = issue.propositions.filter((prop) => prop.type !== 'APPLICATION');
    const applicationClaims = issue.propositions.filter((prop) => prop.type === 'APPLICATION');

    if (ruleClaims.length > 0) {
      lines.push('\n### Rule\n');
    }
    for (const prop of ruleClaims) {
      if (prop.type === 'GENERAL_PRINCIPLE') {
        lines.push(prop.text);
        verificationNotes.add(
          `General principle not verified against retrieved sources: ${prop.text}`,
        );
        continue;
      }
      const citations = prop.evidenceIds
        .map((id) => citationMap.get(id))
        .filter(Boolean)
        .join('; ');
      lines.push(citations ? `${prop.text} *(${citations})*` : prop.text);
    }

    if (applicationClaims.length > 0) {
      lines.push('\n### Application\n');
      for (const prop of applicationClaims) {
        const citations = prop.evidenceIds
          .map((id) => citationMap.get(id))
          .filter(Boolean)
          .join('; ');
        lines.push(citations ? `${prop.text} *(${citations})*` : prop.text);
      }
    }

    const conclusion =
      typeof issue.conclusion === 'string' ? issue.conclusion : issue.conclusion.text;
    lines.push(`\n### Conclusion\n\n${conclusion}`);
    if (typeof issue.conclusion !== 'string') {
      lines.push(
        `\n**Evidence-bounded assessment:** ${issue.conclusion.strength.toLowerCase()}.`,
      );
      if (issue.conclusion.factualDependencies.length > 0) {
        lines.push(`\n**Fact dependencies:** ${issue.conclusion.factualDependencies.join('; ')}`);
      }
      if (issue.conclusion.adverseConsiderations.length > 0) {
        lines.push(
          `\n**Adverse considerations:** ${issue.conclusion.adverseConsiderations.join('; ')}`,
        );
      }
    }
  }

  if ((draft.risksAndDefences?.length ?? 0) > 0) {
    lines.push('\n## Risks and Defences\n');
    for (const item of draft.risksAndDefences ?? []) {
      lines.push(`- **Risk:** ${item.risk}${item.defence ? ` **Defence:** ${item.defence}` : ''}`);
    }
  }

  if (draft.practicalSteps.length > 0) {
    lines.push('\n## Practical Steps\n');
    for (const step of draft.practicalSteps) {
      if (typeof step === 'string') {
        lines.push(`- ${step}`);
        continue;
      }
      const details = [
        `**Timing:** ${step.timing}`,
        `**Purpose:** ${step.purpose}`,
        step.evidenceNeeded.length > 0
          ? `**Evidence:** ${step.evidenceNeeded.join(', ')}`
          : undefined,
        step.condition ? `**Condition:** ${step.condition}` : undefined,
      ].filter(Boolean);
      lines.push(`- **${step.id}:** ${step.action} — ${details.join('; ')}`);
    }
  }

  if ((draft.authoritiesReliedOn?.length ?? 0) > 0) {
    lines.push('\n## Authorities Relied On\n');
    for (const authority of draft.authoritiesReliedOn ?? []) {
      const citation = citationMap.get(authority.evidenceId);
      if (!citation) continue;
      const propositions = authority.claimIds
        .map((claimId) => allClaims.get(claimId)?.text)
        .filter((text): text is string => Boolean(text));
      lines.push(`- **${citation}**${propositions.length ? ` — ${propositions.join(' ')}` : ''}`);
    }
  }

  if (draft.unansweredQuestions.length > 0) {
    lines.push('\n## Unanswered Questions\n');
    for (const q of draft.unansweredQuestions) {
      if (typeof q === 'string') {
        lines.push(`- ${q}`);
        continue;
      }
      const affected = q.affectedIssueId
        ? ` Affects issue ${q.affectedIssueId}.`
        : q.affectedConclusion
          ? ` Affects: ${q.affectedConclusion}.`
          : '';
      const source = q.suggestedSource ? ` Suggested source: ${q.suggestedSource}.` : '';
      lines.push(
        `- **${q.id}:** ${q.question} _Why it matters:_ ${q.whyItMatters} ` +
          `_Expected answer:_ ${q.expectedAnswerType}.${affected}${source}`,
      );
    }
  }

  if (verificationNotes.size > 0 || draft.scopeNote) {
    lines.push('\n## Appendix: Verification Notes\n');
    if (draft.scopeNote) lines.push(`- ${draft.scopeNote}`);
    for (const note of verificationNotes) lines.push(`- ${note}`);
  }

  return lines.join('\n');
}
