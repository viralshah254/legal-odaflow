import { Injectable, Logger } from '@nestjs/common';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import { buildIssueFingerprint, type DraftIssue } from '../contracts/draft-issue';
import { evaluateCommercialSummarySuitProcedure } from '@/ai/drafting/commercial-summary-suit-procedure';

export interface ProceduralGateResult {
  status: 'pass' | 'pass_with_warnings' | 'blocked';
  issues: DraftIssue[];
  proceduralProfile: {
    forum?: string;
    limitation?: string;
    governingProcedure?: string[];
    mandatoryNotices?: string[];
  };
}

/**
 * Unified Procedural Gate — deterministic only, no LLM.
 *
 * Merges the logic from:
 *   - DraftProceduralGateService (india-draft path)
 *   - ProceduralGateService (v3 platform path)
 *
 * Never spends LLM tokens on a blocked matter.
 */
@Injectable()
export class UnifiedProceduralGateService {
  private readonly logger = new Logger(UnifiedProceduralGateService.name);

  async check(matter: NormalizedMatter): Promise<ProceduralGateResult> {
    const issues: DraftIssue[] = [];

    // 1. Mandatory party checks
    this.checkParties(matter, issues);

    // 2. Forum / court checks
    this.checkForum(matter, issues);
    this.checkCommercialSummarySuit(matter, issues);

    // 3. Limitation period signals
    this.checkLimitation(matter, issues);

    // 4. Standing
    this.checkStanding(matter, issues);

    // 5. IPR-specific forum and jurisdiction checks
    this.checkIprForum(matter, issues);
    this.checkIprJurisdiction(matter, issues);

    // 5. Mandatory prior notice checks
    const mandatoryNotices = this.getMandatoryNotices(matter.documentKind);

    // Forward missing blocking inputs as critical issues — but allow drafting
    // to proceed with [BLANK] placeholders for forum / address / case-number fields.
    const draftPlaceholderFields = /court|forum|address|case.?number|index|pin/i;
    for (const missing of matter.missingInputs.filter((m) => m.blocking)) {
      if (draftPlaceholderFields.test(missing.field)) continue;
      issues.push({
        id: '',
        category: 'missing_input',
        severity: 'critical',
        message: `Required input missing: ${missing.description}`,
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('missing_input', undefined, missing.field, undefined),
      });
    }

    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasHigh = issues.some((i) => i.severity === 'high');

    const status: ProceduralGateResult['status'] = hasCritical
      ? 'blocked'
      : hasHigh
        ? 'pass_with_warnings'
        : issues.length > 0
          ? 'pass_with_warnings'
          : 'pass';

    if (hasCritical) {
      this.logger.warn(`Procedural gate BLOCKED for ${matter.documentKind}: ${issues.filter((i) => i.severity === 'critical').map((i) => i.message).join('; ')}`);
    }

    return {
      status,
      issues,
      proceduralProfile: {
        forum: matter.court?.name,
        governingProcedure: this.getGoverningProcedure(matter.documentKind, matter.jurisdiction),
        mandatoryNotices,
      },
    };
  }

  private checkParties(matter: NormalizedMatter, issues: DraftIssue[]): void {
    const missingFields = new Set(
      matter.missingInputs.map((m) => m.field.toLowerCase().replace(/\s+/g, '_')),
    );
    if (missingFields.has('petitioner_name') || missingFields.has('respondent_name')) {
      return;
    }

    const petitionerRoles = new Set([
      'petitioner', 'plaintiff', 'appellant', 'applicant', 'accused',
      'husband', 'wife', 'claimant', 'complainant',
    ]);
    const respondentRoles = new Set([
      'respondent', 'defendant', 'opposite_party', 'opposite party',
      'husband', 'wife',
    ]);

    const hasPetitioner = matter.parties.some((p) =>
      petitionerRoles.has(p.role.toLowerCase().replace(/\s+/g, '_')),
    );
    const hasRespondent = matter.parties.some((p) =>
      respondentRoles.has(p.role.toLowerCase().replace(/\s+/g, '_')),
    );

    // Also accept named parties extracted into facts when roles were not tagged.
    const hasNamedPartiesInFacts = matter.parties.length >= 2
      || (matter.parties.length === 1 && matter.facts.length > 0);

    if (!hasPetitioner && !hasNamedPartiesInFacts && matter.parties.length === 0) {
      issues.push({
        id: '',
        category: 'missing_input',
        severity: 'critical',
        message: 'No petitioner / applicant identified — add the applicant name or name the parties in your facts',
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('missing_input', undefined, 'no_petitioner', undefined),
      });
    }

    const kind = matter.documentKind.toLowerCase();
    const needsRespondent = !/^notice|^letter|^affidavit|^declaration/i.test(kind);
    if (needsRespondent && !hasRespondent && matter.parties.length < 2 && matter.facts.length === 0) {
      issues.push({
        id: '',
        category: 'missing_input',
        severity: 'high',
        message: 'No respondent / defendant identified — add the opposing party or name them in your facts',
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('missing_input', undefined, 'no_respondent', undefined),
      });
    }
  }

