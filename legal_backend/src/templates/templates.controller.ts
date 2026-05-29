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
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(TenantGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.templatesService.findAll(tenantId, category, isActive);
  }

  @Get('check-name')
  checkName(
    @TenantId() tenantId: string,
    @Query('name') name: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.templatesService.checkNameExists(tenantId, name, excludeId);
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
    @Param('templateId') templateId: string,
  ) {
    return this.templatesService.remove(tenantId, templateId);
  }
}
