import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('billing/invoices')
@UseGuards(TenantGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(tenantId, dto);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.invoicesService.findAll(tenantId, status);
  }

  @Get(':invoiceId')
  findOne(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoicesService.findOne(tenantId, invoiceId);
  }

  @Patch(':invoiceId/send')
  markSent(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoicesService.markSent(tenantId, invoiceId);
  }
}
