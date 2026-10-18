import { Body, Controller, Post, UseGuards, Get, Query, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { SuperAdminGuard } from '@/admin/super-admin.guard';
import { SiteAnalyticsService, IngestBatchDto, IdentifyDto } from './site-analytics.service';

@Controller('analytics/site')
export class SiteAnalyticsController {
  constructor(private readonly svc: SiteAnalyticsService) {}

  /** Public ingest — rate-limited, no auth required */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('events')
  ingest(@Body() dto: IngestBatchDto) {
    return this.svc.ingest(dto);
  }

  /** Associate a visitorId to a userId after login/signup */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('identify')
  identify(@Body() dto: IdentifyDto) {
    return this.svc.identify(dto);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  @UseGuards(SuperAdminGuard)
  @Get('admin/summary')
  getSummary() {
    return this.svc.getSummary();
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/timeseries')
  getTimeseries(@Query('days') days?: string) {
    return this.svc.getTimeseries(Math.min(Number(days ?? 30), 90));
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/utm')
  getUtm(@Query('days') days?: string) {
    return this.svc.getUtmBreakdown(Math.min(Number(days ?? 7), 90));
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/funnel')
  getFunnel(@Query('days') days?: string) {
    return this.svc.getFunnel(Math.min(Number(days ?? 7), 90));
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/referrers')
  getReferrers(@Query('days') days?: string) {
    return this.svc.getReferrerBreakdown(Math.min(Number(days ?? 7), 90));
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/search-queries')
  getSearchQueries(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'countryCode' | 'issueType' | 'mode',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('countryCode') countryCode?: string,
    @Query('mode') mode?: string,
  ) {
    return this.svc.getSearchQueries(
      Math.min(Number(days ?? 30), 90),
      Math.min(Number(limit ?? 50), 200),
      Number(offset ?? 0),
      sortBy,
      sortDir,
      countryCode,
      mode,
    );
  }
}
