import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { resolveRequestLocale } from '@/config/locales';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateConflictCheckDto } from '@/conflicts/dto/conflicts.dto';
import { PRACTICE_AREA_QUESTIONS } from '@/consumers/practice-area-questions';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { UsersService } from '@/users/users.service';
import { LegalFormsService } from '@/legal-forms/legal-forms.service';
import { MattersService } from './matters.service';
import { DraftingWorkspaceService } from './drafting-workspace.service';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import {
  GenerateDraftingDocumentDto,
  PatchDraftingFieldsDto,
} from './dto/patch-drafting-fields.dto';

@Controller('matters')
@UseGuards(TenantGuard)
export class MattersController {
  constructor(
    private readonly mattersService: MattersService,
    private readonly draftingWorkspace: DraftingWorkspaceService,
    private readonly aiGateway: AiGatewayService,
    private readonly usersService: UsersService,
    private readonly legalFormsService: LegalFormsService,
  ) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterDto,
  ) {
    return this.mattersService.create(tenantId, dto, user.id);
  }

  @Post('conflicts-check')
  conflictsCheck(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConflictCheckDto,
  ) {
    return this.mattersService.runConflictCheck(tenantId, user.id, dto);
  }

  @Post(':matterId/forms/attach')
  attachForms(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() body: { formIds?: string[] },
  ) {
    return this.legalFormsService.attachToMatter(
      tenantId,
      matterId,
      Array.isArray(body.formIds) ? body.formIds : [],
      user.id,
    );
  }

  @Get(':matterId/forms')
  listAttachedForms(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.legalFormsService.listMatterAttachments(tenantId, matterId);
  }

  @Get('auto-analyzed-ids')
  getAutoAnalyzedIds(@TenantId() tenantId: string) {
    return this.mattersService.getAutoAnalyzedIds(tenantId);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('assignee') assignee?: string,
    @Query('stage') stage?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('clientId') clientId?: string,
    @Query('q') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      status,
      assignee,
      stage,
      dateFrom,
      dateTo,
      clientId,
      search,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    };

    const usesPagination =
      filters.page != null ||
      filters.limit != null ||
      !!search?.trim() ||
      !!status?.trim() ||
      !!stage?.trim() ||
      !!assignee?.trim() ||
      !!dateFrom?.trim() ||
      !!dateTo?.trim();

    const result = await this.mattersService.findAllPaginated(
      tenantId,
      user.id,
      user.tenantRole,
      filters,
    );

    if (usesPagination) {
      return result;
    }

    return result.items;
  }

  @Get(':matterId')
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.mattersService.findOne(tenantId, matterId, user.id, user.tenantRole);
  }

  @Patch(':matterId')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() dto: UpdateMatterDto,
  ) {
    return this.mattersService.update(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':matterId')
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.mattersService.remove(tenantId, matterId, user.id, user.tenantRole);
  }

  /** Return intake questionnaire questions for a given practice area */
  @Get('questionnaire/:practiceArea')
  getQuestionnaire(@Param('practiceArea') practiceArea: string) {
    const questions = PRACTICE_AREA_QUESTIONS[practiceArea] ?? [];
    return { practiceArea, questions };
  }

  /** Save questionnaire answers against a matter */
  @Post(':matterId/questionnaire')
  saveQuestionnaireAnswers(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() body: { answers: Record<string, unknown> },
  ) {
    return this.mattersService.saveQuestionnaireAnswers(tenantId, matterId, body.answers);
  }

  /** Run jurisdiction-aware deadline agent and auto-create tasks */
  @Post(':matterId/deadline-agent')
  async runDeadlineAgent(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.aiGateway.runJurisdictionDeadlineAgent({
      tenantId,
      userId: user.id,
      matterId,
      locale: resolveRequestLocale(acceptLanguage, preferredLocale),
    });
  }

  @Get(':matterId/drafting-workspace')
  getDraftingWorkspace(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.draftingWorkspace.getWorkspace(tenantId, matterId);
  }

  @Patch(':matterId/drafting-workspace/fields')
  patchDraftingFields(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() dto: PatchDraftingFieldsDto,
  ) {
    return this.draftingWorkspace.patchFields(
      tenantId,
      user.id,
      matterId,
      dto.fields,
      dto.regenerateDraft ?? false,
      dto.selectedClauses,
      dto.knowledgeSources,
    );
  }

  @Post(':matterId/drafting-workspace/generate')
  async generateDraftingDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() dto: GenerateDraftingDocumentDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.draftingWorkspace.generateDraft(
      tenantId,
      user.id,
      matterId,
      dto.sectionHint,
      resolveRequestLocale(acceptLanguage, preferredLocale),
      dto.selectedClauses,
      dto.knowledgeSources,
    );
  }

  /** Run matter kickoff agent: auto-create tasks, draft engagement letter, flag conflicts */
  @Post(':matterId/kickoff-agent')
  async runKickoffAgent(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.aiGateway.runMatterKickoff({
      tenantId,
      userId: user.id,
      matterId,
      locale: resolveRequestLocale(acceptLanguage, preferredLocale),
    });
  }
}
