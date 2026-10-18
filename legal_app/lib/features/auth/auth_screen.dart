import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/firebase_auth_errors.dart';
import '../../core/auth/referral_storage.dart';
import '../../core/auth/oauth_auth_service.dart';
import '../../core/auth/profile_completion.dart';
import '../../core/auth/social_auth_provider.dart';
import '../../core/device/device_id.dart';
import '../../core/firebase/firebase_service.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';
import 'auth_navigation.dart';
import 'widgets/auth_error_banner.dart';
import 'widgets/auth_screen_header.dart';
import 'widgets/auth_terms_footer.dart';
import 'widgets/oauth_profile_completion_form.dart';
import 'widgets/social_auth_buttons.dart';

enum _EmailAuthPhase { enterEmail, enterPassword, socialOnly }

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, this.initialReferralCode});

  final String? initialReferralCode;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  _EmailAuthPhase _emailPhase = _EmailAuthPhase.enterEmail;
  var _isSubmitting = false;
  String? _error;
  SocialAuthProvider? _socialLoading;
  OAuthProfileCompletionState? _profileCompletion;
  String? _referralCode;

  bool get _firebaseReady =>
      FirebaseService.isConfigured && FirebaseService.auth != null;

  @override
  void initState() {
    super.initState();
    _loadReferralCode();
  }

  Future<void> _loadReferralCode() async {
    final urlRef = widget.initialReferralCode;
    if (urlRef != null && urlRef.trim().isNotEmpty) {
      await persistReferralCode(urlRef);
    }
    final resolved = await resolveReferralCode(urlRef);
    if (!mounted || resolved == null) return;
    setState(() => _referralCode = resolved);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _navigateAfterAuth() {
    final user = ref.read(authControllerProvider).session!.user;
    navigateAfterAuth(context, user);
  }

  void _navigateToSignUp(String email) {
    final encoded = Uri.encodeComponent(email.trim());
    final ref = _referralCode;
    final refQuery = ref != null && ref.isNotEmpty ? '&ref=${Uri.encodeComponent(ref)}' : '';
    context.go('/auth/sign-up?email=$encoded$refQuery');
  }

  Future<void> _completeFirebaseSession() async {
    final idToken = await FirebaseService.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw fb_auth.FirebaseAuthException(
        code: 'missing-id-token',
        message: 'Missing Firebase ID token.',
      );
    }
    final deviceFingerprint = await getDeviceId();
    await ref.read(authControllerProvider.notifier).loginWithFirebase(
          idToken: idToken,
          deviceFingerprint: deviceFingerprint,
        );
    if (!mounted) return;
    _navigateAfterAuth();
  }

  Future<void> _handleSocialSignIn(SocialAuthProvider provider) async {
    final l10n = AppLocalizations.of(context);
    if (!_firebaseReady) {
      setState(() => _error = l10n.authFirebaseNotConfigured);
      return;
    }

    setState(() {
      _socialLoading = provider;
      _error = null;
    });

    try {
      final deviceFingerprint = await getDeviceId();
      final outcome = await ref.read(oauthAuthServiceProvider).signInWithProvider(
            provider,
            deviceFingerprint: deviceFingerprint,
            referralCode: _referralCode,
          );

      if (!mounted) return;

      switch (outcome) {
        case OAuthAuthenticated(:final session):
          await ref.read(authControllerProvider.notifier).establishSession(session);
          if (!mounted) return;
          _navigateAfterAuth();
        case OAuthProfileCompletionNeeded(:final profile):
          setState(() => _profileCompletion = profile);
      }
    } on fb_auth.FirebaseAuthException catch (error) {
      if (isFirebaseAuthCancelled(error)) return;
      setState(
        () => _error = mapSocialFirebaseAuthError(
          error,
          l10n,
          provider: provider,
        ),
      );
    } on ApiException catch (error) {
      final profile = parseProfileCompletionError(error);
      if (profile != null) {
        setState(() {
          _profileCompletion = OAuthProfileCompletionState(
            email: profile.email,
            name: profile.name,
            provider: provider,
          );
        });
        return;
      }
      setState(() => _error = error.message);
    } catch (error) {
      if (isFirebaseAuthCancelled(error)) return;
      setState(
        () => _error = mapSocialAuthError(error, l10n, provider: provider),
      );
    } finally {
      if (mounted) setState(() => _socialLoading = null);
    }
  }

  Future<void> _continueWithEmail() async {
    if (!_emailFormKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      if (!_firebaseReady) {
        setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
        return;
      }

      final methods = await FirebaseService.fetchSignInMethodsForEmail(email);
      final hasPassword = methods.contains('password');
      final hasSocial = methods.any((method) => method != 'password');

      if (hasSocial && !hasPassword) {
        try {
          final lookup = await ref.read(authApiProvider).lookupEmail(email);
          if (lookup.exists && lookup.hasPassword) {
            setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
            return;
          }
        } catch (_) {
          // Lookup unavailable — still allow password attempt below.
        }
        setState(() => _emailPhase = _EmailAuthPhase.socialOnly);
        return;
      }

      if (hasPassword) {
        setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
        return;
      }

      if (methods.isEmpty) {
        try {
          final lookup = await ref.read(authApiProvider).lookupEmail(email);
          if (lookup.exists && (lookup.hasPassword || lookup.hasFirebaseAccount)) {
            setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
            return;
          }
          if (!lookup.exists) {
            _navigateToSignUp(email);
            return;
          }
          if (lookup.exists && !lookup.hasPassword && !lookup.hasFirebaseAccount) {
            setState(() => _emailPhase = _EmailAuthPhase.socialOnly);
            return;
          }
        } catch (_) {
          // Backend-only account or lookup unavailable — try password login.
        }
        setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
        return;
      }

      setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
    } catch (_) {
      setState(() => _emailPhase = _EmailAuthPhase.enterPassword);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitPassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      if (_firebaseReady) {
        await _submitPasswordWithFirebase();
      } else {
        await ref.read(authControllerProvider.notifier).login(
              email: _emailController.text.trim(),
              password: _passwordController.text,
            );
        if (!mounted) return;
        _navigateAfterAuth();
      }
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error = AppLocalizations.of(context).authUnableToSignIn);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitPasswordWithFirebase() async {
    final l10n = AppLocalizations.of(context);
    final email = _emailController.text.trim();

    try {
      await FirebaseService.auth!.signInWithEmailAndPassword(
        email: email,
        password: _passwordController.text,
      );
      await _completeFirebaseSession();
    } on fb_auth.FirebaseAuthException catch (error) {
      if (isFirebaseAuthUnavailable(error)) {
        await ref.read(authControllerProvider.notifier).login(
              email: email,
              password: _passwordController.text,
            );
        if (!mounted) return;
        _navigateAfterAuth();
        return;
      }

      if (isFirebaseCredentialMismatch(error)) {
        try {
          await ref.read(authControllerProvider.notifier).login(
                email: email,
                password: _passwordController.text,
              );
          if (!mounted) return;
          _navigateAfterAuth();
          return;
        } on ApiException catch (apiError) {
          setState(() => _error = apiError.message);
          return;
        } catch (_) {
          setState(() => _error = l10n.authInvalidCredentials);
          return;
        }
      }

      setState(() => _error = mapFirebaseAuthError(error, l10n));
    }
  }

  void _resetEmailPhase() {
    setState(() {
      _emailPhase = _EmailAuthPhase.enterEmail;
      _passwordController.clear();
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_profileCompletion != null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.authCompleteSignUp)),
        body: SafeArea(
          child: OAuthProfileCompletionForm(
            profile: _profileCompletion!,
            referralCode: _referralCode,
            onComplete: _navigateAfterAuth,
            onCancel: () => setState(() => _profileCompletion = null),
          ),
        ),
      );
    }

    final isBusy = _isSubmitting || _socialLoading != null;
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AuthScreenHeader(
                        title: l10n.authContinueToUmbrella,
                        subtitle: l10n.authUnifiedAuthDescription,
                        footer: Text(
                          l10n.authSignInSecurityNote,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.mutedForegroundLight,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      if (_error != null) ...[
                        AuthErrorBanner(message: _error!),
                        const SizedBox(height: 16),
                      ],
                      if (_firebaseReady) ...[
                        SocialAuthButtons(
                          onProviderTap: _handleSocialSignIn,
                          disabled: isBusy,
                          loadingProvider: _socialLoading,
                          showDivider: _emailPhase == _EmailAuthPhase.enterEmail,
                        ),
                      ],
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: switch (_emailPhase) {
                          _EmailAuthPhase.enterEmail => _EmailEntryForm(
                              key: const ValueKey('email-entry'),
                              formKey: _emailFormKey,
                              emailController: _emailController,
                              isBusy: isBusy,
                              isSubmitting: _isSubmitting,
                              onSubmit: _continueWithEmail,
                              l10n: l10n,
                            ),
                          _EmailAuthPhase.enterPassword => _PasswordEntryForm(
                              key: const ValueKey('password-entry'),
                              formKey: _passwordFormKey,
                              email: _emailController.text.trim(),
                              passwordController: _passwordController,
                              isBusy: isBusy,
                              isSubmitting: _isSubmitting,
                              onSubmit: _submitPassword,
                              onChangeEmail: _resetEmailPhase,
                              onForgotPassword: () =>
                                  context.go('/auth/forgot-password'),
                              l10n: l10n,
                            ),
                          _EmailAuthPhase.socialOnly => _SocialOnlyHint(
                              key: const ValueKey('social-only'),
                              email: _emailController.text.trim(),
                              onChangeEmail: _resetEmailPhase,
                              l10n: l10n,
                            ),
                        },
                      ),
                      const SizedBox(height: 16),
                      AuthTermsFooter(prefix: l10n.authSignInTermsPrefix),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EmailEntryForm extends StatelessWidget {
  const _EmailEntryForm({
    super.key,
    required this.formKey,
    required this.emailController,
    required this.isBusy,
    required this.isSubmitting,
    required this.onSubmit,
    required this.l10n,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final bool isBusy;
  final bool isSubmitting;
  final VoidCallback onSubmit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            enabled: !isBusy,
            onFieldSubmitted: (_) {
              if (!isBusy) onSubmit();
            },
            decoration: InputDecoration(
              labelText: l10n.authEmail,
              hintText: l10n.authEmailPlaceholder,
              prefixIcon: const Icon(Icons.email_outlined),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return l10n.authEmailRequired;
              }
              if (!value.contains('@')) return l10n.authEnterValidEmail;
              return null;
            },
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: isBusy ? null : onSubmit,
            child: Text(
              isSubmitting ? l10n.commonLoading : l10n.commonContinue,
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordEntryForm extends StatelessWidget {
  const _PasswordEntryForm({
    super.key,
    required this.formKey,
    required this.email,
    required this.passwordController,
    required this.isBusy,
    required this.isSubmitting,
    required this.onSubmit,
    required this.onChangeEmail,
    required this.onForgotPassword,
    required this.l10n,
  });

  final GlobalKey<FormState> formKey;
  final String email;
  final TextEditingController passwordController;
  final bool isBusy;
  final bool isSubmitting;
  final VoidCallback onSubmit;
  final VoidCallback onChangeEmail;
  final VoidCallback onForgotPassword;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  email,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: isBusy ? null : onChangeEmail,
                child: Text(l10n.authUseDifferentEmail),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: passwordController,
            obscureText: true,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            enabled: !isBusy,
            autofocus: true,
            onFieldSubmitted: (_) {
              if (!isBusy) onSubmit();
            },
            decoration: InputDecoration(
              labelText: l10n.authPassword,
              prefixIcon: const Icon(Icons.lock_outline),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return l10n.authPasswordRequired;
              }
              return null;
            },
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: isBusy ? null : onForgotPassword,
              child: Text(l10n.authForgotPassword),
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: isBusy ? null : onSubmit,
            child: Text(isSubmitting ? l10n.commonLoading : l10n.authSignIn),
          ),
        ],
      ),
    );
  }
}

class _SocialOnlyHint extends StatelessWidget {
  const _SocialOnlyHint({
    super.key,
    required this.email,
    required this.onChangeEmail,
    required this.l10n,
  });

  final String email;
  final VoidCallback onChangeEmail;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                email,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            TextButton(
              onPressed: onChangeEmail,
              child: Text(l10n.authUseDifferentEmail),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.logoAccent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(
              color: AppColors.logoAccent.withValues(alpha: 0.25),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.info_outline,
                size: 20,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  l10n.authAccountUsesSocial,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        height: 1.45,
                      ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
