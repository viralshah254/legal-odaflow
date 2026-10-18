/// Agent job model — mirrors `AgentJob` from `legal_web/lib/api/types.ts`.
class AgentJob {
  const AgentJob({
    required this.id,
    required this.queue,
    required this.jobType,
    required this.status,
    required this.attempts,
    required this.createdAt,
    required this.updatedAt,
    this.userId,
    this.tenantId,
    this.payload,
    this.result,
    this.error,
    this.completedAt,
  });

  final String id;
  final String queue;
  final String jobType;
  final String status;
  final String? userId;
  final String? tenantId;
  final Map<String, dynamic>? payload;
  final Map<String, dynamic>? result;
  final String? error;
  final int attempts;
  final String createdAt;
  final String updatedAt;
  final String? completedAt;

  bool get isTerminal =>
      status == 'completed' ||
      status == 'failed' ||
      status == 'cancelled' ||
      status == 'SUCCEEDED' ||
      status == 'FAILED' ||
      status == 'CANCELLED';

  bool get isSuccess =>
      status == 'completed' || status == 'SUCCEEDED' || status == 'ready';

  factory AgentJob.fromJson(Map<String, dynamic> json) {
    final payloadRaw = json['payload'];
    final resultRaw = json['result'];
    return AgentJob(
      id: json['id'] as String? ?? '',
      queue: json['queue'] as String? ?? '',
      jobType: json['jobType'] as String? ?? '',
      status: json['status'] as String? ?? '',
      userId: json['userId'] as String?,
      tenantId: json['tenantId'] as String?,
      payload: payloadRaw is Map<String, dynamic> ? payloadRaw : null,
      result: resultRaw is Map<String, dynamic> ? resultRaw : null,
      error: json['error'] as String?,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      completedAt: json['completedAt'] as String?,
    );
  }

  /// Progress phase from result/payload (research jobs).
  ResearchJobProgress? get researchProgress {
    final sources = [result, payload];
    for (final source in sources) {
      if (source == null) continue;
      final progress = source['progress'];
      if (progress is Map<String, dynamic>) {
        return ResearchJobProgress.fromJson(progress);
      }
    }
    return null;
  }
}

class ResearchJobProgress {
  const ResearchJobProgress({
    this.phase,
    this.updatedAt,
    this.message,
  });

  final String? phase;
  final String? updatedAt;
  final String? message;

  factory ResearchJobProgress.fromJson(Map<String, dynamic> json) {
    return ResearchJobProgress(
      phase: json['phase'] as String?,
      updatedAt: json['updatedAt'] as String?,
      message: json['message'] as String?,
    );
  }
}
