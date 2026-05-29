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
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';
import { PlaybooksService } from './playbooks.service';

@Controller('playbooks')
@UseGuards(TenantGuard)
export class PlaybooksController {
  constructor(private readonly playbooksService: PlaybooksService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreatePlaybookDto) {
    return this.playbooksService.create(tenantId, dto);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @Query('isEnabled') isEnabled?: string) {
    return this.playbooksService.findAll(tenantId, isEnabled);
  }

  @Get(':playbookId')
  findOne(@TenantId() tenantId: string, @Param('playbookId') playbookId: string) {
    return this.playbooksService.findOne(tenantId, playbookId);
  }

  @Patch(':playbookId')
  update(
    @TenantId() tenantId: string,
    @Param('playbookId') playbookId: string,
    @Body() dto: UpdatePlaybookDto,
  ) {
    return this.playbooksService.update(tenantId, playbookId, dto);
  }

  @Delete(':playbookId')
  remove(@TenantId() tenantId: string, @Param('playbookId') playbookId: string) {
    return this.playbooksService.remove(tenantId, playbookId);
  }
}
