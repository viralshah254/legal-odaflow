import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INDIA_LOCALE_CODES } from '@/config/locales';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import type { FilingReadinessReport } from '@/ai/drafting/draft-verification.types';
import type { SectionResult, ConfidenceReport, VerificationReport, CitationAppendixEntry } from '@/ai/drafting-v2/drafting-v2.types';
import type {
  PinnedCaseLaw,
  PinnedSection,
} from '@/ai/drafting/draft-pinned-authorities';
import type { AuthorityEvidenceBundle } from '@/ai/legal-research/authority-evidence-bundle';
import type { VerifiedSourceRegistry } from '@/ai/unified-drafting/contracts/verified-source';

export type DraftModelMode = 'AUTO' | 'PREMIUM';

/** Max characters accepted for caseDetails / intake narrative on India draft endpoints. */
export const CASE_DETAILS_MAX_LENGTH = 15_000;

export type { DraftVerificationAudit as IndiaDraftVerificationAudit };
export type { PinnedCaseLaw, PinnedSection };

export class PinnedSectionDto implements PinnedSection {
  @IsString()
  @IsOptional()
  @MaxLength(40)
  actId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  section!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  authorityId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  textExcerpt?: string;

  @IsString()
  @IsIn(['section_finder', 'user_unresolved', 'resolved_ingest'])
  source!: PinnedSection['source'];
}

export class PinnedCaseLawDto implements PinnedCaseLaw {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  citation!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  caseName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  holding?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  authorityId?: string;

  @IsString()
  @IsIn(['user', 'research', 'form_metadata'])
  source!: PinnedCaseLaw['source'];
}

export class ExtractCaseRecordDto {
  @IsString()
  @MinLength(1)
  kind!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(CASE_DETAILS_MAX_LENGTH)
  caseDetails!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  courtName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  opposingParty?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;

  @IsString()
  @IsOptional()
  @MaxLength(6000)
  attachmentContext?: string;
}

/** POST /ai/india-draft/extract-form-fields — party/court prefill (regex + optional LLM). */
export class ExtractFormFieldsDto {
  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  caseDetails!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  kind?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  category?: string;
}

export class ConfirmCaseRecordResolutionDto {
  @IsString()
  contradictionId!: string;

  @IsString()
  chosenFactId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class ConfirmCaseRecordDto {
  @IsObject()
  caseRecord!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmCaseRecordResolutionDto)
  resolutions?: ConfirmCaseRecordResolutionDto[];
}

export class RepairConfirmationAnswerDto {
  @IsString()
  findingCode!: string;

  @IsString()
  field!: string;

  value!: unknown;
}

export class ApplyRepairConfirmationsDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  draft!: string;

  @IsObject()
  caseRecord!: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepairConfirmationAnswerDto)
  answers!: RepairConfirmationAnswerDto[];

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  caseDetails?: string;

  @IsOptional()
  @IsIn(['fast', 'balanced', 'strict'])
  accuracyMode?: 'fast' | 'balanced' | 'strict';
}

export class HumanReviewApproveDto {
  @IsString()
  draftId!: string;

  @IsInt()
  @IsOptional()
  expectedContentRevision?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class DraftPartyEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn([
    'plaintiff',
    'petitioner',
    'defendant',
    'respondent',
    'complainant',
    'opposite_party',
  ])
  role!:
    | 'plaintiff'
    | 'petitioner'
    | 'defendant'
    | 'respondent'
    | 'complainant'
    | 'opposite_party';
}

export class DraftPartiesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftPartyEntryDto)
  plaintiffs!: DraftPartyEntryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftPartyEntryDto)
  defendants!: DraftPartyEntryDto[];
}

export class GenerateIndiaDraftDto {
  @IsString()
  @MinLength(1)
  kind!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(CASE_DETAILS_MAX_LENGTH)
  caseDetails!: string;

  /** Confirmed Case Record from extract-case-record flow. */
  @IsOptional()
  @IsObject()
  confirmedCaseRecord?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  matterId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  clientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  courtName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  opposingParty?: string;

