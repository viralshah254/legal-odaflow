import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { IssueCheckerSchemaController } from './issue-checker-schema.controller';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksDeliveryService } from './webhooks-delivery.service';

@Module({
  controllers: [
    PublicApiController,
    WebhooksController,
    ApiKeysController,
    IssueCheckerSchemaController,
  ],
  providers: [PublicApiService, WebhooksDeliveryService, ApiKeysService],
  exports: [PublicApiService, WebhooksDeliveryService, ApiKeysService],
})
export class PublicApiModule {}
