import 'package:dio/dio.dart';

import 'api_client.dart';

class ProfileApi {
  ProfileApi(this._client);

  final ApiClient _client;

  Future<Map<String, dynamic>> getMyPreferences() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/users/me/preferences',
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> updateMyPreferences({String? preferredLocale}) async {
    try {
      await _client.dio.patch<Map<String, dynamic>>(
        '/users/me/preferences',
        data: {
          if (preferredLocale != null && preferredLocale.isNotEmpty)
            'preferredLocale': preferredLocale,
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    try {
      final response =
          await _client.dio.get<Map<String, dynamic>>('/users/me');
      return response.data ?? const {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> updateMe({String? countryCode, String? name}) async {
    try {
      await _client.dio.patch<Map<String, dynamic>>(
        '/users/me',
        data: {
          if (countryCode != null && countryCode.isNotEmpty)
            'countryCode': countryCode,
          if (name != null && name.isNotEmpty) 'name': name,
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
