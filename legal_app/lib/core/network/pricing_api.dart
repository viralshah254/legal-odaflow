import 'package:dio/dio.dart';

import '../models/models.dart';
import '../pricing/local_pricing.dart';
import 'api_client.dart';
import 'pricing_plans_parser.dart';

class PricingApi {
  PricingApi(this._client);

  final ApiClient _client;

  Future<List<PricingPlan>> getPlans({
    required String countryCode,
    String userType = 'CONSUMER',
  }) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/pricing/plans',
        queryParameters: {
          'country': countryCode.toUpperCase(),
          'userType': userType,
        },
      );
      return parsePricingPlansResponse(
        response.data,
        countryCode: countryCode,
        userType: userType,
      );
    } on DioException {
      return fallbackConsumerPlans(countryCode);
    }
  }

  Future<LawyerReviewPricing> getLawyerReviewPricing(String countryCode) async {
    final code = countryCode.toUpperCase();
    try {
      final plans = await getPlans(countryCode: code);
      final plusPlan = plans.cast<PricingPlan?>().firstWhere(
        (plan) => plan!.planId.contains('plus'),
        orElse: () => null,
      );
      if (plusPlan != null) {
        return LawyerReviewPricing.fromPlan(plusPlan, code);
      }
    } catch (_) {
      // Fall through to static defaults when pricing API is unavailable.
    }
    return LawyerReviewPricing.fallback(code);
  }
}
