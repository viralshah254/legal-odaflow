import { Injectable } from '@nestjs/common';
import { findRemap } from '@/legal-search/statute-registry';
import {
  BailSectionResolverService,
  type BailSectionResult,
} from './bail-section-resolver.service';
import type {
  GoverningSection,
  ProceduralRouterResult,
} from './drafting/draft-procedural-router.types';
import { getSectionChapterMeta } from './legal-section-chapters';
import type { LegalDomain } from './legal-research/legal-research-classifier.service';
import { allowsCriminalGrounding } from '@/legal-search/legal-domain-profile';

export type LegalSectionConsumer =
  | 'legal_research'
  | 'india_draft_v1'
  | 'drafting_v2'
  | 'unified_drafting';

export type CodeFamily = 'current' | 'legacy' | 'unknown';

export interface LegalSectionRouterInput {
  countryCode: string;
  rawFacts: string;
  consumer: LegalSectionConsumer;
  documentKind?: string;
  query?: string;
  courtName?: string;
  filingDate?: string;
  offenceDate?: string;
  priorRejection?: boolean;
  legalDomain?: LegalDomain;
}

export interface LegalSectionRouteResult {
  governingSections: GoverningSection[];
  substantiveSections: GoverningSection[];
  proceduralSections: GoverningSection[];
  bailResolution?: BailSectionResult;
  codeFamily: CodeFamily;
  missingFacts: string[];
  warnings: string[];
  promptBlocks: {
    research: string;
    drafting: string;
  };
}

const CURRENT_CODE_START = Date.UTC(2024, 6, 1); // 1 July 2024