  private checkForum(matter: NormalizedMatter, issues: DraftIssue[]): void {
    if (!matter.court) {
      const isNoticeKind = /notice|letter|agreement|contract/i.test(matter.documentKind);
      if (!isNoticeKind) {
        issues.push({
          id: '',
          category: 'procedure',
          severity: 'high',
          message: 'Court or forum not specified — required for filing',
          repairableAutomatically: false,
          validator: 'UnifiedProceduralGateService',
          fingerprint: buildIssueFingerprint('procedure', undefined, 'no_forum', undefined),
        });
      }
    }
  }

  private checkLimitation(matter: NormalizedMatter, issues: DraftIssue[]): void {
    // Signal if no date context provided for types where limitation is critical
    const limitationSensitive = /bail|maintenance|revision|appeal|writ|cheque|dishonour|suit_recovery_cpc_37/i.test(matter.documentKind);
    if (limitationSensitive && matter.dates.length === 0 && matter.facts.filter((f) => f.date).length === 0) {
      issues.push({
        id: '',
        category: 'procedure',
        severity: 'medium',
        message: 'No dates found in facts — limitation period cannot be confirmed',
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('procedure', undefined, 'no_dates_for_limitation', undefined),
      });
    }
  }

  private checkStanding(matter: NormalizedMatter, issues: DraftIssue[]): void {
    const isPIL = /PIL|public interest/i.test(matter.documentKind);
    if (isPIL && !matter.facts.some((f) => /public interest|affected person|locus/i.test(f.statement))) {
      issues.push({
        id: '',
        category: 'procedure',
        severity: 'medium',
        message: 'PIL detected — locus standi basis not found in facts',
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('procedure', undefined, 'pil_no_standing', undefined),
      });
    }
  }

  private isCommercialSummarySuit(documentKind: string): boolean {
    return documentKind === 'india_suit_recovery_cpc_37';
  }

  private checkCommercialSummarySuit(matter: NormalizedMatter, issues: DraftIssue[]): void {
    if (!this.isCommercialSummarySuit(matter.documentKind)) return;

    const factsText = [
      matter.rawUserInput,
      ...matter.facts.map((fact) => fact.statement),
      ...matter.proceduralHistory.map((event) => event.description),
      ...matter.requestedRelief.map((relief) => relief.description),
    ].join(' ');
    const result = evaluateCommercialSummarySuitProcedure({
      kind: matter.documentKind,
      facts: factsText,
      courtName: matter.court?.name,
    });
    for (const issue of result.issues) {
      issues.push({
        id: '',
        category: 'procedure',
        severity: issue.severity,
        message: issue.message,
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint(
          'procedure',
          undefined,
          issue.field,
          undefined,
        ),
      });
    }
  }

  private getMandatoryNotices(documentKind: string): string[] {
    const notices: string[] = [];
    if (/cheque|dishonour|ni_act|section_138/i.test(documentKind)) {
      notices.push('Statutory demand notice under Section 138 NI Act (within 30 days of dishonour)');
    }
    if (/consumer|consumer_complaint/i.test(documentKind)) {
      notices.push('Pre-litigation notice to opposite party (recommended)');
    }
    if (/specific_performance|breach_of_contract/i.test(documentKind)) {
      notices.push('Legal notice of breach (recommended before suit)');
    }
    if (this.isCommercialSummarySuit(documentKind)) {
      notices.push(
        'Section 12A, Commercial Courts Act 2015: Pre-institution mediation is mandatory unless the plaint genuinely contemplates urgent interim relief supported by concrete pleaded facts.',
      );
    }
    if (/trademark|trade.?mark|passing.?off|ipr|intellectual.?property/i.test(documentKind)) {
      notices.push(
        'Section 12A, Commercial Courts Act 2015: Pre-institution mediation is mandatory for trademark suits ' +
        'unless urgent interim relief is specifically pleaded — state the specific grounds of urgency ' +
        '(ongoing infringing signage, active advertising, continuing customer confusion, risk of destruction ' +
        'of evidence). Do not bypass mediation merely because the prayer contains the words "interim injunction".',
      );
      notices.push(
        'Section 134, Trade Marks Act 1999: Jurisdiction must be positively established by showing the ' +
        'plaintiff carries on business or resides in the chosen forum — mere harm occurring there is ' +
        'insufficient. Apply Indian Performing Rights Society Ltd. v. Sanjay Dalia (2015) 10 SCC 161.',
      );
      notices.push(
        'Commercial Court allocation: IP disputes of specified value are "commercial disputes" under the ' +
        'Commercial Courts Act 2015. The suit must be filed before the designated Commercial Court (or ' +
        'Commercial Division of the High Court), not simply the Court of the District Judge. Confirm the ' +
        'exact court designation and pecuniary jurisdiction before captioning.',
      );
    }
    return notices;
  }

  private isIprKind(documentKind: string): boolean {
    return /trademark|trade.?mark|passing.?off|ipr|intellectual.?property/i.test(documentKind);
  }

