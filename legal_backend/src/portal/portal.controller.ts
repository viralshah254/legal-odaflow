import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import {
  PortalAuthGuard,
  PortalRequestUser,
} from '@/common/guards/portal-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreatePortalDocumentRequestDto } from './dto/create-document-request.dto';
import { CreatePortalMessageDto } from './dto/create-portal-message.dto';
import { CreateClientPortalMessageDto } from './dto/create-client-portal-message.dto';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { UploadPortalRequestDocumentDto } from './dto/upload-request-document.dto';
import { PortalService } from './portal.service';

@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Public()
  @UseGuards(PortalAuthGuard)
  @Get('matters/:matterId/outcome-summary')
  getOutcomeSummary(
    @Req() req: Request & { portalUser: PortalRequestUser },
    @Param('matterId') matterId: string,
  ) {
    return this.portalService.getOutcomeSummary(
      req.portalUser.clientId,
      req.portalUser.tenantId,
      matterId,
    );
  }

  @Public()
  @Post('login')
  login(@Body() dto: PortalLoginDto) {
    return this.portalService.login(dto);
  }

  @Public()
  @UseGuards(PortalAuthGuard)
  @Get('dashboard')
  dashboard(@Req() req: Request & { portalUser: PortalRequestUser }) {
    return this.portalService.getDashboard(
      req.portalUser.clientId,
      req.portalUser.tenantId,
    );
  }

  @Post('firm/document-requests')
  @UseGuards(TenantGuard)
  createDocumentRequest(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePortalDocumentRequestDto,
  ) {
    return this.portalService.createDocumentRequest(tenantId, user.id, dto);
  }

  @Post('firm/messages')
  @UseGuards(TenantGuard)
  createMessage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePortalMessageDto,
  ) {
    return this.portalService.createMessage(tenantId, user.id, dto);
  }

  @Public()
  @UseGuards(PortalAuthGuard)
  @Post('document-requests/:requestId/upload')
  uploadDocumentForRequest(
    @Req() req: Request & { portalUser: PortalRequestUser },
    @Param('requestId') requestId: string,
    @Body() dto: UploadPortalRequestDocumentDto,
  ) {
    return this.portalService.uploadDocumentForRequest(
      requestId,
      req.portalUser.clientId,
      req.portalUser.tenantId,
      dto,
    );
  }

  @Public()
  @UseGuards(PortalAuthGuard)
  @Get('messages')
  listMessages(
    @Req() req: Request & { portalUser: PortalRequestUser },
    @Query('matterId') matterId?: string,
  ) {
    return this.portalService.listMessages(
      req.portalUser.clientId,
      req.portalUser.tenantId,
      matterId,
    );
  }

  @Public()
  @UseGuards(PortalAuthGuard)
  @Post('messages')
  createClientMessage(
    @Req() req: Request & { portalUser: PortalRequestUser },
    @Body() dto: CreateClientPortalMessageDto,
  ) {
    return this.portalService.createClientMessage(
      req.portalUser.clientId,
      req.portalUser.tenantId,
      dto,
    );
  }

  @Public()
  @UseGuards(PortalAuthGuard)
  @Patch('messages/:messageId/read')
  markMessageRead(
    @Req() req: Request & { portalUser: PortalRequestUser },
    @Param('messageId') messageId: string,
  ) {
    return this.portalService.markMessageRead(
      req.portalUser.clientId,
      req.portalUser.tenantId,
      messageId,
    );
  }

  @Public()
  @Get('invoices/:invoiceId')
  getInvoice(@Param('invoiceId') invoiceId: string) {
    return this.portalService.getPublicInvoice(invoiceId);
  }

  @Public()
  @Post('invoices/:invoiceId/pay')
  payInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.portalService.payInvoice(invoiceId, dto);
  }
}
