import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import { MiMetadataService } from './mi-metadata.service';
import { MiReviewService } from '@/ai/matter-intelligence/mi-review.service';

@Controller('admin/mi-metadata')
@UseGuards(SuperAdminGuard)
export class MiMetadataController {
  constructor(
    private readonly miMetadata: MiMetadataService,
    private readonly miReview: MiReviewService,
  ) {}

  @Get('assets')
  listAssets(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.miMetadata.listAssets({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      practiceArea,
      countryCode,
    });
  }

  @Patch('assets/:assetId')
  updateAssetTags(
    @Param('assetId') assetId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.miMetadata.updateAssetMetadata(assetId, body);
  }

  @Get('taxonomy/coverage')
  taxonomyCoverage() {
    return this.miMetadata.taxonomyCoverage();
  }

  @Get('audit')
  miAuditLogs(
    @Query('consumer') consumer?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.miMetadata.listMiAuditLogs({
      consumer,
      practiceArea,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('reviews')
  listReviews(@Query('status') status?: string) {
    return this.miReview.list({ status });
  }

  @Post('reviews/:reviewId')
  submitReview(
    @Param('reviewId') reviewId: string,
    @Body() body: { correction?: Record<string, unknown>; status?: string; reviewerId?: string },
  ) {
    return this.miReview.submitReview(reviewId, body);
  }
}
