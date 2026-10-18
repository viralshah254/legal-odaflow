import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import { TenantId } from '@/common/decorators/tenant-id.decorator'
import type { RequestUser } from '@/common/types/request-user.interface'
import { FeatureHandoffService, HandoffRequest } from './feature-handoff.service'

class CreateHandoffDto implements HandoffRequest {
  fromUserId!: string
  toUserId?: string
  toRole?: string
  handoffType!: HandoffRequest['handoffType']
  matterId?: string
  workflowId?: string
  summary!: string
  documents!: string[]
  urgency!: 'normal' | 'urgent' | 'emergency'
  notes?: string
}

class DeclineHandoffDto {
  reason?: string
}

@UseGuards(TenantGuard)
@Controller('handoffs')
export class FeatureHandoffController {
  constructor(private readonly handoffService: FeatureHandoffService) {}

  @Post()
  createHandoff(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateHandoffDto,
  ) {
    return this.handoffService.createHandoff(tenantId, {
      ...dto,
      fromUserId: user.id,
    })
  }

  @Get()
  listHandoffs(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('role') role?: 'sender' | 'receiver',
  ) {
    if (role === 'sender' || role === 'receiver') {
      return this.handoffService.getHandoffsForUser(user.id, tenantId, role)
    }
    return Promise.all([
      this.handoffService.getHandoffsForUser(user.id, tenantId, 'sender'),
      this.handoffService.getHandoffsForUser(user.id, tenantId, 'receiver'),
    ]).then(([sent, received]) => ({ sent, received }))
  }

  @Post(':id/accept')
  acceptHandoff(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.handoffService.acceptHandoff(id, tenantId, user.id)
  }

  @Post(':id/decline')
  declineHandoff(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DeclineHandoffDto,
  ) {
    return this.handoffService.declineHandoff(id, tenantId, user.id, dto.reason)
  }

  @Post(':id/complete')
  completeHandoff(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.handoffService.completeHandoff(id, tenantId)
  }
}
