import { Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  listPlans(@Query('userType') userType?: string) {
    return this.subscriptionsService.listPlans(userType);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: CheckoutSubscriptionDto,
  ) {
    return this.subscriptionsService.createCheckout(user.id, dto, tenantId);
  }

  @Public()
  @Post('webhooks/stripe')
  handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
      ? (req as Request & { rawBody?: Buffer }).rawBody!.toString('utf8')
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});
    return this.subscriptionsService.handleStripeSubscriptionWebhook(rawBody, signature);
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
    return this.subscriptionsService.handleRazorpaySubscriptionWebhook(rawBody, signature);
  }
}

@Controller('pricing')
export class PricingController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  listByCountry(
    @Query('country') country?: string,
    @Query('countryCode') countryCode?: string,
    @Query('userType') userType?: string,
  ) {
    const code = country ?? countryCode;
    if (userType && !code) {
      return this.subscriptionsService.listPlans(userType);
    }
    return this.subscriptionsService.listPricingByCountry(code);
  }
}
