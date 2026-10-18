import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class TrainingConsentApi {
  TrainingConsentApi(this._client);

  final ApiClient _client;

  static const defaultScope = 'USER_DOCUMENTS';

  Future<TrainingConsent> getConsent({String scope = defaultScope}) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/training-consent',
        queryParameters: {'scope': scope},
      );
      return TrainingConsent.fromJson(response.data!);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return TrainingConsent.denied(scope: scope);
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<TrainingConsent> updateConsent({
    required bool optIn,
    required String jurisdictionCountryCode,
    String scope = defaultScope,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/training-consent',
        data: {
          'scope': scope,
          'consentStatus': optIn ? 'GRANTED' : 'DENIED',
          'jurisdictionCountryCode': jurisdictionCountryCode,
          'canUseForPromptImprove': optIn,
          'canUseForEvaluation': optIn,
          'canUseForFineTuning': false,
        },
      );
      return TrainingConsent.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<TrainingConsent> withdrawConsent({String scope = defaultScope}) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/training-consent/withdraw',
        data: {'scope': scope},
      );
      return TrainingConsent.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