  /** Structured multi-party list (preferred over joined client/opposing strings). */
  @IsOptional()
  @ValidateNested()
  @Type(() => DraftPartiesDto)
  parties?: DraftPartiesDto;

  @IsString()
  @IsOptional()
  @IsIn([...INDIA_LOCALE_CODES])
  language?: (typeof INDIA_LOCALE_CODES)[number];

  @IsString()
  @IsOptional()
  @MaxLength(100)
  formNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  formTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  authority?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  practiceArea?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(6000)
  attachmentContext?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  label?: string;

  /** Active drafting style: "my_style" or a preset ID (e.g. "concise_direct"). */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  styleId?: string;

  @IsBoolean()
  @IsOptional()
  bundleMode?: boolean;

  /** Accuracy validation depth: fast (deterministic only), balanced (default), strict. */
  @IsOptional()
  @IsIn(['fast', 'balanced', 'strict'])
  accuracyMode?: 'fast' | 'balanced' | 'strict';

  @IsInt()
  @Min(0)
  @IsOptional()
  bundleIndex?: number;

  /**
   * AUTO (default) — system picks cheapest model per section complexity.
   * PREMIUM — treat every section as complex; always use highest-accuracy models.
   * Maps to the "Higher accuracy" toggle in the UI.
   */
  @IsString()
  @IsIn(['AUTO', 'PREMIUM'])
  @IsOptional()
  modelMode?: DraftModelMode;

  /** Offence / incident date (ISO or DD/MM/YYYY) — drives IPC vs BNS code family. */
  @IsString()
  @IsOptional()
  @MaxLength(40)
  offenceDate?: string;

  /** Filing date for procedural code selection. */
  @IsString()
  @IsOptional()
  @MaxLength(40)
  filingDate?: string;

  /** User-pinned statute sections (Section Finder / resolve-and-pin). */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PinnedSectionDto)
  pinnedSections?: PinnedSectionDto[];

  /** User-pinned case laws (manual or resolve-case-law). */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PinnedCaseLawDto)
  pinnedCaseLaws?: PinnedCaseLawDto[];

  /**
   * Restrict retrieval to selected knowledge sources (statutes, case_law, firm_vault, web, etc.).
   * When omitted all enabled sources are queried.
   */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  knowledgeSources?: string[];
}

export class FillBlanksDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsObject()
  @IsOptional()
  context?: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  emptyFields!: string[];
}

export class EditIndiaDraftDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  selectedText!: string;

  @IsString()
  @MinLength(1)
  instruction!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  context?: string;

  @IsString()
  @IsOptional()
  @MaxLength(CASE_DETAILS_MAX_LENGTH)
  caseDetails?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;
}

export class ReverifyIndiaDraftDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  draft!: string;

  @IsString()
  @IsOptional()
  @MaxLength(CASE_DETAILS_MAX_LENGTH)
  caseDetails?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  matterId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  offenceDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  filingDate?: string;

  /** User-pinned case laws for authority verification on reverify. */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PinnedCaseLawDto)
  pinnedCaseLaws?: PinnedCaseLawDto[];

  /** Persisted registry from generation/enrichment; prevents orphan re-verification. */
  @IsObject()
  @IsOptional()
  sourceRegistry?: VerifiedSourceRegistry;
}

export class FixVerificationDto extends ReverifyIndiaDraftDto {
  @IsString()
  @IsIn(['retrieve_authority', 'qualify_claim', 'remove_claim', 'check_law', 'add_citations'])
  instruction!: 'retrieve_authority' | 'qualify_claim' | 'remove_claim' | 'check_law' | 'add_citations';

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  selectedText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  findingId?: string;
}

