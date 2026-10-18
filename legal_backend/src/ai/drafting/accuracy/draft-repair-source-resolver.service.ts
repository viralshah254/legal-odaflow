import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import { resolveCourtProfile, type CourtProfile } from '../legal/court-profile';
import { findRemap } from '@/legal-search/statute-registry';
import type { AccuracyFinding } from './accuracy-finding';
import type {
  DraftRepairConflict,
  DraftRepairSourceResolution,
  ResolvedFactValue,
  ResolvedForum,
  VerifiedAuthorityReference,
  VerifiedStatuteReference,
} from './draft-repair.types';

export interface DraftRepairSourceResolverInput {
  caseRecord: CaseRecord;
  draftText: string;
  findings: AccuracyFinding[];
  caseDetails?: string;
  forumHint?: string;
  verifiedAuthorities?: VerifiedAuthorityReference[];
}

/**
 * Resolves grounded sources for automated draft repair.
 * Priority — facts: CaseRecord → chronology/money → conflicts.
 * Statutes: CaseRecord charged provisions + internal remaps.
 * Forum: CaseRecord jurisdiction + CourtProfile registry.
 */
@Injectable()
export class DraftRepairSourceResolverService {
  resolve(input: DraftRepairSourceResolverInput): DraftRepairSourceResolution {
    const facts = this.resolveFacts(input.caseRecord);
    const statutes = this.resolveStatutes(input.caseRecord, input.draftText);
    const authorities = (input.verifiedAuthorities ?? []).filter((a) => a.verified);
    const unresolvedConflicts = this.detectConflicts(input.caseRecord, input.findings);
    const courtProfile = this.resolveProfile(input);
    const forum = this.toForum(courtProfile, input.caseRecord);

    return {
      facts,
      statutes,
      authorities,
      forum,
      unresolvedConflicts,
      courtProfile,
    };
  }

  private resolveFacts(caseRecord: CaseRecord): ResolvedFactValue[] {
    const out: ResolvedFactValue[] = [];

    for (const p of caseRecord.parties ?? []) {
      if (!p.name?.trim()) continue;
      out.push({
        field: `party.${p.role || p.id}`,
        value: p.name.trim(),
        sourceIds: [p.id],
        confidence: 'confirmed',
      });
      for (const alias of p.aliases ?? []) {
        if (alias.trim() && alias.toLowerCase() !== p.name.toLowerCase()) {
          out.push({
            field: `party.alias.${p.id}`,
            value: alias.trim(),
            sourceIds: [p.id],
            confidence: 'extracted',
          });
        }
      }
    }

    for (const e of caseRecord.chronology ?? []) {
      if (!e.date) continue;
      out.push({
        field: `chronology.${e.id}`,
        value: e.date,
        sourceIds: [e.id, ...(e.factIds ?? [])],
        confidence: e.datePrecision === 'exact' ? 'confirmed' : 'extracted',
      });
      if (e.label) {
        out.push({
          field: `chronology.label.${e.id}`,
          value: e.label,
          sourceIds: [e.id],
          confidence: 'confirmed',
        });
      }
    }

    for (const m of caseRecord.moneyRecords ?? []) {
      const value =
        m.amount != null
          ? `${m.currency ?? 'INR'} ${m.amount}`
          : m.amountLabel;
      out.push({
        field: `money.${m.id}`,
        value,
        sourceIds: [m.id, ...(m.sourceFactIds ?? [])],
        confidence:
          m.confirmationState === 'user_confirmed'
            ? 'confirmed'
            : m.disputed || m.confirmationState === 'disputed'
              ? 'conflicted'
              : 'extracted',
      });
    }

    for (const f of caseRecord.facts ?? []) {
      if (f.confidence === 'unknown' && !f.userApproved) continue;
      out.push({
        field: `fact.${f.id}`,
        value: f.proposition,
        sourceIds: [f.id],
        confidence:
          f.userApproved || f.confidence === 'explicit' ? 'confirmed' : 'extracted',
      });
    }

    return out;
  }

