import 'package:dio/dio.dart';

import '../models/agent_job.dart';
import 'api_client.dart';

/// Agent job polling API — mirrors `legal_web/lib/api/agents.ts`.
class AgentsApi {
  AgentsApi(this._client);

  final ApiClient _client;

  Options _tenantOptions(String? tenantId) => Options(
        headers: tenantId != null && tenantId.isNotEmpty
            ? {'X-Tenant-Id': tenantId}
            : null,
      );

  Future<List<AgentJob>> listAgentJobs({
    required String tenantId,
    int limit = 25,
  }) async {
    final response = await _client.dio.get<List<dynamic>>(
      '/agents/jobs',
      queryParameters: {'limit': limit},
      options: _tenantOptions(tenantId),
    );
    return (response.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(AgentJob.fromJson)
        .toList();
  }

  Future<AgentJob> getAgentJob({
    required String tenantId,
    required String jobId,
  }) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/agents/jobs/$jobId',
      options: _tenantOptions(tenantId),
    );
    return AgentJob.fromJson(response.data!);
  }
}
