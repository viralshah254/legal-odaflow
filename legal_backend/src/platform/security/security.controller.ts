import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { EthicalWallService, CreateEthicalWallDto } from './ethical-wall.service';
import { LegalHoldService, CreateLegalHoldDto } from './legal-hold.service';
import { RetentionPolicyService, CreateRetentionPolicyDto } from './retention-policy.service';
import { SecurityMonitorService, GetEventsFilters } from './security-monitor.service';
import { ConflictsEnhancedService, CheckConflictsDto } from './conflicts-enhanced.service';

@UseGuards(TenantGuard)
@Controller('admin')
export class SecurityController {
  constructor(
    private readonly ethicalWall: EthicalWallService,
    private readonly legalHold: LegalHoldService,
    private readonly retentionPolicy: RetentionPolicyService,
    private readonly securityMonitor: SecurityMonitorService,
    private readonly conflictsEnhanced: ConflictsEnhancedService,
  ) {}

  // ─── Ethical Walls ──────────────────────────────────────────────────────────

  @Post('ethical-walls')
  createWall(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEthicalWallDto,
  ) {
    return this.ethicalWall.createWall(tenantId, user.id, dto);
  }

  @Get('ethical-walls')
  getWalls(@TenantId() tenantId: string) {
    return this.ethicalWall.getWalls(tenantId);
  }

  @Post('ethical-walls/:id/matters')
  addMatterToWall(
    @TenantId() tenantId: string,
    @Param('id') wallId: string,
    @Body() body: { matterId: string },
  ) {
    return this.ethicalWall.addMatterToWall(wallId, body.matterId, tenantId);
  }

  @Post('ethical-walls/:id/users')
  addUserToWall(
    @TenantId() tenantId: string,
    @Param('id') wallId: string,
    @Body() body: { userId: string },
  ) {
    return this.ethicalWall.addUserToWall(wallId, body.userId, tenantId);
  }

  // ─── Legal Holds ─────────────────────────────────────────────────────────────

  @Post('legal-holds')
  createHold(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLegalHoldDto,
  ) {
    return this.legalHold.createHold(tenantId, user.id, dto);
  }

  @Get('legal-holds')
  getHolds(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('matterId') matterId?: string,
  ) {
    return this.legalHold.getHolds(tenantId, { status, matterId });
  }

  @Post('legal-holds/:id/release')
  releaseHold(
    @TenantId() tenantId: string,
    @Param('id') holdId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { reason: string },
  ) {
    return this.legalHold.releaseHold(holdId, tenantId, user.id, body.reason);
  }

  // ─── Retention Policies ───────────────────────────────────────────────────────

  @Post('retention-policies')
  createPolicy(@TenantId() tenantId: string, @Body() dto: CreateRetentionPolicyDto) {
    return this.retentionPolicy.createPolicy({ ...dto, tenantId: dto.tenantId ?? tenantId });
  }

  @Get('retention-policies')
  getPolicies(@TenantId() tenantId: string) {
    return this.retentionPolicy.getAll(tenantId);
  }

  // ─── Security Events ─────────────────────────────────────────────────────────

  @Get('security-events')
  getSecurityEvents(
    @TenantId() tenantId: string,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('reviewed') reviewed?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: GetEventsFilters = {
      ...(eventType ? { eventType } : {}),
      ...(severity ? { severity } : {}),
      ...(reviewed !== undefined ? { reviewed: reviewed === 'true' } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    };
    return this.securityMonitor.getEvents(tenantId, filters);
  }

  @Post('security-events/:id/review')
  reviewEvent(
    @TenantId() tenantId: string,
    @Param('id') eventId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { reviewNote: string },
  ) {
    return this.securityMonitor.reviewEvent(eventId, tenantId, user.id, body.reviewNote);
  }

  // ─── Conflicts ───────────────────────────────────────────────────────────────

  @Post('conflicts/check')
  async checkConflicts(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckConflictsDto,
  ) {
    const result = await this.conflictsEnhanced.checkConflicts(tenantId, dto);
    await this.conflictsEnhanced.recordConflictCheck(
      tenantId,
      { ...dto, userId: user.id },
      result,
    );
    return result;
  }

  @Post('conflicts/:id/waive')
  waiveConflict(
    @TenantId() tenantId: string,
    @Param('id') conflictId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { consentedParties: string[]; notes: string },
  ) {
    return this.conflictsEnhanced.waiveConflict(
      conflictId,
      tenantId,
      user.id,
      body.consentedParties,
      body.notes,
    );
  }
}
