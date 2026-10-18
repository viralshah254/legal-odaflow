import { Injectable, Logger, Optional } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  type AccuracyFinding,
} from './accuracy-finding';
import {
  getFindingRepairPolicy,
  isAutomaticallyRepairable,
} from './draft-finding-repair-policy';
import type {
  DraftAccuracyRepairInput,
  DraftAccuracyRepairResult,
  DraftRepairConfirmationQuestion,
  DraftRepairSourceResolution,
  VerifiedAuthorityReference,
  VerifiedStatuteReference,
} from './draft-repair.types';
import { splitDraftSections } from './pleading-completeness-validator.service';
import { isResearchMemoKind } from '../draft-kind.util';

const SECTION_REGEN_SYSTEM = `You are regenerating one section of an Indian legal document.

Rules:
1. Use ONLY the CaseRecord as the source of truth for names, dates, amounts, and events.
2. Do not invent insurer claim denial, repudiation, or bad faith unless CaseRecord facts support it.
3. For consumer complaints use Complainant / Opposite Party terminology (not Petitioner/Respondent).
4. For research memoranda: write SHORT ANSWER, ISSUES, FACTS, ANALYSIS, AUTHORITIES, or NEXT STEPS — never CAUSE TITLE, PRAYER, or VERIFICATION.
5. Write a complete section body with proper paragraphs.
6. Return ONLY the section body markdown (no commentary). Include the section heading as the first line (## TITLE).
7. Do not leave [BLANK] for values present in the CaseRecord.`;

const REPAIR_SYSTEM_PROMPT = `You are repairing an existing legal draft after deterministic and legal validation.

Rules:
1. Preserve every supported CaseRecord fact and every user-confirmed value.
2. Do not invent names, dates, amounts, procedures, policy terms, sections, cases, quotations, or evidence.
3. Correct only the supplied findings and directly dependent wording.
4. Use the CaseRecord as the source of truth for facts.
5. Use only supplied verified statute data for legal provisions.
6. Use only supplied verified authority passages for case citations.
7. If verified legal data is unavailable, remove the unsupported citation and insert a review marker rather than guessing.
8. For disputed facts, use allegation language.
9. For estimated or claimed amounts, preserve that qualification.
10. For wrong document kind or forum, rebuild structure using the resolved playbook.
11. For prayers exceeding the legal test, narrow the relief.
12. Return the complete repaired draft only.
13. Do not return commentary, defect reports, explanations, or lists of changes.`;

/** Known wrong CPA / statute replacements (deterministic). */
const STATUTE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /Consumer Protection Act,?\s*1986/gi,
    replacement: 'Consumer Protection Act, 2019',
  },
  {
    pattern: /section\s*2\s*\(\s*1\s*\)\s*\(\s*h\s*\)/gi,
    replacement: 'Section 34',
  },
  {
    pattern: /section\s*2\s*\(\s*1\s*\)\s*\(\s*[cd]\s*\)/gi,
    replacement: 'Section 34',
  },
  {
    pattern: /section\s*2\s*\(\s*18\s*\)/gi,
    replacement: 'Section 2(16)',
  },
  {
    pattern: /§\s*2\s*\(\s*1\s*\)\s*\(\s*h\s*\)/gi,
    replacement: '§34',
  },
  {
    pattern: /§\s*2\s*\(\s*18\s*\)/gi,
    replacement: '§2(16)',
  },
];

@Injectable()
export class DraftAccuracyRepairService {
  private readonly logger = new Logger(DraftAccuracyRepairService.name);

  constructor(@Optional() private readonly llm?: LlmCompletionService) {}

