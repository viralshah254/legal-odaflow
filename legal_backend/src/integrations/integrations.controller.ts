import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(TenantGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.integrationsService.list(tenantId);
  }

  @Post(':provider/connect')
  connect(@TenantId() tenantId: string, @Param('provider') provider: string) {
    return this.integrationsService.connect(tenantId, provider);
  }

  @Post(':provider/disconnect')
  disconnect(@TenantId() tenantId: string, @Param('provider') provider: string) {
    return this.integrationsService.disconnect(tenantId, provider);
  }

  @Post(':provider/oauth/callback')
  oauthCallback(
    @TenantId() tenantId: string,
    @Param('provider') provider: string,
    @Body() body: { accessToken: string; refreshToken?: string; expiresAt?: string },
  ) {
    return this.integrationsService.completeOAuth(tenantId, provider, body);
  }
}
