import '../../l10n/app_localizations.dart';

class PracticeArea {
  const PracticeArea({required this.slug, required this.label});
  final String slug;
  final String label;
}

/// Localized country display name for supported regions.
/// Prefer over [AppConfig.countryNames] in UI.
String localizedCountryName(AppLocalizations l10n, String code) {
  switch (code) {
    case 'IN':
      return l10n.commonIndia;
    case 'US':
      return l10n.commonUnitedStates;
    case 'KE':
      return l10n.commonKenya;
    case 'GB':
      return l10n.commonUnitedKingdom;
    default:
      return AppConfig.countryNames[code] ?? code;
  }
}

/// Localized practice-area label matching [AppConfig.practiceAreas] slugs.
/// Prefer over [PracticeArea.label] in UI.
String localizedPracticeAreaLabel(AppLocalizations l10n, String slug) {
  switch (slug) {
    case 'litigation_disputes':
      return l10n.commonLitigationDisputes;
    case 'corporate_commercial':
      return l10n.commonCorporateCommercial;
    case 'employment_labour':
      return l10n.commonEmploymentLabour;
    case 'family_matrimonial':
      return l10n.commonFamilyMatrimonial;
    case 'criminal_defense':
      return l10n.commonCriminalDefense;
    case 'real_estate_property':
      return l10n.commonRealEstateProperty;
    case 'intellectual_property':
      return l10n.commonIntellectualProperty;
    case 'immigration':
      return l10n.commonImmigration;
    case 'tax':
      return l10n.commonTax;
    case 'wills_estates_probate':
      return l10n.commonWillsEstatesProbate;
    default:
      for (final area in AppConfig.practiceAreas) {
        if (area.slug == slug) return area.label;
      }
      return slug.replaceAll('_', ' ');
  }
}

class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api.okaylegal.ai/api/v1',
  );

  /// Socket.IO origin for live meeting captions (same host as [apiBaseUrl], no /api/v1).
  static String get realtimeSocketUrl {
    final uri = Uri.parse(apiBaseUrl);
    final port = uri.hasPort ? ':${uri.port}' : '';
    return '${uri.scheme}://${uri.host}$port';
  }

  static const String webBaseUrl = String.fromEnvironment(
    'WEB_URL',
    defaultValue: 'https://legal.odaflow.com',
  );

  /// Base URL for subscription / payment checkout WebView (Stripe, Razorpay, etc.).
  static String resolveCheckoutUrl(String checkoutUrl) {
    final trimmed = checkoutUrl.trim();
    if (trimmed.isEmpty) return trimmed;
    final parsed = Uri.tryParse(trimmed);
    if (parsed != null && parsed.hasScheme) return trimmed;
    final base = webBaseUrl.replaceAll(RegExp(r'/$'), '');
    final path = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$base$path';
  }

  static const String appEnv = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const String sentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  static const String defaultCountry = String.fromEnvironment(
    'DEFAULT_COUNTRY',
    defaultValue: 'US',
  );

  static const supportedCountryCodes = ['IN', 'US', 'KE', 'GB'];

  static const countryNames = {
    'IN': 'India',
    'US': 'United States',
    'KE': 'Kenya',
    'GB': 'United Kingdom',
  };

  /// Canonical practice-area slugs matching backend PRACTICE_AREAS config.
  static const practiceAreas = [
    PracticeArea(slug: 'litigation_disputes', label: 'Litigation & Disputes'),
    PracticeArea(slug: 'corporate_commercial', label: 'Corporate & Commercial'),
    PracticeArea(slug: 'employment_labour', label: 'Employment & Labour'),
    PracticeArea(slug: 'family_matrimonial', label: 'Family & Matrimonial'),
    PracticeArea(slug: 'criminal_defense', label: 'Criminal Defense'),
    PracticeArea(slug: 'real_estate_property', label: 'Real Estate & Property'),
    PracticeArea(slug: 'intellectual_property', label: 'Intellectual Property'),
    PracticeArea(slug: 'immigration', label: 'Immigration'),
    PracticeArea(slug: 'tax', label: 'Tax'),
    PracticeArea(slug: 'wills_estates_probate', label: 'Wills, Estates & Probate'),
  ];

  /// Default matter types per practice area slug (mirrors backend defaultMatterTypeForPracticeArea).
  static String defaultMatterType(String practiceAreaSlug) {
    switch (practiceAreaSlug) {
      case 'litigation_disputes':
        return 'civil_litigation';
      case 'corporate_commercial':
        return 'corporate';
      case 'employment_labour':
        return 'employment_dispute';
      case 'family_matrimonial':
        return 'family';
      case 'criminal_defense':
        return 'criminal';
      case 'real_estate_property':
        return 'property';
      case 'intellectual_property':
        return 'ip';
      case 'immigration':
        return 'immigration';
      case 'tax':
        return 'tax';
      case 'wills_estates_probate':
        return 'wills_probate';
      default:
        return 'general';
    }
  }

  /// Legacy list kept for backwards compatibility.
  static const issueTypes = [
    'Employment',
    'Contract',
    'Family',
    'Property',
    'Criminal',
    'Consumer Rights',
    'Other',
  ];

  // Feature flags — pass via --dart-define=ENABLE_*=true|false
  static const bool enableConsumerApp = bool.fromEnvironment(
    'ENABLE_CONSUMER_APP',
    defaultValue: true,
  );

  static const bool enableLawyerMode = bool.fromEnvironment(
    'ENABLE_LAWYER_MODE',
    defaultValue: true,
  );

  static const bool enableLawyerApp = bool.fromEnvironment(
    'ENABLE_LAWYER_APP',
    defaultValue: true,
  );

  static const bool enableDocumentUpload = bool.fromEnvironment(
    'ENABLE_DOCUMENT_UPLOAD',
    defaultValue: true,
  );

  static const bool enableLawyerReview = bool.fromEnvironment(
    'ENABLE_LAWYER_REVIEW',
    defaultValue: true,
  );

  static const bool enablePushNotifications = bool.fromEnvironment(
    'ENABLE_PUSH_NOTIFICATIONS',
    defaultValue: true,
  );

  /// Web OAuth client ID from Firebase console (`umbrella-95da1`).
  /// Required for Google Sign-In to obtain a Firebase-compatible ID token (iOS + Android).
  /// Matches `legal_web/.env.local` and `android/app/google-services.json` oauth_client type 3.
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue:
        '1034275934580-rm58bb4bj2csrpasbmngbfqd1ndqv96q.apps.googleusercontent.com',
  );

  /// iOS OAuth client ID from Firebase console — matches `GoogleService-Info.plist` CLIENT_ID.
  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue:
        '1034275934580-2sn8vugf9vum4js1n7ma0s796mihfmju.apps.googleusercontent.com',
  );

  static const bool enableSubscriptions = bool.fromEnvironment(
    'ENABLE_SUBSCRIPTIONS',
    defaultValue: true,
  );

  /// When false, all in-app purchasing UI and WebView checkout is disabled.
  /// Must be false for App Store and Google Play builds (guideline 3.1.1).
  static const bool enableInAppPurchasing = bool.fromEnvironment(
    'ENABLE_IN_APP_PURCHASING',
    defaultValue: false,
  );

  static bool get isProduction => appEnv == 'production';
  static bool get sentryEnabled => sentryDsn.isNotEmpty;
}
