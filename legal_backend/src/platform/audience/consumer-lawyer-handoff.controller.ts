import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { TenantId } from '@/common/decorators/tenant-id.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import type { RequestUser } from '@/common/types/request-user.interface'
import { ConsumerLawyerHandoffService, CreateLeadDto } from './consumer-lawyer-handoff.service'

class CreateLeadBody implements CreateLeadDto {
  matter?: string
  jurisdiction?: string
  urgency?: 'normal' | 'urgent' | 'emergency'
}

class ConvertLeadBody {
  matterId!: string
}

@UseGuards(TenantGuard)
@Controller()
export class ConsumerLawyerHandoffController {
  constructor(private readonly handoffService: ConsumerLawyerHandoffService) {}

  @Post('consumer/lawyer-leads')
  createLead(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLeadBody,
  ) {
    return this.handoffService.createLead(user.id, dto)
  }

  @Get('consumer/lawyer-leads')
  getMyLeads(@CurrentUser() user: RequestUser) {
    return this.handoffService.getLeads(user.id, 'consumer')
  }

  @Post('lawyer/leads/:id/accept')
  acceptLead(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.handoffService.acceptLead(id, user.id)
  }

  @Get('lawyer/leads')
  getLawyerLeads(@CurrentUser() user: RequestUser) {
    return this.handoffService.getLeads(user.id, 'lawyer')
  }

  @Post('lawyer/leads/:id/convert')
  convertLead(
    @Param('id') id: string,
    @Body() body: ConvertLeadBody,
  ) {
    return this.handoffService.convertLead(id, body.matterId)
  }
}
