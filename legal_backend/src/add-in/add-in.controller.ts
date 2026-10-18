import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AddInService } from './add-in.service';

@Controller('add-in')
export class AddInController {
  constructor(private readonly addInService: AddInService) {}

  /**
   * POST /add-in/token — exchange Office identity token or dev credentials for a backend JWT.
   * This endpoint is public (no auth required — it IS the auth).
   */
  @Public()
  @Post('token')
  exchangeToken(
    @Body()
    body: {
      officeToken?: string;
      email?: string;
      addinSecret?: string;
    },
  ) {
    return this.addInService.exchangeToken(body);
  }

  /**
   * GET /add-in/context/matter?matterId=xxx
   * Returns compact matter context for the task pane sidebar.
   */
  @UseGuards(TenantGuard)
  @Get('context/matter')
  getMatterContext(@TenantId() tenantId: string, @Query('matterId') matterId: string) {
    return this.addInService.getMatterContext(tenantId, matterId);
  }
}
