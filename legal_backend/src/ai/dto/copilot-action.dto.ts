import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { CopilotToolName } from '../copilot.types';

export class CopilotActionDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsIn([
    'create_task',
    'summarize_matter',
    'legal_research_memo',
    'draft_document',
    'suggest_next_steps',
  ])
  toolName!: CopilotToolName;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  jobId?: string;
}
