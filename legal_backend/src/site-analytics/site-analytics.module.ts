import { Module } from '@nestjs/common';
import { SuperAdminGuard } from '@/admin/super-admin.guard';
import { SiteAnalyticsController } from './site-analytics.controller';
import { SiteAnalyticsService } from './site-analytics.service';

@Module({
  controllers: [SiteAnalyticsController],
  providers: [SiteAnalyticsService, SuperAdminGuard],
  exports: [SiteAnalyticsService],
})
export class SiteAnalyticsModule {}
