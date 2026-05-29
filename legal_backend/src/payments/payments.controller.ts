import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  createIntent(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(user.id, user.tenantId, dto);
  }

  @Get()
  listMine(@CurrentUser() user: RequestUser) {
    return this.paymentsService.listPayments(user.id, user.tenantId);
  }

  @Get(':paymentId/receipt')
  getReceipt(@CurrentUser() user: RequestUser, @Param('paymentId') paymentId: string) {
    return this.paymentsService.getReceipt(paymentId, user.tenantId);
  }

  @Post('tenant/intent')
  @UseGuards(TenantGuard)
  createTenantIntent(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.id, tenantId, dto);
  }

  @Public()
  @Post('webhooks/stripe')
  handleStripeWebhook(@Req() req: Request, @Headers('stripe-signature') signature?: string) {
    const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
      ? (req as Request & { rawBody?: Buffer }).rawBody!.toString('utf8')
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});
    return this.paymentsService.handleStripeWebhook(rawBody, signature);
  }

  @Public()
  @Post('webhooks/razorpay')
  handleRazorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
      ? (req as Request & { rawBody?: Buffer }).rawBody!.toString('utf8')
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});
    return this.paymentsService.handleRazorpayWebhook(rawBody, signature);
  }

  @Public()
  @Post('webhooks/mpesa')
  handleMpesaWebhook(
    @Req() req: Request,
    @Headers('x-mpesa-signature') signature?: string,
  ) {
    const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
      ? (req as Request & { rawBody?: Buffer }).rawBody!.toString('utf8')
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});
    return this.paymentsService.handleMpesaWebhook(rawBody, signature);
  }
}
