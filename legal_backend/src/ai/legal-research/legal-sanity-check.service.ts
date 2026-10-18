import { Injectable } from '@nestjs/common';
import {
  getResearchOverlay,
  type ForbiddenPattern,
} from '@/config/jurisdictions/research-overlays';

export interface LegalSanityCheckResult {
  passed: boolean;
  /** Human-readable correction messages for each triggered forbidden pattern. */
  violations: string[];
}

/**
 * Generic forbidden patterns that apply to all jurisdictions. These block
 * dangerous/overconfident legal statements and disclaimer-as-substitute output.
 */
export const GENERIC_LEGAL_FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  // ── Outcome absolutism ──────────────────────────────────────────────────────
  {
    pattern: /case citations are (ai|computer)[-\s]?generated/i,
    message:
      'Do not output a blanket "citations are AI-generated" disclaimer. Remove or label unverified citations instead of disclaiming all of them.',
  },
  {
    pattern: /\bcourts will always\b/i,
    message: 'Avoid absolute court-outcome predictions ("courts will always ...").',
  },
  {
    pattern: /\bguaranteed to (win|succeed)\b/i,
    message: 'Avoid guaranteed legal-outcome claims.',
  },
  {
    pattern: /\byou will (definitely|certainly) (win|succeed)\b/i,
    message: 'Avoid absolute success predictions; outcomes depend on facts, evidence, and local practice.',
  },
  {
    pattern: /\b(?:the )?(?:court|tribunal) will (?:grant|allow|dismiss|reject)\b/i,
    message:
      'Avoid unconditional court-outcome predictions. Calibrate the conclusion to the legal test, evidence, adverse considerations, and judicial discretion.',
  },
  {
    pattern: /\bthere is (absolutely )?no defence\b/i,
    message:
      'Avoid absolute "no defence" statements unless verified by authority and facts. Prefer "on the retrieved authorities, the stronger position is ...".',
  },
  {
    pattern: /\bthis is always illegal\b/i,
    message: 'Avoid absolute legality claims ("this is always illegal"); state the governing rule and its conditions.',
  },
  {
    pattern: /strict liability[^.]{0,40}\bmere\b[^.]{0,40}guilt/i,
    message: 'Do not collapse statutory ingredients into automatic guilt under a "strict liability" label.',
  },
  {
    pattern: /\b(?:xyz\s+v\.?\s+abc|foo\s+v\.?\s+bar|some case|leading case|\[(?:case|authority|citation)[^\]]*\])\b/i,
    message:
      'Remove placeholder case/citation text. Use only an identified authority from the evidence pack or state the retrieval gap.',
  },

  // ── Matrimonial false-complaint nuance ─────────────────────────────────────
  {
    pattern:
      /(?:dismissal|dismissed|acquittal|acquitted|discharge|closure)[^.]{0,90}(?:therefore|thus|consequently|by itself proves?|automatically establishes?|means that)[^.]{0,100}(?:(?:false|fabricated|malicious)[^.]{0,30}(?:complaint|case|allegation)|(?:complaint|case|allegation)[^.]{0,30}(?:false|fabricated|malicious))/i,
    message:
      'Dismissal, discharge, closure, or acquittal does not automatically prove a matrimonial complaint was knowingly false. Analyse the reason for the outcome, knowledge/good faith, corroboration, adverse material, and the civil standard.',
  },
  {
    pattern:
      /(?:false|fabricated|malicious) (?:complaint|case|allegation)[^.]{0,80}(?:solely|merely|because)[^.]{0,60}(?:dismissed|acquitted|discharged|closed)/i,
    message:
      'Do not infer falsity solely from an unsuccessful proceeding. Distinguish good-faith but unproved allegations from knowingly false or reckless allegations.',
  },

  // ── Registration / formality absolutism ────────────────────────────────────
  {
    pattern: /unregistered[^.]{0,60}(?:document|deed|agreement|contract)[^.]{0,80}(?:\bis\b[^.]{0,20}\b(?:void|illegal|invalid|unenforceable)\b|cannot be used as evidence|has no legal (?:effect|force|value))\b/i,
    message:
      'Avoid absolute "unregistered = void/unenforceable/inadmissible" statements. Many jurisdictions and statutes contain proviso exceptions (e.g. Registration Act, 1908, s.49 proviso for specific performance). State the specific statutory bar and any applicable exceptions rather than treating non-registration as a blanket nullity.',
  },
  {
    pattern: /oral (?:agreement|contract)[^.]{0,60}(?:cannot be enforced|is not enforceable|has no legal effect|is void|is unenforceable)/i,
    message:
      'Avoid absolute "oral agreement = unenforceable" statements. Many jurisdictions allow oral contracts in general (and some require writing only for specific transactions such as sale of immovable property or consumer credit). Identify the specific statutory writing requirement and any exceptions (part-performance, estoppel, etc.) rather than treating all oral agreements as unenforceable.',
  },
  {
    pattern: /(?:verbal|oral) (?:agreement|contract)[^.]{0,60}(?:no legal standing|legally worthless|worthless in court)/i,
    message:
      'Do not state that oral/verbal agreements have "no legal standing" or are "worthless". An oral contract may be enforceable if it meets the relevant legal requirements; writing requirements are specific to categories of transactions. Identify the applicable rule and its exceptions.',
  },

  // ── Administrative vs judicial remedy confusion ────────────────────────────
  {
    pattern: /(?:lodge|file|submit)[^.]{0,40}caveat[^.]{0,80}(?:registrar|revenue|land registry|registry office|Sub.?Registrar)/i,
    message:
      'A court caveat (e.g. CPC s.148A in India) is filed in the competent court — not with a registrar, revenue authority, or land registry. An objection/intimation to a registrar or revenue authority is a separate, often state-specific or jurisdiction-specific administrative step and is not a substitute for an injunction or court caveat. Distinguish these clearly.',
  },
  {
    pattern: /(?:file a complaint|lodge a complaint)[^.]{0,60}(?:civil court|sessions court|district court)[^.]{0,60}(?:arbitration|consumer forum|tribunal)/i,
    message:
      'Do not conflate the forum for a complaint with a court having civil/criminal jurisdiction. Arbitration, consumer forums, and tribunals are separate fora with distinct jurisdiction. Identify the correct forum for each claim.',
  },

  // ── Discretionary / "automatic" remedy errors ──────────────────────────────
  {
    pattern: /court (?:will|must|shall)[^.]{0,20}(?:grant|award|order|issue)[^.]{0,40}(?:injunction|specific performance|damages|bail|stay)[^.]{0,60}automatically/i,
    message:
      'Do not describe a discretionary judicial remedy as "automatically" granted. Injunctions, specific performance, bail, and stays are subject to conditions and the court\'s discretion (or defined criteria). State the applicable legal test rather than implying automatic entitlement.',
  },
  {
    pattern: /(?:injunction|stay|relief)[^.]{0,60}(?:automatically|will definitely|always)[^.]{0,60}(?:granted|given|awarded)/i,
    message:
      'Avoid stating that an injunction, stay, or other discretionary relief "will automatically" or "always" be granted. Courts apply specific tests (e.g. prima facie case, balance of convenience, irreparable harm for injunctions). State the applicable test.',
  },

  // ── Arrest / cognizability errors ──────────────────────────────────────────
  {
    pattern: /police[^.]{0,40}(?:can|may|will|shall)[^.]{0,20}arrest[^.]{0,40}without (?:a )?warrant[^.]{0,60}(?:non.?cognizable|bailable|civil dispute|contract|cheque|bounced)/i,
    message:
      'Do not state that police can arrest without a warrant for non-cognizable or bailable offences, or for civil disputes. Police power of arrest without warrant is limited to cognizable offences. For non-cognizable offences, a warrant or court order is required. State the correct offence classification and arrest power.',
  },
  {
    pattern: /(?:file an? FIR|lodge an? FIR)[^.]{0,80}(?:non.?cognizable|civil|contract|cheque dishonour|bounced cheque)/i,
    message:
      'An FIR can only be filed for a cognizable offence. For non-cognizable offences (e.g. cheque dishonour under NI Act s.138, many civil wrongs), the correct route is a complaint before a Magistrate — not an FIR with police. Clarify the offence classification before advising FIR filing.',
  },

  // ── Compounding / settlement absolutism ────────────────────────────────────
  {
    pattern: /compounding[^.]{0,60}automatically[^.]{0,60}(?:ends|closes|terminates|results in acquittal|discharges)/i,
    message:
      'Compounding an offence does not automatically result in acquittal, discharge, or termination of proceedings. The court must accept the compounding; for some offences, court permission is required. Post-conviction compounding may also depend on the appellate order. Do not state compounding outcomes as automatic.',
  },
  {
    pattern: /(?:settlement|compromise)[^.]{0,60}automatically[^.]{0,60}(?:ends|closes|extinguishes|bars)[^.]{0,40}(?:criminal|proceedings|case|suit)/i,
    message:
      'A civil settlement or compromise does not automatically end, extinguish, or bar related criminal proceedings unless the offence is compoundable and the court accepts the compounding. Distinguish civil settlement from criminal compounding and state the applicable rules.',
  },

  // ── Limitation absolutism ──────────────────────────────────────────────────
  {
    pattern: /limitation[^.]{0,60}(?:can never be|cannot be)[^.]{0,30}(?:extended|condoned|waived|excused)/i,
    message:
      'Avoid absolute "limitation can never be extended/condoned" statements. While limitation for suits generally cannot be condoned (no s.5 Limitation Act for suits), limitation for appeals and applications may be condoned under s.5 if sufficient cause is shown. Also, some special statutes carry their own condonation provisions. Identify the specific proceeding type and applicable rule.',
  },

  // ── Jurisdiction absolutism ────────────────────────────────────────────────
  {
    pattern: /no appeal (?:lies|can be filed|is available|exists)[^.]{0,60}(?:against|from)[^.]{0,60}(?:order|judgment|award|decision)/i,
    message:
      'Avoid absolute "no appeal lies" statements without citing the specific statutory bar. Most judicial/quasi-judicial orders have some appeal, revision, or review mechanism (even if restricted). Identify the applicable appellate/revisional provision and state the grounds and limitations accurately.',
  },

  // ── New-code section number discipline ─────────────────────────────────────
  {
    pattern: /(?:corresponds? to|equivalent to|same as)[^.]{0,60}(?:IPC|CrPC|Evidence Act)[^.]{0,20}s\.?\s*\d+[^.]{0,60}(?:BNS|BNSS|BSA|new code)/i,
    message:
      'When mapping section numbers between old and new criminal codes (IPC→BNS, CrPC→BNSS, Evidence Act→BSA), verify the correspondence from the official text — section numbers frequently change. Do not assume the IPC/CrPC/Evidence Act section number equals the BNS/BNSS/BSA section number.',
  },
  {
    pattern: /(?:BNS|BNSS|BSA)[^.]{0,20}s\.?\s*\d+[^.]{0,60}(?:same section|same provision|unchanged from|identical to)[^.]{0,60}(?:IPC|CrPC|Evidence Act)/i,
    message:
      'Do not assume that BNS/BNSS/BSA section numbers are unchanged from the predecessor IPC/CrPC/Evidence Act. The new codes renumber many provisions. Verify the correct section in the new code from official India Code / Gazette text.',
  },
];

