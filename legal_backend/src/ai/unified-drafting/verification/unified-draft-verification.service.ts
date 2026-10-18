import { Injectable, Logger } from '@nestjs/common';
import {
  buildIssueFingerprint,
  buildVerificationReport,
  type DraftIssue,
  type DraftVerificationReport,
} from '../contracts/draft-issue';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';

export interface VerifyInput {
  jobId: string;
  sections: Array<{ sectionKey: string; sectionType: string; content: string; status: string }>;
  sourceRegistry: VerifiedSourceRegistry;
  matter: NormalizedMatter;
}

/**
 * Unified Draft Verification Service
 *
 * Runs all validators in parallel and produces one canonical DraftVerificationReport.
 * All validators are deterministic — no LLM.
 * LLM-based defect detection is handled separately by DraftDefectReportService.
 */
@Injectable()
export class UnifiedDraftVerificationService {
  private readonly logger = new Logger(UnifiedDraftVerificationService.name);

  async verify(input: VerifyInput): Promise<DraftVerificationReport> {
    const { jobId, sections, sourceRegistry, matter } = input;

    const validatorResults = await Promise.allSettled([
      this.runPlaceholderValidator(sections),
      this.runStructureValidator(sections, matter.documentKind),
      this.runCitationValidator(sections, sourceRegistry),
      this.runFactConsistencyValidator(sections, matter),
      this.runFormattingValidator(sections),
      this.runReliefConsistencyValidator(sections),
    ]);

    const allIssues: DraftIssue[] = [];
    const validatorNames = [
      'PlaceholderValidator',
      'StructureValidator',
      'CitationValidator',
      'FactConsistencyValidator',
      'FormattingValidator',
      'ReliefConsistencyValidator',
    ];

    for (let i = 0; i < validatorResults.length; i++) {
      const result = validatorResults[i];
      if (result.status === 'fulfilled') {
        allIssues.push(...result.value);
      } else {
        this.logger.warn(`${validatorNames[i]} failed: ${String(result.reason)}`);
      }
    }

    const report = buildVerificationReport(jobId, allIssues);
    this.logger.log(
      `Verification complete for job ${jobId}: ${report.certificationStatus} — ${report.criticalCount} critical, ${report.highCount} high`,
    );
    return report;
  }

  // ─── Validators ────────────────────────────────────────────────────────────