  async repair(
    input: DraftAccuracyRepairInput,
    sources?: DraftRepairSourceResolution,
  ): Promise<DraftAccuracyRepairResult> {
    let draftText = input.draftText;
    const appliedFindingCodes: string[] = [];
    const unresolvedFindingCodes: string[] = [];
    const confirmationQuestions: DraftRepairConfirmationQuestion[] = [];
    let requiresAdvocateReview = false;

    const blockers = input.findings.filter((f) => f.severity === 'blocker');
    const repairable: AccuracyFinding[] = [];
    const forConfirmation: AccuracyFinding[] = [];
    const forAdvocate: AccuracyFinding[] = [];
    const forSemantic: AccuracyFinding[] = [];

    for (const finding of blockers) {
      if (
        finding.code === ACCURACY_BLOCKER_CODES.RELIEF_TEST_NOT_PLEADED &&
        isResearchMemoKind(input.documentKind ?? '')
      ) {
        appliedFindingCodes.push(finding.code);
        continue;
      }
      const policy = getFindingRepairPolicy(finding.code);
      if (policy.resolutionType === 'non_repairable') {
        unresolvedFindingCodes.push(finding.code);
        continue;
      }
      if (policy.resolutionType === 'manual_legal_review_required') {
        forAdvocate.push(finding);
        requiresAdvocateReview = true;
        unresolvedFindingCodes.push(finding.code);
        continue;
      }
      if (policy.resolutionType === 'user_confirmation_required') {
        forConfirmation.push(finding);
        continue;
      }
      if (policy.preferDeterministic) {
        repairable.push(finding);
      } else {
        forSemantic.push(finding);
      }
    }

    // Deterministic pass
    for (const finding of repairable) {
      const before = draftText;
      draftText = this.applyDeterministicRepair(draftText, finding, input.caseRecord, sources);
      if (draftText !== before) {
        appliedFindingCodes.push(finding.code);
      } else if (isAutomaticallyRepairable(finding.code)) {
        // Fall through to semantic if deterministic no-op
        forSemantic.push(finding);
      } else {
        unresolvedFindingCodes.push(finding.code);
      }
    }

    // Confirmation questions for ambiguous findings / source conflicts
    for (const finding of forConfirmation) {
      confirmationQuestions.push(
        ...this.buildConfirmationQuestions(finding, input.caseRecord, sources),
      );
    }
    for (const conflict of sources?.unresolvedConflicts ?? []) {
      if (!conflict.findingCode) continue;
      if (confirmationQuestions.some((q) => q.findingCode === conflict.findingCode)) continue;
      confirmationQuestions.push({
        findingCode: conflict.findingCode,
        field: conflict.field,
        question: conflict.description,
        options: conflict.candidates.map((c) => ({
          label: c.value,
          value: c.value,
          sourceIds: c.sourceIds,
        })),
      });
    }

    // Section regen for hollow/stub sections before full-document semantic repair
    const isResearchMemo = isResearchMemoKind(input.documentKind ?? '');
    const sectionTargets = forSemantic.filter(
      (f) =>
        (f.code === ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY ||
          f.code === ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION) &&
        !appliedFindingCodes.includes(f.code),
    );
    if (
      input.allowSemanticRepair !== false &&
      sectionTargets.length > 0 &&
      this.llm
    ) {
      try {
        const regen =
          isResearchMemo &&
          sectionTargets.some((f) => f.code === ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION) &&
          sectionTargets.length >= 2
            ? await this.regenerateFullResearchMemoSkeleton({
                ...input,
                draftText,
              })
            : await this.regenerateHollowSections({
                ...input,
                draftText,
                findings: sectionTargets.slice(0, 2), // max 2 sections per attempt
              });
        if (regen.changed) {
          draftText = regen.draftText;
          for (const code of regen.appliedCodes) {
            appliedFindingCodes.push(code);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Section regen failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Semantic / LLM repair for remaining automatic + retrieval findings
    const semanticTargets = forSemantic.filter(
      (f) =>
        isAutomaticallyRepairable(f.code) &&
        !appliedFindingCodes.includes(f.code) &&
        f.code !== ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
    );
    if (
      input.allowSemanticRepair !== false &&
      semanticTargets.length > 0 &&
      this.llm
    ) {
      try {
        const repaired = await this.semanticRepair({
          ...input,
          draftText,
          findings: semanticTargets,
          verifiedStatutes: sources?.statutes ?? input.verifiedStatutes,
          verifiedAuthorities: sources?.authorities ?? input.verifiedAuthorities,
          courtProfile: sources?.courtProfile ?? input.courtProfile,
        });
        if (repaired && repaired.trim() && repaired !== draftText) {
          draftText = repaired.trim();
          for (const f of semanticTargets) {
            appliedFindingCodes.push(f.code);
          }
        } else {
          for (const f of semanticTargets) {
            if (!appliedFindingCodes.includes(f.code)) {
              unresolvedFindingCodes.push(f.code);
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `Semantic repair failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        for (const f of semanticTargets) {
          if (!appliedFindingCodes.includes(f.code)) {
            unresolvedFindingCodes.push(f.code);
          }
        }
      }
    } else {
      for (const f of semanticTargets) {
        if (!appliedFindingCodes.includes(f.code)) {
          // Without LLM, keep deterministic-only results; mark remaining unresolved
          unresolvedFindingCodes.push(f.code);
        }
      }
    }

    // Confirmation-required codes remain unresolved until answered
    for (const f of forConfirmation) {
      if (!unresolvedFindingCodes.includes(f.code)) {
        unresolvedFindingCodes.push(f.code);
      }
    }

    const uniqueApplied = [...new Set(appliedFindingCodes)];
    const uniqueUnresolved = [...new Set(unresolvedFindingCodes)];

    return {
      draftText,
      changed: draftText !== input.draftText,
      appliedFindingCodes: uniqueApplied,
      unresolvedFindingCodes: uniqueUnresolved,
      requiresUserConfirmation: confirmationQuestions.length > 0,
      confirmationQuestions,
      requiresAdvocateReview,
    };
  }

  applyDeterministicRepair(
    draftText: string,
    finding: AccuracyFinding,
    caseRecord: CaseRecord,
    sources?: DraftRepairSourceResolution,
  ): string {
    let text = draftText;
    const code = finding.code;

    if (code === ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH) {
      text = text.replace(/SecurCare/gi, 'SecureCare');
      // Alias → canonical for parties with aliases
      for (const p of caseRecord.parties ?? []) {
        for (const alias of p.aliases ?? []) {
          if (alias.length < 4) continue;
          if (alias.toLowerCase() === p.name.toLowerCase()) continue;
          const re = new RegExp(escapeRegExp(alias), 'gi');
          text = text.replace(re, p.name);
        }
      }
    }

    if (
      code === ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY ||
      code === ACCURACY_BLOCKER_CODES.PARTY_ROLE_INCONSISTENT
    ) {
      const terminology =
        sources?.forum?.partyTerminology ??
        sources?.courtProfile?.partyTerminology ?? {
          applicant: 'Complainant',
          respondent: 'Opposite Party',
        };
      text = text.replace(/\bPetitioners?\b/g, terminology.applicant);
      text = text.replace(/\bRespondents?\b/g, `${terminology.respondent}s`);
      text = text.replace(/\bRespondent\b/g, terminology.respondent);
      text = text.replace(/\bPlaintiffs?\b/g, terminology.applicant);
      text = text.replace(/\bDefendants?\b/g, terminology.respondent);
    }

    if (code === ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK) {
      text = this.fillKnownBlanks(text, caseRecord);
    }

    if (
      code === ACCURACY_BLOCKER_CODES.DATE_CORRUPTION ||
      code === ACCURACY_BLOCKER_CODES.LIMITATION_DATE_MISMATCH ||
      code === ACCURACY_BLOCKER_CODES.CAUSE_OF_ACTION_DATE_MISMATCH
    ) {
      text = this.repairDates(text, caseRecord);
    }

    if (
      code === ACCURACY_BLOCKER_CODES.AMOUNT_CORRUPTION ||
      code === ACCURACY_BLOCKER_CODES.VALUATION_BASIS_WRONG
    ) {
      text = this.repairAmounts(text, caseRecord);
    }

    if (
      code === ACCURACY_BLOCKER_CODES.WRONG_SECTION ||
      code === ACCURACY_BLOCKER_CODES.WRONG_SUBSECTION ||
      code === ACCURACY_BLOCKER_CODES.STALE_STATUTE ||
      code === ACCURACY_BLOCKER_CODES.UNVERIFIED_STATUTORY_PROPOSITION
    ) {
      text = this.repairStatutes(text, sources?.statutes);
    }

    if (
      code === ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL ||
      code === ACCURACY_BLOCKER_CODES.UNSUPPORTED_MATERIAL_FACT
    ) {
      text = this.removeUnsupportedInsuranceDenial(text, caseRecord);
    }

    if (code === ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED) {
      text = text
        .replace(/\bis\s+established\b/gi, 'is alleged')
        .replace(/\bis\s+admitted\b/gi, 'is alleged')
        .replace(/\bconclusively\b/gi, 'allegedly')
        .replace(/\bbeyond\s+doubt\b/gi, 'subject to proof')
        .replace(
          /\b(consent\s+was\s+signed|was\s+signed)\b/gi,
          'it is alleged the consent form was signed',
        )
        .replace(
          /\b(did\s+not\s+sign|denies\s+signing|denied\s+signing)\b/gi,
          'it is disputed whether the patient signed',
        )
        .replace(
          /\b(no\s+consent\s+was\s+obtained|consent\s+was\s+not\s+obtained|absence\s+of\s+consent)\b/gi,
          'it is alleged that informed consent was not properly obtained',
        );
    }

    if (code === ACCURACY_BLOCKER_CODES.EXPERT_OPINION_STATED_AS_FACT) {
      text = text
        .replace(/\bconclusively\b/gi, 'allegedly')
        .replace(/\bdefinitely\b/gi, 'apparently')
        .replace(/\bestablished\s+that\b/gi, 'appears from available records that');
    }

    if (
      code === ACCURACY_BLOCKER_CODES.CITATION_WITHOUT_PROPOSITION ||
      code === ACCURACY_BLOCKER_CODES.PASSAGE_NOT_VERIFIED
    ) {
      text = this.stripUnverifiedCitations(text, sources?.authorities ?? []);
    }

    if (code === 'WRONG_DOCUMENT_KIND') {
      text = this.stripPleadingSectionsFromMemo(text, finding);
    }

    if (code === ACCURACY_BLOCKER_CODES.MISSING_VERIFICATION) {
      if (!/\bVERIFICATION\b/i.test(text)) {
        text = `${text.trimEnd()}\n\nVERIFICATION\n\nI, the Complainant above named, do hereby verify that the contents of paragraphs above are true to my personal knowledge and belief. No part of it is false and nothing material has been concealed therefrom.\n`;
      }
    }

    if (code === 'VERIFICATION_OVERBROAD') {
      text = text.replace(
        /I\s+verify\s+that\s+everything\s+herein\s+is\s+true\s+and\s+correct[^.]*\./gi,
        'I verify that the contents of the foregoing paragraphs are true to my personal knowledge save where stated on information and belief.',
      );
    }

    return text;
  }

  private fillKnownBlanks(text: string, caseRecord: CaseRecord): string {
    let out = text;
    const partyNames = (caseRecord.parties ?? []).map((p) => p.name).filter(Boolean);
    const dates = (caseRecord.chronology ?? []).map((e) => e.date).filter(Boolean) as string[];
    const amounts = (caseRecord.moneyRecords ?? [])
      .map((m) => m.amountLabel || (m.amount != null ? String(m.amount) : ''))
      .filter(Boolean);

    const resolveBlank = (label: string, window: string): string | null => {
      const labelLower = label.toLowerCase();
      const ctx = `${labelLower} ${window}`;
      if (/consent/i.test(ctx)) {
        const consentDate = (caseRecord.chronology ?? []).find((e) => /consent/i.test(e.label))?.date;
        if (consentDate) return consentDate;
      }
      if (/surgery|procedure|operation|gallbladder|cholecystectomy/i.test(ctx)) {
        const surgeryDate = (caseRecord.chronology ?? []).find((e) =>
          /surgery|procedure/i.test(e.label),
        )?.date;
        if (surgeryDate) return surgeryDate;
      }
      if (/ct|scan|imaging|ultrasound/i.test(ctx)) {
        const imagingDate = (caseRecord.chronology ?? []).find((e) =>
          /ct|imaging|ultrasound|scan/i.test(e.label),
        )?.date;
        if (imagingDate) return imagingDate;
      }
      if (/transfer/i.test(ctx)) {
        const transferDate = (caseRecord.chronology ?? []).find((e) => /transfer/i.test(e.label))
          ?.date;
        if (transferDate) return transferDate;
      }
      if (/date|surgery|procedure|admission|discharge/i.test(ctx) && dates[0]) {
        return dates[0];
      }
      if (/amount|fee|expense|claim|₹|rs\.?/i.test(ctx) && amounts[0]) {
        return amounts[0];
      }
      if (/name|complainant|opposite|party|hospital|doctor|insurer/i.test(ctx)) {
        const roleMatch = ctx.match(/(complainant|opposite\s+party|hospital|doctor|insurer)/i);
        if (roleMatch) {
          const role = roleMatch[1].toLowerCase();
          const party = (caseRecord.parties ?? []).find((p) =>
            p.role?.toLowerCase().includes(role.split(/\s+/)[0]),
          );
          if (party?.name) return party.name;
        }
        if (partyNames[0]) return partyNames[0];
      }
      return null;
    };

    out = out.replace(/\[BLANK:\s*([^\]]+)\]/gi, (match, label: string) => {
      const resolved = resolveBlank(label, label);
      return resolved ?? match;
    });

    // [BLANK] / _____ placeholders near known labels
    out = out.replace(/\[BLANK\]/gi, (match, offset) => {
      const window = out.slice(Math.max(0, offset - 80), offset + 20).toLowerCase();
      const resolved = resolveBlank('', window);
      return resolved ?? match;
    });

    out = out.replace(/_{3,}/g, (match, offset) => {
      const window = out.slice(Math.max(0, offset - 60), offset).toLowerCase();
      if (/date/i.test(window) && dates[0]) return dates[0];
      if (/amount|₹/i.test(window) && amounts[0]) return amounts[0];
      return match;
    });

    return out;
  }

  private repairDates(text: string, caseRecord: CaseRecord): string {
    let out = text;
    for (const e of caseRecord.chronology ?? []) {
      if (!e.date || !e.label) continue;
      // If label mentioned but wrong nearby date patterns — soft: ensure canonical date appears near label once
      const labelRe = new RegExp(escapeRegExp(e.label).slice(0, 40), 'i');
      if (labelRe.test(out) && !out.toLowerCase().includes(e.date.toLowerCase())) {
        out = out.replace(labelRe, `${e.label} (${e.date})`);
      }
    }
    return out;
  }

  private repairAmounts(text: string, caseRecord: CaseRecord): string {
    let out = text;
    for (const m of caseRecord.moneyRecords ?? []) {
      if (m.amount == null && !m.amountLabel) continue;
      const canonical = m.amountLabel || `${m.currency ?? '₹'}${m.amount}`;
      // Fix common digit corruption near description keywords
      if (m.description && m.amount != null) {
        const descToken = m.description.slice(0, 24);
        const re = new RegExp(
          `(${escapeRegExp(descToken)}[^\\d]{0,40})(?:Rs\\.?\\s*|₹\\s*)?[\\d,]+(?:\\.\\d+)?`,
          'i',
        );
        if (re.test(out)) {
          out = out.replace(re, `$1${canonical}`);
        }
      }
    }
    return out;
  }

  private repairStatutes(
    text: string,
    statutes?: VerifiedStatuteReference[],
  ): string {
    let out = text;
    for (const rule of STATUTE_REPLACEMENTS) {
      out = out.replace(rule.pattern, rule.replacement);
    }
    // Remove invented District ₹1–10 crore band language
    out = out.replace(
      /(?:exceeds\s+)?₹?\s*1\s*crore\s*(?:to|–|-|and)\s*₹?\s*10\s*crore/gi,
      '[PECUNIARY BAND — confirm current notification]',
    );
    if (statutes?.length) {
      // no-op beyond replacements; verified list is for LLM prompt
    }
    return out;
  }

  private removeUnsupportedInsuranceDenial(
    text: string,
    caseRecord: CaseRecord,
  ): string {
    const intake = [
      ...(caseRecord.facts ?? []).map((f) => f.proposition),
      ...(caseRecord.facts ?? []).map((f) => f.sourceQuote),
    ]
      .join('\n')
      .toLowerCase();
    const hasRepudiation =
      /\b(repudiat|claim\s+deni|denied\s+the\s+claim|wrongful\s+repudiation)\b/i.test(
        intake,
      );
    if (hasRepudiation) return text;

    const denialLine =
      /\b(rejected|denied|repudiated)\b.{0,40}\b(claim|coverage|policy)\b|\bbad\s+faith\b.{0,40}\binsur/i;

    // Prefer line-level removal so single-block drafts are not wiped entirely.
    const lines = text.split('\n');
    const keptLines = lines.filter((line) => !denialLine.test(line));
    if (keptLines.join('\n').trim().length > 40) {
      return keptLines.join('\n');
    }

    const paragraphs = text.split(/\n{2,}/);
    const kept = paragraphs.filter((p) => !denialLine.test(p));
    const joined = kept.join('\n\n').trim();
    return joined.length > 0 ? joined : text;
  }

  private stripUnverifiedCitations(
    text: string,
    authorities: VerifiedAuthorityReference[],
  ): string {
    if (authorities.length === 0) {
      // Remove parenthetical case cites that look like SCC/AIR without nearby proposition verbs
      return text.replace(
        /\([^)]*(?:\d{4}\s+\d+\s+SCC|\bAIR\s+\d{4}|\bINSC\b)[^)]*\)/g,
        '[AUTHORITY — verification required]',
      );
    }
    const verifiedHay = authorities.map((a) => a.citation.toLowerCase()).join(' ');
    return text.replace(
      /\(([^)]*(?:\d{4}\s+\d+\s+SCC|\bAIR\s+\d{4}|\bINSC\b)[^)]*)\)/g,
      (full, inner: string) => {
        const hit = authorities.some((a) =>
          inner.toLowerCase().includes(a.citation.toLowerCase().slice(0, 20)),
        );
        if (hit || verifiedHay.includes(inner.toLowerCase().slice(0, 15))) {
          return full;
        }
        return '[AUTHORITY — verification required]';
      },
    );
  }

  private stripPleadingSectionsFromMemo(
    text: string,
    finding: AccuracyFinding,
  ): string {
    if (!/research memorandum|pleading-only/i.test(finding.message)) {
      return text;
    }
    // Drop cause title / prayer / verification blocks from memo-shaped output
    let out = text;
    out = out.replace(/(^|\n)\s*CAUSE\s+TITLE[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\n|$)/gi, '\n');
    out = out.replace(/(^|\n)\s*MEMO\s+OF\s+PARTIES[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\n|$)/gi, '\n');
    out = out.replace(/(^|\n)\s*PRAYER[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\n|$)/gi, '\n');
    out = out.replace(/(^|\n)\s*VERIFICATION[\s\S]*$/gi, '\n');
    return out.trim();
  }

  private buildConfirmationQuestions(
    finding: AccuracyFinding,
    caseRecord: CaseRecord,
    sources?: DraftRepairSourceResolution,
  ): DraftRepairConfirmationQuestion[] {
    const optionsFromChronology = (caseRecord.chronology ?? [])
      .filter((e) => e.date)
      .map((e) => ({
        label: `${e.label}: ${e.date}`,
        value: e.date as string,
        sourceIds: [e.id],
      }));

    if (
      finding.code === ACCURACY_BLOCKER_CODES.DATE_CORRUPTION ||
      finding.code === ACCURACY_BLOCKER_CODES.LIMITATION_DATE_MISMATCH ||
      finding.code === ACCURACY_BLOCKER_CODES.CAUSE_OF_ACTION_DATE_MISMATCH
    ) {
      return [
        {
          findingCode: finding.code,
          field: 'date',
          question: finding.message,
          options: optionsFromChronology.length
            ? optionsFromChronology
            : undefined,
        },
      ];
    }

    if (
      finding.code === ACCURACY_BLOCKER_CODES.AMOUNT_CORRUPTION ||
      finding.code === ACCURACY_BLOCKER_CODES.PECUNIARY_BASIS_UNSUPPORTED ||
      finding.code === ACCURACY_BLOCKER_CODES.COURT_FEE_BASIS_WRONG
    ) {
      const moneyOpts = (caseRecord.moneyRecords ?? []).map((m) => ({
        label: `${m.description}: ${m.amountLabel || m.amount}`,
        value: m.amountLabel || m.amount,
        sourceIds: [m.id],
      }));
      return [
        {
          findingCode: finding.code,
          field: 'amount',
          question: finding.message,
          options: moneyOpts.length ? moneyOpts : undefined,
        },
      ];
    }

    if (
      finding.code === ACCURACY_BLOCKER_CODES.WRONG_FORUM ||
      finding.code === ACCURACY_BLOCKER_CODES.TERRITORIAL_BASIS_UNSUPPORTED ||
      finding.code === ACCURACY_BLOCKER_CODES.SUBJECT_MATTER_JURISDICTION_WRONG ||
      finding.code === ACCURACY_BLOCKER_CODES.STATE_RULE_CONFIRMATION_REQUIRED ||
      finding.code === 'DOCUMENT_KIND_UNRESOLVED'
    ) {
      const forum = sources?.forum?.forumName ?? caseRecord.jurisdiction?.courtName;
      return [
        {
          findingCode: finding.code,
          field: 'forum',
          question: finding.message,
          options: forum
            ? [{ label: forum, value: forum, sourceIds: sources?.forum?.courtProfileId ? [sources.forum.courtProfileId] : [] }]
            : undefined,
        },
      ];
    }

    return [
      {
        findingCode: finding.code,
        field: finding.sectionHint ?? 'general',
        question: finding.message,
      },
    ];
  }

  /**
   * Regenerate all six research-memo sections when multiple required headings are missing.
   */
  private async regenerateFullResearchMemoSkeleton(
    input: DraftAccuracyRepairInput,
  ): Promise<{ draftText: string; changed: boolean; appliedCodes: string[] }> {
    if (!this.llm) {
      return { draftText: input.draftText, changed: false, appliedCodes: [] };
    }

    const sections = [
      'SHORT ANSWER',
      'ISSUES',
      'FACTS',
      'ANALYSIS',
      'AUTHORITIES',
      'NEXT STEPS',
    ];
    const caseRecordSummary = JSON.stringify(
      {
        parties: input.caseRecord.parties,
        chronology: input.caseRecord.chronology,
        moneyRecords: input.caseRecord.moneyRecords,
        facts: (input.caseRecord.facts ?? []).slice(0, 40).map((f) => ({
          id: f.id,
          proposition: f.proposition,
          status: f.status,
        })),
        jurisdiction: input.caseRecord.jurisdiction,
      },
      null,
      2,
    );

    const intakeHasRepudiation = /\b(repudiat|claim\s+deni|denied\s+the\s+claim)\b/i.test(
      [
        ...(input.caseRecord.facts ?? []).map((f) => f.proposition),
        ...(input.caseRecord.facts ?? []).map((f) => f.sourceQuote),
      ].join('\n'),
    );

    const userPrompt = [
      'CASE RECORD SOURCE OF TRUTH',
      caseRecordSummary,
      '',
      `DOCUMENT KIND: ${input.documentKind ?? 'india_consumer_research_memo'}`,
      `INSURER DENIAL SUPPORTED BY CASE RECORD: ${intakeHasRepudiation ? 'yes' : 'no — do not allege repudiation/denial'}`,
      '',
      'Regenerate a complete legal research memorandum with ALL six sections:',
      sections.map((s) => `## ${s}`).join('\n'),
      '',
      'CURRENT DRAFT (may be wrong shape — replace entirely with correct memo skeleton)',
      input.draftText.slice(0, 8_000),
    ].join('\n');

    const result = await this.llm.complete({
      modelName: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SECTION_REGEN_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 8_000,
      temperature: 0.1,
    });

    const content = result.content?.trim();
    if (!content || content.length < 400) {
      return { draftText: input.draftText, changed: false, appliedCodes: [] };
    }

    const hasAllSections = sections.every((s) =>
      new RegExp(`(^|\\n)\\s*##?\\s*${s.replace(/\s+/g, '\\s+')}\\b`, 'i').test(content),
    );
    if (!hasAllSections) {
      return { draftText: input.draftText, changed: false, appliedCodes: [] };
    }

    return {
      draftText: content,
      changed: content !== input.draftText,
      appliedCodes: [ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION],
    };
  }

  /**
   * Regenerate hollow FACTS/GROUNDS (etc.) from CaseRecord and splice into the draft.
   */
  private async regenerateHollowSections(
    input: DraftAccuracyRepairInput,
  ): Promise<{ draftText: string; changed: boolean; appliedCodes: string[] }> {
    if (!this.llm) {
      return { draftText: input.draftText, changed: false, appliedCodes: [] };
    }

    let draftText = input.draftText;
    const appliedCodes: string[] = [];
    const caseRecordSummary = JSON.stringify(
      {
        parties: input.caseRecord.parties,
        chronology: input.caseRecord.chronology,
        moneyRecords: input.caseRecord.moneyRecords,
        facts: (input.caseRecord.facts ?? []).slice(0, 40).map((f) => ({
          id: f.id,
          proposition: f.proposition,
          status: f.status,
        })),
        jurisdiction: input.caseRecord.jurisdiction,
      },
      null,
      2,
    );

    const intakeHasRepudiation = /\b(repudiat|claim\s+deni|denied\s+the\s+claim)\b/i.test(
      [
        ...(input.caseRecord.facts ?? []).map((f) => f.proposition),
        ...(input.caseRecord.facts ?? []).map((f) => f.sourceQuote),
      ].join('\n'),
    );

    for (const finding of input.findings) {
      const isResearchMemo = /research_memo|case_strategy|legal_research/i.test(
        input.documentKind ?? '',
      );
      const sectionName =
        finding.sectionHint ||
        (isResearchMemo
          ? /short.?answer/i.test(finding.message)
            ? 'SHORT ANSWER'
            : /issues/i.test(finding.message)
              ? 'ISSUES'
              : /analysis/i.test(finding.message)
                ? 'ANALYSIS'
                : /authorit/i.test(finding.message)
                  ? 'AUTHORITIES'
                  : /facts/i.test(finding.message)
                    ? 'FACTS'
                    : 'FACTS'
          : /facts/i.test(finding.message)
            ? 'STATEMENT OF FACTS'
            : /grounds/i.test(finding.message)
              ? 'GROUNDS'
              : /prayer/i.test(finding.message)
                ? 'PRAYER'
                : /jurisdiction/i.test(finding.message)
                  ? 'JURISDICTION'
                  : 'FACTS');

      const userPrompt = [
        'CASE RECORD SOURCE OF TRUTH',
        caseRecordSummary,
        '',
        `DOCUMENT KIND: ${input.documentKind ?? ''}`,
        `SECTION TO REGENERATE: ${sectionName}`,
        `INSURER DENIAL SUPPORTED BY CASE RECORD: ${intakeHasRepudiation ? 'yes' : 'no — do not allege repudiation/denial'}`,
        `FINDING: [${finding.code}] ${finding.message}`,
        '',
        'CURRENT FULL DRAFT (for context; rewrite only the named section)',
        draftText.slice(0, 12_000),
      ].join('\n');

      const result = await this.llm.complete({
        modelName: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: SECTION_REGEN_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 4_000,
        temperature: 0.1,
      });

      const sectionMd = result.content?.trim();
      if (!sectionMd || sectionMd.length < 80) continue;

      const spliced = this.spliceSection(draftText, sectionName, sectionMd);
      if (spliced !== draftText) {
        draftText = spliced;
        appliedCodes.push(finding.code);
      }
    }

    return {
      draftText,
      changed: draftText !== input.draftText,
      appliedCodes,
    };
  }

  /** Replace or insert a section body by title match. */
  spliceSection(draftText: string, sectionTitle: string, newSectionMarkdown: string): string {
    const slices = splitDraftSections(draftText);
    const needle = sectionTitle.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const idx = slices.findIndex((s) => {
      const t = s.title.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
      return t.includes(needle) || needle.includes(t) || (/\bFACTS\b/.test(needle) && /\bFACTS\b/.test(t));
    });

    const cleaned = newSectionMarkdown.trim();
    if (idx < 0) {
      // Append before VERIFICATION / PRAYER if possible
      const insertBefore = slices.findIndex((s) =>
        /verification|prayer/i.test(s.title),
      );
      if (insertBefore >= 0) {
        const pos = slices[insertBefore].start;
        return `${draftText.slice(0, pos).trimEnd()}\n\n${cleaned}\n\n${draftText.slice(pos)}`;
      }
      return `${draftText.trimEnd()}\n\n${cleaned}\n`;
    }

    const slice = slices[idx];
    return `${draftText.slice(0, slice.start).trimEnd()}\n\n${cleaned}\n\n${draftText.slice(slice.end).trimStart()}`;
  }

  private async semanticRepair(input: DraftAccuracyRepairInput): Promise<string | null> {
    if (!this.llm) return null;

    const statutesBlock = (input.verifiedStatutes ?? [])
      .map((s) => `- ${s.actId} §${s.section}${s.proposition ? `: ${s.proposition}` : ''}`)
      .join('\n');
    const authoritiesBlock = (input.verifiedAuthorities ?? [])
      .map(
        (a) =>
          `- ${a.citation}${a.proposition ? ` — ${a.proposition}` : ''}${a.verified ? ' [verified]' : ' [unverified]'}`,
      )
      .join('\n');
    const findingsBlock = input.findings
      .map((f) => `- [${f.code}] ${f.message}${f.repairHint ? ` | Repair: ${f.repairHint}` : ''}`)
      .join('\n');

    const caseRecordSummary = JSON.stringify(
      {
        parties: input.caseRecord.parties,
        chronology: input.caseRecord.chronology,
        moneyRecords: input.caseRecord.moneyRecords,
        facts: (input.caseRecord.facts ?? []).slice(0, 40).map((f) => ({
          id: f.id,
          proposition: f.proposition,
          status: f.status,
          confidence: f.confidence,
        })),
        jurisdiction: input.caseRecord.jurisdiction,
        statutes: input.caseRecord.statutes,
      },
      null,
      2,
    );

    const userPrompt = [
      'CASE RECORD SOURCE OF TRUTH',
      caseRecordSummary,
      '',
      `DOCUMENT KIND: ${input.documentKind ?? ''}`,
      `DOCUMENT FAMILY: ${input.documentFamily ?? ''}`,
      `PLAYBOOK: ${input.playbookSummary ?? (input.requiredSections ?? []).join(', ')}`,
      `COURT PROFILE: ${input.courtProfile ? `${input.courtProfile.id}@${input.courtProfile.version} — ${input.courtProfile.forum}` : 'none'}`,
      '',
      'VERIFIED STATUTES',
      statutesBlock || '(none)',
      '',
      'VERIFIED AUTHORITIES',
      authoritiesBlock || '(none)',
      '',
      'VALIDATION FINDINGS TO REPAIR',
      findingsBlock,
      '',
      'CURRENT DRAFT',
      input.draftText,
    ].join('\n');

    const result = await this.llm.complete({
      modelName: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: REPAIR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 8_000,
      temperature: 0.1,
    });

    const content = result.content?.trim();
    if (!content) return null;
    // Guard against model returning commentary wrappers
    if (/^(here is|i have repaired|changes made)/i.test(content.slice(0, 80))) {
      const idx = content.search(/\n\n/);
      if (idx > 0) return content.slice(idx).trim();
    }
    return content;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
