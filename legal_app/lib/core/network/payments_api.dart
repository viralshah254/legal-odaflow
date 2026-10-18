import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class PaymentsApi {
  PaymentsApi(this._client);

  final ApiClient _client;

  Future<PaymentIntentResult> createPaymentIntent({
    required double amount,
    required String currency,
    required String countryCode,
    required String purpose,
    Map<String, String>? metadata,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/payments/intent',
        data: {
          'amount': amount,
          'currency': currency,
          'countryCode': countryCode.toUpperCase(),
          'purpose': purpose,
          if (metadata != null && metadata.isNotEmpty) 'metadata': metadata,
        },
      );
      return PaymentIntentResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<AppPayment>> listPayments() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/payments');
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(AppPayment.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
