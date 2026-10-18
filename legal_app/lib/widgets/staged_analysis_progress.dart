import 'dart:async';

import 'package:flutter/material.dart';

class StagedProgressStage {
  const StagedProgressStage({
    required this.id,
    required this.label,
    required this.icon,
    this.duration = Duration.zero,
    this.rotatingLabels = const [],
  });

  final String id;
  final String label;
  final IconData icon;
  final Duration duration;
  final List<String> rotatingLabels;
}

class StagedAnalysisProgress extends StatefulWidget {
  const StagedAnalysisProgress({
    super.key,
    required this.active,
    required this.stages,
    this.title,
  });

  final bool active;
  final List<StagedProgressStage> stages;
  final String? title;

  @override
  State<StagedAnalysisProgress> createState() => _StagedAnalysisProgressState();
}

class _StagedAnalysisProgressState extends State<StagedAnalysisProgress> {
  static const _rotatingInterval = Duration(seconds: 2);

  int _stageIndex = 0;
  int _rotatingIndex = 0;
  Timer? _stageTimer;
  Timer? _rotateTimer;

  @override
  void didUpdateWidget(StagedAnalysisProgress oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      _resetAndStart();
    } else if (!widget.active && oldWidget.active) {
      _stopTimers();
      _stageIndex = 0;
      _rotatingIndex = 0;
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.active) _resetAndStart();
  }

  @override
  void dispose() {
    _stopTimers();
    super.dispose();
  }

  void _stopTimers() {
    _stageTimer?.cancel();
    _stageTimer = null;
    _rotateTimer?.cancel();
    _rotateTimer = null;
  }

  void _resetAndStart() {
    _stopTimers();
    setState(() {
      _stageIndex = 0;
      _rotatingIndex = 0;
    });
    _scheduleStageAdvance(0);
    _startRotatingLabels();
  }

  void _scheduleStageAdvance(int index) {
    if (!widget.active || index >= widget.stages.length) return;

    final stage = widget.stages[index];
    if (stage.duration <= Duration.zero || index >= widget.stages.length - 1) {
      return;
    }

    _stageTimer?.cancel();
    _stageTimer = Timer(stage.duration, () {
      if (!mounted || !widget.active) return;
      final next = (_stageIndex + 1).clamp(0, widget.stages.length - 1);
      setState(() {
        _stageIndex = next;
        _rotatingIndex = 0;
      });
      _startRotatingLabels();
      _scheduleStageAdvance(next);
    });
  }

  void _startRotatingLabels() {
    _rotateTimer?.cancel();
    _rotateTimer = null;

    if (!widget.active) return;
    final labels = widget.stages[_stageIndex].rotatingLabels;
    if (labels.length <= 1) return;

    _rotateTimer = Timer.periodic(_rotatingInterval, (_) {
      if (!mounted || !widget.active) return;
      setState(() {
        _rotatingIndex = (_rotatingIndex + 1) % labels.length;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active || widget.stages.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;
    final progress = widget.stages.length <= 1
        ? 1.0
        : (_stageIndex + 1) / widget.stages.length;

    return Semantics(
      liveRegion: true,
      label: widget.title,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.primary.withValues(alpha: 0.2)),
          color: colorScheme.primary.withValues(alpha: 0.05),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.title != null) ...[
              Text(
                widget.title!,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 12),
            ],
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: colorScheme.surfaceContainerHighest,
              ),
            ),
            const SizedBox(height: 16),
            ...List.generate(widget.stages.length, (index) {
              final stage = widget.stages[index];
              final isDone = index < _stageIndex;
              final isCurrent = index == _stageIndex;
              final label = isCurrent && stage.rotatingLabels.isNotEmpty
                  ? stage.rotatingLabels[
                      _rotatingIndex % stage.rotatingLabels.length]
                  : stage.label;

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    _StageIcon(
                      icon: stage.icon,
                      isDone: isDone,
                      isCurrent: isCurrent,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        label,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: isDone
                                  ? colorScheme.onSurfaceVariant
                                  : isCurrent
                                      ? colorScheme.onSurface
                                      : colorScheme.onSurfaceVariant
                                          .withValues(alpha: 0.5),
                              fontWeight:
                                  isCurrent ? FontWeight.w600 : FontWeight.normal,
                            ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _StageIcon extends StatelessWidget {
  const _StageIcon({
    required this.icon,
    required this.isDone,
    required this.isCurrent,
  });

  final IconData icon;
  final bool isDone;
  final bool isCurrent;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isCurrent
              ? colorScheme.primary
              : isDone
                  ? colorScheme.primary.withValues(alpha: 0.3)
                  : colorScheme.outlineVariant,
        ),
        color: isCurrent
            ? colorScheme.primary.withValues(alpha: 0.15)
            : isDone
                ? colorScheme.primary.withValues(alpha: 0.1)
                : colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      ),
      child: Center(
        child: isDone
            ? Icon(Icons.check, size: 16, color: colorScheme.primary)
            : isCurrent
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colorScheme.primary,
                    ),
                  )
                : Icon(icon, size: 16, color: colorScheme.onSurfaceVariant),
      ),
    );
  }
}