  private resolveStatutes(
    caseRecord: CaseRecord,
    draftText: string,
  ): VerifiedStatuteReference[] {
    const out: VerifiedStatuteReference[] = [];

    for (const s of caseRecord.statutes ?? []) {
      out.push({
        actId: s.actId,
        section: s.section,
        proposition: s.raw,
        status: 'current',
        source: 'case_record',
      });
      const remap = findRemap('IN', s.actId, s.section);
      if (remap) {
        out.push({
          actId: remap.to.actId,
          section: remap.to.section,
          title: remap.to.actId,
          status: 'current',
          source: 'statute_registry_remap',
          proposition: `Remapped from ${s.actId} §${s.section}`,
        });
      }
    }

    // Known CPA 2019 corrections for common bad drafts
    const cpaFixes: VerifiedStatuteReference[] = [
      {
        actId: 'IN-CPA-2019',
        section: '2(16)',
        title: 'Consumer Protection Act, 2019',
        proposition: 'deficiency',
        status: 'current',
        source: 'verified_allowlist',
      },
      {
        actId: 'IN-CPA-2019',
        section: '34',
        title: 'Consumer Protection Act, 2019',
        proposition: 'jurisdiction of District Commission',
        status: 'current',
        source: 'verified_allowlist',
      },
      {
        actId: 'IN-CPA-2019',
        section: '35',
        title: 'Consumer Protection Act, 2019',
        proposition: 'manner of filing complaint',
        status: 'current',
        source: 'verified_allowlist',
      },
      {
        actId: 'IN-CPA-2019',
        section: '47',
        title: 'Consumer Protection Act, 2019',
        proposition: 'jurisdiction of State Commission',
        status: 'current',
        source: 'verified_allowlist',
      },
      {
        actId: 'IN-CPA-2019',
        section: '51',
        title: 'Consumer Protection Act, 2019',
        proposition: 'jurisdiction of National Commission',
        status: 'current',
        source: 'verified_allowlist',
      },
      {
        actId: 'IN-CPA-2019',
        section: '69',
        title: 'Consumer Protection Act, 2019',
        proposition: 'limitation period',
        status: 'current',
        source: 'verified_allowlist',
      },
    ];

    if (/consumer|cpa|deficiency/i.test(draftText) || /consumer/i.test(caseRecord.jurisdiction?.courtName ?? '')) {
      out.push(...cpaFixes);
    }

    // Dedupe by actId+section
    const seen = new Set<string>();
    return out.filter((s) => {
      const key = `${s.actId}|${s.section}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private detectConflicts(
    caseRecord: CaseRecord,
    findings: AccuracyFinding[],
  ): DraftRepairConflict[] {
    const conflicts: DraftRepairConflict[] = [];

    for (const c of caseRecord.contradictions ?? []) {
      if (c.resolution) continue;
      const f1 = caseRecord.facts?.find((f) => f.id === c.factId1);
      const f2 = caseRecord.facts?.find((f) => f.id === c.factId2);
      conflicts.push({
        field: c.field ?? c.id,
        description: c.description,
        candidates: [
          ...(f1 ? [{ value: f1.proposition, sourceIds: [f1.id] }] : []),
          ...(f2 ? [{ value: f2.proposition, sourceIds: [f2.id] }] : []),
        ],
      });
    }

    for (const f of findings) {
      if (
        f.code === 'DATE_CORRUPTION' ||
        f.code === 'AMOUNT_CORRUPTION' ||
        f.code === 'LIMITATION_DATE_MISMATCH' ||
        f.code === 'CAUSE_OF_ACTION_DATE_MISMATCH'
      ) {
        const related = (caseRecord.chronology ?? [])
          .filter((e) => e.date)
          .map((e) => ({ value: `${e.label}: ${e.date}`, sourceIds: [e.id] }));
        if (related.length > 1) {
          conflicts.push({
            field: f.code.toLowerCase(),
            findingCode: f.code,
            description: f.message,
            candidates: related,
          });
        }
      }
    }

    return conflicts;
  }

  private resolveProfile(input: DraftRepairSourceResolverInput): CourtProfile | undefined {
    const hint =
      input.forumHint ||
      input.caseRecord.jurisdiction?.courtName ||
      input.caseDetails ||
      '';
    return resolveCourtProfile(hint);
  }

  private toForum(
    profile: CourtProfile | undefined,
    caseRecord: CaseRecord,
  ): ResolvedForum | undefined {
    if (profile) {
      return {
        forumName: profile.forum,
        courtProfileId: profile.id,
        courtProfileVersion: profile.version,
        partyTerminology: profile.partyTerminology,
        captionFormat: profile.captionFormat,
      };
    }
    if (caseRecord.jurisdiction?.courtName) {
      return { forumName: caseRecord.jurisdiction.courtName };
    }
    return undefined;
  }
}
