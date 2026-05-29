import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { CountryComplianceService } from './country-compliance.service';

@Controller('country-compliance')
export class CountryComplianceController {
  constructor(private readonly countryComplianceService: CountryComplianceService) {}

  @Public()
  @Get()
  listPolicies() {
    return this.countryComplianceService.listPolicies();
  }

  @Public()
  @Get(':countryCode')
  getPolicy(@Param('countryCode') countryCode: string) {
    return this.countryComplianceService.getPolicy(countryCode);
  }
}
