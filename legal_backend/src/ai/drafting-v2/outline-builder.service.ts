/**
 * Stage 6 — Outline Builder
 *
 * Takes a `LegalPlan` + grounding context and produces a `DocumentOutline`:
 * an ordered list of independently generatable `SectionPlan` nodes.
 *
 * Each section gets:
 *   - Its own required ingredients, evidence, and authority refs
 *   - Its dependency list (e.g. Prayer depends on Grounds)
 *   - Its model tier (cheap for boilerplate, premium for Grounds/Arguments)
 *   - A structural guide from the reference skeleton service
 *   - Rule engine outputs relevant to this section
 *
 * The outline is the spine of every v2 document. The orchestrator walks it
 * respecting dependency order and executes generation in parallel where safe.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DraftStructuralReferenceService } from '@/ai/drafting/structural-references/reference-skeleton.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ProceduralRouterResult } from '@/ai/drafting/draft-procedural-router.types';
import type {
  LegalPlan,
  DocumentOutline,
  SectionPlan,
  SectionType,
  SectionModelTier,
  DraftV2Input,
} from './drafting-v2.types';
import { VERIFIED_BUILDING_BLOCKS } from './building-blocks.registry';

// ─── Section composition rules ────────────────────────────────────────────────

interface SectionSpec {
  type: SectionType;
  title: string;
  modelTier: SectionModelTier;
  maxTokens: number;
  /** IDs of other section types that must be built first. */
  dependsOnTypes: SectionType[];
  /** Required for filing-grade only. */
  filingGradeOnly: boolean;
}

const SECTION_SPECS: SectionSpec[] = [
  {
    type: 'heading',
    title: 'CAUSE TITLE',
    modelTier: 'mid',
    maxTokens: 900,
    dependsOnTypes: [],
    filingGradeOnly: false,
  },
  {
    type: 'parties',
    title: 'PARTIES',
    modelTier: 'cheap',
    maxTokens: 400,
    dependsOnTypes: [],
    filingGradeOnly: false,
  },
  {
    type: 'maintainability',
    title: 'MAINTAINABILITY AND JURISDICTION',
    modelTier: 'mid',
    maxTokens: 800,
    dependsOnTypes: ['facts'],
    filingGradeOnly: true,
  },
  {
    type: 'facts',
    title: 'FACTS',
    modelTier: 'mid',
    maxTokens: 2000,
    dependsOnTypes: [],
    filingGradeOnly: false,
  },
  {
    type: 'law',
    title: 'APPLICABLE LAW',
    modelTier: 'mid',
    maxTokens: 1200,
    dependsOnTypes: ['facts'],
    filingGradeOnly: false,
  },
  {
    type: 'grounds',
    title: 'GROUNDS',
    modelTier: 'premium',
    maxTokens: 3500,
    dependsOnTypes: ['facts', 'law'],
    filingGradeOnly: false,
  },
  {
    type: 'arguments',
    title: 'ARGUMENTS',
    modelTier: 'premium',
    maxTokens: 2500,
    dependsOnTypes: ['grounds'],
    filingGradeOnly: false,
  },
  {
    type: 'prayer',
    title: 'PRAYER',
    modelTier: 'mid',
    maxTokens: 600,
    dependsOnTypes: ['grounds'],
    filingGradeOnly: false,
  },
  {
    type: 'verification',
    title: 'VERIFICATION',
    modelTier: 'cheap',
    maxTokens: 300,
    dependsOnTypes: ['prayer'],
    filingGradeOnly: false,
  },
  {
    type: 'annexures',
    title: 'LIST OF ANNEXURES',
    modelTier: 'cheap',
    maxTokens: 400,
    dependsOnTypes: ['verification'],
    filingGradeOnly: false,
  },
];

/** For non-pleading documents (notices, letters, contracts), use a simpler structure. */
const NOTICE_SECTION_SPECS: SectionSpec[] = [
  { type: 'heading', title: 'HEADER', modelTier: 'cheap', maxTokens: 400, dependsOnTypes: [], filingGradeOnly: false },
  { type: 'parties', title: 'PARTIES', modelTier: 'cheap', maxTokens: 300, dependsOnTypes: ['heading'], filingGradeOnly: false },
  { type: 'facts', title: 'FACTS', modelTier: 'mid', maxTokens: 1500, dependsOnTypes: ['parties'], filingGradeOnly: false },
  { type: 'grounds', title: 'LEGAL GROUNDS', modelTier: 'premium', maxTokens: 2000, dependsOnTypes: ['facts'], filingGradeOnly: false },
  { type: 'prayer', title: 'DEMAND / RELIEF', modelTier: 'mid', maxTokens: 600, dependsOnTypes: ['grounds'], filingGradeOnly: false },
  { type: 'verification', title: 'CLOSING', modelTier: 'cheap', maxTokens: 250, dependsOnTypes: ['prayer'], filingGradeOnly: false },
];

@Injectable()
export class OutlineBuilderService {
  constructor(
    private readonly structuralReference: DraftStructuralReferenceService,
  ) {}

