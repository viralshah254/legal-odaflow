import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { resolveLocaleFromAcceptLanguage } from '@/config/locales';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CopilotService } from './copilot.service';
import { ReActAgentService } from './react-agent.service';
import { CopilotChatDto, CreateCopilotSessionDto } from './dto/copilot.dto';
import { CopilotActionDto } from './dto/copilot-action.dto';
import { ConfigService } from '@nestjs/config';

@Controller('ai/copilot')
@UseGuards(TenantGuard)
export class CopilotController {
  constructor(
    private readonly copilotService: CopilotService,
    private readonly reactAgent: ReActAgentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('chat')
  chat(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CopilotChatDto,
    @Headers('accept-language') acceptLanguage?: string,
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
      resolveLocaleFromAcceptLanguage(acceptLanguage),
      dto.knowledgeSources,
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
      dto.deliverableType,
    );
  }

  @Post('sessions/:sessionId/generate-deliverable')
  generateDeliverable(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { deliverableType?: string; documentText?: string },
  ) {
    return this.copilotService.generateDeliverable(
      tenantId,
      user.id,
      sessionId,
      body.deliverableType,
      body.documentText,
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

  @Delete('sessions/:sessionId')
  deleteSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.copilotService.deleteSession(tenantId, user.id, sessionId);
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
      user.tenantRole,
      limit ? Number(limit) : 50,
    );
  }

  @Post('actions/:proposalId/approve')
  approveAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('proposalId') proposalId: string,
    @Body() dto: CopilotActionDto,
  ) {
    return this.copilotService.approveAction(
      tenantId,
      user.id,
      user.tenantRole,
      proposalId,
      dto,
    );
  }

  /** Multi-step ReAct agent for deep research/drafting tasks */
  @Post('agent')
  runReActAgent(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { query: string; matterId?: string; modelName?: string },
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const modelName =
      body.modelName ??
      this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
    return this.reactAgent.run({
      query: body.query,
      matterId: body.matterId,
      tenantId,
      modelName,
      locale: resolveLocaleFromAcceptLanguage(acceptLanguage),
    });
  }

  @Post('actions/:proposalId/reject')
  rejectAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('proposalId') proposalId: string,
    @Body() dto: CopilotActionDto,
  ) {
    return this.copilotService.rejectAction(
      tenantId,
      user.id,
      user.tenantRole,
      proposalId,
      dto,
    );
  }
}
