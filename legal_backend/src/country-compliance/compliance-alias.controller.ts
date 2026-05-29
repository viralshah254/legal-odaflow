import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { CountryComplianceService } from './country-compliance.service';

/** Web client alias: GET /compliance/countries */
@Controller('compliance')
export class ComplianceAliasController {
  constructor(private readonly countryComplianceService: CountryComplianceService) {}

  @Public()
  @Get('countries')
  listCountries() {
    return this.countryComplianceService.listPolicies();
  }
}
