import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { FirmMemoryService } from './firm-memory.service';

@Controller('firm-memory')
@UseGuards(TenantGuard)
export class FirmMemoryController {
  constructor(private readonly firmMemoryService: FirmMemoryService) {}

  @Get('search')
  search(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 50) : 20;
    return this.firmMemoryService.search(
      tenantId,
      user.id,
      user.tenantRole,
      query ?? '',
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  /**
   * POST /firm-memory/ingest
   * Write-path: ingest approved work product (redlines, memos, strategy notes)
   * into firm memory so they can be retrieved in future matters.
   */
  @Post('ingest')
  async ingest(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      sourceType: 'approved_redline' | 'strategy_memo' | 'meeting_notes' | 'custom';
      sourceId: string;
      matterId?: string;
      title?: string;
      content: string;
      practiceArea?: string;
      jurisdiction?: string;
      tags?: string[];
    },
  ) {
    if (!body.content?.trim() || !body.sourceType || !body.sourceId) {
      throw new BadRequestException('sourceType, sourceId, and content are required.');
    }
    return this.firmMemoryService.ingest(tenantId, user.id, body);
  }

  /**
   * POST /firm-memory/clause-compare
   * Compare a draft clause against firm precedents and market benchmarks.
   */
  @Post('clause-compare')
  async clauseCompare(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      clauseText: string;
      clauseKind?: string;
      practiceArea?: string;
      jurisdiction?: string;
    },
  ) {
    if (!body.clauseText?.trim()) {
      throw new BadRequestException('clauseText is required.');
    }
    return this.firmMemoryService.compareClause(
      tenantId,
      user.id,
      user.tenantRole,
      body,
    );
  }
}
