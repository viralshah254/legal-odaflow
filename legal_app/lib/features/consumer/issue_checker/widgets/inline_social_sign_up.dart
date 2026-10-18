import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/oauth_auth_service.dart';
import '../../../../core/auth/profile_completion.dart';
import '../../../../core/auth/social_auth_provider.dart';
import '../../../../core/device/device_id.dart';
import '../../../../core/firebase/firebase_service.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/widgets/oauth_profile_completion_form.dart';
import '../../../auth/widgets/social_auth_buttons.dart';

class InlineSocialSignUp extends ConsumerStatefulWidget {
  const InlineSocialSignUp({
    super.key,
    required this.onSuccess,
    this.emailHref,
    this.subtitle,
  });

  /// Called after successful auth + profile completion.
  final VoidCallback onSuccess;

  /// Route override for the email sign-up link.
  final String? emailHref;

  /// Optional subtitle shown above the buttons.
  final String? subtitle;

  @override
  ConsumerState<InlineSocialSignUp> createState() =>
      _InlineSocialSignUpState();
}

class _InlineSocialSignUpState extends ConsumerState<InlineSocialSignUp> {
  SocialAuthProvider? _loadingProvider;
  String? _error;
  OAuthProfileCompletionState? _profileCompletion;

  bool get _firebaseReady =>
      FirebaseService.isConfigured && FirebaseService.auth != null;

  Future<void> _handleProvider(SocialAuthProvider provider) async {
    if (!_firebaseReady) {
      final l10n = AppLocalizations.of(context);
      setState(() => _error = l10n.authFirebaseNotConfigured);
      return;
    }

    setState(() {
      _loadingProvider = provider;
      _error = null;
    });

    try {
      final deviceFingerprint = await getDeviceId();
      final outcome = await ref.read(oauthAuthServiceProvider).signInWithProvider(
            provider,
            deviceFingerprint: deviceFingerprint,
          );

      if (!mounted) return;

      if (outcome is OAuthProfileCompletionNeeded) {
        setState(() {
          _profileCompletion = outcome.profile;
          _loadingProvider = null;
        });
        return;
      }

      if (outcome is OAuthAuthenticated) {
        await ref
            .read(authControllerProvider.notifier)
            .establishSession(outcome.session);
        if (mounted) widget.onSuccess();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProvider = null;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (_profileCompletion != null) {
      return OAuthProfileCompletionForm(
        profile: _profileCompletion!,
        onComplete: () {
          if (mounted) widget.onSuccess();
        },
        onCancel: () => setState(() => _profileCompletion = null),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.issueCheckerSaveYourAnalysisAndUnlockTheFullReport,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              widget.subtitle ?? l10n.consumerIssueCheckerCreateAccountCta,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            SocialAuthButtons(
              onProviderTap: _handleProvider,
              loadingProvider: _loadingProvider,
              showDivider: false,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: AppColors.destructiveLight),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.push(
                widget.emailHref ?? '/auth/sign-up',
              ),
              child: Text(l10n.authOrContinueWithEmail),
            ),
          ],
        ),
      ),
    );
  }
}
