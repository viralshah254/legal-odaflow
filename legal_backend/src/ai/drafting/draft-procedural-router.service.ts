import { Injectable } from '@nestjs/common';
import { DraftProceduralGateService } from './draft-procedural-gate.service';
import type {
  DraftDocumentClass,
  GoverningSection,
  ProceduralRouterInput,
  ProceduralRouterResult,
} from './draft-procedural-router.types';

import { findMatchingIndiaRules } from './procedural-rules/india.rules';
import { resolveCauseTitleVehicle } from './draft-legal-blocklist';

const APPEAL_KINDS = /appeal|slp|special_leave/i;
const REVISION_KINDS = /revision/i;
const WRIT_KINDS = /writ|pil/i;
const BAIL_KINDS = /bail/i;
const MAINTENANCE_KINDS = /maintenance|muslim_maintenance/i;
const CONTRACT_KINDS = /contract|agreement|nda|lease|deed|poa|partnership/i;
const CIVIL_SUIT_KINDS = /suit|plaint|written_statement|injunction|recovery/i;

function kindMatches(kind: string, pattern: RegExp): boolean {
  return pattern.test(kind);
}

function factsMatch(facts: string, pattern: RegExp): boolean {
  return pattern.test(facts);
}

function classifyDocumentClass(kind: string): DraftDocumentClass {
  if (CONTRACT_KINDS.test(kind)) return 'contract';
  if (/memo|report|brief/i.test(kind)) return 'memo';
  if (/reply|rejoinder|counter/i.test(kind)) return 'reply';
  if (/form|application|petition|complaint|notice/i.test(kind)) return 'application';
  if (/india_form_catalog/.test(kind)) return 'form';
  if (CIVIL_SUIT_KINDS.test(kind) || APPEAL_KINDS.test(kind) || REVISION_KINDS.test(kind) || WRIT_KINDS.test(kind) || BAIL_KINDS.test(kind)) {
    return 'pleading';
  }
  return 'pleading';
}

const MAINTENANCE_FACTS =
  /maintenance|crpc\s*§?\s*125|crpc\s+125|bnss\s*§?\s*144|bnss\s+144|125\s+crpc|section\s+125|section\s+144/i;

function pushMaintenanceSections(governingSections: GoverningSection[]) {
  if (!governingSections.some((g) => g.section === '144')) {
    governingSections.push({
      actId: 'bnss',
      section: '144',
      label: 'BNSS §144 (maintenance)',
      predecessor: { actId: 'crpc', section: '125' },
    });
  }
  if (!governingSections.some((g) => g.section === '438')) {
    governingSections.push({
      actId: 'bnss',
      section: '438',
      label: 'BNSS §438 (criminal revision)',
      predecessor: { actId: 'crpc', section: '397' },
    });
  }
}

@Injectable()
export class DraftProceduralRouterService {
  constructor(private readonly gate: DraftProceduralGateService) {}

