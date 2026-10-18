import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:umbrella/core/drafting/draft_navigation.dart';
import 'package:umbrella/core/geo/detect_country.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('detectSupportedCountry', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
    });

    test('returns stored preference when set', () async {
      await persistLegalFormsCountryFilter('US');
      expect(await detectSupportedCountry(), 'US');
    });

    test('returns ALL when stored as ALL', () async {
      await persistLegalFormsCountryFilter('ALL');
      expect(await detectSupportedCountry(), 'ALL');
    });

    test('prefers stored over session country', () async {
      await persistLegalFormsCountryFilter('GB');
      expect(await detectSupportedCountry(sessionCountryCode: 'US'), 'GB');
    });

    test('uses session country when no stored value', () async {
      expect(await detectSupportedCountry(sessionCountryCode: 'KE'), 'KE');
    });

    test('falls back to supported country when nothing else matches', () async {
      final code = await detectSupportedCountry(sessionCountryCode: 'ZZ');
      expect(supportedDraftCountries.contains(code), isTrue);
    });
  });

  group('countryDisplayName', () {
    test('returns human-readable names', () {
      expect(countryDisplayName('IN'), 'India');
      expect(countryFlagEmoji('US'), '🇺🇸');
    });
  });
}
