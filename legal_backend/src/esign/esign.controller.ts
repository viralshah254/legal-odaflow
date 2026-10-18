import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { ESignService, SendForSignatureDto } from './esign.service';

@Controller('esign')
@UseGuards(TenantGuard)
export class ESignController {
  constructor(private readonly esignService: ESignService) {}

  @Get('envelopes')
  list(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
  ) {
    return this.esignService.list(tenantId, matterId);
  }

  @Post('envelopes')
  sendForSignature(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SendForSignatureDto,
  ) {
    return this.esignService.sendForSignature(tenantId, user.id, dto);
  }

  @Get('envelopes/:id')
  getById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.esignService.getById(tenantId, id);
  }

  @Delete('envelopes/:id')
  void(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.esignService.void(tenantId, id, reason);
  }

  @Public()
  @Post('webhooks/:provider')
  handleWebhook(
    @Req() req: Request,
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
      ? (req as Request & { rawBody?: Buffer }).rawBody!.toString('utf8')
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});
    return this.esignService.handleWebhook(provider, rawBody, headers);
  }
}
