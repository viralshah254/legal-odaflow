import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/draft_job.dart';
import '../models/india_draft.dart';
import 'app_providers.dart';

class DraftJobState {
  const DraftJobState({
    this.jobId,
    this.progress,
    this.result,
    this.error,
  });

  final String? jobId;
  final DraftJobProgress? progress;
  final IndiaDraftResult? result;
  final String? error;

  bool get isRunning =>
      jobId != null &&
      result == null &&
      error == null &&
      !(progress?.isTerminal ?? false);

  double get percent => (progress?.percent ?? 0) / 100.0;

  DraftJobState copyWith({
    String? jobId,
    DraftJobProgress? progress,
    IndiaDraftResult? result,
    String? error,
    bool clearError = false,
    bool clearResult = false,
  }) {
    return DraftJobState(
      jobId: jobId ?? this.jobId,
      progress: progress ?? this.progress,
      result: clearResult ? null : result ?? this.result,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class DraftJobController extends StateNotifier<DraftJobState> {
  DraftJobController(this._ref) : super(const DraftJobState());

  final Ref _ref;
  Timer? _timer;
  bool _cancelled = false;
  String? _tenantId;

  static const _pollInterval = Duration(milliseconds: 1500);

  void startPolling({required String jobId, String? tenantId}) {
    cancel();
    _cancelled = false;
    _tenantId = tenantId;
    state = DraftJobState(jobId: jobId);
    _timer = Timer.periodic(_pollInterval, (_) => _poll());
    unawaited(_poll());
  }

  Future<void> _poll() async {
    final jobId = state.jobId;
    if (jobId == null || _cancelled) return;

    try {
      final api = _ref.read(draftJobsApiProvider);
      final progress = await api.fetchDraftJobStatus(
        jobId: jobId,
        tenantId: _tenantId,
      );
      if (_cancelled) return;

      state = state.copyWith(progress: progress);

      if (progress.isReady) {
        final result = await api.fetchDraftJobResult(
          jobId: jobId,
          tenantId: _tenantId,
        );
        if (!_cancelled) {
          state = state.copyWith(result: result, progress: progress);
        }
        _stopTimer();
        return;
      }

      if (progress.isFailed) {
        state = state.copyWith(
          error: progress.error ?? 'Draft generation failed. Please try again.',
          progress: progress,
        );
        _stopTimer();
        return;
      }

      if (progress.isCancelled) {
        state = state.copyWith(
          error: 'Draft generation was cancelled.',
          progress: progress,
        );
        _stopTimer();
        return;
      }

      if (progress.isBlocked) {
        state = state.copyWith(
          error: progress.blockedReason ??
              progress.error ??
              'Additional information is required to continue drafting.',
          progress: progress,
        );
        _stopTimer();
        return;
      }
    } catch (e, st) {
      debugPrint('[DraftJobController] poll error: $e\n$st');
    }
  }

  Future<void> cancelJob() async {
    final jobId = state.jobId;
    _cancelled = true;
    _stopTimer();
    if (jobId != null) {
      try {
        await _ref.read(draftJobsApiProvider).cancelDraftJob(
              jobId: jobId,
              tenantId: _tenantId,
            );
      } catch (_) {}
    }
    state = state.copyWith(error: 'Draft generation was cancelled.');
  }

  void cancel() {
    _cancelled = true;
    _stopTimer();
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  void reset() {
    cancel();
    state = const DraftJobState();
  }

  @override
  void dispose() {
    cancel();
    super.dispose();
  }
}

final draftJobProvider =
    StateNotifierProvider<DraftJobController, DraftJobState>((ref) {
  return DraftJobController(ref);
});
