import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import { createHash } from 'crypto';

/** Consumer complaint / interim adapter for Case Record + release gate. */
@Injectable()
export class ConsumerComplaintAdapter implements DraftTypeAdapter {
  documentKind = 'india_consumer_complaint';
  aliases = [
    'india_consumer_medical_negligence',
    'india_interim_application_document_production',
    'india_consumer_interim_records_preservation',
    'india_consumer_compensation_schedule',
    'india_consumer_supporting_affidavit',
    'india_consumer_list_of_documents',
  ];

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const findings: GateFinding[] = [];
    const missingBlockingFields: string[] = [];

    if (!caseRecord.parties?.length) {
      missingBlockingFields.push('parties');
      findings.push({
        id: 'consumer:missing:parties',
        checkId: 'missing_fields',
        severity: 'blocker',
        message: 'Missing Complainant / Opposite Parties',
      });
    }

    for (const field of playbook.mandatoryFields.filter((f) => f.blocking)) {
      const value = this.readPath(caseRecord, field.path);
      const emptyArray = Array.isArray(value) && value.length === 0;
      if (value == null || value === '' || emptyArray) {
        if (!missingBlockingFields.includes(field.id)) {
          missingBlockingFields.push(field.id);
          findings.push({
            id: `consumer:missing:${field.id}`,
            checkId: 'missing_fields',
            severity: field.id === 'jurisdiction' ? 'warning' : 'blocker',
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
      disposition:
        f.status === 'disputed' || f.status === 'prosecution_allegation'
          ? ('address_adverse_fact' as const)
          : ('affirmatively_use' as const),
      reason: 'Consumer matter fact',
    }));

    return {
      id: `IP_CONSUMER_${createHash('sha256').update(caseRecord.metadata.caseRecordId).digest('hex').slice(0, 8)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: 'cause_of_action',
      items: playbook.issueTaxonomy.map((i) => ({
        id: `ISSUE_${i.id}`,
        label: i.label,
        mode: 'cause_of_action' as const,
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
    caseRecord: CaseRecord,
    _playbook: DraftPlaybook,
  ): GateFinding[] {
    const text = flattenDraftText(draft);
    const findings: GateFinding[] = [];

    if (/\b(petitioner|respondent)\b/i.test(text) && !/\bcomplainant\b/i.test(text)) {
      findings.push({
        id: 'consumer:party_terminology',
        checkId: 'WRONG_PARTY_TERMINOLOGY',
        severity: 'warning',
        message: 'Prefer Complainant / Opposite Party terminology for consumer forums',
      });
    }

    for (const p of caseRecord.parties ?? []) {
      if (p.name.length >= 8 && !text.toLowerCase().includes(p.name.toLowerCase().slice(0, 12))) {
        findings.push({
          id: `consumer:party_omit:${p.id}`,
          checkId: 'MATERIAL_PARTY_OMITTED',
          severity: 'warning',
          message: `Party "${p.name}" not clearly reflected in draft`,
        });
      }
    }

    return findings;
  }

  validatePrayer(draft: StructuredDraft, _caseRecord: CaseRecord): GateFinding[] {
    const text = flattenDraftText(draft);
    if (text.length > 100 && !/\b(prayer|relief|compensation|direct)\b/i.test(text)) {
      return [
        {
          id: 'consumer:missing_prayer',
          checkId: 'consumer.prayer',
          severity: 'warning',
          message: 'Prayer / relief language not found',
        },
      ];
    }
    return [];
  }

  validateVerification(draft: StructuredDraft): GateFinding[] {
    const text = flattenDraftText(draft);
    if (text.length > 200 && !/\bverif(y|ication)\b/i.test(text)) {
      return [
        {
          id: 'consumer:missing_verification',
          checkId: 'MISSING_VERIFICATION',
          severity: 'warning',
          message: 'Verification section not found',
        },
      ];
    }
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
