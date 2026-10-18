import 'package:flutter/material.dart';

import '../theme/app_semantic_colors.dart';

/// A small colour-coded status chip. Infers the tone from the [status] string
/// via [AppSemanticColors.toneForStatus] so all screens render the same colour
/// mapping without duplicating switch statements.
class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    super.key,
    required this.status,
    this.tone,
    this.fontSize = 11,
  });

  final String status;

  /// Override automatic tone inference when you know the correct tone.
  final AppStatusTone? tone;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final resolved = tone ?? AppSemanticColors.toneForStatus(status);
    final bg = AppSemanticColors.bg(resolved, isDark: isDark);
    final fg = AppSemanticColors.fg(resolved, isDark: isDark);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Text(
        _label(status),
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }

  /// Capitalises first letter and replaces underscores/hyphens with spaces.
  static String _label(String s) {
    if (s.isEmpty) return s;
    final clean = s.replaceAll(RegExp(r'[_-]'), ' ');
    return clean[0].toUpperCase() + clean.substring(1).toLowerCase();
  }
}
