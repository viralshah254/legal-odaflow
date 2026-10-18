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
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import {
  CourtDeadlinesService,
  CreateCourtDeadlineDto,
  UpdateCourtDeadlineDto,
} from './court-deadlines.service';

@Controller('matters/:matterId/court-deadlines')
@UseGuards(JwtAuthGuard)
export class CourtDeadlinesController {
  constructor(private readonly deadlinesService: CourtDeadlinesService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Param('matterId') matterId: string) {
    return this.deadlinesService.findByMatter(tenantId, matterId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: CreateCourtDeadlineDto,
  ) {
    return this.deadlinesService.create(tenantId, matterId, dto);
  }

  @Post('calculate-limitation')
  calculateLimitation(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.deadlinesService.calculateLimitationPeriod(tenantId, matterId);
  }

  @Patch(':deadlineId')
  update(
    @TenantId() tenantId: string,
    @Param('deadlineId') deadlineId: string,
    @Body() dto: UpdateCourtDeadlineDto,
  ) {
    return this.deadlinesService.update(tenantId, deadlineId, dto);
  }

  @Delete(':deadlineId')
  remove(@TenantId() tenantId: string, @Param('deadlineId') deadlineId: string) {
    return this.deadlinesService.delete(tenantId, deadlineId);
  }
}

@Controller('court-deadlines/limitation-periods')
@UseGuards(JwtAuthGuard)
export class LimitationPeriodsController {
  constructor(private readonly deadlinesService: CourtDeadlinesService) {}

  @Get()
  getAll(@Query('practiceArea') practiceArea?: string) {
    return this.deadlinesService.getAllLimitationPeriods(practiceArea);
  }
}
