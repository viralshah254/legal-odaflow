import { ConfigController } from './config.controller';
import { COUNTRY_CONFIGS } from './countries';

describe('ConfigController', () => {
  const controller = new ConfigController();

  describe('listCountries', () => {
    it('includes supportedJurisdictions for each tier-1 country', () => {
      const countries = controller.listCountries();

      expect(countries.length).toBeGreaterThan(0);
      for (const country of countries) {
        const config = COUNTRY_CONFIGS[country.code];
        expect(country.supportedJurisdictions).toEqual(config.supportedJurisdictions);
        expect(country.supportedJurisdictions.length).toBeGreaterThan(0);
      }
    });

    it('returns India with Maharashtra in supportedJurisdictions', () => {
      const india = controller.listCountries().find((country) => country.code === 'IN');
      expect(india?.supportedJurisdictions).toContain('Maharashtra');
    });
  });

  describe('listJurisdictions', () => {
    it('returns jurisdictions for a supported country', () => {
      expect(controller.listJurisdictions('IN')).toEqual({
        countryCode: 'IN',
        countryName: 'India',
        jurisdictions: COUNTRY_CONFIGS.IN.supportedJurisdictions,
      });
    });
  });
});
