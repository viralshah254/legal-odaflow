import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class TimeApi {
  TimeApi(this._client);

  final ApiClient _client;

  Future<List<AppTimeEntry>> listEntries({required String tenantId}) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/time',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(AppTimeEntry.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
