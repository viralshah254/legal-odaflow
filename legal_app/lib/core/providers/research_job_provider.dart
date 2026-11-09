import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import 'app_providers.dart';

/// State for an in-flight / completed research job.
class ResearchJobState {
  const ResearchJobState({
    this.jobId,
    this.status = 'idle',
    this.progress,
    this.result,
    this.partialMarkdown,
    this.error,
    this.enrichedLocally = false,
  });

  final String? jobId;
  final String status;
  final ResearchJobProgress? progress;
  final LegalResearchResult? result;
  final String? partialMarkdown;
  final String? error;

  /// When true, ignore later job snapshots that would overwrite enrich results.
  final bool enrichedLocally;

  bool get isRunning =>
      jobId != null &&
      result == null &&
      error == null &&
      status != 'failed' &&
      status != 'cancelled' &&
      status != 'FAILED' &&
      status != 'CANCELLED';

  String? get phase => progress?.phase;

  ResearchJobState copyWith({
    String? jobId,
    String? status,
    ResearchJobProgress? progress,
    LegalResearchResult? result,
    String? partialMarkdown,
    String? error,
    bool? enrichedLocally,
    bool clearError = false,
    bool clearResult = false,
  }) {
    return ResearchJobState(
      jobId: jobId ?? this.jobId,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      result: clearResult ? null : result ?? this.result,
      partialMarkdown: partialMarkdown ?? this.partialMarkdown,
      error: clearError ? null : error ?? this.error,
      enrichedLocally: enrichedLocally ?? this.enrichedLocally,
    );
  }
}

class ResearchJobController extends StateNotifier<ResearchJobState> {
  ResearchJobController(this._ref) : super(const ResearchJobState());

  final Ref _ref;
  Timer? _timer;
  bool _cancelled = false;
  bool _pollInFlight = false;
  int _pollGeneration = 0;

  static const _pollInterval = Duration(seconds: 2);

  Future<String> start({
    required String query,
    required String countryCode,
    String? jurisdiction,
    String? matterId,
    String contextScope = 'SELECTED',
    String? practiceArea,
    String? tenantId,
    String researchMode = 'DEEP',
    String aiModelMode = 'AUTO',
    String? premiumModelId,
    List<Map<String, dynamic>>? priorContext,
  }) async {
    cancelPolling();
    _cancelled = false;
    state = const ResearchJobState(status: 'starting');

    final ai = _ref.read(aiApiProvider);
    final jobId = await ai.startLegalResearchJob(
      query: query,
      countryCode: countryCode,
      jurisdiction: jurisdiction,
      matterId: matterId,
      contextScope: contextScope,
      practiceArea: practiceArea,
      tenantId: tenantId,
      researchMode: researchMode,
      aiModelMode: aiModelMode,
      premiumModelId: premiumModelId,
      priorContext: priorContext,
    );

    state = ResearchJobState(jobId: jobId, status: 'queued');
    if (tenantId != null && tenantId.isNotEmpty) {
      _startPolling(jobId: jobId, tenantId: tenantId);
    }
    return jobId;
  }

  void attachExisting({
    required String jobId,
    required String tenantId,
  }) {
    cancelPolling();
    _cancelled = false;
    state = ResearchJobState(jobId: jobId, status: 'queued');
    _startPolling(jobId: jobId, tenantId: tenantId);
  }

  void applyEnrichResult(LegalResearchResult enriched) {
    state = state.copyWith(
      result: enriched,
      enrichedLocally: true,
      status: 'completed',
    );
  }

  void _startPolling({required String jobId, required String tenantId}) {
    _timer?.cancel();
    final generation = _pollGeneration;
    _timer = Timer.periodic(_pollInterval, (_) => _poll(jobId, tenantId, generation));
    unawaited(_poll(jobId, tenantId, generation));
  }

  Future<void> _poll(String jobId, String tenantId, int generation) async {
    if (_cancelled || _pollInFlight || generation != _pollGeneration) return;
    _pollInFlight = true;
    try {
      final agents = _ref.read(agentsApiProvider);
      final job = await agents.getAgentJob(tenantId: tenantId, jobId: jobId);
      if (_cancelled || generation != _pollGeneration) return;

      final progress = job.researchProgress;
      String? partial;
      final resultPayload = job.result;
      if (resultPayload != null) {
        final draft = resultPayload['draftMarkdown'] as String? ??
            resultPayload['outputMarkdown'] as String? ??
            resultPayload['answer'] as String?;
        if (draft != null && draft.trim().isNotEmpty) {
          partial = draft;
        }
      }

      if (job.isSuccess ||
          job.status == 'completed' ||
          job.status == 'SUCCEEDED') {
        if (state.enrichedLocally) {
          state = state.copyWith(status: job.status, progress: progress);
          cancelPolling();
          return;
        }
        final parsed = LegalResearchResult.fromJobResult(job.result);
        state = state.copyWith(
          status: job.status,
          progress: progress,
          result: parsed,
          partialMarkdown: partial,
        );
        cancelPolling();
        return;
      }

      if (job.status == 'failed' ||
          job.status == 'FAILED' ||
          job.status == 'cancelled' ||
          job.status == 'CANCELLED') {
        state = state.copyWith(
          status: job.status,
          progress: progress,
          error: job.error ?? 'Research job failed.',
        );
        cancelPolling();
        return;
      }

      state = state.copyWith(
        status: job.status,
        progress: progress,
        partialMarkdown: partial,
      );
    } catch (e) {
      debugPrint('[ResearchJobController] poll error: ${e.runtimeType}');
    } finally {
      _pollInFlight = false;
    }
  }

  void cancelPolling() {
    _pollGeneration++;
    _timer?.cancel();
    _timer = null;
  }

  void reset() {
    _cancelled = true;
    cancelPolling();
    state = const ResearchJobState();
  }

  @override
  void dispose() {
    _cancelled = true;
    cancelPolling();
    super.dispose();
  }
}

final researchJobProvider =
    StateNotifierProvider<ResearchJobController, ResearchJobState>((ref) {
  return ResearchJobController(ref);
});
