import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { InboxService } from './inbox.service';

@Controller('inbox')
@UseGuards(TenantGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('threads')
  listThreads(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.inbox.listThreads(tenantId, matterId, clientId);
  }

  @Get('threads/:threadId')
  getThread(@TenantId() tenantId: string, @Param('threadId') threadId: string) {
    return this.inbox.getThread(tenantId, threadId);
  }

  @Post('threads/:threadId/messages')
  postMessage(
    @TenantId() tenantId: string,
    @Param('threadId') threadId: string,
    @Body() body: { direction: string; body: string; senderId?: string },
  ) {
    return this.inbox.postMessage(tenantId, threadId, body);
  }
}
