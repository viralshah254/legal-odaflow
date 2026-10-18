import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { TenantId } from '@/common/decorators/tenant-id.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import type { RequestUser } from '@/common/types/request-user.interface'
import { AudienceContextService } from './audience-context.service'

class SetModeBody {
  mode!: string
}

@UseGuards(TenantGuard)
@Controller('audience')
export class AudienceController {
  constructor(private readonly audienceContextService: AudienceContextService) {}

  @Post('mode')
  setMode(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() body: SetModeBody,
  ) {
    return this.audienceContextService.setProductMode(user.id, tenantId, body.mode)
  }

  @Get('mode')
  getMode(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ) {
    return this.audienceContextService.getProductMode(user.id, tenantId)
  }

  @Get('features')
  getFeatures(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ) {
    return this.audienceContextService.getEnabledFeatures(user.id, tenantId)
  }
}
