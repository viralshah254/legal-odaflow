/**
 * Drafting Engine v2 — Named Agent Registry
 *
 * The v2 orchestrator is decomposed into named, independently observable agents.
 * Each entry defines the agent's role, the stage it maps to in the 12-stage
 * pipeline, its primary inputs/outputs, and the model tier it operates at.
 *
 * This registry is the single source of truth for agent identity strings used
 * in logs, metrics, and (future) agent-level observability dashboards.
 */

export type DraftingAgentName =
  | 'planner'
  | 'research'
  | 'knowledge-graph'
  | 'rule-engine'
  | 'outline'
  | 'evidence'
  | 'drafting'
  | 'citation'
  | 'verification'
  | 'repair'
  | 'assembly'
  | 'export';

export interface DraftingAgentDescriptor {
  name: DraftingAgentName;
  /** Human-readable display name */
  displayName: string;
  /** Pipeline stage number(s) this agent covers */
  stages: number[];
  /** Primary service implementing this agent */
  service: string;
  /** Brief description of the agent's responsibility */
  description: string;
  /** Whether this agent uses an LLM */
  usesLlm: boolean;
  /** Model tier when usesLlm is true */
  modelTier?: 'cheap' | 'mid' | 'premium' | 'varies';
  /** Whether this agent can be run in parallel across sections */
  parallelisable: boolean;
}

export const DRAFTING_AGENTS: Record<DraftingAgentName, DraftingAgentDescriptor> = {
  planner: {
    name: 'planner',
    displayName: 'Planning Agent',
    stages: [2],
    service: 'PlanningEngineService',
    description:
      'Consumes MatterProfile, ProceduralRouterResult, and RuleEngineResult to build a ' +
      'LegalPlan: document type, required legal ingredients, issue taxonomy, mandatory ' +
      'sections, and required evidence/authorities.',
    usesLlm: false,
    parallelisable: false,
  },

  research: {
    name: 'research',
    displayName: 'Research Agent',
    stages: [4],
    service: 'LegalRetrievalOrchestrator + IndiaDraftGroundingService',
    description:
      'Retrieves statutes, case law, and live connector results (Kanoon, CourtListener, Tavily) ' +
      'per the LegalPlan requirements. Produces grounding blocks injected into section prompts.',
    usesLlm: false,
    parallelisable: false,
  },

  'knowledge-graph': {
    name: 'knowledge-graph',
    displayName: 'Knowledge Graph Agent',
    stages: [3],
    service: 'LegalGraphService',
    description:
      'Maintains and queries the legal knowledge graph: issue → statute → section → ingredient ' +
      '→ exception → leading cases → procedural rules → evidence → forms. Backed by ' +
      'LegalAuthority and StatuteSectionProfile records.',
    usesLlm: false,
    parallelisable: false,
  },

  'rule-engine': {
    name: 'rule-engine',
    displayName: 'Rule Engine Agent',
    stages: [5],
    service: 'RuleEngineService',
    description:
      'Deterministic computation of limitation periods, court fees, stamp duty, forum/pecuniary ' +
      'jurisdiction, and mandatory annexures. Outputs are injected as verified facts into section ' +
      'prompts — the LLM never invents these values.',
    usesLlm: false,
    parallelisable: false,
  },

  outline: {
    name: 'outline',
    displayName: 'Outline Agent',
    stages: [6],
    service: 'OutlineBuilderService',
    description:
      'Converts the LegalPlan into an addressable DocumentOutline of SectionPlan nodes. ' +
      'Resolves section dependencies, orders sections topologically for parallel generation, ' +
      'and caches the outline in Redis.',
    usesLlm: false,
    parallelisable: false,
  },

  evidence: {
    name: 'evidence',
    displayName: 'Evidence Agent',
    stages: [7],
    service: 'EvidenceValidationService',
    description:
      'Classifies each piece of supplied client evidence as supplied / missing / weak / ' +
      'contradictory relative to the LegalPlan requirements. Generates explicit disclosure ' +
      'instructions for the Drafting Agent when evidence is absent.',
    usesLlm: false,
    parallelisable: false,
  },

  drafting: {
    name: 'drafting',
    displayName: 'Drafting Agent',
    stages: [8],
    service: 'SectionGeneratorService',
    description:
      'Generates content for each SectionPlan using a focused, section-scoped prompt. ' +
      'Model tier is selected per section type (cheap for boilerplate, premium for ' +
      'Grounds/Arguments). Sections are generated in parallel, respecting dependency order.',
    usesLlm: true,
    modelTier: 'varies',
    parallelisable: true,
  },

  citation: {
    name: 'citation',
    displayName: 'Citation Agent',
    stages: [9],
    service: 'ConfidenceEngineService',
    description:
      'Runs sentence-level audit per section to build per-paragraph EvidenceChain and ' +
      'ConfidenceScore. Strips unverified citations. Triggers auto-repair for sections ' +
      'below the confidence threshold.',
    usesLlm: false,
    parallelisable: true,
  },

  verification: {
    name: 'verification',
    displayName: 'Verification Agent',
    stages: [10],
    service: 'SectionVerifierService',
    description:
      'Wraps UnifiedVerificationService to run per-section verification (~7 sub-verifiers: ' +
      'statute accuracy, citation check, procedural compliance, completeness, format, ' +
      'citation sanitization, section checks). Emits SectionVerificationStatus per section.',
    usesLlm: false,
    parallelisable: true,
  },

  repair: {
    name: 'repair',
    displayName: 'Repair Agent',
    stages: [11],
    service: 'TargetedRepairService',
    description:
      'Regenerates only the sections that failed verification or fell below the confidence ' +
      'threshold. Uses the correction prompt from UnifiedVerificationService. Bounded retries; ' +
      'sections exceeding retries are flagged "needs lawyer review".',
    usesLlm: true,
    modelTier: 'mid',
    parallelisable: false,
  },

  assembly: {
    name: 'assembly',
    displayName: 'Assembly Agent',
    stages: [12],
    service: 'FinalAssemblyService',
    description:
      'Merges all verified SectionResults into a cohesive document. Applies court formatting. ' +
      'Emits ConfidenceReport, VerificationReport, CitationAppendix, and per-section ' +
      'explainability.',
    usesLlm: false,
    parallelisable: false,
  },

  export: {
    name: 'export',
    displayName: 'Export Agent',
    stages: [12],
    service: 'IndiaDraftController (reuses existing DOCX/PDF export)',
    description:
      'Converts the assembled document to DOCX or PDF using the existing export pipeline. ' +
      'Attaches verification watermark if canCertify is false.',
    usesLlm: false,
    parallelisable: false,
  },
};

/** Ordered list of agents as they run in the pipeline (for progress UI). */
export const AGENT_PIPELINE_ORDER: DraftingAgentName[] = [
  'planner',
  'knowledge-graph',
  'rule-engine',
  'research',
  'outline',
  'evidence',
  'drafting',
  'citation',
  'verification',
  'repair',
  'assembly',
  'export',
];

/** Returns the display name for an agent, used in logs and observability. */
export function getAgentDisplayName(name: DraftingAgentName): string {
  return DRAFTING_AGENTS[name]?.displayName ?? name;
}
