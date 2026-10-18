import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class TasksApi {
  TasksApi(this._client);

  final ApiClient _client;

  Future<List<LawyerTask>> listTasks({
    required String tenantId,
    String? matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/tasks',
        queryParameters: matterId != null ? {'matterId': matterId} : null,
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(LawyerTask.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LawyerTask> createTask({
    required String tenantId,
    required String title,
    String priority = 'MEDIUM',
    String? matterId,
    DateTime? dueDate,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/tasks',
        data: {
          'title': title,
          'priority': priority,
          if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
          if (dueDate != null) 'dueDate': dueDate.toIso8601String(),
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return LawyerTask.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LawyerTask> updateTaskStatus({
    required String tenantId,
    required String taskId,
    required String status,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/tasks/$taskId',
        data: {'status': status},
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return LawyerTask.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