  build(
    plan: LegalPlan,
    grounding: {
      authorities: RetrievedAuthority[];
      statuteGrounding: string;
    },
    input: DraftV2Input,
    profile: MatterProfile,
    proceduralResult: ProceduralRouterResult,
  ): DocumentOutline {
    const isPleading = ['pleading', 'application', 'form'].includes(plan.documentClass);
    const specs = isPleading ? SECTION_SPECS : NOTICE_SECTION_SPECS;

    // Filter specs to what's needed for this document kind
    const applicableSpecs = specs.filter((spec) => {
      if (spec.filingGradeOnly && !plan.filingGrade) return false;
      // Only include ARGUMENTS for complex filing-grade pleadings
      if (spec.type === 'arguments' && !plan.filingGrade) return false;
      // Check if this section type is in the mandatory sections list
      if (
        spec.type !== 'heading' &&
        spec.type !== 'parties' &&
        spec.type !== 'verification'
      ) {
        const sectionTitleMatch = plan.mandatorySections.some((s) => {
          const mandatory = s.toLowerCase();
          const specTitle = spec.title.toLowerCase();
          const specFirst = specTitle.split(' ')[0] ?? '';
          return mandatory.includes(specFirst) || specTitle.includes(mandatory);
        });
        if (!sectionTitleMatch && spec.type !== 'grounds' && spec.type !== 'facts' && spec.type !== 'prayer') {
          return false;
        }
      }
      return true;
    });

    // Build section plans with dependency IDs resolved
    const sectionIdMap = new Map<SectionType, string>();
    const sections: SectionPlan[] = applicableSpecs.map((spec, idx) => {
      const id = `section-${spec.type}-${idx}`;
      sectionIdMap.set(spec.type, id);
      return { id, ...spec, order: idx, dependsOn: [], requiredIngredients: [], requiredEvidence: [], requiredAuthorities: [], issueIds: [] };
    });

    // Resolve dependency IDs
    for (const section of sections) {
      const spec = applicableSpecs.find((s) => s.type === section.type)!;
      section.dependsOn = spec.dependsOnTypes
        .map((t) => sectionIdMap.get(t))
        .filter((id): id is string => Boolean(id));
    }

    // Enrich each section with plan data
    const referenceBlock = this.structuralReference.buildPromptBlock(plan.documentKind);

    for (const section of sections) {
      // Attach issues to sections that address them
      if (section.type === 'grounds' || section.type === 'arguments') {
        section.issueIds = plan.issues.map((i) => i.id);
        section.requiredIngredients = plan.requiredIngredients;
        section.requiredEvidence = plan.requiredEvidence;
        section.requiredAuthorities = plan.requiredAuthorities;
      } else if (section.type === 'facts') {
        section.requiredEvidence = plan.requiredEvidence;
      } else if (section.type === 'prayer') {
        section.issueIds = plan.issues.map((i) => i.id);
      }

      // Attach structural guide to heading / grounds
      if (section.type === 'heading' && referenceBlock) {
        section.structuralGuide = referenceBlock;
      }

      // Attach rule engine outputs
      if (plan.ruleContext) {
        const { limitation, forum, courtFee, annexures } = plan.ruleContext;
        if (section.type === 'maintainability') {
          section.ruleOutputs = [
            ...forum.notes,
            ...forum.warnings,
            ...(limitation.applicable ? [`Limitation: ${limitation.rule}`] : []),
          ];
        }
        if (section.type === 'facts') {
          section.ruleOutputs = limitation.applicable
            ? [`Limitation period: ${limitation.periodDays} days (${limitation.rule})`]
            : [];
        }
        if (section.type === 'annexures') {
          section.ruleOutputs = [
            ...annexures.required.map((a) => `Required: ${a}`),
            ...annexures.optional.map((a) => `Optional: ${a}`),
          ];
        }
        if (section.type === 'prayer' && courtFee.applicable) {
          section.ruleOutputs = [
            courtFee.feeScheduleRef
              ? `Court fee: ${courtFee.feeScheduleRef}`
              : 'Court fee applicable',
          ];
        }
      }

      // Notices may reuse verified boilerplate. Filing-grade pleadings let the
      // model write verification from the case record (same as research synthesis).
      if (
        !plan.filingGrade &&
        (section.type === 'verification' || section.type === 'boilerplate')
      ) {
        const block = VERIFIED_BUILDING_BLOCKS.find(
          (b) =>
            b.type === section.type &&
            (!b.documentKind || b.documentKind === plan.documentKind),
        );
        if (block) {
          section.boilerplateContent = block.content;
        }
      }
    }

    return {
      planId: plan.id,
      documentKind: plan.documentKind,
      documentTitle: plan.documentTitle,
      jurisdiction: plan.jurisdiction,
      countryCode: plan.countryCode,
      sections,
      globalContext: {
        matterProfile: profile,
        proceduralResult,
        verifiedAuthorities: grounding.authorities,
        statuteGrounding: grounding.statuteGrounding,
        caseDetails: input.caseDetails,
        clientName: input.clientName,
        courtName: input.courtName,
        opposingParty: input.opposingParty,
        attachmentContext: input.attachmentContext,
      },
    };
  }
}