export interface GenerateIndiaDraftResult {
  draft: string;
  creditsUsed: number;
  modelUsed?: string;
  verification?: DraftVerificationAudit;
  draftId?: string;
  authorityEvidenceBundle?: AuthorityEvidenceBundle;
  proceduralDetermination?: {
    recommendedKind: string;
    userSelectedKind: string;
    kindOverridden: boolean;
    maintainabilityNotes: string[];
    governingSections: Array<{ actId: string; section: string; label: string }>;
  };
  researchPhase?: {
    retrievalConfidence: 'high' | 'medium' | 'low';
    usedDeepResearch: boolean;
    authorityCount: number;
  };
  preDraftChecklist?: Record<string, boolean>;
  resolvedItems?: string[];
  unresolvedItems?: string[];
  counselChecklist?: string;
  accuracyGate?: {
    canCertify: boolean;
    canExport: boolean;
    exportWatermark?: string;
    certificationLabel: 'lawyer_ready' | 'verified_for_filing' | 'complete_missing_facts' | 'needs_review';
    unresolvedFacts?: string[];
    lawyerReady?: boolean;
    filingReadiness?: FilingReadinessReport;
  };
  /** Outcome of automated review-and-repair before release. */
  finalResolutionStatus?:
    | 'clean'
    | 'repaired'
    | 'needs_user_confirmation'
    | 'needs_advocate_review'
    | 'blocked';
  repairAttemptCount?: number;
  resolvedFindingCodes?: string[];
  unresolvedFindingCodes?: string[];
  confirmationQuestions?: Array<{
    findingCode: string;
    field: string;
    question: string;
    options?: Array<{ label: string; value: unknown; sourceIds: string[] }>;
  }>;
  accuracyFindings?: Array<{
    code: string;
    severity: string;
    message: string;
    repairHint?: string;
  }>;
  /** v2 engine outputs — present only when DRAFT_ENGINE_V2=true */
  sections?: SectionResult[];
  confidenceReport?: ConfidenceReport;
  verificationReport?: VerificationReport;
  citationAppendix?: CitationAppendixEntry[];
  engineVersion?: 'v1' | 'v2';
}

export interface EditIndiaDraftResult {
  revisedText: string;
  explanation: string;
  creditsUsed: number;
  verification?: DraftVerificationAudit;
  accuracyGate?: GenerateIndiaDraftResult['accuracyGate'];
}

export interface ReverifyIndiaDraftResult {
  draft: string;
  verification: DraftVerificationAudit;
  accuracyGate: NonNullable<GenerateIndiaDraftResult['accuracyGate']>;
  creditsUsed: number;
  citationAppendix?: CitationAppendixEntry[];
}

export class ExportIndiaDraftDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsString()
  @MinLength(1)
  html!: string;

  @IsString()
  fileName!: string;

  @IsString()
  @IsOptional()
  format?: 'pdf' | 'docx';

  /** Optional citation appendix to include as Table of Authorities in the export. */
  @IsOptional()
  citationAppendix?: CitationAppendixEntry[];

  @IsString()
  @IsOptional()
  draftId?: string;

  @IsOptional()
  @IsIn(['draft', 'filing'])
  exportMode?: 'draft' | 'filing';
}

/**
 * POST /ai/india-draft/regenerate-section
 * v2 engine only: targeted repair of a single section by sectionId.
 */
export class ResolveCaseLawDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  citation!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  caseName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  holding?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  kind?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;

  @IsBoolean()
  @IsOptional()
  allowSoftPin?: boolean;
}

export class RegenerateSectionDto {
  /** The section ID from the original v2 SectionResult. */
  @IsString()
  @MinLength(1)
  sectionId!: string;

  /** Original draft inputs — needed to reconstruct the generation context. */
  @IsString()
  @MinLength(1)
  kind!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(CASE_DETAILS_MAX_LENGTH)
  caseDetails!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  courtName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  opposingParty?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  practiceArea?: string;

  @IsString()
  @IsOptional()
  @MaxLength(6000)
  attachmentContext?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PinnedSectionDto)
  pinnedSections?: PinnedSectionDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PinnedCaseLawDto)
  pinnedCaseLaws?: PinnedCaseLawDto[];
}
