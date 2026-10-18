import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';

class AuthTermsFooter extends StatelessWidget {
  const AuthTermsFooter({
    super.key,
    required this.prefix,
  });

  final String prefix;

  Future<void> _openUrl(String path) async {
    final base = AppConfig.webBaseUrl.replaceAll(RegExp(r'/$'), '');
    final uri = Uri.parse('$base$path');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final linkStyle = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.primary,
      fontWeight: FontWeight.w600,
      decoration: TextDecoration.underline,
      decorationColor: theme.colorScheme.primary.withValues(alpha: 0.5),
    );
    final bodyStyle = theme.textTheme.bodySmall?.copyWith(
      color: AppColors.mutedForegroundLight,
      height: 1.45,
    );

    return Text.rich(
      TextSpan(
        style: bodyStyle,
        children: [
          TextSpan(text: prefix),
          TextSpan(
            text: l10n.commonTermsOfService,
            style: linkStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () => _openUrl('/terms'),
          ),
          TextSpan(text: ' ${l10n.commonAnd} '),
          TextSpan(
            text: l10n.commonPrivacyPolicy,
            style: linkStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () => _openUrl('/privacy'),
          ),
          const TextSpan(text: '.'),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}
