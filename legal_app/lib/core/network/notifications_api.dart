import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../network/api_client.dart';

class NotificationsApi {
  NotificationsApi(this._client);

  final ApiClient _client;

  Future<void> registerDevice({
    required String fcmToken,
    String? platform,
  }) async {
    try {
      await _client.dio.post<void>(
        '/notifications/devices/register',
        data: {'token': fcmToken, 'platform': platform ?? _defaultPlatform},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  static String get _defaultPlatform {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.android:
        return 'android';
      default:
        return 'unknown';
    }
  }

  Future<List<AppNotification>> listInbox({
    required String tenantId,
    bool unreadOnly = false,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/notifications',
        queryParameters: unreadOnly ? {'unreadOnly': 'true'} : null,
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> markRead({
    required String tenantId,
    required String notificationId,
  }) async {
    try {
      await _client.dio.patch<void>(
        '/notifications/$notificationId/read',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> markAllRead({required String tenantId}) async {
    try {
      await _client.dio.post<void>(
        '/notifications/read-all',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
