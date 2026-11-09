import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/app_providers.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/consent/ai_inference_consent_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';

/// Shows the AI inference consent dialog if the user has not yet answered.
/// Returns true if the user has (or has previously) granted consent, false
/// if they declined.
///
/// Call this before any action that sends user data to a third-party AI
/// provider, per Apple App Store guidelines 5.1.1(i) and 5.1.2(i).
Future<bool> requireAiInferenceConsent(BuildContext context) async {
  if (!context.mounted) return false;
  final container = ProviderScope.containerOf(context, listen: false);
  final user = container.read(authControllerProvider).session?.user;
  final scope = '${user?.id ?? 'guest'}:${user?.tenantId ?? 'personal'}';
  late String policyVersion;
  late List<String> providers;
  try {
    final response = await container.read(apiClientProvider).dio.get<Map<String, dynamic>>('/ai/processing-disclosure');
    policyVersion = response.data?['version'] as String? ?? '';
    providers = (response.data?['providers'] as List<dynamic>? ?? []).whereType<String>().toList();
    if (policyVersion.isEmpty || providers.isEmpty) return false;
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(const SnackBar(content: Text('AI privacy information is unavailable. Please retry before sending your data.')));
    }
    return false;
  }
  if (await AiInferenceConsentStorage.hasGranted(scope: scope, policyVersion: policyVersion)) return true;
  if (!context.mounted) return false;
  final granted = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => AiInferenceConsentDialog(providers: providers, policyVersion: policyVersion, scope: scope),
  );

  return granted == true;
}

/// Blocking dialog shown once per install before the first AI feature use.
class AiInferenceConsentDialog extends StatelessWidget {
  const AiInferenceConsentDialog({super.key, required this.providers, required this.policyVersion, required this.scope});
  final List<String> providers;
  final String policyVersion;
  final String scope;

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
    final colorScheme = theme.colorScheme;

    final linkStyle = theme.textTheme.bodySmall?.copyWith(
      color: colorScheme.primary,
      fontWeight: FontWeight.w600,
      decoration: TextDecoration.underline,
      decorationColor: colorScheme.primary.withValues(alpha: 0.5),
    );
    final bodyStyle = theme.textTheme.bodySmall?.copyWith(
      color: colorScheme.onSurface.withValues(alpha: 0.8),
      height: 1.5,
    );

    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius + 4),
      ),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.privacy_tip_outlined,
                size: 20, color: colorScheme.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l10n.aiConsentDialogTitle,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Text('To perform the AI work you request, Umbrella sends your questions, instructions, authorized matter facts, document excerpts, research and draft text to the recipients below. Audio is sent when you use transcription. Inference permission does not grant permission to train models.', style: bodyStyle),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest
                    .withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(AppColors.radius),
                border: Border.all(
                  color: colorScheme.outline.withValues(alpha: 0.25),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.smart_toy_outlined,
                      size: 16, color: colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      providers.join(', '),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurface,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(l10n.aiConsentDialogPurpose, style: bodyStyle),
            const SizedBox(height: 10),
            Text.rich(
              TextSpan(
                style: bodyStyle,
                children: [
                  TextSpan(text: '${l10n.aiConsentDialogLearnMore} '),
                  TextSpan(
                    text: l10n.commonPrivacyPolicy,
                    style: linkStyle,
                    recognizer: TapGestureRecognizer()
                      ..onTap = () => _openUrl('/privacy'),
                  ),
                  const TextSpan(text: ' & '),
                  TextSpan(
                    text: l10n.commonDataAiConsentPolicy,
                    style: linkStyle,
                    recognizer: TapGestureRecognizer()
                      ..onTap = () => _openUrl('/data-consent'),
                  ),
                  const TextSpan(text: '.'),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () async {
            await AiInferenceConsentStorage.setGranted(false, scope: scope, policyVersion: policyVersion);
            if (context.mounted) Navigator.of(context).pop(false);
          },
          child: Text(l10n.aiConsentDialogDecline),
        ),
        FilledButton(
          onPressed: () async {
            await AiInferenceConsentStorage.setGranted(true, scope: scope, policyVersion: policyVersion);
            if (context.mounted) Navigator.of(context).pop(true);
          },
          child: Text(l10n.aiConsentDialogAgree),
        ),
      ],
    );
  }
}
