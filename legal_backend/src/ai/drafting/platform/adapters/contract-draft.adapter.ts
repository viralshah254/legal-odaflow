import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import type { ContractMatterData } from '../../contracts/matter-data/contract-matter-data';
import { createHash } from 'crypto';

/**
 * Wave-1 minimal service agreement adapter.
 * Acceptance: contract passes pipeline without FIR/arrest/chargesheet fields.
 */
@Injectable()
export class ContractDraftAdapter implements DraftTypeAdapter {
  documentKind = 'service_agreement_general';
  aliases = ['service_agreement'];

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const findings: GateFinding[] = [];
    const missingBlockingFields: string[] = [];
    const md = caseRecord.matterData as ContractMatterData;

    // Hard acceptance: no criminal matter fields required
    const asAny = caseRecord.matterData as Record<string, unknown>;
    if (asAny?.firDetails || asAny?.arrestDetails || asAny?.chargesheetStatus) {
      findings.push({
        id: 'contract:criminal_fields_present',
        checkId: 'contract.no_criminal_fields',
        severity: 'blocker',
        message:
          'Contract Case Record must not carry FIR/arrest/chargesheet fields — use ContractMatterData only',
      });
    }

    if (!md?.transactionType) {
      missingBlockingFields.push('transactionType');
      findings.push({
        id: 'contract:missing_transaction',
        checkId: 'missing_fields',
        severity: 'warning',
        message: 'Missing transaction type',
      });
    }

    if (caseRecord.parties.length < 2) {
      missingBlockingFields.push('parties');
      findings.push({
        id: 'contract:missing_parties',
        checkId: 'missing_fields',
        severity: 'warning',
        message: 'Service agreement needs at least two parties',
      });
    }

    void playbook;
    return {
      ok: findings.every((f) => f.severity !== 'blocker'),
      findings,
      missingBlockingFields,
    };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    return {
      id: `IP_CONTRACT_${createHash('sha256').update(caseRecord.metadata.caseRecordId).digest('hex').slice(0, 8)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: 'contract_term',
      items: [
        {
          id: 'ISSUE_commercial_terms',
          label: 'Commercial terms consistency',
          mode: 'contract_term',
          required: true,
          supportingFactIds: caseRecord.facts.map((f) => f.id),
          playbookIssueId: 'commercial_terms',
        },
      ],
      dispositions: caseRecord.facts.map((f) => ({
        factId: f.id,
        disposition: 'affirmatively_use' as const,
        reason: 'Contract term source',
      })),
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

    if (/\bFIR\b|\bchargesheet\b|\barrest(?:ed)?\b/i.test(text)) {
      findings.push({
        id: 'contract:criminal_language',
        checkId: 'contract.no_criminal_fields',
        severity: 'blocker',
        message: 'Service agreement draft must not include FIR/arrest/chargesheet language',
      });
    }

    // Conflicting dispute resolution heuristic
    if (/\barbitration\b/i.test(text) && /\bexclusive\s+jurisdiction\s+of\s+courts\b/i.test(text)) {
      findings.push({
        id: 'contract:arb_court_conflict',
        checkId: 'contract.term_consistency',
        severity: 'blocker',
        message: 'Arbitration and exclusive court jurisdiction appear to conflict',
      });
    }

    void caseRecord;
    return findings;
  }

  validatePrayer(): GateFinding[] {
    return [];
  }

  validateVerification(): GateFinding[] {
    return [];
  }
}
