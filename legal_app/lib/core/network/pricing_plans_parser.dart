import '../models/models.dart';

/// Parses `/pricing/plans` responses — either a flat list or a catalog object
/// with a nested `plans` array (country-localized pricing).
List<PricingPlan> parsePricingPlansResponse(
  dynamic data, {
  required String countryCode,
  String userType = 'CONSUMER',
}) {
  List<dynamic> raw;
  if (data is List) {
    raw = data;
  } else if (data is Map<String, dynamic>) {
    raw = data['plans'] as List<dynamic>? ?? [];
  } else {
    raw = [];
  }

  final normalizedType = userType.toUpperCase();
  final plans = raw
      .whereType<Map<String, dynamic>>()
      .map(PricingPlan.fromJson)
      .where((p) => p.userType.toUpperCase() == normalizedType)
      .toList();

  return plans.isNotEmpty
      ? plans
      : PricingPlan.fallbackForCountry(countryCode);
}
