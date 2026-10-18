import 'package:dio/dio.dart';

import 'api_client.dart';

class ConflictCheckResult {
  ConflictCheckResult({
    required this.id,
    required this.status,
    this.summary,
    this.matches = const [],
  });

  factory ConflictCheckResult.fromJson(Map<String, dynamic> json) {
    final result = json['result'];
    String? summary;
    List<ConflictMatch> matches = [];

    if (result is Map<String, dynamic>) {
      summary = result['summary'] as String?;
      final rawMatches = result['matches'];
      if (rawMatches is List) {
        matches = rawMatches
            .whereType<Map<String, dynamic>>()
            .map(ConflictMatch.fromJson)
            .toList();
      }
    }

    return ConflictCheckResult(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'REVIEW_REQUIRED',
      summary: summary,
      matches: matches,
    );
  }

  final String id;
  final String status;
  final String? summary;
  final List<ConflictMatch> matches;

  bool get isClear => status == 'CLEAR';
}

class ConflictMatch {
  ConflictMatch({
    required this.type,
    required this.name,
    required this.reason,
  });

  factory ConflictMatch.fromJson(Map<String, dynamic> json) => ConflictMatch(
        type: json['type'] as String? ?? '',
        name: json['name'] as String? ?? '',
        reason: json['reason'] as String? ?? '',
      );

  final String type;
  final String name;
  final String reason;
}

class ConflictsApi {
  ConflictsApi(this._client);

  final ApiClient _client;

  Future<ConflictCheckResult> createConflictCheck({
    required String tenantId,
    String? clientId,
    String? matterId,
    required List<Map<String, String?>> parties,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/conflicts',
        data: {
          if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
          if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
          'parties': parties
              .where(
                (party) =>
                    (party['name']?.trim().isNotEmpty ?? false) ||
                    (party['email']?.trim().isNotEmpty ?? false),
              )
              .map(
                (party) => {
                  if (party['name']?.trim().isNotEmpty ?? false)
                    'name': party['name']!.trim(),
                  if (party['email']?.trim().isNotEmpty ?? false)
                    'email': party['email']!.trim(),
                },
              )
              .toList(),
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return ConflictCheckResult.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
