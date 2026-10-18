import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import { createHash } from 'crypto';

/**
 * Non-filing research / strategy memo adapter.
 * Rejects court-pleading form; requires parties + facts for Case Record confirm.
 */
@Injectable()
export class ResearchMemoAdapter implements DraftTypeAdapter {
  documentKind = 'india_legal_research_memo';
  aliases = [
    'india_consumer_research_memo',
    'india_case_strategy_memo',
    'india_legal_research',
  ];

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const findings: GateFinding[] = [];
    const missingBlockingFields: string[] = [];

    if (!caseRecord.parties?.length) {
      missingBlockingFields.push('parties');
      findings.push({
        id: 'research:missing:parties',
        checkId: 'missing_fields',
        severity: 'blocker',
        message: 'Missing parties / client for research memo',
      });
    }

    if (!caseRecord.facts?.length && !(caseRecord.chronology?.length > 0)) {
      missingBlockingFields.push('facts');
      findings.push({
        id: 'research:missing:facts',
        checkId: 'missing_fields',
        severity: 'warning',
        message: 'Few structured facts extracted — confirm chronology before drafting',
      });
    }

    for (const field of playbook.mandatoryFields.filter((f) => f.blocking)) {
      const value = this.readPath(caseRecord, field.path);
      const emptyArray = Array.isArray(value) && value.length === 0;
      if (value == null || value === '' || emptyArray) {
        if (!missingBlockingFields.includes(field.id)) {
          missingBlockingFields.push(field.id);
          findings.push({
            id: `research:missing:${field.id}`,
            checkId: 'missing_fields',
            severity: 'warning',
            message: `Missing ${field.label}`,
          });
        }
      }
    }

    return {
      ok: findings.every((f) => f.severity !== 'blocker'),
      findings,
      missingBlockingFields,
    };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    const dispositions = caseRecord.facts.map((f) => ({
      factId: f.id,
      disposition: 'affirmatively_use' as const,
      reason: 'Research fact',
    }));

    return {
      id: `IP_RESEARCH_${createHash('sha256').update(caseRecord.metadata.caseRecordId).digest('hex').slice(0, 8)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: 'legal_issue',
      items: playbook.issueTaxonomy.map((i) => ({
        id: `ISSUE_${i.id}`,
        label: i.label,
        mode: 'legal_issue' as const,
        required: i.required,
        supportingFactIds: caseRecord.facts.map((f) => f.id).slice(0, 8),
        playbookIssueId: i.id,
      })),
      dispositions,
      blocked: false,
      blockReasons: [],
      createdAt: new Date().toISOString(),
    };
  }

  validateDraft(
    draft: StructuredDraft,
    _caseRecord: CaseRecord,
    _playbook: DraftPlaybook,
  ): GateFinding[] {
    const text = flattenDraftText(draft);
    const findings: GateFinding[] = [];

    if (
      /\bCAUSE\s+TITLE\b/i.test(text) &&
      /\b(MOST\s+RESPECTFULLY\s+SHOWETH|PRAYER|VERIFICATION)\b/i.test(text)
    ) {
      findings.push({
        id: 'research:pleading_form',
        checkId: 'research.no_pleading_form',
        severity: 'blocker',
        message:
          'Research memo was drafted as a court pleading (CAUSE TITLE / PRAYER / VERIFICATION). Regenerate as a memo.',
        repairHint: 'Use SHORT ANSWER, ISSUES, FACTS, ANALYSIS, AUTHORITIES, NEXT STEPS.',
      });
    }

    if (/\bMOST\s+RESPECTFULLY\s+SHOWETH\b/i.test(text)) {
      findings.push({
        id: 'research:showeth',
        checkId: 'research.no_pleading_form',
        severity: 'blocker',
        message: 'Research memo must not use MOST RESPECTFULLY SHOWETH.',
      });
    }

    return findings;
  }

  validatePrayer(): GateFinding[] {
    return [];
  }

  validateVerification(): GateFinding[] {
    return [];
  }

  private readPath(record: CaseRecord, path: string): unknown {
    const parts = path.split('.');
    let cur: unknown = record;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }
}