  route(input: ProceduralRouterInput): ProceduralRouterResult {
    const { kind, caseDetails, countryCode, respectUserSelection = false } = input;
    const facts = caseDetails.toLowerCase();
    const kindLower = kind.toLowerCase();
    const maintainabilityNotes: string[] = [];
    const governingSections: GoverningSection[] = [];
    let recommendedKind = kind;
    let kindOverridden = false;

    const applyKindOverride = (nextKind: string, note?: string) => {
      if (respectUserSelection) {
        if (note) maintainabilityNotes.push(note);
        return;
      }
      recommendedKind = nextKind;
      kindOverridden = recommendedKind !== kind;
      if (note) maintainabilityNotes.push(note);
    };

    const gateResult = this.gate.check({ kind, caseDetails, countryCode });
    const documentClass = classifyDocumentClass(kindLower);

    if (countryCode === 'IN') {
      for (const rule of findMatchingIndiaRules(facts, kindLower)) {
        if (rule.recommendedKind) {
          applyKindOverride(rule.recommendedKind);
        }
        maintainabilityNotes.push(rule.note);
        for (const s of rule.governingSections) {
          if (!governingSections.some((g) => g.section === s.section)) {
            governingSections.push({ ...s, predecessor: undefined });
          }
        }
      }
    }

    if (
      countryCode === 'IN' &&
      /suit_recovery_cpc_37|summary_suit_recovery/i.test(recommendedKind)
    ) {
      governingSections.push(
        {
          actId: 'cpc',
          section: 'Order XXXVII',
          label: 'CPC Order XXXVII (summary procedure on qualifying written debt)',
        },
        {
          actId: 'commercial_courts_act',
          section: '12A',
          label:
            'Commercial Courts Act §12A (pre-institution mediation, unless a supported urgent-relief exception applies)',
        },
      );
      maintainabilityNotes.push(
        'Commercial summary procedure requires a liquidated debt founded on a qualifying written contract, invoice acknowledgment, negotiable instrument, or guarantee.',
        'Specified value, designated Commercial Court, territorial nexus, court fee, limitation, and Section 12A compliance must be confirmed before filing.',
      );
    }

    // Facts-first maintenance routing — overrides wrong catalog kinds (e.g. service_agreement)
    if (countryCode === 'IN' && factsMatch(facts, MAINTENANCE_FACTS)) {
      if (factsMatch(facts, /interim/i)) {
        applyKindOverride(
          'india_maintenance_order_revision',
          'Interim maintenance orders under BNSS §144 are typically challenged by criminal revision under BNSS §438, not appeal.',
        );
        pushMaintenanceSections(governingSections);
      } else if (factsMatch(facts, /final/i) && !factsMatch(facts, /interim/i)) {
        applyKindOverride(
          'india_maintenance_appeal_final',
          'Final maintenance orders may be appealed under the successor to CrPC §128. Confirm whether the order is interim or final before filing.',
        );
        if (!governingSections.some((g) => g.section === '144')) {
          governingSections.push({
            actId: 'bnss',
            section: '144',
            label: 'BNSS §144 (maintenance)',
            predecessor: { actId: 'crpc', section: '125' },
          });
        }
      } else if (
        factsMatch(
          facts,
          /appeal|memorandum of appeal|challenge|set aside|against.*order|revision/i,
        )
      ) {
        applyKindOverride(
          'india_maintenance_order_revision',
          'Maintenance challenge with ambiguous interim/final status — defaulting to criminal revision (interim-safe). Confirm order nature before filing.',
        );
        pushMaintenanceSections(governingSections);
      }
    }

    // Maintenance interim order + appeal kind → revision
    if (
      countryCode === 'IN' &&
      kindMatches(kindLower, APPEAL_KINDS) &&
      factsMatch(facts, /interim maintenance|interim order.*maintenance|maintenance.*interim|crpc\s*125|bnss\s*144/i)
    ) {
      applyKindOverride(
        'india_maintenance_order_revision',
        'Interim maintenance orders under BNSS §144 are typically challenged by criminal revision under BNSS §438, not appeal. Appeal under the successor to CrPC §128 applies to final maintenance determinations.',
      );
      governingSections.push(
        { actId: 'bnss', section: '144', label: 'BNSS §144 (maintenance)', predecessor: { actId: 'crpc', section: '125' } },
        { actId: 'bnss', section: '438', label: 'BNSS §438 (criminal revision)', predecessor: { actId: 'crpc', section: '397' } },
      );
    } else if (
      countryCode === 'IN' &&
      kindMatches(kindLower, APPEAL_KINDS) &&
      factsMatch(facts, /maintenance only|maintenance order|crpc 125|bnss 144/i) &&
      !factsMatch(facts, /interim/i)
    ) {
      if (!kindMatches(kindLower, /maintenance_appeal|maintenance_order/i)) {
        applyKindOverride(
          'india_maintenance_appeal_final',
          'Final maintenance orders may be appealed under the successor to CrPC §128. Confirm whether the order is interim or final before filing.',
        );
      }
      governingSections.push(
        { actId: 'bnss', section: '144', label: 'BNSS §144 (maintenance)', predecessor: { actId: 'crpc', section: '125' } },
      );
    } else if (
      countryCode === 'IN' &&
      factsMatch(facts, /challenge maintenance|appeal maintenance|set aside maintenance|against maintenance order/i) &&
      !kindMatches(kindLower, APPEAL_KINDS) &&
      !kindMatches(kindLower, REVISION_KINDS) &&
      !kindMatches(kindLower, WRIT_KINDS)
    ) {
      applyKindOverride(
        factsMatch(facts, /interim/i)
          ? 'india_maintenance_order_revision'
          : 'india_maintenance_appeal_final',
        'User intends to challenge a maintenance order — routed to the appropriate revision or appeal document kind.',
      );
      governingSections.push(
        { actId: 'bnss', section: '144', label: 'BNSS §144 (maintenance)', predecessor: { actId: 'crpc', section: '125' } },
      );
    }

    if (kindMatches(kindLower, BAIL_KINDS) && factsMatch(facts, /civil suit|money recovery|partition|injunction suit/i)) {
      maintainabilityNotes.push(
        'Facts suggest a civil dispute but document kind is bail — confirm criminal proceedings exist before filing bail.',
      );
    }

    if (kindMatches(recommendedKind, REVISION_KINDS) || recommendedKind === 'india_maintenance_order_revision') {
      governingSections.push(
        { actId: 'bnss', section: '438', label: 'BNSS §438 (criminal revision)', predecessor: { actId: 'crpc', section: '397' } },
      );
    }

    if (kindMatches(recommendedKind, APPEAL_KINDS) && !governingSections.some((s) => s.section === '427')) {
      governingSections.push(
        { actId: 'bnss', section: '427', label: 'BNSS §427 (criminal appeal)', predecessor: { actId: 'crpc', section: '374' } },
      );
    }

    if (kindMatches(recommendedKind, MAINTENANCE_KINDS) && !governingSections.some((s) => s.section === '144')) {
      governingSections.push(
        { actId: 'bnss', section: '144', label: 'BNSS §144 (maintenance)', predecessor: { actId: 'crpc', section: '125' } },
      );
    }

    const requiredStructuralSections = this.resolveStructuralSections(documentClass, recommendedKind);

    const causeTitleVehicle = resolveCauseTitleVehicle(recommendedKind);

    return {
      recommendedKind,
      userSelectedKind: kind,
      kindOverridden,
      causeTitleVehicle,
      documentClass,
      governingSections,
      maintainabilityNotes,
      requiredStructuralSections,
      proceduralWarnings: [...gateResult.proceduralWarnings, ...maintainabilityNotes],
      completenessGaps: gateResult.completenessGaps,
    };
  }

