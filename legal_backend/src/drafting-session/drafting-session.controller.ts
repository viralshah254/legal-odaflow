import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { resolveRequestLocale } from '@/config/locales';
import { UsersService } from '@/users/users.service';
import { DraftingSessionService } from './drafting-session.service';
import {
  CreateDraftingSessionDto,
  DraftingSessionEditDto,
  DraftingSessionExportDto,
  DraftingSessionExtractDto,
  DraftingSessionFinalizeDto,
  UpdateDraftingSessionFieldsDto,
  DraftingSessionGenerateDto,
} from './dto/drafting-session.dto';

@Controller('drafting-sessions')
@UseGuards(TenantGuard)
export class DraftingSessionController {
  constructor(
    private readonly draftingSession: DraftingSessionService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveLocale(userId: string, acceptLanguage?: string) {
    const preferredLocale = await this.usersService.getPreferredLocale(userId);
    return resolveRequestLocale(acceptLanguage, preferredLocale);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDraftingSessionDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = await this.resolveLocale(user.id, acceptLanguage);
    return this.draftingSession.create(tenantId, user.id, dto, locale);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.draftingSession.get(tenantId, id);
  }

  @Patch(':id/fields')
  updateFields(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDraftingSessionFieldsDto,
  ) {
    return this.draftingSession.updateFields(
      tenantId,
      id,
      dto.fieldValues,
      dto.clauseAnswers,
    );
  }

  @Post(':id/extract')
  async extract(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DraftingSessionExtractDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = await this.resolveLocale(user.id, acceptLanguage);
    return this.draftingSession.extract(tenantId, id, dto.text, locale);
  }

  @Post(':id/assemble')
  assemble(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.draftingSession.assemble(tenantId, id);
  }

  @Post(':id/generate')
  async generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DraftingSessionGenerateDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = await this.resolveLocale(user.id, acceptLanguage);
    return this.draftingSession.generate(
      tenantId,
      user.id,
      id,
      locale,
      dto.knowledgeSources,
    );
  }

  @Post(':id/finalize')
  finalize(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DraftingSessionFinalizeDto,
  ) {
    return this.draftingSession.finalize(tenantId, user.id, id, dto);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  importDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.draftingSession.importDocument(tenantId, user.id, file);
  }

  @Post(':id/analyze')
  async analyze(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = await this.resolveLocale(user.id, acceptLanguage);
    return this.draftingSession.analyze(tenantId, id, locale);
  }

  @Post(':id/edit')
  async edit(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DraftingSessionEditDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = await this.resolveLocale(user.id, acceptLanguage);
    return this.draftingSession.edit(tenantId, id, dto, locale);
  }

  @Post(':id/export')
  export(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: DraftingSessionExportDto,
  ) {
    return this.draftingSession.exportSession(tenantId, id, dto.format);
  }
}
