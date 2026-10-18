import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

import 'tutorial_welcome_sheet.dart';

/// Prevents two screens from running their tours simultaneously.
/// The first screen to call [runTutorialWithWelcome] holds this lock; any
/// concurrent caller exits immediately so we never show two welcome sheets.
bool _tourInProgress = false;

/// Shows the welcome sheet, then starts the showcase tour after the sheet
/// fully dismisses (pop completes before the dismiss animation ends).
///
/// [welcomeBody] and [welcomeBullets] let each screen provide copy that
/// describes its own tour instead of the generic fallback text.
Future<void> runTutorialWithWelcome({
  required BuildContext context,
  required List<GlobalKey> showcaseKeys,
  required Future<void> Function() onSkip,
  required Future<void> Function() onComplete,
  VoidCallback? onDismiss,
  String? welcomeBody,
  List<String>? welcomeBullets,
}) async {
  // Bail if another tour is already in flight (e.g. two shell tabs mounting
  // at the same time and both scheduling their tours).
  if (_tourInProgress) return;
  _tourInProgress = true;

  try {
    final start = await showTutorialWelcomeSheet(
      context,
      body: welcomeBody,
      bullets: welcomeBullets,
    );
    if (!context.mounted) return;

    if (start == null) {
      onDismiss?.call();
      return;
    }

    if (start != true) {
      await onSkip();
      return;
    }

    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (!context.mounted) return;

    ShowCaseWidget.of(context).startShowCase(showcaseKeys);
    await onComplete();
  } finally {
    _tourInProgress = false;
  }
}
