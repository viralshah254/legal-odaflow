import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CreateCourtCaseDto,
  CreateCourtFilingDto,
  CreateCourtHearingDto,
  CreateDocketEntryDto,
  EcourtsLookupDto,
  UsDocketSyncDto,
} from './dto/court.dto';
import { CourtService } from './court.service';

@Controller('matters/:matterId/court-case')
@UseGuards(TenantGuard)
export class MatterCourtController {
  constructor(private readonly courtService: CourtService) {}

  @Get()
  getCourtCase(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.courtService.getCourtCaseForMatter(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
    );
  }

  @Post()
  createCourtCase(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCourtCaseDto,
  ) {
    return this.courtService.createCourtCaseForMatter(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }
}

@Controller('court-cases/:id')
@UseGuards(TenantGuard)
export class CourtCaseController {
  constructor(private readonly courtService: CourtService) {}

  @Get('hearings')
  listHearings(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.courtService.listHearings(tenantId, id);
  }

  @Post('hearings')
  createHearing(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateCourtHearingDto,
  ) {
    return this.courtService.createHearing(tenantId, id, dto);
  }

  @Get('filings')
  listFilings(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.courtService.listFilings(tenantId, id);
  }

  @Post('filings')
  createFiling(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateCourtFilingDto,
  ) {
    return this.courtService.createFiling(tenantId, id, dto);
  }

  @Get('docket-entries')
  listDocketEntries(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.courtService.listDocketEntries(tenantId, id);
  }

  @Post('docket-entries')
  createDocketEntry(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateDocketEntryDto,
  ) {
    return this.courtService.createDocketEntry(tenantId, id, dto);
  }
}

@Controller('court')
@UseGuards(TenantGuard)
export class CourtLookupController {
  constructor(private readonly courtService: CourtService) {}

  @Post('ecourts/lookup')
  ecourtsLookup(@Body() dto: EcourtsLookupDto) {
    return this.courtService.ecourtsLookup(dto);
  }

  @Post('us-docket/sync')
  usDocketSync(@TenantId() tenantId: string, @Body() dto: UsDocketSyncDto) {
    return this.courtService.usDocketSync(tenantId, dto);
  }
}
