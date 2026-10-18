import 'package:flutter/material.dart';

/// Semantic status colors shared across the app. These mirror the web app's
/// status palette (success / warning / info / danger / neutral) so that
/// mobile surfaces render in the same visual language as their web
/// counterparts.
///
/// Each entry exposes a [base] color (for text / icons / accents) plus
/// [bg]/[fg] helpers that adapt to the current [Brightness].
enum AppStatusTone { success, warning, info, danger, neutral, accent }

class AppSemanticColors {
  AppSemanticColors._();

  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color danger = Color(0xFFEF4444);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color teal = Color(0xFF14B8A6);
  static const Color neutral = Color(0xFF94A3B8);

  static Color base(AppStatusTone tone) {
    switch (tone) {
      case AppStatusTone.success:
        return success;
      case AppStatusTone.warning:
        return warning;
      case AppStatusTone.info:
        return info;
      case AppStatusTone.danger:
        return danger;
      case AppStatusTone.accent:
        return purple;
      case AppStatusTone.neutral:
        return neutral;
    }
  }

  /// Background tint for chips/badges of the given [tone].
  static Color bg(AppStatusTone tone, {bool isDark = true}) {
    final c = base(tone);
    return c.withValues(alpha: isDark ? 0.16 : 0.12);
  }

  /// Foreground (text/icon) color for chips/badges of the given [tone].
  static Color fg(AppStatusTone tone, {bool isDark = true}) {
    final c = base(tone);
    return isDark ? c.withValues(alpha: 0.95) : c;
  }

  /// Maps a free-form status/severity string to a [AppStatusTone].
  static AppStatusTone toneForStatus(String? status) {
    final s = (status ?? '').toLowerCase().trim();
    if (s.isEmpty) return AppStatusTone.neutral;
    // success-ish
    if (RegExp(
      r'(active|open|done|complete|completed|paid|approved|won|success|ready|live|connected|granted|signed)',
    ).hasMatch(s)) {
      return AppStatusTone.success;
    }
    // warning-ish
    if (RegExp(
      r'(pending|review|in_progress|in progress|draft|warning|due|processing|partial|on_hold|on hold|waiting|sent)',
    ).hasMatch(s)) {
      return AppStatusTone.warning;
    }
    // danger-ish
    if (RegExp(
      r'(overdue|failed|error|rejected|lost|cancelled|canceled|blocked|urgent|critical|breach|expired|declined)',
    ).hasMatch(s)) {
      return AppStatusTone.danger;
    }
    // info-ish
    if (RegExp(r'(new|info|scheduled|upcoming|todo|to_do|to do|queued)').hasMatch(s)) {
      return AppStatusTone.info;
    }
    return AppStatusTone.neutral;
  }
}