  /**
   * Flags when an IPR/trademark matter is captioned before the plain District Judge
   * rather than the designated Commercial Court, as required by the Commercial Courts Act 2015.
   */
  private checkIprForum(matter: NormalizedMatter, issues: DraftIssue[]): void {
    if (!this.isIprKind(matter.documentKind)) return;
    const courtName = matter.court?.name ?? '';
    if (courtName && /district.?judge/i.test(courtName) && !/commercial/i.test(courtName)) {
      issues.push({
        id: '',
        category: 'procedure',
        severity: 'high',
        message:
          'Trademark/IPR disputes of specified value are "commercial disputes" under the Commercial Courts Act 2015. ' +
          'The caption "Court of the District Judge" is incorrect — file before the designated Commercial Court ' +
          '(e.g. "Commercial Court at [City]" or "Commercial Division, High Court"). ' +
          'Confirm the exact designation and pecuniary threshold before finalising the cause title.',
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('procedure', undefined, 'ipr_wrong_court', undefined),
      });
    }
  }

  /**
   * Flags unestablished jurisdiction for trademark suits.
   *
   * Section 134 of the Trade Marks Act 1999 grants an additional forum connected to
   * where the plaintiff resides or carries on business, but the Supreme Court in
   * Indian Performing Rights Society Ltd. v. Sanjay Dalia (2015) 10 SCC 161 held that
   * this provision cannot be used to drag a defendant to a remote forum where neither
   * the cause of action nor the plaintiff's relevant establishment is located.
   *
   * Emits a medium-severity warning if the pleaded court city does not appear in the
   * facts as the plaintiff's place of business or residence.
   */
  private checkIprJurisdiction(matter: NormalizedMatter, issues: DraftIssue[]): void {
    if (!this.isIprKind(matter.documentKind)) return;
    const city = (matter.court?.city ?? '').trim();
    if (!city) return;

    const cityLower = city.toLowerCase();
    const factsText = matter.facts.map((f) => f.statement.toLowerCase()).join(' ');
    const hasPlaintiffEstablishment =
      factsText.includes(cityLower) &&
      (
        /office|registered|principal|carries on business|resides|located/i.test(factsText) ||
        // Accept if the plaintiff's name and the city appear in the same fact
        matter.facts.some(
          (f) =>
            f.statement.toLowerCase().includes(cityLower) &&
            matter.parties
              .filter((p) => ['petitioner', 'plaintiff', 'applicant'].includes(p.role))
              .some((p) => f.statement.toLowerCase().includes(p.name.toLowerCase())),
        )
      );

    if (!hasPlaintiffEstablishment) {
      issues.push({
        id: '',
        category: 'procedure',
        severity: 'medium',
        message:
          `Section 134, Trade Marks Act 1999: Jurisdiction in ${city} must be positively established ` +
          `by pleading that the plaintiff carries on business or resides in ${city} — ` +
          `harm occurring there is insufficient per Indian Performing Rights Society Ltd. v. Sanjay Dalia ` +
          `(2015) 10 SCC 161. If the infringing acts and the defendant are both in another city, ` +
          `that city is likely the natural forum. Add a specific averment of the plaintiff's ` +
          `establishment in ${city} or reconsider the chosen forum.`,
        repairableAutomatically: false,
        validator: 'UnifiedProceduralGateService',
        fingerprint: buildIssueFingerprint('procedure', undefined, 'ipr_jurisdiction_unestablished', city),
      });
    }
  }

  private getGoverningProcedure(documentKind: string, jurisdiction: string): string[] {
    const procedures: string[] = [];
    if (jurisdiction === 'IN' || jurisdiction?.startsWith('IN-')) {
      if (/criminal|bail|fir|custody/i.test(documentKind)) {
        procedures.push('Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)');
        procedures.push('Bharatiya Nyaya Sanhita, 2023 (BNS)');
      }
      if (/civil|plaint|suit|injunction/i.test(documentKind)) {
        procedures.push('Code of Civil Procedure, 1908 (CPC)');
      }
      if (this.isCommercialSummarySuit(documentKind)) {
        procedures.push('CPC Order XXXVII Rules 1–2 (summary procedure)');
        procedures.push('Commercial Courts Act, 2015 (including Section 12A and Statement of Truth)');
      }
      if (/writ|constitutional|HC|high_court/i.test(documentKind)) {
        procedures.push('Constitution of India, Articles 226 / 32');
      }
      if (/maintenance|matrimonial|divorce|family/i.test(documentKind)) {
        procedures.push('Hindu Marriage Act, 1955 / Special Marriage Act, 1954');
        procedures.push('BNSS Section 144 (maintenance)');
      }
      if (/trademark|trade.?mark|passing.?off|ipr|intellectual.?property/i.test(documentKind)) {
        procedures.push('Trade Marks Act, 1999 (Sections 27, 28, 29, 31, 134, 135)');
        procedures.push('Commercial Courts Act, 2015 (Sections 2, 3, 12A)');
        procedures.push('Code of Civil Procedure, 1908 (CPC)');
      }
    }
    return procedures;
  }
}
