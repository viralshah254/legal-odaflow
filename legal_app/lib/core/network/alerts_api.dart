import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class AlertsApi {
  AlertsApi(this._client);

  final ApiClient _client;

  Future<List<AppAlert>> listAlerts({required String tenantId}) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/alerts',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(AppAlert.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
