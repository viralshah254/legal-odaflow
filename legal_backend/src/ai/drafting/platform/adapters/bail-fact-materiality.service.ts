import { Injectable } from '@nestjs/common';
import type { CaseFact, CaseRecord } from '../../contracts/case-record';
import type { FactMateriality } from '../../contracts/case-record';
import {
  BAIL_CHECKLIST_FIELDS,
  type BailCaseChecklist,
  type CriminalMatterData,
  type FieldState,
} from '../../contracts/matter-data/criminal-matter-data';

/**
 * Bail-only materiality + checklist — lives in adapter layer, NOT extraction.
 */
@Injectable()
export class BailFactMaterialityService {
  assignMateriality(record: CaseRecord<CriminalMatterData>): CaseRecord<CriminalMatterData> {
    const facts = record.facts.map((f) => ({
      ...f,
      materiality: this.classify(f),
    }));
    const checklist = this.buildChecklist(record);
    return {
      ...record,
      facts,
      matterData: {
        ...record.matterData,
        bailChecklist: checklist,
      },
    };
  }

  private classify(fact: CaseFact): FactMateriality {
    const p = fact.proposition;
    if (
      fact.status === 'procedural_record' ||
      /\bFIR\b|\barrest\b|\bchargesheet\b|\bcustody\b|\bparity\b|\bco-?accused\b/i.test(p)
    ) {
      return 'critical';
    }
    if (fact.status === 'defence_version') return 'critical';
    if (fact.status === 'prosecution_allegation') return 'important';
    if (/CCTV|forensic|CDR|Wi-?Fi|shopkeeper|recovery|intimidation/i.test(p)) {
      return 'critical';
    }
    return 'background';
  }

  private buildChecklist(record: CaseRecord<CriminalMatterData>): BailCaseChecklist {
    const md = record.matterData;
    const field = (state: FieldState, value?: string, note?: string) => ({
      state,
      value,
      note,
    });

    const knownOrMissing = (value?: string | null): FieldState =>
      value && String(value).trim() ? 'known' : 'missing';

    const fields: BailCaseChecklist['fields'] = {};
    const applicant = md.accusedPersons.find((a) => a.isApplicant) ?? md.accusedPersons[0];
    fields.applicantName = field(
      knownOrMissing(applicant?.name),
      applicant?.name,
    );
    fields.firNo = field(knownOrMissing(md.firDetails?.firNo), md.firDetails?.firNo);
    fields.firDate = field(knownOrMissing(md.firDetails?.firDate), md.firDetails?.firDate);
    fields.policeStation = field(
      knownOrMissing(md.firDetails?.policeStation),
      md.firDetails?.policeStation,
    );
    fields.arrestDate = field(
      /anticipatory/i.test(record.metadata.playbookId)
        ? md.arrestDetails?.arrestDate
          ? 'conflicted'
          : 'not_applicable'
        : knownOrMissing(md.arrestDetails?.arrestDate),
      md.arrestDetails?.arrestDate,
    );
    fields.custodyStatus = field(
      md.custodyStatus && md.custodyStatus !== 'unknown' ? 'known' : 'missing',
      md.custodyStatus,
    );
    fields.chargesheetStatus = field(
      md.chargesheetStatus && md.chargesheetStatus !== 'unknown' ? 'known' : 'missing',
      md.chargesheetStatus,
    );
    fields.chargedSections = field(
      md.allegedOffences.length > 0 || record.statutes.length > 0 ? 'known' : 'missing',
      (md.allegedOffences.length ? md.allegedOffences : record.statutes)
        .map((s) => `${s.actId} ${s.section}`)
        .join(', '),
    );
    fields.courtName = field(
      knownOrMissing(record.jurisdiction.courtName),
      record.jurisdiction.courtName,
    );
    fields.coAccusedBail = field(
      md.priorBailHistory.length > 0 ? 'known' : 'missing',
      md.priorBailHistory.map((b) => `${b.accusedName}:${b.granted}`).join('; '),
    );
    fields.recoveryPosition = field(
      md.recoveryDetails.length > 0 ? 'known' : 'missing',
      md.recoveryDetails.map((r) => r.description).join('; '),
    );
    fields.defenceFacts = field(
      record.facts.some((f) => f.status === 'defence_version') ? 'known' : 'missing',
    );
    fields.antecedents = field(
      md.antecedents && md.antecedents.length > 0 ? 'known' : 'not_applicable',
    );
    fields.remedySought = field('known', 'regular_or_anticipatory_bail');
    fields.jurisdiction = field(
      knownOrMissing(record.jurisdiction.countryCode),
      record.jurisdiction.countryCode,
    );
    fields.proceduralStage = field(
      md.proceduralStage && md.proceduralStage !== 'unknown' ? 'known' : 'missing',
      md.proceduralStage,
    );

    // Ensure all checklist keys exist
    for (const key of BAIL_CHECKLIST_FIELDS) {
      if (!fields[key]) fields[key] = field('missing');
    }

    return { fields };
  }
}
