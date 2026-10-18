import 'package:dio/dio.dart';

import '../models/models.dart';
import '../auth/profile_completion.dart';
import 'api_client.dart';

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<({bool exists, bool hasPassword, bool hasFirebaseAccount})> lookupEmail(
    String email,
  ) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/email-lookup',
        data: {'email': email.trim()},
      );
      final data = response.data ?? {};
      return (
        exists: data['exists'] as bool? ?? false,
        hasPassword: data['hasPassword'] as bool? ?? false,
        hasFirebaseAccount: data['hasFirebaseAccount'] as bool? ?? false,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email.trim(), 'password': password},
      );
      return AuthSession.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> register({
    required String email,
    required String password,
    required String userType,
    required String countryCode,
    String? name,
    String? phone,
    String? firmName,
    String? jurisdiction,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'email': email.trim(),
          'password': password,
          'userType': userType,
          'countryCode': countryCode,
          if (name != null && name.isNotEmpty) 'name': name,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          if (firmName != null && firmName.isNotEmpty) 'firmName': firmName,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
      );
      return AuthSession.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> loginWithFirebase({
    required String idToken,
    String? userType,
    String? countryCode,
    String? jurisdiction,
    String? name,
    String? firmName,
    String? phone,
    String? referralCode,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/firebase/login',
        data: {
          'idToken': idToken,
          if (userType != null) 'userType': userType,
          if (countryCode != null) 'countryCode': countryCode,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
          if (name != null && name.isNotEmpty) 'name': name,
          if (firmName != null && firmName.isNotEmpty) 'firmName': firmName,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          if (referralCode != null && referralCode.isNotEmpty)
            'referralCode': referralCode,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
      );
      return AuthSession.fromJson(response.data!);
    } on DioException catch (error) {
      final response = error.response;
      final data = response?.data;
      if (response?.statusCode == 422 && data is Map<String, dynamic>) {
        final profile = readProfileFromBody(data);
        if (profile != null) {
          throw ProfileCompletionRequiredException(profile);
        }
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<void> logout({required String refreshToken}) async {
    try {
      await _client.dio.post<void>(
        '/auth/logout',
        data: {'refreshToken': refreshToken},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      return AuthSession.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
