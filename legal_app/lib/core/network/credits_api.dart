import 'package:dio/dio.dart';

import 'api_client.dart';

class AiBudgetPolicy {
  AiBudgetPolicy({
    required this.monthlyBudgetUsd,
    required this.alertAtPercent,
    required this.hardStopEnabled,
    required this.hardStopAtPercent,
  });

  factory AiBudgetPolicy.fromJson(Map<String, dynamic> json) {
    return AiBudgetPolicy(
      monthlyBudgetUsd: (json['monthlyBudgetUsd'] as num?)?.toDouble() ?? 0,
      alertAtPercent: (json['alertAtPercent'] as num?)?.toInt() ?? 80,
      hardStopEnabled: json['hardStopEnabled'] as bool? ?? false,
      hardStopAtPercent: (json['hardStopAtPercent'] as num?)?.toInt() ?? 0,
    );
  }

  final double monthlyBudgetUsd;
  final int alertAtPercent;
  final bool hardStopEnabled;
  final int hardStopAtPercent;
}

class CreditsApi {
  CreditsApi(this._client);

  final ApiClient _client;

  Future<AiBudgetPolicy> getAiBudgetPolicy({String? tenantId}) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/credits/ai-budget-policy',
        options: Options(
          headers: tenantId != null && tenantId.isNotEmpty
              ? {'X-Tenant-Id': tenantId}
              : null,
        ),
      );
      return AiBudgetPolicy.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<AiBudgetPolicy> updateAiBudgetPolicy({
    String? tenantId,
    double? monthlyBudgetUsd,
    int? alertAtPercent,
    bool? hardStopEnabled,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (monthlyBudgetUsd != null) body['monthlyBudgetUsd'] = monthlyBudgetUsd;
      if (alertAtPercent != null) body['alertAtPercent'] = alertAtPercent;
      if (hardStopEnabled != null) body['hardStopEnabled'] = hardStopEnabled;

      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/credits/ai-budget-policy',
        data: body,
        options: Options(
          headers: tenantId != null && tenantId.isNotEmpty
              ? {'X-Tenant-Id': tenantId}
              : null,
        ),
      );
      return AiBudgetPolicy.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
