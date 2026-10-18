import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';
import 'pricing_api.dart';

class SubscriptionsApi {
  SubscriptionsApi(this._client) : _pricing = PricingApi(_client);

  final ApiClient _client;
  final PricingApi _pricing;

  Future<List<PricingPlan>> listPlans({
    required String countryCode,
    String userType = 'CONSUMER',
  }) {
    return _pricing.getPlans(countryCode: countryCode, userType: userType);
  }

  Future<SubscriptionCheckout> checkout({
    required String planId,
    required String countryCode,
    String userType = 'CONSUMER',
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/subscriptions/checkout',
        data: {
          'planId': planId,
          'countryCode': countryCode.toUpperCase(),
          'userType': userType,
        },
      );
      return SubscriptionCheckout.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
