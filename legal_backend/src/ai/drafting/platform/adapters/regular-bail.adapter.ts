import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { DraftPlaybook } from '../../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../../contracts/draft-type-adapter';
import type { IssuePlan, IssuePlanItem } from '../../contracts/issue-plan';
import { dispositionBlocksGeneration } from '../../contracts/issue-plan';
import type { GateFinding, ValidationResult } from '../../contracts/release-gate';
import type { StructuredDraft } from '../../contracts/structured-draft';
import { flattenDraftText } from '../../contracts/structured-draft';
import type { CriminalMatterData } from '../../contracts/matter-data/criminal-matter-data';
import { BailFactMaterialityService } from './bail-fact-materiality.service';
import { createHash } from 'crypto';

@Injectable()
export class RegularBailAdapter implements DraftTypeAdapter {
  documentKind = 'india_regular_bail_bnss_480';
  aliases = ['india_bail_application'];

  constructor(private readonly materiality: BailFactMaterialityService) {}

  validateIntake(
    caseRecord: CaseRecord,
    playbook: DraftPlaybook,
  ): ValidationResult {
    const enriched = this.materiality.assignMateriality(
      caseRecord as CaseRecord<CriminalMatterData>,
    );
    // Mutate matterData/facts onto the shared record for downstream stages
    Object.assign(caseRecord, {
      facts: enriched.facts,
      matterData: enriched.matterData,
    });

    const findings: GateFinding[] = [];
    const missingBlockingFields: string[] = [];
    const md = caseRecord.matterData as CriminalMatterData;
    const checklist = md.bailChecklist?.fields ?? {};

    for (const field of playbook.mandatoryFields.filter((f) => f.blocking)) {
      const state = checklist[field.id]?.state;
      if (state === 'missing' || state === 'conflicted') {
        missingBlockingFields.push(field.id);
        findings.push({
          id: `bail:intake:${field.id}`,
          checkId: 'missing_fields',
          severity: state === 'conflicted' ? 'blocker' : 'warning',
          message: `Bail mandatory field ${field.label} is ${state ?? 'missing'}`,
        });
      }
    }

    if (md.custodyStatus === 'not_arrested') {
      findings.push({
        id: 'bail:intake:wrong_remedy_context',
        checkId: 'bail.custody',
        severity: 'blocker',
        message: 'Regular bail adapter: applicant appears not arrested — use anticipatory bail',
      });
    }

    // Ingredient gap suggestions (do not remove charges)
    for (const offence of md.allegedOffences) {
      if (/316\s*\(?\s*2\s*\)?/i.test(offence.section) || /316\(2\)/.test(offence.raw)) {
        offence.ingredientGaps = offence.ingredientGaps ?? [
          'Verify dishonest misappropriation ingredients for §316(2)',
        ];
        caseRecord.suggestedStatutes.push({
          id: `SUG_${offence.section}`,
          actId: offence.actId,
          section: offence.section,
          raw: offence.raw,
          reason: 'Ingredient gap review — do not auto-remove charged section',
          ingredientGaps: offence.ingredientGaps,
        });
        findings.push({
          id: `bail:ingredient:${offence.section}`,
          checkId: 'bail.charges',
          severity: 'warning',
          message: `Ingredient gap flagged for ${offence.raw} — review only, do not remove`,
        });
      }
    }

    return {
      ok: findings.every((f) => f.severity !== 'blocker'),
      findings,
      missingBlockingFields,
    };
  }

