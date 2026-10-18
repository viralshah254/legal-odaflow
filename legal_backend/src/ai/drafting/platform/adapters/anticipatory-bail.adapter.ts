import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import type { CriminalMatterData } from '../../contracts/matter-data/criminal-matter-data';
import { RegularBailAdapter } from './regular-bail.adapter';
import { BailFactMaterialityService } from './bail-fact-materiality.service';

@Injectable()
export class AnticipatoryBailAdapter implements DraftTypeAdapter {
  documentKind = 'india_anticipatory_bail_bnss_482';
  aliases = ['india_anticipatory_bail'];

  private readonly regular: RegularBailAdapter;

  constructor(materiality: BailFactMaterialityService) {
    this.regular = new RegularBailAdapter(materiality);
  }

  validateIntake(caseRecord: CaseRecord, playbook: DraftPlaybook): ValidationResult {
    const base = this.regular.validateIntake(caseRecord, playbook);
    const md = caseRecord.matterData as CriminalMatterData;
    const findings = [...base.findings];

    // Filter out "not arrested → use anticipatory" from regular adapter
    const filtered = findings.filter((f) => f.id !== 'bail:intake:wrong_remedy_context');

    if (md.custodyStatus === 'in_custody') {
      filtered.push({
        id: 'anticipatory:already_in_custody',
        checkId: 'anticipatory.not_in_custody',
        severity: 'blocker',
        message: 'Anticipatory bail unavailable — applicant already in custody',
      });
    }

    return {
      ok: filtered.every((f) => f.severity !== 'blocker'),
      findings: filtered,
      missingBlockingFields: base.missingBlockingFields.filter((f) => f !== 'arrestDate'),
    };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    const plan = this.regular.buildIssuePlan(caseRecord, playbook);
    return {
      ...plan,
      planningMode: 'remedy_based',
      items: playbook.issueTaxonomy.map((issue) => ({
        id: `ISSUE_${issue.id}`,
        label: issue.label,
        mode: 'remedy_based' as const,
        required: issue.required,
        supportingFactIds: caseRecord.facts
          .filter((f) => f.materiality === 'critical')
          .slice(0, 5)
          .map((f) => f.id),
        playbookIssueId: issue.id,
      })),
    };
  }

  validateDraft(
    draft: StructuredDraft,
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): GateFinding[] {
    const findings = this.regular
      .validateDraft(draft, caseRecord, playbook)
      .filter((f) => f.id !== 'bail:party_label');
    const text = flattenDraftText(draft);
    if (/\benlarge\s+(?:the\s+)?(?:applicant|accused).{0,40}on\s+bail\b/i.test(text)) {
      findings.push({
        id: 'anticipatory:regular_bail_prayer',
        checkId: 'anticipatory.no_regular_prayer',
        severity: 'blocker',
        message: 'Anticipatory bail application must not use regular-bail enlarge-on-bail prayer',
      });
    }
    return findings;
  }

  validatePrayer(draft: StructuredDraft, caseRecord: CaseRecord): GateFinding[] {
    const text = flattenDraftText(draft);
    const findings: GateFinding[] = [];
    if (/\bregular\s+bail\b/i.test(text) && !/\banticipatory\b/i.test(text)) {
      findings.push({
        id: 'anticipatory:wrong_prayer',
        checkId: 'anticipatory.no_regular_prayer',
        severity: 'blocker',
        message: 'Prayer seeks regular bail in anticipatory bail application',
      });
    }
    if (!/\banticipatory\b|\bpre-?arrest\b|\bprotection\s+from\s+arrest\b/i.test(text) && text.length > 100) {
      findings.push({
        id: 'anticipatory:missing_prayer',
        checkId: 'anticipatory.no_regular_prayer',
        severity: 'warning',
        message: 'Anticipatory / pre-arrest protection language not found',
      });
    }
    void caseRecord;
    return findings;
  }

  validateVerification(draft: StructuredDraft): GateFinding[] {
    return this.regular.validateVerification(draft);
  }
}
