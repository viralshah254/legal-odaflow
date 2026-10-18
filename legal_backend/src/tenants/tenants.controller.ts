import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { SkipTenant } from '@/common/decorators/skip-tenant.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreditTopupCheckoutDto } from '@/consumers/dto/credit-topup.dto';
import { UpdateAiPreferencesDto } from '@/credits/dto/update-ai-preferences.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateUserSeatPlanDto } from './dto/update-user-seat-plan.dto';
import { TenantsService } from './tenants.service';
import { IsString, MinLength, MaxLength } from 'class-validator';

class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

@Controller('tenants')
@UseGuards(TenantGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @SkipTenant()
  listMine(@CurrentUser() user: RequestUser) {
    return this.tenantsService.findForUser(user.id);
  }

  @Get('me/credits')
  getMyCredits(@CurrentUser() user: RequestUser, @TenantId() tenantId: string) {
    return this.tenantsService.getCredits(tenantId, user.id);
  }

  @Post('credits/topup/checkout')
  @Roles('FIRM_ADMIN', 'PARTNER')
  createCreditTopupCheckout(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() dto: CreditTopupCheckoutDto,
  ) {
    return this.tenantsService.createCreditTopupCheckout(tenantId, user.id, dto);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: RequestUser, @TenantId() tenantId: string) {
    return this.tenantsService.findById(tenantId, user.id);
  }

  @Patch(':tenantId/ai-preferences')
  @Roles('FIRM_ADMIN', 'PARTNER')
  updateAiPreferences(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAiPreferencesDto,
  ) {
    return this.tenantsService.updateAiPreferences(tenantId, user.id, dto);
  }

  @Get(':tenantId')
  getOne(@Param('tenantId') tenantId: string, @CurrentUser() user: RequestUser) {
    return this.tenantsService.findById(tenantId, user.id);
  }

  @Patch(':tenantId')
  @Roles('FIRM_ADMIN', 'PARTNER')
  update(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateTenant(tenantId, user.id, dto);
  }

  @Get(':tenantId/users')
  @Roles('FIRM_ADMIN', 'PARTNER')
  listUsers(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenantsService.listUsers(tenantId, user.id);
  }

  @Post(':tenantId/users')
  @Roles('FIRM_ADMIN', 'PARTNER')
  createUser(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTenantUserDto,
  ) {
    return this.tenantsService.createUser(tenantId, user.id, dto);
  }

  @Patch(':tenantId/users/:userId')
  @Roles('FIRM_ADMIN', 'PARTNER')
  updateUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.tenantsService.updateUser(tenantId, user.id, targetUserId, dto);
  }

  @Patch(':tenantId/users/:userId/plan')
  @Roles('FIRM_ADMIN', 'PARTNER')
  updateUserSeatPlan(
    @Param('tenantId') tenantId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserSeatPlanDto,
  ) {
    return this.tenantsService.updateUserSeatPlan(tenantId, user.id, targetUserId, dto);
  }

  /** Per-user credit usage — admin or self. */
  @Get(':tenantId/users/:userId/credits')
  @Roles('FIRM_ADMIN', 'PARTNER', 'ASSOCIATE', 'FINANCE', 'INTAKE')
  getUserCreditUsage(
    @Param('tenantId') tenantId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenantsService.getUserCreditUsage(tenantId, user.id, targetUserId);
  }

  /** Bulk team credit usage — admin only. Avoids N+1 on the team page. */
  @Get(':tenantId/users/credit-usage')
  @Roles('FIRM_ADMIN', 'PARTNER')
  getTeamCreditUsage(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenantsService.getTeamCreditUsage(tenantId, user.id);
  }

  /** Accept a team invitation — public endpoint (no auth required). */
  @Post('invitations/accept')
  @Public()
  @SkipTenant()
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.tenantsService.acceptInvitation(dto.token, dto.password);
  }
}
