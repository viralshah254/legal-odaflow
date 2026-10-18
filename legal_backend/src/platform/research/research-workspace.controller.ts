import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  AppendResearchContextDto,
  CreateResearchWorkspaceDto,
  UpdateResearchWorkspaceDto,
} from './research-workspace.dto';
import { ResearchWorkspaceService } from './research-workspace.service';

@Controller('research/workspaces')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ResearchWorkspaceController {
  constructor(private readonly workspaces: ResearchWorkspaceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateResearchWorkspaceDto,
  ) {
    return this.workspaces.create(tenantId, user.id, user.tenantRole, dto);
  }

  @Get(':id')
  get(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') workspaceId: string,
  ) {
    return this.workspaces.get(workspaceId, tenantId, user.id, user.tenantRole);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') workspaceId: string,
    @Body() dto: UpdateResearchWorkspaceDto,
  ) {
    return this.workspaces.update(
      workspaceId,
      tenantId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Post(':id/context')
  appendContext(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') workspaceId: string,
    @Body() dto: AppendResearchContextDto,
  ) {
    return this.workspaces.appendContext(
      workspaceId,
      tenantId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Get(':id/revisions')
  listRevisions(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') workspaceId: string,
  ) {
    return this.workspaces.listRevisions(
      workspaceId,
      tenantId,
      user.id,
      user.tenantRole,
    );
  }
}
