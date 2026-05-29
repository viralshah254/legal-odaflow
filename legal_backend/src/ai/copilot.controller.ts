import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CopilotService } from './copilot.service';
import { CopilotChatDto, CreateCopilotSessionDto } from './dto/copilot.dto';

@Controller('ai/copilot')
@UseGuards(TenantGuard)
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('chat')
  chat(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CopilotChatDto,
  ) {
    return this.copilotService.chat(
      tenantId,
      user.id,
      user.tenantRole,
      dto.message,
      dto.sessionId,
      dto.context,
      dto.modelMode,
      dto.premiumModelId,
    );
  }

  @Get('sessions')
  listSessions(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.copilotService.listSessions(tenantId, user.id);
  }

  @Post('sessions')
  createSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCopilotSessionDto,
  ) {
    return this.copilotService.createSession(
      tenantId,
      user.id,
      user.tenantRole,
      dto.context,
    );
  }

  @Get('sessions/:sessionId/messages')
  getMessages(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.copilotService.getSessionMessages(tenantId, user.id, sessionId);
  }

  @Get('audit')
  listAudit(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.copilotService.listAudit(
      tenantId,
      user.id,
      limit ? Number(limit) : 50,
    );
  }
}
