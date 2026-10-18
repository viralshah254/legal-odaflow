import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DraftWorkspaceV3, DraftSectionV3 } from '@prisma/client';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { AdversarialFinding } from './drafting.types';

/**
 * Adversarial Review Service — simulates hostile scrutiny of the draft.
 *
 * Two review perspectives:
 *   1. Opposing Counsel Review — attack arguments, procedural objections,
 *      weak evidence, surface overstatements.
 *   2. Judge Review — clarity, legal sufficiency, evidence support, remedy fit.
 *
 * In production these would call an LLM with a carefully engineered adversarial
 * system prompt.  The structured outlines below describe exactly what each
 * prompt would instruct the model to do, and the service runs a deterministic
 * baseline analysis that can be replaced or supplemented by LLM output.
 *
 * Only executes when workspace.riskLevel is 'high' or 'critical'.
 */
@Injectable()
export class AdversarialReviewService {
  private readonly logger = new Logger(AdversarialReviewService.name);

  constructor(@Optional() private readonly llm: LlmCompletionService | null) {}

  // ─── Opposing Counsel Review ──────────────────────────────────────────────

  /**
   * Simulates opposing counsel attacking the draft.
   *
   * LLM prompt (when integrated) would:
   *   SYSTEM: "You are a hostile, experienced opposing counsel reviewing a draft
   *   legal document. Your goal is to find every weakness that could be exploited
   *   in litigation. Identify: (1) procedural objections that could get this
   *   dismissed; (2) weak or missing evidence for each key argument;
   *   (3) overstatements or unsupported legal conclusions; (4) internal
   *   contradictions; (5) jurisdictional or standing challenges.
   *   For each issue provide severity (critical/major/minor) and a suggested
   *   repair."
   */
  async runOpposingCounselReview(
    workspace: DraftWorkspaceV3,
    sections: DraftSectionV3[],
  ): Promise<AdversarialFinding[]> {
    if (!this.shouldRunAdversarialReview(workspace)) {
      this.logger.log(
        `Skipping adversarial review for workspace ${workspace.id} (riskLevel=${workspace.riskLevel})`,
      );
      return [];
    }

    this.logger.log(`Running opposing counsel review for workspace ${workspace.id}`);

    // Run heuristic checks as baseline
    const findings: AdversarialFinding[] = [];

    for (const section of sections) {
      if (!section.content) continue;

      findings.push(...this.detectProceduralObjections(section, workspace));
      findings.push(...this.detectWeakEvidence(section));
      findings.push(...this.detectOverstatements(section));
      findings.push(...this.detectContradictions(section, sections));
    }

    findings.push(...this.checkMissingElements(sections, workspace));

    // Augment with LLM-based review when available
    if (this.llm) {
      const llmFindings = await this.runLlmOpposingCounselReview(workspace, sections);
      findings.push(...llmFindings);
    }

    return findings;
  }

  private async runLlmOpposingCounselReview(
    workspace: DraftWorkspaceV3,
    sections: DraftSectionV3[],
  ): Promise<AdversarialFinding[]> {
    const docText = sections
      .map((s) => `=== ${s.title} ===\n${s.content ?? ''}`)
      .join('\n\n');

    const systemPrompt = `You are a hostile, experienced opposing counsel reviewing a draft legal document.
Your goal is to find every weakness that could be exploited in litigation.
Identify:
1. Procedural objections that could get this dismissed
2. Weak or missing evidence for each key argument
3. Overstatements or unsupported legal conclusions
4. Internal contradictions
5. Jurisdictional or standing challenges

Respond ONLY with a JSON array of findings, each with:
{ "type": "procedural_objection"|"weak_evidence"|"contradiction"|"overstatement"|"missing_element"|"jurisdiction_issue",
  "severity": "critical"|"major"|"minor",
  "targetSection": "<section title or null>",
  "issue": "<description of the problem>",
  "suggestedRepair": "<specific suggested fix>" }

Return at most 8 findings. Focus on the most impactful ones.`;

    const userPrompt = `DOCUMENT TYPE: ${workspace.documentType ?? 'court document'}
JURISDICTION: ${workspace.jurisdiction ?? 'India'}

DOCUMENT CONTENT:
${docText.slice(0, 8000)}`;

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.6-sol',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 1500,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]) as Array<{
        type: string;
        severity: string;
        targetSection?: string;
        issue: string;
        suggestedRepair: string;
      }>;

