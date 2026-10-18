import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/locale_config.dart';

const _storageKey = 'umbrella_locale';

final localeStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

class LocaleNotifier extends AsyncNotifier<String> {
  @override
  Future<String> build() async {
    final stored = await ref.read(localeStorageProvider).read(key: _storageKey);
    if (stored != null && supportedLocaleCodes.contains(stored)) {
      currentAcceptLanguage = stored;
      return stored;
    }
    currentAcceptLanguage = defaultLocale;
    return defaultLocale;
  }

  /// Returns false when [code] is not valid for [countryCode].
  Future<bool> setLocale(String code, {required String countryCode}) async {
    if (!isLocaleValidForCountry(code, countryCode)) return false;
    await ref.read(localeStorageProvider).write(key: _storageKey, value: code);
    currentAcceptLanguage = code;
    state = AsyncData(code);
    return true;
  }

  /// Apply server-stored locale when local storage is empty or invalid.
  Future<void> hydrateFromServer({
    required String? preferredLocale,
    required String countryCode,
  }) async {
    if (preferredLocale == null || preferredLocale.isEmpty) {
      await ensureValidForCountry(countryCode);
      return;
    }
    final stored = state.maybeWhen(data: (v) => v, orElse: () => null);
    if (stored != null &&
        stored != defaultLocale &&
        isLocaleValidForCountry(stored, countryCode)) {
      return;
    }
    if (isLocaleValidForCountry(preferredLocale, countryCode)) {
      await setLocale(preferredLocale, countryCode: countryCode);
    } else {
      await ensureValidForCountry(countryCode);
    }
  }

  Future<void> ensureValidForCountry(String countryCode) async {
    final current = state.maybeWhen(data: (v) => v, orElse: () => defaultLocale);
    if (!isLocaleValidForCountry(current, countryCode)) {
      await setLocale(getDefaultLocaleForCountry(countryCode), countryCode: countryCode);
    }
  }
}

final localeProvider = AsyncNotifierProvider<LocaleNotifier, String>(
  LocaleNotifier.new,
);

Locale parseLocale(String code) {
  final definition = localeDefinitions[code] ?? localeDefinitions[defaultLocale]!;
  return Locale(definition.code);
}
