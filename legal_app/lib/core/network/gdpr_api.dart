import 'package:dio/dio.dart';

import 'api_client.dart';

class DeleteAccountResult {
  const DeleteAccountResult({
    required this.deleted,
    required this.subjectType,
    required this.subjectId,
    required this.deletedAt,
  });

  factory DeleteAccountResult.fromJson(Map<String, dynamic> json) {
    return DeleteAccountResult(
      deleted: json['deleted'] as bool? ?? false,
      subjectType: json['subjectType'] as String? ?? 'user',
      subjectId: json['subjectId'] as String? ?? '',
      deletedAt: json['deletedAt'] as String? ?? '',
    );
  }

  final bool deleted;
  final String subjectType;
  final String subjectId;
  final String deletedAt;
}

class GdprApi {
  GdprApi(this._client);

  final ApiClient _client;

  Future<DeleteAccountResult> deleteMyAccount({
    required String confirmEmail,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/gdpr/users/me/delete',
        data: {'confirmEmail': confirmEmail.trim()},
      );
      return DeleteAccountResult.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
