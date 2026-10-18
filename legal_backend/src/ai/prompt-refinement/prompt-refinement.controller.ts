import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RefinePromptDto } from './dto/refine-prompt.dto';
import { PromptRefinementService } from './prompt-refinement.service';

@Controller('ai/prompt')
@UseGuards(TenantGuard)
export class PromptRefinementController {
  constructor(private readonly promptRefinement: PromptRefinementService) {}

  /** Free pre-refinement — no credits charged. Restructures user prompt for AI readability. */
  @Post('refine')
  // Strip unknown fields instead of 400 — older clients still send matterId / desiredOutput.
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  refine(@Body() dto: RefinePromptDto) {
    return this.promptRefinement.refine({
      prompt: dto.prompt,
      purpose: dto.purpose,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      practiceArea: dto.practiceArea,
      outputLanguage: dto.outputLanguage,
      knowledgeSources: dto.knowledgeSources,
    });
  }
}
