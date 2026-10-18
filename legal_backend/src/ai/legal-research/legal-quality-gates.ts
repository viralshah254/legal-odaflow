import type { LegalEvidencePack } from './legal-evidence-pack.service';
import type {
  CalibratedConclusion,
  LegalResearchDraft,
  StructuredPracticalStep,
  StructuredUnansweredQuestion,
} from './legal-research-draft.types';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';

const VERSION = 'legal-quality-v1';
const ABSOLUTE_OUTCOME =
  /\b(?:guaranteed|certain(?:ly)?|definitely|always|automatically|cannot lose|will win|will succeed|court will (?:grant|allow|dismiss))\b/i;
const PLACEHOLDER_CASE =
  /\b(?:case\s+[a-z](?:\s+v\.?\s+case\s+[a-z])?|xyz\s+v\.?\s+abc|foo\s+v\.?\s+bar|some case|leading case|\[(?:case|authority|citation)[^\]]*\])\b/i;
const GENERIC_QUESTION =
  /^(?:any other (?:facts|details|documents)\??|what happened\??|please provide (?:more )?(?:details|information)\.?|anything else\??)$/i;
const ACTION_REQUIRING_CONDITION =
  /\b(?:file|lodge|commence|initiate|report|contact|approach|publish|serve|withhold|stop paying|transfer)\b/i;

function finding(
  checkId: string,
  explanation: string,
  severity: VerificationFinding['severity'] = 'BLOCKER',
  propositionId?: string,
): VerificationFinding {
  return {
    checkId: `quality:${checkId}`,
    state: 'FAIL',
    severity,
    dimension: 'coverage',
    propositionId,
    evidenceIds: [],
    explanation,
    repairAction: 'QUALIFY',
    verifierVersion: VERSION,
  };
}

function conclusionText(conclusion: string | CalibratedConclusion): string {
  return typeof conclusion === 'string' ? conclusion : conclusion.text;
}

/**
 * Deterministic publication gates for defects that should not depend on an LLM
 * reviewer. Legacy strings remain renderable, but new structured objects receive
 * stronger completeness and safety checks.
 */
