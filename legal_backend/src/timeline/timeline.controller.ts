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
import {
  CreateTimelineEventDto,
  UpdateTimelineEventDto,
} from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@Controller('matters/:matterId/timeline')
@UseGuards(TenantGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTimelineEventDto,
  ) {
    return this.timelineService.create(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Query('eventType') eventType?: string,
  ) {
    return this.timelineService.findAll(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      eventType,
    );
  }

  @Get(':eventId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.timelineService.findOne(
      tenantId,
      matterId,
      eventId,
      user.id,
      user.tenantRole,
    );
  }

  @Patch(':eventId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTimelineEventDto,
  ) {
    return this.timelineService.update(
      tenantId,
      matterId,
      eventId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':eventId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.timelineService.remove(
      tenantId,
      matterId,
      eventId,
      user.id,
      user.tenantRole,
    );
  }
}
