import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiSafetyService, LegalRequestContext } from './ai-safety.service';

@Controller('admin/ai-safety')
export class AiSafetyController {
  constructor(private readonly svc: AiSafetyService) {}

  @Get('logs')
  getFlags(
    @Query('tenantId') tenantId: string,
    @Query('feature') feature?: string,
    @Query('onlyFailed') onlyFailed?: string,
    @Query('onlyBlocked') onlyBlocked?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getFlags(tenantId, {
      feature,
      onlyFailed: onlyFailed === 'true',
      onlyBlocked: onlyBlocked === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scan(@Body() body: { input: string; context: LegalRequestContext }) {
    const [inputChecks, outputChecks] = await Promise.all([
      this.svc.scanInput(body.input, body.context),
      this.svc.scanOutput(body.input, body.context),
    ]);
    return { inputChecks, outputChecks };
  }

  @Patch('logs/:id/review')
  markReviewed(
    @Param('id') id: string,
    @Body() body: { reviewedBy: string; note?: string },
  ) {
    return this.svc.markReviewed(id, body.reviewedBy, body.note);
  }
}