@Injectable()
export class LegalSanityCheckService {
  /**
   * Runs deterministic forbidden-pattern checks against generated legal research
   * output. Combines generic patterns with the jurisdiction overlay's patterns.
   * Returns the set of violation messages so the caller can drive a block-and-repair
   * regeneration and/or surface a visible warning.
   */
  check(params: {
    outputMarkdown: string;
    countryCode?: string | null;
  }): LegalSanityCheckResult {
    const { outputMarkdown } = params;
    const violations: string[] = [];

    const overlay = getResearchOverlay(params.countryCode);
    const patterns: ForbiddenPattern[] = [
      ...GENERIC_LEGAL_FORBIDDEN_PATTERNS,
      ...(overlay?.forbiddenPatterns ?? []),
    ];

    for (const { pattern, message } of patterns) {
      if (pattern.test(outputMarkdown)) {
        violations.push(message);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Builds a correction instruction block from violation messages, to be appended
   * to the regeneration prompt so the model fixes the exact issues.
   */
  buildCorrectionInstructions(violations: string[]): string {
    if (violations.length === 0) return '';
    return [
      'LEGAL ACCURACY CORRECTIONS REQUIRED — your prior draft contained the following errors. Fix every one of them:',
      ...violations.map((v, i) => `  ${i + 1}. ${v}`),
      'Re-state the affected propositions accurately. Do not reintroduce any of these errors.',
    ].join('\n');
  }
}
