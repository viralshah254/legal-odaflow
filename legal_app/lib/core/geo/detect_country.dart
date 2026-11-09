import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../drafting/draft_navigation.dart';
import '../providers/app_providers.dart';

const supportedDraftCountries = ['IN', 'US', 'GB', 'KE'];

const countryDisplayNames = <String, String>{
  'IN': 'India',
  'US': 'United States',
  'GB': 'United Kingdom',
  'KE': 'Kenya',
  'ALL': 'All countries',
};

const countryFlagEmojis = <String, String>{
  'IN': '🇮🇳',
  'US': '🇺🇸',
  'GB': '🇬🇧',
  'KE': '🇰🇪',
};

String countryDisplayName(String code) =>
    countryDisplayNames[code.toUpperCase()] ?? code;

String countryFlagEmoji(String code) =>
    countryFlagEmojis[code.toUpperCase()] ?? '🌍';

String _localeCountryCode() {
  final region = PlatformDispatcher.instance.locale.countryCode?.toUpperCase();
  if (region != null &&
      region.length == 2 &&
      supportedDraftCountries.contains(region)) {
    return region;
  }
  return '';
}

/// Explicit catalog choice → current location → account → device locale.
Future<String> detectSupportedCountry({
  String? sessionCountryCode,
  String? currentLocationCountryCode,
}) async {
  final stored = await readLegalFormsCountryFilter();
  if (stored != null && stored.isNotEmpty) {
    if (stored == 'ALL') return 'ALL';
    if (supportedDraftCountries.contains(stored.toUpperCase())) {
      return stored.toUpperCase();
    }
  }

  final location = currentLocationCountryCode?.toUpperCase();
  if (location != null && RegExp(r'^[A-Z]{2}$').hasMatch(location) && location != 'XX' && location != 'ZZ') {
    return supportedDraftCountries.contains(location) ? location : 'ALL';
  }

  final session = sessionCountryCode?.toUpperCase();
  if (session != null &&
      session.isNotEmpty &&
      supportedDraftCountries.contains(session)) {
    return session;
  }

  final locale = _localeCountryCode();
  if (locale.isNotEmpty) return locale;

  return 'IN';
}

Future<String> detectSupportedCountryFromRef(Ref ref) async {
  final sessionCountry =
      ref.read(authControllerProvider).session?.user.countryCode;
  final location = await ref.read(workCountryProvider.future);
  return detectSupportedCountry(
    sessionCountryCode: sessionCountry, currentLocationCountryCode: location,
  );
}

const draftCountryPickerOptions = <({String code, String label})>[
  (code: 'IN', label: 'India'),
  (code: 'US', label: 'United States'),
  (code: 'GB', label: 'United Kingdom'),
  (code: 'KE', label: 'Kenya'),
  (code: 'ALL', label: 'All countries'),
];
