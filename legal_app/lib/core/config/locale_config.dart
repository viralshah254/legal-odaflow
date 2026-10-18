// Locale configuration mirrored from shared/i18n/locales.config.ts

class LocaleDefinition {
  const LocaleDefinition({
    required this.code,
    required this.englishName,
    required this.nativeName,
    required this.rtl,
  });

  final String code;
  final String englishName;
  final String nativeName;
  final bool rtl;
}

const defaultLocale = 'en';

/// Updated by [LocaleNotifier] for API Accept-Language headers.
String currentAcceptLanguage = defaultLocale;

const supportedLocaleCodes = [
  'en', 'fr', 'de', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as',
];

const indiaLocaleCodes = [
  'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as',
];

const globalLocaleCodes = ['en', 'fr', 'de'];

const localeDefinitions = <String, LocaleDefinition>{
  'en': LocaleDefinition(code: 'en', englishName: 'English', nativeName: 'English', rtl: false),
  'fr': LocaleDefinition(code: 'fr', englishName: 'French', nativeName: 'Français', rtl: false),
  'de': LocaleDefinition(code: 'de', englishName: 'German', nativeName: 'Deutsch', rtl: false),
  'hi': LocaleDefinition(code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', rtl: false),
  'bn': LocaleDefinition(code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', rtl: false),
  'te': LocaleDefinition(code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', rtl: false),
  'mr': LocaleDefinition(code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', rtl: false),
  'ta': LocaleDefinition(code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', rtl: false),
  'gu': LocaleDefinition(code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false),
  'kn': LocaleDefinition(code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false),
  'ml': LocaleDefinition(code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', rtl: false),
  'ur': LocaleDefinition(code: 'ur', englishName: 'Urdu', nativeName: 'اردو', rtl: true),
  'pa': LocaleDefinition(code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false),
  'or': LocaleDefinition(code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', rtl: false),
  'as': LocaleDefinition(code: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া', rtl: false),
};

List<String> getLocalesForCountry(String countryCode) {
  if (countryCode.toUpperCase() == 'IN') {
    return List<String>.from(indiaLocaleCodes);
  }
  return List<String>.from(globalLocaleCodes);
}

bool isLocaleValidForCountry(String locale, String countryCode) {
  return getLocalesForCountry(countryCode).contains(locale);
}

String getDefaultLocaleForCountry(String countryCode) => defaultLocale;

bool isRtlLocale(String locale) => localeDefinitions[locale]?.rtl ?? false;

List<LocaleDefinition> availableLocalesForCountry(String countryCode) {
  return getLocalesForCountry(countryCode)
      .map((code) => localeDefinitions[code]!)
      .toList();
}