  buildIssuePlan(caseRecord: CaseRecord, playbook: DraftPlaybook): IssuePlan {
    const md = caseRecord.matterData as CriminalMatterData;
    const criticalFacts = caseRecord.facts.filter((f) => f.materiality === 'critical');
    const items: IssuePlanItem[] = playbook.issueTaxonomy.map((issue) => ({
      id: `ISSUE_${issue.id}`,
      label: issue.label,
      mode: 'remedy_based',
      required: issue.required,
      supportingFactIds: this.matchFacts(caseRecord, issue.id),
      playbookIssueId: issue.id,
    }));

    // Ensure parity issue gets co-accused bail facts
    const parity = items.find((i) => i.playbookIssueId === 'parity_if_applicable');
    if (parity && md.priorBailHistory.some((b) => b.granted)) {
      parity.required = true;
      parity.supportingFactIds = caseRecord.facts
        .filter((f) => /co-?accused|parity/i.test(f.proposition))
        .map((f) => f.id);
    }

    const dispositions = criticalFacts.map((f) => {
      const adverse = /intimidation|recovery|alleged/i.test(f.proposition) &&
        f.status === 'prosecution_allegation';
      return {
        factId: f.id,
        disposition: adverse
          ? ('address_adverse_fact' as const)
          : f.status === 'defence_version' || f.status === 'procedural_record'
            ? ('affirmatively_use' as const)
            : ('affirmatively_use' as const),
        issuePlanItemId: items.find((i) => i.supportingFactIds.includes(f.id))?.id,
        reason: adverse
          ? 'Adverse allegation — address cautiously'
          : 'Material defence/procedural fact',
      };
    });

    const blockReasons = dispositionBlocksGeneration(
      dispositions,
      criticalFacts.map((f) => f.id),
    );

    return {
      id: `IP_${createHash('sha256').update(caseRecord.metadata.caseRecordId).digest('hex').slice(0, 10)}`,
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      planningMode: 'remedy_based',
      items,
      dispositions,
      blocked: blockReasons.length > 0,
      blockReasons,
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
    const md = caseRecord.matterData as CriminalMatterData;

    if (md.proceduralStage === 'post_chargesheet' || md.chargesheetStatus === 'filed') {
      if (/\binvestigation\s+(?:is\s+)?(?:still\s+)?(?:ongoing|pending)\b/i.test(text)) {
        findings.push({
          id: 'bail:post_chargesheet_language',
          checkId: 'bail.post_chargesheet',
          severity: 'blocker',
          message: 'Post-chargesheet draft must not claim investigation pending/ongoing',
        });
      }
    }

    if (/\bPetitioner\b/i.test(text) && !/\bApplicant[-–]?Accused\b/i.test(text)) {
      findings.push({
        id: 'bail:party_label',
        checkId: 'bail.party_label',
        severity: 'warning',
        message: 'Use Applicant–Accused, not Petitioner, in regular bail',
      });
    }

    // Charged sections must be reproducible — never silently drop
    for (const s of caseRecord.statutes.filter((x) => x.charged)) {
      const sectionRe = new RegExp(`\\b${s.section.replace(/[()]/g, '\\$&')}\\b`);
      if (text.length > 300 && !sectionRe.test(text) && !new RegExp(s.raw.slice(0, 12), 'i').test(text)) {
        findings.push({
          id: `bail:missing_charge:${s.section}`,
          checkId: 'bail.charges',
          severity: 'warning',
          message: `Charged section ${s.raw} not clearly reproduced in draft`,
        });
      }
    }

    // Never invent CCTV if defence says none
    if (
      caseRecord.facts.some((f) => /no\s+CCTV/i.test(f.proposition)) &&
      /\bCCTV\s+(?:footage\s+)?(?:clearly\s+)?(?:shows|establishes|identifies)\b/i.test(text)
    ) {
      findings.push({
        id: 'bail:invented_cctv',
        checkId: 'fact_entailment',
        severity: 'blocker',
        message: 'Draft invents CCTV identification contrary to Case Record',
      });
    }

    return findings;
  }

  validatePrayer(draft: StructuredDraft, _caseRecord: CaseRecord): GateFinding[] {
    const text = flattenDraftText(draft);
    const findings: GateFinding[] = [];
    if (/\banticipatory\s+bail\b/i.test(text)) {
      findings.push({
        id: 'bail:wrong_prayer_anticipatory',
        checkId: 'bail.custody',
        severity: 'blocker',
        message: 'Regular bail draft must not pray for anticipatory bail',
      });
    }
    if (text.length > 100 && !/\bbail\b/i.test(text)) {
      findings.push({
        id: 'bail:missing_bail_prayer',
        checkId: 'bail.custody',
        severity: 'blocker',
        message: 'Prayer / draft does not request bail',
      });
    }
    return findings;
  }

  validateVerification(draft: StructuredDraft): GateFinding[] {
    const text = flattenDraftText(draft);
    if (text.length > 200 && !/\bVERIFICATION\b/i.test(text)) {
      return [
        {
          id: 'bail:missing_verification',
          checkId: 'verification',
          severity: 'warning',
          message: 'Verification section missing',
        },
      ];
    }
    return [];
  }

  private matchFacts(record: CaseRecord, issueId: string): string[] {
    const facts = record.facts;
    switch (issueId) {
      case 'parity_if_applicable':
        return facts.filter((f) => /parity|co-?accused/i.test(f.proposition)).map((f) => f.id);
      case 'fact_anchored_defence':
        return facts.filter((f) => f.status === 'defence_version').map((f) => f.id);
      case 'bail_factors':
        return facts.filter((f) => f.status === 'procedural_record').map((f) => f.id);
      default:
        return facts.filter((f) => f.materiality === 'critical').slice(0, 5).map((f) => f.id);
    }
  }
}
