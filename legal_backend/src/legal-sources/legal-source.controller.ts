import { Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { LegalSourceService } from './legal-source.service';

@Controller('legal-sources')
export class LegalSourceController {
  constructor(private readonly legalSourceService: LegalSourceService) {}

  @Public()
  @Get()
  list(
    @Query('countryCode') countryCode?: string,
    @Query('enabled') enabled?: string,
  ) {
    return this.legalSourceService.list({
      countryCode,
      enabled: enabled === undefined ? undefined : enabled === 'true',
    });
  }

  @Post('sync')
  sync(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.syncSources(countryCode);
  }

  @Get('export')
  export(@Query('countryCode') countryCode?: string) {
    return this.legalSourceService.exportSources(countryCode);
  }
}
