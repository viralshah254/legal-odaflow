import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import type { RequestUser } from '@/common/types/request-user.interface';
import {
  CourtDraftHistoryService,
  type CourtDraftRecordFull,
  type DraftHistoryItem,
} from './court-draft-history.service';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

class LinkToClientDto {
  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @IsOptional()
  matterId?: string;

  @IsString()
  @IsOptional()
  clientName?: string;
}

class UpdateCourtDraftDto {
  @IsString()
  @MinLength(1)
  draftText!: string;

  @IsOptional()
  @IsInt()
  expectedRevision?: number;
}

@Controller('ai/drafts')
@UseGuards(TenantGuard)
export class CourtDraftController {
  constructor(private readonly history: CourtDraftHistoryService) {}

  @Get('history')
  listHistory(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Query('countryCode') countryCode?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ): Promise<DraftHistoryItem[]> {
    return this.history.list(tenantId, user.id, {
      countryCode: countryCode || undefined,
      kind: kind || undefined,
      limit: limit ? parseInt(limit, 10) : 30,
    });
  }

  @Get(':id')
  getDraft(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ): Promise<CourtDraftRecordFull> {
    return this.history.getById(id, tenantId, user.id);
  }

  @Patch(':id')
  updateDraft(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() dto: UpdateCourtDraftDto,
  ): Promise<DraftHistoryItem> {
    return this.history.update(id, tenantId, user.id, {
      draftText: dto.draftText,
      expectedRevision: dto.expectedRevision,
    });
  }

  @Patch(':id/link-to-client')
  linkToClient(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() dto: LinkToClientDto,
  ): Promise<{ success: boolean; clientId: string; clientName: string | null; matterId: string | null }> {
    return this.history.linkToClient(
      id,
      tenantId,
      user.id,
      {
        clientId: dto.clientId,
        matterId: dto.matterId,
        clientName: dto.clientName,
      },
      user.tenantRole,
    );
  }

  @Delete(':id')
  async archiveDraft(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ): Promise<{ ok: true }> {
    await this.history.archive(id, tenantId, user.id);
    return { ok: true };
  }
}
