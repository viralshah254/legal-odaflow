import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
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
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(TenantGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateCalendarEventDto) {
    return this.calendarService.create(tenantId, dto, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendarService.findAll(tenantId, matterId, from, to, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }

  // Alias so both /calendar and /calendar/events resolve correctly
  @Get('events')
  findAllAlias(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendarService.findAll(tenantId, matterId, from, to, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }

  @Get(':eventId')
  findOne(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('eventId') eventId: string) {
    return this.calendarService.findOne(tenantId, eventId, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }

  @Patch(':eventId')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(tenantId, eventId, dto, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }

  @Delete(':eventId')
  remove(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param('eventId') eventId: string) {
    return this.calendarService.remove(tenantId, eventId, { tenantId, userId: user.id, tenantRole: user.tenantRole });
  }
}
