import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SkipTenant } from '@/common/decorators/skip-tenant.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { ProvisionLibraryDto } from './dto/template-library.dto';
import { TemplateLibraryService } from './template-library.service';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(TenantGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly templateLibrary: TemplateLibraryService,
  ) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(tenantId, dto, user.id);
  }

  @SkipTenant()
  @Get('practice-areas')
  listPracticeAreas() {
    return this.templateLibrary.listPracticeAreas();
  }

  @Get('library')
  async listLibrary(
    @TenantId() tenantId: string,
    @Query('countryCode') countryCode?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('allPracticeAreas') allPracticeAreas?: string,
  ) {
    const resolvedCountry = await this.templateLibrary.resolveCountryCode(
      tenantId,
      countryCode,
    );
    return this.templateLibrary.listLibrary({
      tenantId,
      countryCode: resolvedCountry,
      practiceArea,
      allPracticeAreas: allPracticeAreas === 'true',
    });
  }

  @Post('library/provision')
  provisionLibrary(
    @TenantId() tenantId: string,
    @Body() dto: ProvisionLibraryDto,
  ) {
    return this.templateLibrary.provisionTemplates(tenantId, dto);
  }

  @Get('check-name')
  checkName(
    @TenantId() tenantId: string,
    @Query('name') name: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.templatesService.checkNameExists(tenantId, name, excludeId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('countryCode') countryCode?: string,
    @Query('source') source?: string,
  ) {
    return this.templatesService.findAll(tenantId, {
      category,
      isActive,
      practiceArea,
      countryCode,
      source,
      userId: user.id,
    });
  }

  @Get(':templateId')
  findOne(
    @TenantId() tenantId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templatesService.findOne(tenantId, templateId);
  }

  @Patch(':templateId')
  update(
    @TenantId() tenantId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(tenantId, templateId, dto);
  }

  @Delete(':templateId')
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('templateId') templateId: string,
  ) {
    return this.templatesService.remove(
      tenantId,
      templateId,
      user.id,
      user.tenantRole,
    );
  }

  /** POST /templates/seed-jurisdiction — seed multi-jurisdiction clause library */
  @Post('seed-jurisdiction')
  seedJurisdictionTemplates() {
    return this.templateLibrary.seedJurisdictionTemplates();
  }
}
