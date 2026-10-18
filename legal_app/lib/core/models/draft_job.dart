/// Draft job progress — mirrors `DraftJobProgress` from use-draft-job.ts.
class DraftJobProgress {
  const DraftJobProgress({
    required this.jobId,
    required this.status,
    required this.stage,
    required this.percent,
    required this.message,
    required this.timestamp,
    this.completedSections,
    this.totalSections,
    this.error,
    this.blockedReason,
    this.failureReason,
  });

  final String jobId;
  final String status;
  final String stage;
  final int percent;
  final String message;
  final int? completedSections;
  final int? totalSections;
  final String? error;
  final String? blockedReason;
  final String? failureReason;
  final String timestamp;

  static const terminalStatuses = {'ready', 'failed', 'cancelled', 'blocked'};

  bool get isTerminal => terminalStatuses.contains(status);
  bool get isReady => status == 'ready';
  bool get isFailed => status == 'failed';
  bool get isCancelled => status == 'cancelled';
  bool get isBlocked => status == 'blocked';

  factory DraftJobProgress.fromJson(Map<String, dynamic> json) {
    return DraftJobProgress(
      jobId: json['jobId'] as String? ?? json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      stage: json['stage'] as String? ?? '',
      percent: (json['percent'] as num?)?.toInt() ?? 0,
      message: json['message'] as String? ?? '',
      completedSections: (json['completedSections'] as num?)?.toInt(),
      totalSections: (json['totalSections'] as num?)?.toInt(),
      error: json['error'] as String?,
      blockedReason: json['blockedReason'] as String?,
      failureReason: json['failureReason'] as String?,
      timestamp: json['timestamp'] as String? ??
          json['updatedAt'] as String? ??
          DateTime.now().toIso8601String(),
    );
  }
}
