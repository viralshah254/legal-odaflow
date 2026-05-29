import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { ApiKeysService } from './api-keys.service';

@Controller('public-api/keys')
@UseGuards(TenantGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.apiKeys.list(tenantId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() body: { name: string; scopes: string[] },
  ) {
    return this.apiKeys.create(tenantId, body.name, body.scopes ?? ['read:matters']);
  }
}
