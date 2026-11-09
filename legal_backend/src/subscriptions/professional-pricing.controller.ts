import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { professionalCatalog } from '@/config/professional-catalog';

@Controller('pricing/professional-catalog')
export class ProfessionalPricingController {
  @Public()
  @Get()
  catalog(@Query('country') country = 'US', @Query('interval') interval = 'month', @Query('channel') channel = 'web') {
    if (!['month', 'year'].includes(interval) || !['web', 'apple', 'google'].includes(channel)) {
      throw new BadRequestException('Invalid billing interval or purchase channel');
    }
    try {
      return professionalCatalog({ countryCode: country, interval: interval as 'month' | 'year', channel: channel as 'web' | 'apple' | 'google' });
    } catch {
      throw new BadRequestException('Invalid billing country');
    }
  }
}