  private async runPlaceholderValidator(
    sections: VerifyInput['sections'],
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];
    for (const section of sections) {
      const matches = section.content.match(/\[BLANK:[^\]]*\]/g) ?? [];
      for (const placeholder of matches) {
        issues.push({
          id: '',
          category: 'placeholder',
          severity: 'medium',
          sectionId: section.sectionKey,
          message: `Unresolved placeholder: ${placeholder}`,
          repairableAutomatically: false,
          validator: 'PlaceholderValidator',
          fingerprint: buildIssueFingerprint('placeholder', section.sectionKey, placeholder, undefined),
        });
      }
      // Detect generic unfilled brackets
      const genericBlanks = section.content.match(/\[[A-Z _]+\]/g) ?? [];
      for (const blank of genericBlanks) {
        if (blank.length > 4 && !/SOURCE_\d+|BLANK:/.test(blank)) {
          issues.push({
            id: '',
            category: 'placeholder',
            severity: 'low',
            sectionId: section.sectionKey,
            message: `Possible unfilled field: ${blank}`,
            repairableAutomatically: false,
            validator: 'PlaceholderValidator',
            fingerprint: buildIssueFingerprint('placeholder', section.sectionKey, blank, undefined),
          });
        }
      }
    }
    return issues;
  }

  private async runStructureValidator(
    sections: VerifyInput['sections'],
    documentKind: string,
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];
    const sectionTypes = sections.map((s) => s.sectionType);

    // Mandatory sections for court documents
    const isCourt = /petition|plaint|revision|bail|writ|application|complaint/i.test(documentKind);
    if (isCourt) {
      if (!sectionTypes.includes('prayer')) {
        issues.push({
          id: '',
          category: 'structure',
          severity: 'high',
          message: 'Prayer section is missing — required for all court documents',
          repairableAutomatically: false,
          validator: 'StructureValidator',
          fingerprint: buildIssueFingerprint('structure', undefined, 'missing_prayer', undefined),
        });
      }
      if (!sectionTypes.includes('facts')) {
        issues.push({
          id: '',
          category: 'structure',
          severity: 'high',
          message: 'Statement of facts section is missing',
          repairableAutomatically: false,
          validator: 'StructureValidator',
          fingerprint: buildIssueFingerprint('structure', undefined, 'missing_facts', undefined),
        });
      }
    }

    // Check section lengths
    for (const section of sections) {
      if (section.content.trim().length < 50 && section.sectionType !== 'heading') {
        issues.push({
          id: '',
          category: 'structure',
          severity: 'medium',
          sectionId: section.sectionKey,
          message: `Section "${section.sectionType}" appears too short (${section.content.trim().length} chars)`,
          repairableAutomatically: true,
          validator: 'StructureValidator',
          fingerprint: buildIssueFingerprint('structure', section.sectionKey, 'too_short', undefined),
        });
      }
    }

    return issues;
  }

  private async runCitationValidator(
    sections: VerifyInput['sections'],
    sourceRegistry: VerifiedSourceRegistry,
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];
    const verifiedIds = new Set(sourceRegistry.sources.filter((s) => s.verificationStatus !== 'rejected').map((s) => s.id));

    for (const section of sections) {
      // Find source ID references in text like [SOURCE_1] or [CASE_2]
      const cited = section.content.match(/\[(SOURCE|STATUTE|CASE|RULE)_\w+\]/g) ?? [];
      for (const ref of cited) {
        const id = ref.replace(/\[|\]/g, '');
        if (!verifiedIds.has(id)) {
          issues.push({
            id: '',
            category: 'citation',
            severity: 'high',
            sectionId: section.sectionKey,
            message: `Citation ${ref} not found in verified source registry`,
            repairableAutomatically: true,
            validator: 'CitationValidator',
            sourceId: id,
            fingerprint: buildIssueFingerprint('citation', section.sectionKey, id, id),
          });
        }
      }

      // Detect bare invented citation patterns like (2023) 5 SCC 123 without a registry ID
      const inventedPattern = /\(\d{4}\)\s+\d+\s+[A-Z]+\s+\d+/g;
      const inventedMatches = section.content.match(inventedPattern) ?? [];
      for (const match of inventedMatches) {
        const isRegistered = sourceRegistry.sources.some(
          (s) => s.citation && s.citation.includes(match.trim()),
        );
        if (!isRegistered) {
          issues.push({
            id: '',
            category: 'unsupported_proposition',
            severity: 'high',
            sectionId: section.sectionKey,
            message: `Citation "${match}" not found in source registry — verify before filing`,
            repairableAutomatically: false,
            validator: 'CitationValidator',
            fingerprint: buildIssueFingerprint('unsupported_proposition', section.sectionKey, match, undefined),
          });
        }
      }
    }

    return issues;
  }

  private async runFactConsistencyValidator(
    sections: VerifyInput['sections'],
    matter: NormalizedMatter,
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];

    // Flag speculative language in facts section
    const factsSection = sections.find((s) => s.sectionType === 'facts');
    if (factsSection) {
      const speculativePatterns = /\ballegedly\b|\breportedly\b|\bpurportedly\b|\bit is said\b|\bapparently\b/gi;
      if (speculativePatterns.test(factsSection.content)) {
        issues.push({
          id: '',
          category: 'fact',
          severity: 'medium',
          sectionId: factsSection.sectionKey,
          message: 'Speculative language found in statement of facts — facts should be stated as facts or as client allegations',
          repairableAutomatically: true,
          validator: 'FactConsistencyValidator',
          fingerprint: buildIssueFingerprint('fact', factsSection.sectionKey, 'speculative_language', undefined),
        });
      }
    }

    // Flag if contradictions from intake appear in same section
    for (const contradiction of matter.contradictions) {
      for (const section of sections) {
        if (section.sectionType === 'facts' || section.sectionType === 'grounds') {
          issues.push({
            id: '',
            category: 'logic',
            severity: 'medium',
            sectionId: section.sectionKey,
            message: `Potential internal contradiction in facts: ${contradiction.description}`,
            repairableAutomatically: false,
            validator: 'FactConsistencyValidator',
            fingerprint: buildIssueFingerprint('logic', section.sectionKey, contradiction.description, undefined),
          });
          break; // Only flag once per contradiction
        }
      }
    }

    return issues;
  }

  private async runFormattingValidator(
    sections: VerifyInput['sections'],
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];

    for (const section of sections) {
      // Excessive whitespace
      if (/\n{4,}/.test(section.content)) {
        issues.push({
          id: '',
          category: 'format',
          severity: 'low',
          sectionId: section.sectionKey,
          message: 'Excessive blank lines found in section',
          repairableAutomatically: true,
          validator: 'FormattingValidator',
          fingerprint: buildIssueFingerprint('format', section.sectionKey, 'excessive_whitespace', undefined),
        });
      }
    }

    return issues;
  }

  private async runReliefConsistencyValidator(
    sections: VerifyInput['sections'],
  ): Promise<DraftIssue[]> {
    const issues: DraftIssue[] = [];
    const prayerSection = sections.find((s) => s.sectionType === 'prayer');

    if (!prayerSection) return issues;

    if (!prayerSection.content.toLowerCase().includes('costs')) {
      issues.push({
        id: '',
        category: 'structure',
        severity: 'low',
        sectionId: prayerSection.sectionKey,
        message: 'Prayer does not include costs — consider adding a prayer for costs',
        repairableAutomatically: false,
        validator: 'ReliefConsistencyValidator',
        fingerprint: buildIssueFingerprint('structure', prayerSection.sectionKey, 'prayer_no_costs', undefined),
      });
    }

    return issues;
  }
}
