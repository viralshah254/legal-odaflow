import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRY_CODES,
  getCountryConfig,
} from '@/config/countries';
import { LOCALE_DEFINITIONS } from '@/config/locales';

@Controller('config')
export class ConfigController {
  @Public()
  @Get('countries')
  listCountries() {
    return SUPPORTED_COUNTRY_CODES.map((code) => {
      const config = COUNTRY_CONFIGS[code];
      return {
        code: config.code,
        name: config.name,
        currency: config.currency,
        currencySymbol: config.currencySymbol,
        defaultLocale: config.defaultLocale,
        dataRegion: config.dataRegion,
        timezone: config.timezone,
        paymentProviders: config.paymentProviders,
        defaultPaymentProvider: config.defaultPaymentProvider,
        consumerFreePreviews: config.consumerFreePreviews,
        supportedUiLocales: config.supportedUiLocales,
        supportedJurisdictions: config.supportedJurisdictions,
      };
    });
  }

  @Public()
  @Get('locales')
  listLocales(@Query('country') country?: string) {
    const countryCode = (country ?? 'US').toUpperCase();
    const config = getCountryConfig(countryCode);
    return config.supportedUiLocales.map((code) => ({
      ...LOCALE_DEFINITIONS[code],
      code,
    }));
  }

  @Public()
  @Get('countries/:code/jurisdictions')
  listJurisdictions(@Param('code') code: string) {
    const config = getCountryConfig(code);
    return {
      countryCode: config.code,
      countryName: config.name,
      jurisdictions: config.supportedJurisdictions,
    };
  }
}
