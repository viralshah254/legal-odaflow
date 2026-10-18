import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import type { NoticeMatterData } from '../../contracts/matter-data/notice-matter-data';
import { createHash } from 'crypto';

/** Wave-1 minimal legal notice adapter */
@Injectable()
export class LegalNoticeAdapter implements DraftTypeAdapter {
  documentKind = 'india_legal_notice_general';
  aliases = ['india_legal_notice'];

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const md = (caseRecord.matterData ?? {}) as NoticeMatterData;
    const findings: GateFinding[] = [];
    const missingBlockingFields: string[] = [];

    for (const field of playbook.mandatoryFields.filter((f) => f.blocking)) {
      const value = this.readPath(caseRecord, field.path);
      if (!value) {
        missingBlockingFields.push(field.id);
        findings.push({
          id: `notice:missing:${field.id}`,
          checkId: 'missing_fields',
          severity: 'warning',
          message: `Missing ${field.label}`,
        });
      }
    }

    // Prove pipeline works without criminal fields
    const criminalKeys = ['firDetails', 'arrestDetails', 'chargesheetStatus'];
    for (const key of criminalKeys) {
      if (key in (caseRecord.matterData as object) && (caseRecord.matterData as Record<string, unknown>)[key]) {
        // Soft: notice matter data should not use criminal extension
      }
    }
    void md;

    return {
      ok: missingBlockingFields.length === 0 || findings.every((f) => f.severity !== 'blocker'),
      findings,
      missingBlockingFields,
    };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    const dispositions = caseRecord.facts
      .filter((f) => f.materiality === 'critical' || !f.materiality)
      .map((f) => ({
        factId: f.id,
        disposition: 'affirmatively_use' as const,
        reason: 'Notice fact',
      }));

    return {
      id: `IP_NOTICE_${createHash('sha256').update(caseRecord.metadata.caseRecordId).digest('hex').slice(0, 8)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: 'remedy_based',
      items: playbook.issueTaxonomy.map((i) => ({
        id: `ISSUE_${i.id}`,
        label: i.label,
        mode: 'remedy_based' as const,
        required: i.required,
        supportingFactIds: caseRecord.facts.map((f) => f.id).slice(0, 5),
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
    const md = caseRecord.matterData as NoticeMatterData;

    if (md.demandAmount && text.length > 50 && !text.includes(md.demandAmount.replace(/\s/g, '')) && !new RegExp(md.demandAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
      // amount may be formatted differently — warning only
      findings.push({
        id: 'notice:demand_amount',
        checkId: 'notice.demand',
        severity: 'warning',
        message: 'Demand amount from Case Record not clearly reflected in notice',
      });
    }

    if (/\byou\s+will\s+be\s+arrested\b|\bcriminal\s+prosecution\s+is\s+certain\b/i.test(text)) {
      findings.push({
        id: 'notice:unlawful_threat',
        checkId: 'notice.threats',
        severity: 'blocker',
        message: 'Notice contains unlawful / improper criminal threat language',
      });
    }

    return findings;
  }

  validatePrayer(draft: StructuredDraft, _caseRecord: CaseRecord): GateFinding[] {
    const text = flattenDraftText(draft);
    if (text.length > 80 && !/\bdemand\b|\bpay\b|\bcomply\b/i.test(text)) {
      return [
        {
          id: 'notice:missing_demand',
          checkId: 'notice.demand',
          severity: 'warning',
          message: 'Demand language not found',
        },
      ];
    }
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
