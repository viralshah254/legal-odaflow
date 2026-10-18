import 'package:flutter/material.dart';

import '../../../core/brand/umbrella_logo.dart';
import '../../../core/theme/app_colors.dart';

class AuthScreenHeader extends StatelessWidget {
  const AuthScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.footer,
    this.logoHeight = 36,
  });

  final String title;
  final String? subtitle;
  final Widget? footer;
  final double logoHeight;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(child: UmbrellaLogo(height: logoHeight)),
        const SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            height: 1.2,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.mutedForegroundLight,
              height: 1.45,
            ),
          ),
        ],
        if (footer != null) ...[
          const SizedBox(height: 12),
          footer!,
        ],
      ],
    );
  }
}
