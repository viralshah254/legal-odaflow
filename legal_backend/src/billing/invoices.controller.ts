import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { InvoicesService } from './invoices.service';
import { LedesService } from './ledes.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoiceFromApprovedTimeDto } from './dto/create-invoice-from-approved-time.dto';

@Controller('billing/invoices')
@UseGuards(TenantGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly ledesService: LedesService,
  ) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(tenantId, dto);
  }

  @Post('from-approved-time')
  createFromApprovedTime(
    @TenantId() tenantId: string,
    @Body() dto: CreateInvoiceFromApprovedTimeDto,
  ) {
    return this.invoicesService.createFromApprovedTime(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.invoicesService.findAll(tenantId, { status, matterId, clientId });
  }

  @Get(':invoiceId')
  findOne(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoicesService.findOne(tenantId, invoiceId);
  }

  @Patch(':invoiceId/send')
  markSent(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoicesService.markSent(tenantId, invoiceId);
  }

  @Get(':invoiceId/ledes98b')
  async exportLedes98B(
    @TenantId() tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response,
  ) {
    const content = await this.ledesService.exportInvoice98B(tenantId, invoiceId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${invoiceId}-ledes98b.txt"`,
    );
    res.send(content);
  }
}
