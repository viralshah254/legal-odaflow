import { FirmKnowledgeService } from './firm-knowledge.service';
import { FirmKnowledgeSubmissionDto, FirmKnowledgeReviewDto } from './firm-knowledge.dto';
import { BadRequestException, Body, Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { FirmMemoryService } from './firm-memory.service';

@Controller('firm-memory')
@UseGuards(TenantGuard)
export class FirmMemoryController {
  constructor(private readonly firmMemoryService: FirmMemoryService, private readonly knowledge: FirmKnowledgeService) {}

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
    body: FirmKnowledgeSubmissionDto,
  ) {
    return this.knowledge.submit({ tenantId, userId: user.id, tenantRole: user.tenantRole }, body);
  }

  @Get('items')
  listKnowledge(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.knowledge.list({ tenantId, userId: user.id });
  }

  @Get('items/:itemId')
  getKnowledge(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('itemId') id: string) {
    return this.knowledge.get({ tenantId, userId: user.id }, id);
  }

  @Post('items/:itemId/approve')
  approveKnowledge(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('itemId') id: string, @Body() review: FirmKnowledgeReviewDto) {
    return this.knowledge.review({ tenantId, userId: user.id }, id, 'APPROVE', review);
  }

  @Post('items/:itemId/reject')
  rejectKnowledge(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('itemId') id: string, @Body() review: FirmKnowledgeReviewDto) {
    return this.knowledge.review({ tenantId, userId: user.id }, id, 'REJECT', review);
  }

  @Post('items/:itemId/revoke')
  revokeKnowledge(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('itemId') id: string, @Body() review: FirmKnowledgeReviewDto) {
    return this.knowledge.review({ tenantId, userId: user.id }, id, 'REVOKE', review);
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
