import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { BulkReviewService } from './bulk-review.service';

@Controller('matters/:matterId/diligence')
@UseGuards(TenantGuard)
export class BulkReviewController {
  constructor(private readonly bulkReview: BulkReviewService) {}

  @Get()
  list(@TenantId() tenantId: string, @Param('matterId') matterId: string) {
    return this.bulkReview.list(tenantId, matterId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() body: { documentIds: string[] },
  ) {
    return this.bulkReview.create(tenantId, matterId, body.documentIds ?? [], user.id);
  }
}
