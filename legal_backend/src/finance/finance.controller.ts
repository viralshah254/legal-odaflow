import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import {
  CreateClaimDto,
  CreateExpenseDto,
  CreateFixedCostDto,
  RecordInvoicePaymentDto,
  UpdatePaymentReconciliationDto,
  UpdateClaimDto,
  UpdateExpenseDto,
  UpdateFixedCostDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(TenantGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('invoices')
  findInvoices(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.financeService.findInvoices(tenantId, status);
  }

  @Get('invoices/outstanding')
  findOutstandingInvoices(@TenantId() tenantId: string) {
    return this.financeService.findOutstandingInvoices(tenantId);
  }

  @Get('invoices/overdue')
  findOverdueInvoices(@TenantId() tenantId: string) {
    return this.financeService.findOverdueInvoices(tenantId);
  }

  @Get('invoices/:invoiceId')
  getInvoice(@TenantId() tenantId: string, @Param('invoiceId') invoiceId: string) {
    return this.financeService.getInvoice(tenantId, invoiceId);
  }

  @Post('invoices/:invoiceId/payments')
  recordInvoicePayment(
    @TenantId() tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordInvoicePaymentDto,
  ) {
    return this.financeService.recordInvoicePayment(tenantId, invoiceId, dto);
  }

  @Get('payments')
  findPayments(@TenantId() tenantId: string) {
    return this.financeService.findPayments(tenantId);
  }

  @Patch('payments/:paymentId')
  setReconciled(
    @TenantId() tenantId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdatePaymentReconciliationDto,
  ) {
    return this.financeService.setPaymentReconciled(tenantId, paymentId, dto.reconciled);
  }

  @Get('pl')
  getProfitAndLoss(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.getProfitAndLoss(tenantId, from, to);
  }

  @Get('statements')
  getClientStatements(
    @TenantId() tenantId: string,
    @Query('clientId') clientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.getClientStatements(tenantId, clientId, from, to);
  }

  @Post('expenses')
  createExpense(@TenantId() tenantId: string, @Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(tenantId, dto);
  }

  @Get('expenses')
  findExpenses(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
  ) {
    return this.financeService.findExpenses(tenantId, matterId, status);
  }

  @Patch('expenses/:expenseId')
  updateExpense(
    @TenantId() tenantId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(tenantId, expenseId, dto);
  }

  @Post('claims')
  createClaim(@TenantId() tenantId: string, @Body() dto: CreateClaimDto) {
    return this.financeService.createClaim(tenantId, dto);
  }

  @Get('claims')
  findClaims(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
  ) {
    return this.financeService.findClaims(tenantId, matterId, status);
  }

  @Patch('claims/:claimId')
  updateClaim(
    @TenantId() tenantId: string,
    @Param('claimId') claimId: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.financeService.updateClaim(tenantId, claimId, dto);
  }

  @Post('fixed-costs')
  createFixedCost(
    @TenantId() tenantId: string,
    @Body() dto: CreateFixedCostDto,
  ) {
    return this.financeService.createFixedCost(tenantId, dto);
  }

  @Get('fixed-costs')
  findFixedCosts(
    @TenantId() tenantId: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.financeService.findFixedCosts(tenantId, isActive);
  }

  @Patch('fixed-costs/:fixedCostId')
  updateFixedCost(
    @TenantId() tenantId: string,
    @Param('fixedCostId') fixedCostId: string,
    @Body() dto: UpdateFixedCostDto,
  ) {
    return this.financeService.updateFixedCost(tenantId, fixedCostId, dto);
  }
}
