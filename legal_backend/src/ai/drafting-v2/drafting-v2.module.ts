/**
 * Drafting Engine v2 NestJS Module
 *
 * Registers all v2 services as providers. Exported for injection into AiModule.
 */

import { Module } from '@nestjs/common';
import { DraftEngineV2Service } from './draft-engine-v2.service';
import { DraftComplexityService } from './draft-complexity.service';
import { PlanningEngineService } from './planning-engine.service';
import { OutlineBuilderService } from './outline-builder.service';
import { SectionGeneratorService } from './section-generator.service';
import { ConfidenceEngineService } from './confidence-engine.service';
import { SectionVerifierService } from './section-verifier.service';
import { TargetedRepairService } from './targeted-repair.service';
import { EvidenceValidationService } from './evidence-validation.service';
import { FinalAssemblyService } from './final-assembly.service';
import { RuleEngineService } from './rule-engine/rule-engine.service';
import { LimitationEngineService } from './rule-engine/limitation-engine.service';
import { CourtFeeCalculatorService } from './rule-engine/court-fee-calculator.service';
import { StampDutyCalculatorService } from './rule-engine/stamp-duty-calculator.service';
import { ForumJurisdictionResolverService } from './rule-engine/forum-jurisdiction-resolver.service';
import { MandatoryAnnexureResolverService } from './rule-engine/mandatory-annexure-resolver.service';
import { LegalGraphService } from './legal-graph/legal-graph.service';
import { CitationAppendixBuilderService } from '@/ai/citations/citation-appendix-builder.service';

const PROVIDERS = [
  CitationAppendixBuilderService,
  DraftComplexityService,
  // Stage 2 — Planning
  PlanningEngineService,
  // Stage 3 — Legal Graph
  LegalGraphService,
  // Stage 5 — Rule Engine
  LimitationEngineService,
  CourtFeeCalculatorService,
  StampDutyCalculatorService,
  ForumJurisdictionResolverService,
  MandatoryAnnexureResolverService,
  RuleEngineService,
  // Stage 6 — Outline Builder
  OutlineBuilderService,
  // Stage 7 — Evidence Validation
  EvidenceValidationService,
  // Stage 8 — Section Generator
  SectionGeneratorService,
  // Stage 9 — Confidence Engine
  ConfidenceEngineService,
  // Stage 10 — Section Verifier
  SectionVerifierService,
  // Stage 11 — Targeted Repair
  TargetedRepairService,
  // Stage 12 — Final Assembly
  FinalAssemblyService,
  // Orchestrator
  DraftEngineV2Service,
];

@Module({
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class DraftingV2Module {}
