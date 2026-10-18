import 'dart:ui' as ui;

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';
import 'jurisdiction_options.dart';

class DetectedCountry {
  const DetectedCountry({
    required this.countryCode,
    required this.countryName,
    required this.source,
    this.jurisdiction,
  });

  final String countryCode;
  final String countryName;
  final String source;

  /// Matched state/region from the static jurisdiction list, or null if not detected.
  final String? jurisdiction;

  factory DetectedCountry.fromJson(Map<String, dynamic> json) {
    return DetectedCountry(
      countryCode: json['countryCode'] as String? ?? AppConfig.defaultCountry,
      countryName: json['countryName'] as String? ?? 'Unknown',
      source: json['source'] as String? ?? 'default',
    );
  }
}

class DetectCountryService {
  DetectCountryService(this._client);

  final ApiClient _client;

  String get _fallbackCountry => AppConfig.defaultCountry;

  String normalizeCountryCode(String? code) {
    final upper = code?.toUpperCase();
    if (upper != null && AppConfig.supportedCountryCodes.contains(upper)) {
      return upper;
    }
    return _fallbackCountry;
  }

  String countryNameFor(String code) {
    return AppConfig.countryNames[code] ?? code;
  }

  DetectedCountry _result(String code, String source, {String? jurisdiction}) {
    final normalized = normalizeCountryCode(code);
    return DetectedCountry(
      countryCode: normalized,
      countryName: countryNameFor(normalized),
      source: source,
      jurisdiction: jurisdiction,
    );
  }

  /// Fuzzy-matches [rawRegion] (from ipapi) against the static jurisdiction list
  /// for [countryCode]. Returns the matched entry or null.
  String? _matchRegion(String countryCode, String rawRegion) {
    final options = JurisdictionOptions.forCountry(countryCode);
    if (options == null || rawRegion.isEmpty) return null;
    final query = rawRegion.toLowerCase();
    for (final option in options) {
      if (option.toLowerCase().contains(query) ||
          query.contains(option.toLowerCase())) {
        return option;
      }
    }
    return null;
  }

  /// Device locale region (e.g. en_US → US).
  DetectedCountry? detectFromDeviceLocale() {
    final locales = ui.PlatformDispatcher.instance.locales;
    for (final locale in locales) {
      final region = locale.countryCode?.toUpperCase();
      if (region != null &&
          region.isNotEmpty &&
          AppConfig.supportedCountryCodes.contains(region)) {
        return _result(region, 'locale');
      }
    }
    return null;
  }

  /// Timezone heuristics when locale has no region.
  DetectedCountry? detectFromTimezone() {
    final name = DateTime.now().timeZoneName.toUpperCase();
    if (name.contains('IST') && !name.contains('EST')) {
      return _result('IN', 'timezone');
    }
    if (name.contains('EAT') || name.contains('NAIROBI')) {
      return _result('KE', 'timezone');
    }
    if (name.contains('GMT') ||
        name.contains('BST') ||
        name.contains('LONDON')) {
      return _result('GB', 'timezone');
    }
    if (name.contains('EST') ||
        name.contains('CST') ||
        name.contains('MST') ||
        name.contains('PST') ||
        name.contains('EDT') ||
        name.contains('PDT')) {
      return _result('US', 'timezone');
    }
    return null;
  }

  Future<DetectedCountry?> detectFromBackend() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/geo/detect',
      );
      final data = response.data;
      if (data == null) return null;
      final rawCode = data['countryCode'] as String?;
      if (rawCode == null || rawCode.isEmpty) return null;
      return DetectedCountry(
        countryCode: normalizeCountryCode(rawCode),
        countryName:
            data['countryName'] as String? ??
            countryNameFor(normalizeCountryCode(rawCode)),
        source: data['source'] as String? ?? 'backend',
      );
    } on DioException {
      return null;
    }
  }

  Future<DetectedCountry?> detectFromIpApi() async {
    try {
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
          headers: {'Accept': 'application/json'},
        ),
      );
      final response = await dio.get<Map<String, dynamic>>(
        'https://ipapi.co/json/',
      );
      final data = response.data;
      final rawCode = data?['country_code'] as String?;
      if (rawCode == null || rawCode.isEmpty) return null;
      final normalized = normalizeCountryCode(rawCode);
      final rawRegion = data?['region'] as String?;
      final jurisdiction =
          rawRegion != null ? _matchRegion(normalized, rawRegion) : null;
      return DetectedCountry(
        countryCode: normalized,
        countryName:
            data?['country_name'] as String? ?? countryNameFor(normalized),
        source: 'ipapi',
        jurisdiction: jurisdiction,
      );
    } on DioException {
      return null;
    }
  }

  Future<DetectedCountry> detectCountry() async {
    // Device IP lookup first — backend /geo/detect uses the API server's IP, not the phone's.
    final ipapi = await detectFromIpApi();
    if (ipapi != null) return ipapi;

    final locale = detectFromDeviceLocale();
    if (locale != null) return locale;

    final backend = await detectFromBackend();
    if (backend != null) return backend;

    final timezone = detectFromTimezone();
    if (timezone != null) return timezone;

    return _result(_fallbackCountry, 'default');
  }
}
