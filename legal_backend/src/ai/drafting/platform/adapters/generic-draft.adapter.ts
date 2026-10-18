import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';

/** Safe fallback adapter; the resolved playbook supplies document-specific policy. */
@Injectable()
export class GenericDraftAdapter implements DraftTypeAdapter {
  documentKind = 'generic';

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const missingBlockingFields: string[] = [];
    const findings: GateFinding[] = [];
    for (const field of playbook.mandatoryFields.filter((item) => item.blocking)) {
      if (this.readPath(caseRecord, field.path)) continue;
      missingBlockingFields.push(field.id);
      findings.push({
        id: `generic:missing:${field.id}`,
        checkId: 'missing_fields',
        severity: 'blocker',
        message: `Missing ${field.label}`,
        repairHint: `Complete ${field.label} before generation.`,
      });
    }
    return { ok: missingBlockingFields.length === 0, findings, missingBlockingFields };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    return {
      id: `IP_GENERIC_${createHash('sha256')
        .update(`${caseRecord.metadata.caseRecordId}:${playbook.documentKind}`)
        .digest('hex')
        .slice(0, 8)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: playbook.planningMode,
      items: playbook.issueTaxonomy.map((issue) => ({
        id: `ISSUE_${issue.id}`,
        label: issue.label,
        mode: playbook.planningMode,
        required: issue.required,
        supportingFactIds: caseRecord.facts.map((fact) => fact.id).slice(0, 10),
        playbookIssueId: issue.id,
      })),
      dispositions: caseRecord.facts.map((fact) => ({
        factId: fact.id,
        disposition: 'affirmatively_use' as const,
        reason: 'Material case-record fact',
      })),
      blocked: false,
      blockReasons: [],
      createdAt: new Date().toISOString(),
    };
  }

  validateDraft(
    draft: StructuredDraft,
    _caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): GateFinding[] {
    const text = flattenDraftText(draft);
    return playbook.requiredSections.flatMap((section) => {
      if (!section.required || this.hasSection(text, section.title)) return [];
      return [
        {
          id: `generic:section:${section.id}`,
          checkId: 'required_section',
          severity: 'blocker' as const,
          message: `Required section missing: ${section.title}`,
          repairHint: `Add the ${section.title} section and rerun readiness.`,
        },
      ];
    });
  }

  validatePrayer(): GateFinding[] {
    return [];
  }

  validateVerification(): GateFinding[] {
    return [];
  }

  private hasSection(text: string, title: string): boolean {
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return normalizedText.includes(normalizedTitle);
  }

  private readPath(record: CaseRecord, path: string): unknown {
    let current: unknown = record;
    for (const part of path.split('.')) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
