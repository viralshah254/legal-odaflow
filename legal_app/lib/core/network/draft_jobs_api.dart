import 'package:dio/dio.dart';

import '../models/draft_job.dart';
import '../models/india_draft.dart';
import 'api_client.dart';

/// Unified draft job (v3) API — mirrors draft-job helpers in
/// `legal_web/lib/api/india-drafting.ts`.
class DraftJobsApi {
  DraftJobsApi(this._client);

  final ApiClient _client;

  Options _tenantOptions(String? tenantId) => Options(
        headers: tenantId != null && tenantId.isNotEmpty
            ? {'X-Tenant-Id': tenantId}
            : null,
        receiveTimeout: const Duration(seconds: 60),
      );

  Future<DraftJobProgress> fetchDraftJobStatus({
    required String jobId,
    String? tenantId,
  }) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/draft-jobs/$jobId',
      options: _tenantOptions(tenantId),
    );
    return DraftJobProgress.fromJson(response.data!);
  }

  Future<IndiaDraftResult> fetchDraftJobResult({
    required String jobId,
    String? tenantId,
  }) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/draft-jobs/$jobId/result',
      options: _tenantOptions(tenantId),
    );
    return IndiaDraftResult.fromDraftJobResult(response.data!);
  }

  Future<void> cancelDraftJob({
    required String jobId,
    String? tenantId,
  }) async {
    await _client.dio.post<void>(
      '/draft-jobs/$jobId/cancel',
      options: _tenantOptions(tenantId),
    );
  }

  Future<EnrichCaseLawsResponse> enrichDraftWithCaseLaws({
    required String jobId,
    required String draftText,
    required String documentKind,
    String? rawFacts,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/draft-jobs/$jobId/enrich-case-laws',
      data: {
        'draftText': draftText,
        'documentKind': documentKind,
        if (rawFacts != null && rawFacts.isNotEmpty) 'rawFacts': rawFacts,
      },
      options: _tenantOptions(tenantId),
    );
    return EnrichCaseLawsResponse.fromJson(response.data!);
  }
}
