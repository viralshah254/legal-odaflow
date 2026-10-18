import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import type { AtomicDraftClaim, StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'atomic-entailment-v1';

/**
 * Sentence/claim-level factual entailment auditor.
 * Universal — does not know about bail.
 */
@Injectable()
export class AtomicEntailmentAuditor {
  readonly version = VERIFIER;

  evaluate(draft: StructuredDraft, record: CaseRecord): GateFinding[] {
    const findings: GateFinding[] = [];
    const factIds = new Set(record.facts.map((f) => f.id));
    const renderableFacts = record.facts.filter(
      (f) => f.sourceType !== 'model_inference' || f.userApproved,
    );

    for (const section of draft.sections) {
      for (const claim of section.claims) {
        findings.push(...this.auditClaim(claim, factIds, renderableFacts, section.id));
      }
    }

    // If claims metadata missing, fall back to sentence scan for invented numeric dates
    if (draft.sections.every((s) => s.claims.length === 0) && draft.fullMarkdown) {
      findings.push(...this.fallbackDateScan(draft.fullMarkdown, record));
    }

    return findings;
  }

  private auditClaim(
    claim: AtomicDraftClaim,
    factIds: Set<string>,
    facts: CaseRecord['facts'],
    sectionId: string,
  ): GateFinding[] {
    const findings: GateFinding[] = [];
    if (claim.claimType === 'case_fact' || claim.claimType === 'party_position') {
      const supported = claim.supportingFactIds.filter((id) => factIds.has(id));
      if (supported.length === 0) {
        findings.push({
          id: `entailment:unsupported:${claim.id}`,
          checkId: 'fact_entailment',
          severity: 'blocker',
          message: `Claim lacks supporting Case Record fact: "${claim.claimText.slice(0, 120)}"`,
          evidence: [sectionId, claim.id],
          repairHint: 'Link claim to factIds or remove invented assertion',
        });
        return findings;
      }
      // Soft lexical overlap check
      const claimNorm = claim.claimText.toLowerCase();
      const overlap = facts.some(
        (f) =>
          supported.includes(f.id) &&
          f.proposition
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 4)
            .some((w) => claimNorm.includes(w)),
      );
      if (!overlap && claim.claimType === 'case_fact') {
        findings.push({
          id: `entailment:weak_support:${claim.id}`,
          checkId: 'fact_entailment',
          severity: 'warning',
          message: `Weak lexical entailment for claim: "${claim.claimText.slice(0, 100)}"`,
          evidence: supported,
        });
      }
    }

    if (claim.claimType === 'inference' && claim.supportingFactIds.length === 0) {
      findings.push({
        id: `entailment:bare_inference:${claim.id}`,
        checkId: 'fact_entailment',
        severity: 'warning',
        message: `Inference claim without supporting facts: "${claim.claimText.slice(0, 100)}"`,
      });
    }

    return findings;
  }

  private fallbackDateScan(text: string, record: CaseRecord): GateFinding[] {
    const findings: GateFinding[] = [];
    const knownDays = new Set(
      record.chronology
        .map((e) => e.date?.match(/\d{1,2}/)?.[0])
        .filter((d): d is string => !!d),
    );
    if (knownDays.size === 0) return findings;

    const dateMentions = [...text.matchAll(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi)];
    for (const m of dateMentions) {
      if (!knownDays.has(m[1])) {
        // Only flag if month+year matches a known event but day differs
        const knownSameMonth = record.chronology.some((e) => {
          if (!e.date) return false;
          return (
            new RegExp(m[2], 'i').test(e.date) &&
            e.date.includes(m[3]) &&
            !e.date.includes(m[1])
          );
        });
        if (knownSameMonth) {
          findings.push({
            id: `entailment:invented_date:${m[0]}`,
            checkId: 'fact_entailment',
            severity: 'blocker',
            message: `Draft date ${m[0]} is not entailed by Case Record chronology`,
          });
        }
      }
    }
    return findings;
  }
}
