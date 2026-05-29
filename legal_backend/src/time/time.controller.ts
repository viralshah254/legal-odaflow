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
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { StartTimerDto } from './dto/timer.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeService } from './time.service';

@Controller('time')
@UseGuards(TenantGuard)
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeService.create(tenantId, user.id, dto);
  }

  @Get('approvals')
  approvalQueue(@TenantId() tenantId: string) {
    return this.timeService.findApprovalQueue(tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.timeService.findAll(tenantId, matterId, userId);
  }

  @Get('timer')
  getActiveTimer(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.timeService.getActiveTimer(tenantId, user.id);
  }

  @Post('timer/start')
  startTimer(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: StartTimerDto,
  ) {
    return this.timeService.startTimer(tenantId, user.id, dto.matterId);
  }

  @Post('timer/stop')
  stopTimer(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.timeService.stopTimer(tenantId, user.id);
  }

  @Get(':entryId')
  findOne(@TenantId() tenantId: string, @Param('entryId') entryId: string) {
    return this.timeService.findOne(tenantId, entryId);
  }

  @Patch(':entryId')
  update(
    @TenantId() tenantId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timeService.update(tenantId, entryId, dto);
  }

  @Post(':entryId/approve')
  approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('entryId') entryId: string,
  ) {
    return this.timeService.approve(tenantId, entryId, user.tenantRole);
  }

  @Delete(':entryId')
  remove(@TenantId() tenantId: string, @Param('entryId') entryId: string) {
    return this.timeService.remove(tenantId, entryId);
  }
}
