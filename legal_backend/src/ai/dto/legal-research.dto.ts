import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { ResearchTaskKind } from '../legal-research/research-planning.types';

export class LegalResearchDto {
  @IsString()
  @MinLength(3)
  query!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  selectedDocumentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  selectedSavedResearchIds?: string[];

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsOptional()
  @IsIn(['AUTO', 'PREMIUM'])
  aiModelMode?: 'AUTO' | 'PREMIUM';

  @IsOptional()
  @IsIn(['FAST', 'DEEP', 'GUIDANCE'])
  researchMode?: 'FAST' | 'DEEP' | 'GUIDANCE';

  @IsOptional()
  @IsString()
  premiumModelId?: string;

  @IsOptional()
  @IsString()
  priorContext?: string;

  /**
   * Preferred output language for AI responses.
   * 'en' = English (default), 'hi' = Hindi, 'hinglish' = mixed Hindi/English.
   * Only meaningful when countryCode === 'IN'.
   */
  @IsOptional()
  @IsIn(['en', 'hi', 'hinglish'])
  outputLanguage?: 'en' | 'hi' | 'hinglish';

  /**
   * Input language hint for better query handling.
   * 'en' = English (default), 'hi' = Hindi, 'hinglish' = Hinglish.
   */
  @IsOptional()
  @IsIn(['en', 'hi', 'hinglish'])
  inputLanguage?: 'en' | 'hi' | 'hinglish';

  /**
   * Explicit knowledge sources to restrict retrieval.
   * e.g. ['statutes', 'case_law', 'firm_vault', 'web', 'edgar', 'tax', 'regulations', 'contracts']
   * When omitted all enabled sources are queried.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];

  @IsOptional()
  @IsString()
  asOfDate?: string;

  @IsOptional()
  @IsString()
  eventDate?: string;

  @IsOptional()
  @IsIn(['ANSWER', 'AUTHORITY_LIST', 'ANALYSIS', 'MEMO', 'VERIFICATION'])
  desiredOutput?: 'ANSWER' | 'AUTHORITY_LIST' | 'ANALYSIS' | 'MEMO' | 'VERIFICATION';

  @IsOptional()
  @IsIn([
    'SECTION_LOOKUP',
    'STATUTORY_INTERPRETATION',
    'CASE_LOOKUP',
    'CASE_SURVEY',
    'CASE_ANALYSIS',
    'CASE_COMPARISON',
    'CITATION_VERIFICATION',
    'CURRENT_LAW',
    'ADVERSE_AUTHORITY',
    'PROCEDURE',
    'GENERAL_RESEARCH',
    'MATTER_OPINION',
  ])
  requestedTaskKind?: ResearchTaskKind;
}
