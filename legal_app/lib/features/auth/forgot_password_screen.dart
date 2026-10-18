import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/firebase/firebase_service.dart';
import '../../core/providers/app_providers.dart';
import '../../l10n/app_localizations.dart';
import 'widgets/auth_error_banner.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  var _loading = false;
  var _sent = false;
  String? _error;

  bool get _firebaseReady =>
      FirebaseService.isConfigured && FirebaseService.auth != null;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!_formKey.currentState!.validate()) return;

    if (!_firebaseReady) {
      setState(() => _error = l10n.authFirebaseResetRequired);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ref
          .read(authControllerProvider.notifier)
          .sendPasswordResetEmail(_emailController.text.trim());
      if (!mounted) return;
      setState(() => _sent = true);
    } on fb_auth.FirebaseAuthException catch (error) {
      setState(() => _error = error.message ?? l10n.authFailedToSendReset);
    } catch (_) {
      setState(() => _error = l10n.authFailedToSendReset);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.authResetPasswordTitle)),
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
                      Icon(
                        Icons.lock_reset_outlined,
                        size: 48,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        l10n.authResetPasswordTitle,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _sent
                            ? l10n.authResetPasswordSent
                            : l10n.authResetPasswordPrompt,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 24),
                      if (_sent) ...[
                        ElevatedButton.icon(
                          onPressed: () => context.go('/auth'),
                          icon: const Icon(Icons.arrow_back),
                          label: Text(l10n.authBackToSignIn),
                        ),
                      ] else ...[
                        if (_error != null) ...[
                          AuthErrorBanner(message: _error!),
                          const SizedBox(height: 16),
                        ],
                        Form(
                          key: _formKey,
                          child: TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.email],
                            decoration: InputDecoration(
                              labelText: l10n.authEmail,
                              hintText: l10n.authYouexamplecom,
                              prefixIcon: const Icon(Icons.email_outlined),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return l10n.authEnterEmailAddress;
                              }
                              if (!value.contains('@')) {
                                return l10n.authEnterValidEmail;
                              }
                              return null;
                            },
                            onFieldSubmitted: (_) {
                              if (!_loading) _submit();
                            },
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _loading ? null : _submit,
                          child: Text(
                            _loading
                                ? l10n.authSending
                                : l10n.authSendResetLink,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton.icon(
                          onPressed: _loading
                              ? null
                              : () => context.go('/auth'),
                          icon: const Icon(Icons.arrow_back),
                          label: Text(l10n.authBackToSignIn),
                        ),
                      ],
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
