import { Body, Controller, Delete, Get, Post, Param, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { EthicalWallsService } from './ethical-walls.service';

@Controller('ethical-walls')
@UseGuards(TenantGuard)
export class EthicalWallsController {
  constructor(private readonly walls: EthicalWallsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.walls.list(tenantId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() body: { name: string; matterIds: string[]; userIds: string[] },
  ) {
    return this.walls.create(tenantId, body);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.walls.remove(tenantId, id);
  }
}