const COMMON_OFFENCE_REMAPS: Array<{
  pattern: RegExp;
  section: GoverningSection;
}> = [
  {
    pattern: /\b(?:ipc\s*§?\s*302|section\s*302\s*(?:of\s*)?ipc|murder)\b/i,
    section: {
      actId: 'bns',
      section: '101',
      label: 'BNS §101 (murder)',
      predecessor: { actId: 'ipc', section: '302' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*376|section\s*376\s*(?:of\s*)?ipc|rape)\b/i,
    section: {
      actId: 'bns',
      section: '63',
      label: 'BNS §63 (rape)',
      predecessor: { actId: 'ipc', section: '376' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*354d|section\s*354d\s*(?:of\s*)?ipc|stalking)\b/i,
    section: {
      actId: 'bns',
      section: '78',
      label: 'BNS §78 (stalking)',
      predecessor: { actId: 'ipc', section: '354D' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*354a|section\s*354a\s*(?:of\s*)?ipc|sexual\s+harass)\b/i,
    section: {
      actId: 'bns',
      section: '75',
      label: 'BNS §75 (sexual harassment)',
      predecessor: { actId: 'ipc', section: '354A' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*323|section\s*323\s*(?:of\s*)?ipc|voluntarily\s+causing\s+hurt|assault)\b/i,
    section: {
      actId: 'bns',
      section: '115',
      label: 'BNS §115 (voluntarily causing hurt)',
      predecessor: { actId: 'ipc', section: '323' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*379|section\s*379\s*(?:of\s*)?ipc|theft|stole|stolen)\b/i,
    section: {
      actId: 'bns',
      section: '303',
      label: 'BNS §303 (theft)',
      predecessor: { actId: 'ipc', section: '379' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*392|section\s*392\s*(?:of\s*)?ipc|robbery)\b/i,
    section: {
      actId: 'bns',
      section: '309',
      label: 'BNS §309 (theft, extortion and robbery)',
      predecessor: { actId: 'ipc', section: '392' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*395|section\s*395\s*(?:of\s*)?ipc|dacoity)\b/i,
    section: {
      actId: 'bns',
      section: '310',
      label: 'BNS §310 (dacoity — five or more persons)',
      predecessor: { actId: 'ipc', section: '395' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*420|section\s*420\s*(?:of\s*)?ipc|cheat(?:ing|ed)?)\b/i,
    section: {
      actId: 'bns',
      section: '318',
      label: 'BNS §318 (cheating)',
      predecessor: { actId: 'ipc', section: '420' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*506|section\s*506\s*(?:of\s*)?ipc|criminal\s+intimidat)\b/i,
    section: {
      actId: 'bns',
      section: '351',
      label: 'BNS §351 (criminal intimidation)',
      predecessor: { actId: 'ipc', section: '506' },
    },
  },
  {
    pattern: /\b(?:ipc\s*§?\s*498a|section\s*498a\s*(?:of\s*)?ipc|cruelty\s+by\s+husband)\b/i,
    section: {
      actId: 'bns',
      section: '85',
      label: 'BNS §85 (cruelty by husband or relatives)',
      predecessor: { actId: 'ipc', section: '498A' },
    },
  },
  {
    pattern: /\b(?:ni\s*act\s*§?\s*138|cheque\s+bounce|dishonou?r(?:ed)?\s+cheque)\b/i,
    section: {
      actId: 'ni_act',
      section: '138',
      label: 'NI Act §138 (dishonour of cheque)',
    },
  },
];

const ACT_ALIASES: Record<string, string> = {
  BNS: 'bns',
  BNSS: 'bnss',
  BSA: 'bsa',
  IPC: 'ipc',
  CRPC: 'crpc',
  IEA: 'iea',
  'NI ACT': 'ni_act',
  NDPS: 'ndps',
  POCSO: 'pocso',
  PMLA: 'pmla',
};

const IPC_TO_BNS_COMMON: Record<string, GoverningSection> = {
  '302': {
    actId: 'bns',
    section: '101',
    label: 'BNS §101 (murder)',
    predecessor: { actId: 'ipc', section: '302' },
  },
  '307': {
    actId: 'bns',
    section: '109',
    label: 'BNS §109 (attempt to murder)',
    predecessor: { actId: 'ipc', section: '307' },
  },
  '376': {
    actId: 'bns',
    section: '63',
    label: 'BNS §63 (rape)',
    predecessor: { actId: 'ipc', section: '376' },
  },
  '354D': {
    actId: 'bns',
    section: '78',
    label: 'BNS §78 (stalking)',
    predecessor: { actId: 'ipc', section: '354D' },
  },
  '392': {
    actId: 'bns',
    section: '309',
    label: 'BNS §309 (robbery)',
    predecessor: { actId: 'ipc', section: '392' },
  },
  '395': {
    actId: 'bns',
    section: '310',
    label: 'BNS §310 (dacoity)',
    predecessor: { actId: 'ipc', section: '395' },
  },
  '397': {
    actId: 'bns',
    section: '311',
    label: 'BNS §311 (robbery/dacoity with deadly weapon or grievous hurt)',
    predecessor: { actId: 'ipc', section: '397' },
  },
  '379': {
    actId: 'bns',
    section: '303',
    label: 'BNS §303 (theft)',
    predecessor: { actId: 'ipc', section: '379' },
  },
  '323': {
    actId: 'bns',
    section: '115',
    label: 'BNS §115 (voluntarily causing hurt)',
    predecessor: { actId: 'ipc', section: '323' },
  },
  '354A': {
    actId: 'bns',
    section: '75',
    label: 'BNS §75 (sexual harassment)',
    predecessor: { actId: 'ipc', section: '354A' },
  },
  '506': {
    actId: 'bns',
    section: '351',
    label: 'BNS §351 (criminal intimidation)',
    predecessor: { actId: 'ipc', section: '506' },
  },
  '420': {
    actId: 'bns',
    section: '318',
    label: 'BNS §318 (cheating)',
    predecessor: { actId: 'ipc', section: '420' },
  },
  '498A': {
    actId: 'bns',
    section: '85',
    label: 'BNS §85 (cruelty by husband or relatives)',
    predecessor: { actId: 'ipc', section: '498A' },
  },
};

const CRPC_TO_BNSS_COMMON: Record<string, GoverningSection> = {
  '125': {
    actId: 'bnss',
    section: '144',
    label: 'BNSS §144 (maintenance)',
    predecessor: { actId: 'crpc', section: '125' },
  },
  '227': {
    actId: 'bnss',
    section: '250',
    label: 'BNSS §250 (discharge — Sessions trial)',
    predecessor: { actId: 'crpc', section: '227' },
  },
  '228': {
    actId: 'bnss',
    section: '251',
    label: 'BNSS §251 (framing of charge — Sessions trial)',
    predecessor: { actId: 'crpc', section: '228' },
  },
  '229': {
    actId: 'bnss',
    section: '252',
    label: 'BNSS §252 (conviction on plea of guilty — Sessions trial)',
    predecessor: { actId: 'crpc', section: '229' },
  },
  '239': {
    actId: 'bnss',
    section: '262',
    label: 'BNSS §262 (discharge — warrant case)',
    predecessor: { actId: 'crpc', section: '239' },
  },
  '240': {
    actId: 'bnss',
    section: '263',
    label: 'BNSS §263 (framing of charge — warrant case)',
    predecessor: { actId: 'crpc', section: '240' },
  },
  '241': {
    actId: 'bnss',
    section: '264',
    label: 'BNSS §264 (conviction on plea of guilty — warrant case)',
    predecessor: { actId: 'crpc', section: '241' },
  },
  '251': {
    actId: 'bnss',
    section: '274',
    label: 'BNSS §274 (substance of accusation — summons case)',
    predecessor: { actId: 'crpc', section: '251' },
  },
  '252': {
    actId: 'bnss',
    section: '275',
    label: 'BNSS §275 (conviction on plea of guilty — summons case)',
    predecessor: { actId: 'crpc', section: '252' },
  },
  '437': {
    actId: 'bnss',
    section: '480',
    label: 'BNSS §480 (bail in non-bailable offences — Magistrate)',
    predecessor: { actId: 'crpc', section: '437' },
  },
  '438': {
    actId: 'bnss',
    section: '482',
    label: 'BNSS §482 (anticipatory bail)',
    predecessor: { actId: 'crpc', section: '438' },
  },
  '439': {
    actId: 'bnss',
    section: '483',
    label: 'BNSS §483 (special powers of Sessions Court / High Court)',
    predecessor: { actId: 'crpc', section: '439' },
  },
};

function dedupeSections(sections: GoverningSection[]): GoverningSection[] {
  const seen = new Set<string>();
  const out: GoverningSection[] = [];
  for (const section of sections) {
    const key = `${section.actId}:${section.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(section);
  }
  return out;
}

function parseDateLike(raw?: string): number | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAny(haystack: string, pattern: RegExp): boolean {
  return pattern.test(haystack);
}

@Injectable()
export class LegalSectionRouterService {
  constructor(private readonly bailResolver: BailSectionResolverService) {}

  resolve(input: LegalSectionRouterInput): LegalSectionRouteResult {
    const country = input.countryCode.toUpperCase();
    const rawFacts = input.rawFacts ?? '';
    const haystack = `${rawFacts}\n${input.query ?? ''}\n${input.documentKind ?? ''}\n${input.courtName ?? ''}`;

    if (country !== 'IN') {
      return this.empty('unknown', [], ['LegalSectionRouter currently applies India grounding only.']);
    }

    const codeFamily = this.resolveCodeFamily(input);
    const missingFacts = this.findMissingFacts(haystack, input);
    const warnings: string[] = [];
    const proceduralSections: GoverningSection[] = [];
    const allowCriminalGrounding = allowsCriminalGrounding(input.legalDomain, haystack);
    const substantiveSections = allowCriminalGrounding
      ? this.resolveSubstantiveSections(haystack)
      : [];
    const bailResolution = allowCriminalGrounding ? this.resolveBail(haystack, input) : undefined;

    if (codeFamily === 'unknown') {
      warnings.push(
        'Offence date / filing date is not clear. Verify IPC/CrPC versus BNS/BNSS applicability before filing.',
      );
    }

    if (bailResolution) {
      proceduralSections.push(this.sectionFromBail(bailResolution));
    }

    const explicit = this.extractExplicitSections(haystack);
    substantiveSections.push(
      ...explicit.filter((s) => !['bnss', 'crpc'].includes(s.actId)),
    );
    proceduralSections.push(
      ...explicit.filter((s) => ['bnss', 'crpc'].includes(s.actId)),
    );
    if (allowCriminalGrounding) {
      proceduralSections.push(...this.resolveCriminalProcedureSections(haystack));
      proceduralSections.push(...this.resolveSpecialActBars(haystack));
    }

    const governingSections = dedupeSections([...proceduralSections, ...substantiveSections]);
    const result: Omit<LegalSectionRouteResult, 'promptBlocks'> = {
      governingSections,
      substantiveSections: dedupeSections(substantiveSections),
      proceduralSections: dedupeSections(proceduralSections),
      bailResolution,
      codeFamily,
      missingFacts,
      warnings,
    };

    return {
      ...result,
      promptBlocks: {
        research: this.buildResearchPromptBlock(result),
        drafting: this.buildDraftingPromptBlock(result),
      },
    };
  }

  enrichProceduralResult(
    procedural: ProceduralRouterResult,
    input: LegalSectionRouterInput,
  ): ProceduralRouterResult {
    const route = this.resolve(input);
    return {
      ...procedural,
      governingSections: dedupeSections([
        ...procedural.governingSections,
        ...route.governingSections,
      ]),
      maintainabilityNotes: [
        ...procedural.maintainabilityNotes,
        ...route.warnings,
      ],
      completenessGaps: [
        ...procedural.completenessGaps,
        ...route.missingFacts,
      ],
    };
  }

  private empty(
    codeFamily: CodeFamily,
    missingFacts: string[],
    warnings: string[],
  ): LegalSectionRouteResult {
    return {
      governingSections: [],
      substantiveSections: [],
      proceduralSections: [],
      codeFamily,
      missingFacts,
      warnings,
      promptBlocks: { research: '', drafting: '' },
    };
  }

  private resolveCodeFamily(input: LegalSectionRouterInput): CodeFamily {
    const offenceDate = parseDateLike(input.offenceDate);
    const filingDate = parseDateLike(input.filingDate);
    const haystack = `${input.rawFacts ?? ''}\n${input.query ?? ''}`;

    const explicitLegacy =
      /\bipc\b|\bcrpc\b|before\s+1\s+july\s+2024|prior\s+to\s+1\s+july\s+2024/i.test(haystack);
    const explicitCurrent =
      /\bbns\b|\bbnss\b|after\s+1\s+july\s+2024|post\s+1\s+july\s+2024/i.test(haystack);

    if (offenceDate !== null) return offenceDate >= CURRENT_CODE_START ? 'current' : 'legacy';
    if (filingDate !== null) return filingDate >= CURRENT_CODE_START ? 'current' : 'legacy';
    if (explicitCurrent && !explicitLegacy) return 'current';
    if (explicitLegacy && !explicitCurrent) return 'legacy';
    return 'unknown';
  }

  private findMissingFacts(haystack: string, input: LegalSectionRouterInput): string[] {
    const gaps: string[] = [];
    const isCriminal =
      /bail|fir|charge|accused|arrest|robbery|rape|murder|ndps|pocso|pmla|cheque|guilty|plea/i.test(
        haystack,
      );

    if (!isCriminal) return gaps;

    if (!input.offenceDate && !/date\s+of\s+offen[cs]e|offen[cs]e\s+date|fir\s+date/i.test(haystack)) {
      gaps.push('Confirm offence/FIR date to select IPC/CrPC versus BNS/BNSS.');
    }
    if (/bail|guilty|plea|charge|discharge/i.test(haystack) && !input.courtName && !/magistrate|sessions|high court|court of session/i.test(haystack)) {
      gaps.push('Confirm forum/court (Magistrate, Sessions Court, or High Court).');
    }
    if (/robbery|dacoity/i.test(haystack) && !/weapon|hurt|injur|grievous|five|5|accused|co-accused|night|highway/i.test(haystack)) {
      gaps.push('Confirm robbery aggravating facts: weapon, hurt/grievous hurt, and number of accused.');
    }
    if (/bail/i.test(haystack) && !/anticipatory|arrested|custody|rejected|dismissed|post.?arrest|regular bail/i.test(haystack)) {
      gaps.push('Confirm bail posture: anticipatory, regular post-arrest, or post-rejection Sessions/HC bail.');
    }
    return gaps;
  }

  private resolveBail(
    haystack: string,
    input: LegalSectionRouterInput,
  ): BailSectionResult | undefined {
    if (!/bail|anticipatory|post.?arrest|custody|bnss\s*§?\s*48[023]/i.test(haystack)) {
      return undefined;
    }
    return this.bailResolver.resolve({
      documentKind: input.documentKind ?? 'legal_research_bail',
      courtName: input.courtName,
      rawFacts: `${input.rawFacts ?? ''}\n${input.query ?? ''}`,
      priorRejection: input.priorRejection,
    });
  }

  private sectionFromBail(result: BailSectionResult): GoverningSection {
    const crpcSection = result.crpcEquivalent.match(/\d+/)?.[0] ?? '';
    return {
      actId: 'bnss',
      section: result.section,
      label: result.label,
      predecessor: crpcSection ? { actId: 'crpc', section: crpcSection } : undefined,
    };
  }

  private resolveSubstantiveSections(haystack: string): GoverningSection[] {
    const sections: GoverningSection[] = [];
    for (const remap of COMMON_OFFENCE_REMAPS) {
      if (hasAny(haystack, remap.pattern)) sections.push(remap.section);
    }
    return dedupeSections(sections);
  }

  private extractExplicitSections(haystack: string): GoverningSection[] {
    const sections: GoverningSection[] = [];
    const refPattern =
      /\b(BNSS|BNS|BSA|IPC|CrPC|IEA|NI\s+Act|NDPS|POCSO|PMLA)\s*(?:Act)?\s*(?:§|s\.?|sec(?:tion)?\.?)?\s*(\d+[A-Z]?)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = refPattern.exec(haystack)) !== null) {
      const actRaw = match[1].replace(/\s+/g, ' ').toUpperCase();
      const actId = ACT_ALIASES[actRaw];
      const section = match[2].toUpperCase();
      if (!actId) continue;

      if (actId === 'ipc' && IPC_TO_BNS_COMMON[section]) {
        sections.push(IPC_TO_BNS_COMMON[section]);
        continue;
      }
      if (actId === 'crpc' && CRPC_TO_BNSS_COMMON[section]) {
        sections.push(CRPC_TO_BNSS_COMMON[section]);
        continue;
      }

      // Full Schedule I crosswalk (300+ entries) for legacy → current remaps.
      if (actId === 'ipc' || actId === 'crpc' || actId === 'iea') {
        const remap = findRemap('IN', actId, section);
        if (remap) {
          const toAct = remap.to.actId.toUpperCase();
          sections.push({
            actId: remap.to.actId,
            section: remap.to.section,
            label: `${toAct} §${remap.to.section}${remap.note ? ` (${remap.note})` : ''}`,
            predecessor: { actId, section },
          });
          continue;
        }
      }

      sections.push({
        actId,
        section,
        label: `${actRaw} §${section}`,
      });
    }
    return dedupeSections(sections);
  }

  private resolveCriminalProcedureSections(haystack: string): GoverningSection[] {
    const sections: GoverningSection[] = [];

    if (/guilty\s+plea|plead\s+guilty|plea\s+of\s+guilty/i.test(haystack)) {
      if (/sessions court|court of sessions|sessions trial/i.test(haystack)) {
        sections.push({
          actId: 'bnss',
          section: '252',
          label: 'BNSS §252 (conviction on plea of guilty — Sessions trial)',
          predecessor: { actId: 'crpc', section: '229' },
        });
      } else if (/summons case|summons trial/i.test(haystack)) {
        sections.push({
          actId: 'bnss',
          section: '275',
          label: 'BNSS §275 (conviction on plea of guilty — summons case)',
          predecessor: { actId: 'crpc', section: '252' },
        });
      } else {
        sections.push({
          actId: 'bnss',
          section: '264',
          label: 'BNSS §264 (conviction on plea of guilty — warrant case)',
          predecessor: { actId: 'crpc', section: '241' },
        });
      }
    }

    if (/charge\s+framing|framing\s+of\s+charge|charge\s+objection|contest.*charge/i.test(haystack)) {
      const isSessions = /sessions court|court of sessions|sessions trial/i.test(haystack);
      sections.push(
        isSessions
          ? {
              actId: 'bnss',
              section: '251',
              label: 'BNSS §251 (framing of charge — Sessions trial)',
              predecessor: { actId: 'crpc', section: '228' },
            }
          : {
              actId: 'bnss',
              section: '263',
              label: 'BNSS §263 (framing of charge — warrant case)',
              predecessor: { actId: 'crpc', section: '240' },
            },
      );
    }

    if (/discharge|discharged/i.test(haystack)) {
      const isSessions = /sessions court|court of sessions|sessions trial/i.test(haystack);
      sections.push(
        isSessions
          ? {
              actId: 'bnss',
              section: '250',
              label: 'BNSS §250 (discharge — Sessions trial)',
              predecessor: { actId: 'crpc', section: '227' },
            }
          : {
              actId: 'bnss',
              section: '262',
              label: 'BNSS §262 (discharge — warrant case on police report)',
              predecessor: { actId: 'crpc', section: '239' },
            },
      );
    }

    if (/plea\s+bargain|plea[-\s]?bargaining/i.test(haystack)) {
      sections.push(
        { actId: 'bnss', section: '289', label: 'BNSS §289 (application of plea bargaining)' },
        { actId: 'bnss', section: '290', label: 'BNSS §290 (application for plea bargaining)' },
      );
    }

    if (/appeal|convict(?:ed|ion).*guilty|plea.*appeal/i.test(haystack)) {
      sections.push({
        actId: 'bnss',
        section: '416',
        label: 'BNSS §416 (appeal after conviction on guilty plea)',
      });
    }

    return dedupeSections(sections);
  }

  private resolveSpecialActBars(haystack: string): GoverningSection[] {
    const sections: GoverningSection[] = [];
    if (/\bndps\b|narcotic|psychotropic|ganja|charas|heroin|cocaine/i.test(haystack)) {
      sections.push({ actId: 'ndps', section: '37', label: 'NDPS Act §37 (bail restrictions)' });
    }
    if (/\bpocso\b|minor victim|child sexual/i.test(haystack)) {
      sections.push({ actId: 'pocso', section: '29', label: 'POCSO Act §29 (presumption)' });
      sections.push({ actId: 'pocso', section: '30', label: 'POCSO Act §30 (culpable mental state)' });
    }
    if (/\bpmla\b|money laundering|ed case|enforcement directorate/i.test(haystack)) {
      sections.push({ actId: 'pmla', section: '45', label: 'PMLA §45 (bail conditions)' });
    }
    return dedupeSections(sections);
  }

  private buildResearchPromptBlock(
    result: Omit<LegalSectionRouteResult, 'promptBlocks'>,
  ): string {
    if (
      result.governingSections.length === 0 &&
      result.missingFacts.length === 0 &&
      result.warnings.length === 0
    ) {
      return '';
    }
    return [
      '=== RESOLVED LEGAL SECTION ROUTING (India) ===',
      ...this.renderSections(result),
      ...result.warnings.map((w) => `- TRANSITION WARNING: ${w}`),
      ...result.missingFacts.map((g) => `- MISSING FACT: ${g}`),
      '- Do not cite a procedural section unless it matches the resolved forum/track or is explicitly identified as alternative context.',
      '- For similar caselaw using IPC/CrPC, remap to BNS/BNSS before relying on the section number.',
    ].join('\n');
  }

  private buildDraftingPromptBlock(
    result: Omit<LegalSectionRouteResult, 'promptBlocks'>,
  ): string {
    if (
      result.governingSections.length === 0 &&
      result.missingFacts.length === 0 &&
      result.warnings.length === 0
    ) {
      return '';
    }
    return [
      'RESOLVED STATUTE ROUTING:',
      ...this.renderSections(result),
      ...result.warnings.map((w) => `- TRANSITION WARNING: ${w}`),
      ...result.missingFacts.map((g) => `- MISSING FACT: ${g}`),
      result.bailResolution
        ? `BAIL PROVISION (resolved): ${result.bailResolution.label} — ${result.bailResolution.reasoning}.`
        : '',
      'Use these resolved sections as the grounding truth. If facts are missing, use [BLANK] placeholders and do not overstate maintainability.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private renderSections(result: Omit<LegalSectionRouteResult, 'promptBlocks'>): string[] {
    if (result.governingSections.length === 0) return ['- No deterministic governing section resolved.'];
    return result.governingSections.map((section) => {
      const pred = section.predecessor
        ? ` (legacy: ${section.predecessor.actId.toUpperCase()} §${section.predecessor.section})`
        : '';
      const chapter = getSectionChapterMeta(section.actId, section.section)?.chapterTitle;
      return `- ${section.label}${chapter ? ` [Chapter: ${chapter}]` : ''}${pred}`;
    });
  }
}
