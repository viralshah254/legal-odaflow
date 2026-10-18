import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:showcaseview/showcaseview.dart';

import '../providers/app_providers.dart';
import 'tutorial_progress_store.dart';
import 'tutorial_theme.dart';

class TutorialStep {
  const TutorialStep({
    required this.key,
    required this.title,
    required this.description,
  });

  final GlobalKey key;
  final String title;
  final String description;
}

/// Wraps a screen and auto-starts a showcase tour on first visit.
class PageTutorialHost extends ConsumerStatefulWidget {
  const PageTutorialHost({
    super.key,
    required this.tourId,
    required this.steps,
    required this.child,
    this.autoStart = true,
  });

  final String tourId;
  final List<TutorialStep> steps;
  final Widget child;
  final bool autoStart;

  @override
  ConsumerState<PageTutorialHost> createState() => _PageTutorialHostState();
}

class _PageTutorialHostState extends ConsumerState<PageTutorialHost> {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoStart) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
    }
  }

  Future<void> _maybeStartTour() async {
    if (_started || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null || widget.steps.isEmpty) return;

    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey(widget.tourId)) return;

    _started = true;
    if (!mounted) return;
    ShowCaseWidget.of(context).startShowCase(
      widget.steps.map((step) => step.key).toList(),
    );
    await store.markCompleted(userId, widget.tourId);
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

Widget tutorialTarget({
  required GlobalKey key,
  required String title,
  required String description,
  required Widget child,
  required VoidCallback onBarrierClick,
}) {
  return UmbrellaShowcase(
    showcaseKey: key,
    title: title,
    description: description,
    onBarrierClick: onBarrierClick,
    child: child,
  );
}

Widget buildTutorialShell({
  required Widget child,
  required List<TutorialStep> steps,
}) {
  return UmbrellaShowcaseScope(
    builder: (context) => child,
  );
}
