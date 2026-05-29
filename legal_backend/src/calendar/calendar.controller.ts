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
  create(@TenantId() tenantId: string, @Body() dto: CreateCalendarEventDto) {
    return this.calendarService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendarService.findAll(tenantId, matterId, from, to);
  }

  @Get(':eventId')
  findOne(@TenantId() tenantId: string, @Param('eventId') eventId: string) {
    return this.calendarService.findOne(tenantId, eventId);
  }

  @Patch(':eventId')
  update(
    @TenantId() tenantId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(tenantId, eventId, dto);
  }

  @Delete(':eventId')
  remove(@TenantId() tenantId: string, @Param('eventId') eventId: string) {
    return this.calendarService.remove(tenantId, eventId);
  }
}
