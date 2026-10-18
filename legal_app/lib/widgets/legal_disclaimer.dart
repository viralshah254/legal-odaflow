import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../core/theme/app_colors.dart';

/// Reusable legal disclaimer aligned with Transformation Spec §2.5.
class LegalDisclaimer extends StatelessWidget {
  const LegalDisclaimer({
    super.key,
    this.compact = false,
    this.attorney = false,
    this.padding,
  });

  final bool compact;
  final bool attorney;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final message = attorney ? l10n.legalAttorneyDisclaimer : l10n.legalStandardDisclaimer;

    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(
          alpha: 0.45,
        ),
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline,
            size: compact ? 16 : 18,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style:
                  (compact
                          ? theme.textTheme.bodySmall
                          : theme.textTheme.bodyMedium)
                      ?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(
                          alpha: 0.75,
                        ),
                        height: 1.4,
                      ),
            ),
          ),
        ],
      ),
    );
  }
}
