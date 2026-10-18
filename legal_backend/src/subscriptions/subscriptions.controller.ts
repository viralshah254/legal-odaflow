import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(TenantGuard)
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

  @Post(['confirm-checkout', 'confirm-checkout/'])
  confirmCheckout(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.subscriptionsService.confirmCheckoutSession(
      user.id,
      tenantId,
      dto.sessionId,
    );
  }

  @Get('intro-offer')
  getIntroOffer(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.subscriptionsService.getIntroOfferStatus(user.id, tenantId);
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
