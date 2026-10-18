import { Injectable } from '@nestjs/common';
import { evaluateCommercialSummarySuitProcedure } from './commercial-summary-suit-procedure';

export interface ProceduralGateInput {
  kind: string;
  caseDetails: string;
  countryCode: string;
  courtName?: string;
}

export interface ProceduralGateResult {
  proceduralWarnings: string[];
  completenessGaps: string[];
}

const APPEAL_KINDS = /appeal|slp|special_leave/i;
const REVISION_KINDS = /revision/i;
const WRIT_KINDS = /writ|pil/i;
const BAIL_KINDS = /bail/i;
const MAINTENANCE_KINDS = /maintenance|muslim_maintenance/i;
const CIVIL_SUIT_KINDS = /suit|plaint|written_statement|injunction|recovery/i;
const CONTRACT_KINDS = /contract|agreement|nda|lease|deed|poa|partnership/i;

const APPEAL_SECTIONS = ['jurisdiction', 'limitation', 'prayer', 'verification', 'grounds'];
const WRIT_SECTIONS = ['jurisdiction', 'facts', 'grounds', 'prayer', 'affidavit'];
const CONTRACT_SECTIONS = ['parties', 'consideration', 'term', 'termination', 'governing law'];

function kindMatches(kind: string, pattern: RegExp): boolean {
  return pattern.test(kind);
}

function factsMatch(caseDetails: string, pattern: RegExp): boolean {
  return pattern.test(caseDetails);
}

@Injectable()
export class DraftProceduralGateService {
  check(input: ProceduralGateInput): ProceduralGateResult {
    const proceduralWarnings: string[] = [];
    const completenessGaps: string[] = [];
    const { kind, caseDetails } = input;
    const facts = caseDetails.toLowerCase();
    const kindLower = kind.toLowerCase();

    if (kindMatches(kindLower, APPEAL_KINDS) && factsMatch(facts, /maintenance only|interim maintenance|crpc 125|bnss 144/i)) {
      proceduralWarnings.push(
        'Facts describe a maintenance matter but document kind is an appeal — verify whether appeal, revision, or fresh maintenance petition is maintainable before filing.',
      );
    }

    if (kindMatches(kindLower, BAIL_KINDS) && factsMatch(facts, /civil suit|money recovery|partition|injunction suit/i)) {
      proceduralWarnings.push(
        'Facts suggest a civil dispute but document kind is bail — confirm criminal proceedings exist and bail is the correct remedy.',
      );
    }

    if (kindMatches(kindLower, MAINTENANCE_KINDS) && factsMatch(facts, /appeal against|challenge order|set aside conviction/i)) {
      proceduralWarnings.push(
        'Facts mention challenging an order or conviction but document kind is maintenance — verify the correct procedural vehicle (appeal/revision/writ vs maintenance).',
      );
    }

    if (
      factsMatch(facts, /appeal maintenance order|challenge maintenance order/i) &&
      !kindMatches(kindLower, APPEAL_KINDS) &&
      !kindMatches(kindLower, REVISION_KINDS) &&
      !kindMatches(kindLower, WRIT_KINDS)
    ) {
      proceduralWarnings.push(
        'User may intend to challenge a maintenance order — confirm whether criminal appeal, family court appeal, revision, or writ is maintainable; do not assume.',
      );
    }

    if (
      kindMatches(kindLower, CIVIL_SUIT_KINDS) &&
      factsMatch(
        facts,
        /\b(bail|fir|chargesheet|charge[-\s]?sheet|accused|arrested|criminal\s+(?:proceedings?|case)|offence)\b/i,
      )
    ) {
      proceduralWarnings.push(
        'Facts reference criminal proceedings but document kind is civil — verify cause of action and correct forum.',
      );
    }

    if (input.countryCode === 'IN' && kindMatches(kindLower, APPEAL_KINDS)) {
      for (const section of APPEAL_SECTIONS) {
        if (!facts.includes(section) && section !== 'verification') {
          completenessGaps.push(`Appeal drafts typically require a ${section} section — confirm before filing.`);
        }
      }
    }

    if (kindMatches(kindLower, WRIT_KINDS)) {
      for (const section of WRIT_SECTIONS) {
        if (!facts.includes(section) && !['affidavit', 'delay'].includes(section)) {
          completenessGaps.push(`Writ petitions typically require ${section} — add if applicable.`);
        }
      }
      if (!facts.match(/delay|condonation|limitation/i)) {
        completenessGaps.push('Writ petitions often require delay/limitation explanation if relief is time-barred.');
      }
    }

    if (kindMatches(kindLower, CONTRACT_KINDS)) {
      for (const section of CONTRACT_SECTIONS) {
        if (!facts.includes(section.replace(' ', '')) && !facts.includes(section)) {
          completenessGaps.push(`Contract/agreement drafts typically address ${section}.`);
        }
      }
    }

    const commercial = evaluateCommercialSummarySuitProcedure({
      kind,
      facts: caseDetails,
      courtName: input.courtName,
    });
    for (const issue of commercial.issues) {
      const message = `[${issue.field}] ${issue.message}`;
      if (issue.severity === 'critical' || issue.severity === 'high') {
        proceduralWarnings.push(message);
      } else {
        completenessGaps.push(message);
      }
    }

    return { proceduralWarnings, completenessGaps };
  }

  buildPromptBlock(result: ProceduralGateResult): string {
    if (result.proceduralWarnings.length === 0 && result.completenessGaps.length === 0) {
      return '';
    }
    const lines = ['PROCEDURAL & COMPLETENESS CHECK (address in draft or flag as [TO BE CONFIRMED]):'];
    for (const w of result.proceduralWarnings) {
      lines.push(`- WARNING: ${w}`);
    }
    for (const g of result.completenessGaps) {
      lines.push(`- GAP: ${g}`);
    }
    return lines.join('\n');
  }
}