export function evaluateLegalQuality(
  draft: LegalResearchDraft,
  pack: LegalEvidencePack,
): VerificationFinding[] {
  const findings: VerificationFinding[] = [];
  const caseEvidence = new Map(
    pack.authorities.flatMap((authority) =>
      authority.passages.map((passage) => [passage.evidenceId, passage] as const),
    ),
  );

  const outcomeText = [
    draft.directAnswer.text,
    draft.shortAnswer?.text,
    ...draft.issues.map((issue) => conclusionText(issue.conclusion)),
  ]
    .filter(Boolean)
    .join('\n');
  if (ABSOLUTE_OUTCOME.test(outcomeText)) {
    findings.push(
      finding(
        'absolute_outcome',
        'A short answer or conclusion predicts an absolute legal outcome. State a reasoned, fact-sensitive likelihood and preserve judicial discretion.',
      ),
    );
  }

  for (const issue of draft.issues) {
    const conclusion = issue.conclusion;
    if (typeof conclusion !== 'string') {
      const validConfidence =
        Number.isFinite(conclusion.confidence) &&
        conclusion.confidence >= 0 &&
        conclusion.confidence <= 1;
      if (
        !validConfidence ||
        conclusion.controllingReasons.length === 0 ||
        (conclusion.strength !== 'STRONG' && conclusion.factualDependencies.length === 0)
      ) {
        findings.push(
          finding(
            `uncalibrated_conclusion:${issue.issueId}`,
            `Issue ${issue.issueId} has an incomplete calibrated conclusion: include confidence, controlling reasons, and factual dependencies for non-strong outcomes.`,
            'HIGH',
          ),
        );
      }
    }

    const materialCaseClaims = issue.propositions.filter(
      (claim) =>
        (claim.type === 'HOLDING' || claim.type === 'RULE') &&
        (claim.materiality ?? 'MATERIAL') === 'MATERIAL' &&
        claim.evidenceIds.some((id) => caseEvidence.has(id)),
    );
    for (const claim of materialCaseClaims) {
      const hasPinpoint = claim.evidenceIds.some((id) => {
        const passage = caseEvidence.get(id);
        return Boolean(passage?.paragraph || passage?.page);
      });
      if (!hasPinpoint) {
        findings.push(
          finding(
            `missing_pinpoint:${claim.claimId}`,
            `Material case proposition ${claim.claimId} lacks a paragraph or page pinpoint.`,
            'BLOCKER',
            claim.claimId,
          ),
        );
      }
    }
    if (materialCaseClaims.length > 0) {
      const adverseText = [
        conclusionText(issue.conclusion),
        ...issue.propositions.map((claim) => claim.text),
        ...(draft.risksAndDefences ?? []).flatMap((item) => [item.risk, item.defence ?? '']),
      ].join(' ');
      const structuredAdverse =
        typeof conclusion !== 'string' && conclusion.adverseConsiderations.length > 0;
      if (
        !structuredAdverse &&
        !/\b(?:adverse|counterargument|contrary|distinguish|weakness|defence|defense)\b/i.test(
          adverseText,
        )
      ) {
        findings.push(
          finding(
            `missing_adverse_analysis:${issue.issueId}`,
            `Issue ${issue.issueId} relies on material case law but does not identify adverse authority, counterarguments, or explain that none was found.`,
            'HIGH',
          ),
        );
      }
    }
  }

  const propositionText = draft.issues.flatMap((issue) =>
    issue.propositions.map((claim) => ({ id: claim.claimId, text: claim.text })),
  );
  const memoText = [
    ...propositionText,
    { id: 'direct_answer', text: draft.directAnswer.text },
    ...draft.issues.map((issue) => ({
      id: `conclusion:${issue.issueId}`,
      text: conclusionText(issue.conclusion),
    })),
  ];
  for (const item of memoText) {
    if (PLACEHOLDER_CASE.test(item.text)) {
      findings.push(
        finding(
          `placeholder_case:${item.id}`,
          `${item.id} contains placeholder case or citation text.`,
          'BLOCKER',
          item.id,
        ),
      );
    }
  }

  const seenQuestionIds = new Set<string>();
  for (const question of draft.unansweredQuestions) {
    const text = typeof question === 'string' ? question : question.question;
    if (GENERIC_QUESTION.test(text.trim())) {
      findings.push(
        finding(
          'generic_unanswered_question',
          `Unanswered question "${text}" is generic; ask for a fact that changes a named issue or conclusion.`,
          'HIGH',
        ),
      );
    }
    if (typeof question !== 'string') {
      const structured = question as StructuredUnansweredQuestion;
      if (
        !structured.id.trim() ||
        seenQuestionIds.has(structured.id) ||
        !structured.whyItMatters.trim() ||
        !structured.suggestedSource?.trim() ||
        (!structured.affectedIssueId && !structured.affectedConclusion)
      ) {
        findings.push(
          finding(
            `invalid_question_contract:${structured.id || 'missing-id'}`,
            'Structured unanswered questions require a unique stable id, why-it-matters, expected answer type, and affected issue or conclusion.',
            'HIGH',
          ),
        );
      }
      seenQuestionIds.add(structured.id);
    }
  }

  const seenStepIds = new Set<string>();
  for (const step of draft.practicalSteps) {
    if (typeof step === 'string') {
      if (ACTION_REQUIRING_CONDITION.test(step) && !/\b(?:consider|if|subject to|after|once|where appropriate|through counsel)\b/i.test(step)) {
        findings.push(
          finding(
            'unconditional_legacy_step',
            `Practical step "${step}" directs a consequential action without a condition or safety framing.`,
          ),
        );
      }
      continue;
    }
    const structured = step as StructuredPracticalStep;
    const missingCore =
      !structured.id?.trim() ||
      seenStepIds.has(structured.id) ||
      !structured.timing?.trim() ||
      !structured.purpose?.trim() ||
      !Array.isArray(structured.evidenceNeeded) ||
      !structured.safeActionType;
    const unsafeUnconditional =
      ACTION_REQUIRING_CONDITION.test(structured.action) &&
      !structured.condition?.trim() &&
      !['PRESERVE_EVIDENCE', 'GATHER_INFORMATION', 'VERIFY_AUTHORITY', 'SEEK_LEGAL_ADVICE'].includes(
        structured.safeActionType,
      );
    if (missingCore || unsafeUnconditional) {
      findings.push(
        finding(
          `unsafe_or_incomplete_step:${structured.id || 'missing-id'}`,
          'Structured practical steps require id, timing, purpose, evidence, safe action type, dependencies where relevant, and a condition before consequential action.',
        ),
      );
    }
    seenStepIds.add(structured.id);
  }

  return findings;
}