      return raw.map((f) => ({
        id: randomUUID(),
        type: (f.type as AdversarialFinding['type']) ?? 'weak_evidence',
        severity: (f.severity as AdversarialFinding['severity']) ?? 'minor',
        targetSectionId: sections.find((s) => s.title === f.targetSection)?.id,
        issue: f.issue,
        suggestedRepair: f.suggestedRepair,
      }));
    } catch (err) {
      this.logger.warn(`LLM opposing counsel review failed: ${String(err)}`);
      return [];
    }
  }

  // ─── Judge Review ─────────────────────────────────────────────────────────

  /**
   * Simulates a judge reviewing the draft for legal sufficiency.
   *
   * LLM prompt (when integrated) would:
   *   SYSTEM: "You are an experienced judge reviewing a draft legal document
   *   for clarity, legal sufficiency, and appropriateness of relief. Assess:
   *   (1) Is the legal claim clearly and sufficiently pleaded?
   *   (2) Is the evidence foundation adequate for each assertion?
   *   (3) Is the remedy sought legally available and proportionate?
   *   (4) Are there ambiguities that require clarification?
   *   (5) Are citations accurate and the law correctly stated?
   *   Be objective. Categorise findings as: jurisdiction_issue,
   *   missing_element, weak_evidence, or overstatement."
   */
  async runJudgeReview(
    workspace: DraftWorkspaceV3,
    sections: DraftSectionV3[],
  ): Promise<AdversarialFinding[]> {
    if (!this.shouldRunAdversarialReview(workspace)) {
      return [];
    }

    this.logger.log(`Running judge review for workspace ${workspace.id}`);

    const findings: AdversarialFinding[] = [];

    findings.push(...this.assessClarity(sections));
    findings.push(...this.assessLegalSufficiency(sections, workspace));
    findings.push(...this.assessRemedyFit(sections, workspace));

    if (this.llm) {
      const llmFindings = await this.runLlmJudgeReview(workspace, sections);
      findings.push(...llmFindings);
    }

    return findings;
  }

  private async runLlmJudgeReview(
    workspace: DraftWorkspaceV3,
    sections: DraftSectionV3[],
  ): Promise<AdversarialFinding[]> {
    const docText = sections
      .map((s) => `=== ${s.title} ===\n${s.content ?? ''}`)
      .join('\n\n');

    const systemPrompt = `You are an experienced judge reviewing a draft legal document for legal sufficiency.
Assess:
1. Is the legal claim clearly and sufficiently pleaded?
2. Is the evidence foundation adequate for each assertion?
3. Is the remedy sought legally available and proportionate?
4. Are there ambiguities that require clarification?
5. Are citations accurate and the law correctly stated?

Respond ONLY with a JSON array of findings, each with:
{ "type": "procedural_objection"|"weak_evidence"|"contradiction"|"overstatement"|"missing_element"|"jurisdiction_issue",
  "severity": "critical"|"major"|"minor",
  "targetSection": "<section title or null>",
  "issue": "<description>",
  "suggestedRepair": "<specific suggested fix>" }

Return at most 6 findings. Be objective and focus on legal sufficiency.`;

    const userPrompt = `DOCUMENT TYPE: ${workspace.documentType ?? 'court document'}
JURISDICTION: ${workspace.jurisdiction ?? 'India'}

DOCUMENT:
${docText.slice(0, 8000)}`;

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.6-sol',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]) as Array<{
        type: string;
        severity: string;
        targetSection?: string;
        issue: string;
        suggestedRepair: string;
      }>;

      return raw.map((f) => ({
        id: randomUUID(),
        type: (f.type as AdversarialFinding['type']) ?? 'weak_evidence',
        severity: (f.severity as AdversarialFinding['severity']) ?? 'minor',
        targetSectionId: sections.find((s) => s.title === f.targetSection)?.id,
        issue: f.issue,
        suggestedRepair: f.suggestedRepair,
      }));
    } catch (err) {
      this.logger.warn(`LLM judge review failed: ${String(err)}`);
      return [];
    }
  }

  // ─── Guard ────────────────────────────────────────────────────────────────

  private shouldRunAdversarialReview(workspace: DraftWorkspaceV3): boolean {
    return workspace.riskLevel === 'high' || workspace.riskLevel === 'critical';
  }

  // ─── Opposing counsel sub-checks ─────────────────────────────────────────

  private detectProceduralObjections(
    section: DraftSectionV3,
    workspace: DraftWorkspaceV3,
  ): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];
    const content = section.content ?? '';

    // Missing cause of action pleading
    if (
      section.sectionType === 'legal_grounds' &&
      !/cause of action|right of action|actionable/i.test(content)
    ) {
      findings.push({
        id: randomUUID(),
        type: 'procedural_objection',
        severity: 'major',
        targetSectionId: section.id,
        issue:
          'The grounds section does not explicitly establish a cause of action. Opposing counsel will argue no actionable claim is disclosed.',
        suggestedRepair: 'Explicitly state the cause of action and the essential legal elements satisfied.',
      });
    }

    // No limitation period addressed
    if (
      section.sectionType === 'facts' &&
      !/limitation|time-barred|within time|section 3|article [0-9]/i.test(content)
    ) {
      findings.push({
        id: randomUUID(),
        type: 'procedural_objection',
        severity: 'minor',
        targetSectionId: section.id,
        issue:
          'The facts section does not address the limitation period. Opposing counsel may raise a time-bar objection.',
        suggestedRepair: 'Add a paragraph establishing the date the cause of action accrued and confirming the matter is within limitation.',
      });
    }

    // Jurisdiction not established
    if (
      section.sectionType === 'heading' &&
      !workspace.court &&
      !/jurisdiction/i.test(content)
    ) {
      findings.push({
        id: randomUUID(),
        type: 'jurisdiction_issue',
        severity: 'major',
        targetSectionId: section.id,
        issue: 'The court / forum with jurisdiction is not identified in the cause title.',
        suggestedRepair: 'Specify the court name and confirm territorial/pecuniary jurisdiction.',
      });
    }

    return findings;
  }

  private detectWeakEvidence(section: DraftSectionV3): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];
    const content = section.content ?? '';

    if (section.sectionType !== 'facts' && section.sectionType !== 'legal_grounds') {
      return findings;
    }

    // Assertions without support
    const unsupportedAssertions = [
      /it is well[ -]settled that/i,
      /it is obvious that/i,
      /clearly/i,
      /undoubtedly/i,
      /manifestly/i,
    ].filter((p) => p.test(content));

    if (unsupportedAssertions.length >= 2) {
      findings.push({
        id: randomUUID(),
        type: 'weak_evidence',
        severity: 'minor',
        targetSectionId: section.id,
        issue: `Section "${section.title}" uses ${unsupportedAssertions.length} conclusory assertion(s) without specific evidence support.`,
        suggestedRepair: 'Replace conclusory language with specific factual assertions backed by documentary evidence or authoritative citations.',
      });
    }

    // No citations in a grounds section
    if (section.sectionType === 'legal_grounds' && !/\d{4}.*\d+|AIR|SCC|SCR|\§\s*\d+/i.test(content)) {
      findings.push({
        id: randomUUID(),
        type: 'weak_evidence',
        severity: 'major',
        targetSectionId: section.id,
        issue: 'Legal grounds section appears to lack statutory or case law citations.',
        suggestedRepair: 'Add specific statutory provisions and precedent citations for every legal argument made.',
      });
    }

    return findings;
  }

  private detectOverstatements(section: DraftSectionV3): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];
    const content = section.content ?? '';

    const overstatementPatterns = [
      { pattern: /never.*any|never.*ever/i, label: 'absolute temporal claim ("never")' },
      { pattern: /all.*courts|every court/i, label: 'overbroad statement about all courts' },
      { pattern: /completely|entirely|absolutely/i, label: 'absolute qualifier' },
    ];

    for (const { pattern, label } of overstatementPatterns) {
      if (pattern.test(content)) {
        findings.push({
          id: randomUUID(),
          type: 'overstatement',
          severity: 'minor',
          targetSectionId: section.id,
          issue: `Section "${section.title}" contains a potential overstatement: ${label}.`,
          suggestedRepair: `Qualify the statement appropriately to avoid opposing counsel challenging it as an unsupported absolute claim.`,
        });
        break; // one finding per section to avoid noise
      }
    }

    return findings;
  }

  private detectContradictions(
    section: DraftSectionV3,
    allSections: DraftSectionV3[],
  ): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];
    const content = section.content ?? '';

    // Cross-section contradiction: check if facts section denies something that
    // the legal grounds section asserts (simple heuristic)
    if (section.sectionType === 'legal_grounds') {
      const factSection = allSections.find((s) => s.sectionType === 'facts');
      if (factSection?.content) {
        // If both sections use a date but they differ significantly, flag it
        const datesInGrounds = content.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g) ?? [];
        const datesInFacts = factSection.content.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g) ?? [];

        const groundsDateSet = new Set(datesInGrounds);
        const factDateSet = new Set(datesInFacts);
        const unmatchedGroundDates = datesInGrounds.filter((d) => !factDateSet.has(d));

        if (unmatchedGroundDates.length > 0 && datesInFacts.length > 0) {
          findings.push({
            id: randomUUID(),
            type: 'contradiction',
            severity: 'minor',
            targetSectionId: section.id,
            issue: `Dates in legal grounds (${unmatchedGroundDates.join(', ')}) do not appear in the facts section. Possible inconsistency.`,
            suggestedRepair: 'Ensure all dates referenced in legal arguments are grounded in the stated facts.',
          });
        }
      }
    }

    return findings;
  }

  private checkMissingElements(
    sections: DraftSectionV3[],
    workspace: DraftWorkspaceV3,
  ): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];
    const sectionTypes = new Set(sections.map((s) => s.sectionType));

    const requiredForCourtDoc = ['heading', 'parties', 'facts', 'legal_grounds', 'prayer', 'verification'];

    if (
      workspace.documentType === 'court_draft' ||
      workspace.documentType === 'pleading'
    ) {
      for (const required of requiredForCourtDoc) {
        if (!sectionTypes.has(required)) {
          findings.push({
            id: randomUUID(),
            type: 'missing_element',
            severity: 'critical',
            issue: `Required section "${required}" is missing from the court document.`,
            suggestedRepair: `Add a "${required}" section to complete the document structure.`,
          });
        }
      }
    }

    return findings;
  }

  // ─── Judge review sub-checks ──────────────────────────────────────────────

  private assessClarity(sections: DraftSectionV3[]): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];

    for (const section of sections) {
      const content = section.content ?? '';
      if (!content) continue;

      // Paragraphs longer than 600 words are likely to confuse a court
      const words = content.split(/\s+/).length;
      if (words > 600 && section.sectionType === 'legal_grounds') {
        findings.push({
          id: randomUUID(),
          type: 'overstatement',
          severity: 'minor',
          targetSectionId: section.id,
          issue: `Legal grounds section is very long (${words} words). Courts prefer concise, structured arguments.`,
          suggestedRepair: 'Break the section into numbered sub-arguments for each legal issue.',
        });
      }

      // Legalese overload — very long sentences
      const sentences = content.split(/[.!?]+/).filter(Boolean);
      const longSentences = sentences.filter((s) => s.split(/\s+/).length > 80);
      if (longSentences.length > 2) {
        findings.push({
          id: randomUUID(),
          type: 'overstatement',
          severity: 'minor',
          targetSectionId: section.id,
          issue: `Section "${section.title}" has ${longSentences.length} very long sentence(s) that may reduce clarity.`,
          suggestedRepair: 'Break long sentences into shorter, clearer statements.',
        });
        break;
      }
    }

    return findings;
  }

  private assessLegalSufficiency(
    sections: DraftSectionV3[],
    workspace: DraftWorkspaceV3,
  ): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];

    const groundsSection = sections.find((s) => s.sectionType === 'legal_grounds');
    if (!groundsSection?.content) {
      findings.push({
        id: randomUUID(),
        type: 'missing_element',
        severity: 'critical',
        issue: 'No legal grounds section found. The document does not establish legal basis for the claim.',
        suggestedRepair: 'Generate a comprehensive legal grounds section with applicable statutes and precedents.',
      });
      return findings;
    }

    // Check that at least one statutory reference exists
    const hasStatutoryRef = /section\s+\d+|article\s+\d+|schedule|act,?\s+\d{4}/i.test(
      groundsSection.content,
    );
    if (!hasStatutoryRef) {
      findings.push({
        id: randomUUID(),
        type: 'weak_evidence',
        severity: 'major',
        targetSectionId: groundsSection.id,
        issue: 'Legal grounds section does not cite any statute or legal provision.',
        suggestedRepair: 'Cite the specific statutory provisions that support each legal argument.',
      });
    }

    return findings;
  }

  private assessRemedyFit(
    sections: DraftSectionV3[],
    workspace: DraftWorkspaceV3,
  ): AdversarialFinding[] {
    const findings: AdversarialFinding[] = [];

    const prayerSection = sections.find((s) => s.sectionType === 'prayer');
    if (!prayerSection?.content) {
      findings.push({
        id: randomUUID(),
        type: 'missing_element',
        severity: 'critical',
        issue: 'No prayer section found. The document does not specify the relief sought.',
        suggestedRepair: 'Add a prayer section with specific, legally available reliefs.',
      });
      return findings;
    }

    // For contracts / letters, prayer does not apply — no issue
    if (workspace.documentType === 'contract' || workspace.documentType === 'letter') {
      return findings;
    }

    // Check remedy matches document type
    const content = prayerSection.content;
    const hasMonetaryRelief = /damages|compensation|award|sum of|₹|rs\.|inr/i.test(content);
    const hasDeclaratoryRelief = /declaration|declaratory|declare/i.test(content);
    const hasInjunction = /injunction|restrain|prohibit|stay/i.test(content);

    if (!hasMonetaryRelief && !hasDeclaratoryRelief && !hasInjunction) {
      findings.push({
        id: randomUUID(),
        type: 'missing_element',
        severity: 'major',
        targetSectionId: prayerSection.id,
        issue: 'Prayer section does not appear to specify a recognised category of legal relief (monetary, declaratory, or injunctive).',
        suggestedRepair: 'Ensure the prayer specifies one or more legally available remedies appropriate to the claim.',
      });
    }

    return findings;
  }
}