  buildPromptBlock(result: ProceduralRouterResult): string {
    const lines: string[] = ['PROCEDURAL DETERMINATION:'];
    if (result.kindOverridden) {
      lines.push(
        `- RECOMMENDED DOCUMENT KIND: ${result.recommendedKind} (user selected ${result.userSelectedKind}). Draft using the recommended kind unless facts clearly require the user's selection.`,
      );
    } else {
      lines.push(`- Document kind: ${result.recommendedKind}`);
    }
    lines.push(`- Document class: ${result.documentClass}`);
    lines.push(`- Cause title vehicle: ${result.causeTitleVehicle}`);
    if (result.governingSections.length > 0) {
      lines.push('- Governing sections:');
      for (const s of result.governingSections) {
        const pred = s.predecessor
          ? ` (Schedule I: ${s.predecessor.actId.toUpperCase()} §${s.predecessor.section})`
          : '';
        lines.push(`  · ${s.label}${pred}`);
      }
    }
    for (const n of result.maintainabilityNotes) {
      lines.push(`- MAINTAINABILITY: ${n}`);
    }
    for (const s of result.requiredStructuralSections) {
      lines.push(`- REQUIRED SECTION: ${s}`);
    }
    for (const w of result.proceduralWarnings) {
      lines.push(`- WARNING: ${w}`);
    }
    for (const g of result.completenessGaps) {
      lines.push(`- GAP: ${g}`);
    }
    return lines.join('\n');
  }

  private resolveStructuralSections(
    documentClass: DraftDocumentClass,
    kind: string,
  ): string[] {
    const common = ['cause title', 'parties', 'prayer', 'verification'];
    switch (documentClass) {
      case 'pleading':
        return [...common, 'facts', 'grounds', 'limitation (if applicable)'];
      case 'contract':
        return ['parties', 'recitals', 'defined terms', 'operative clauses', 'signatures'];
      case 'form':
        return ['form header', 'parties', 'relief sought', 'verification'];
      case 'application':
        return [...common, 'facts', 'grounds'];
      case 'memo':
        return ['issue', 'facts', 'analysis', 'conclusion'];
      case 'reply':
        return ['cause title', 'parties', 'reply to allegations', 'prayer'];
      default:
        return common;
    }
  }
}
