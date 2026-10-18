import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/firebase/firebase_service.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';

class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  ConsumerState<DeleteAccountScreen> createState() =>
      _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  var _submitting = false;
  var _emailInitialized = false;
  String? _error;
  var _deleted = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _confirmAndDelete() async {
    final l10n = AppLocalizations.of(context);
    if (!_formKey.currentState!.validate()) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.settingsDeleteAccountConfirmTitle),
        content: Text(l10n.settingsDeleteAccountConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.settingsDeleteAccountConfirmAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(gdprApiProvider).deleteMyAccount(
            confirmEmail: _emailController.text.trim(),
          );
      await FirebaseService.auth?.signOut();
      await ref.read(authControllerProvider.notifier).logout();
      if (!mounted) return;
      setState(() => _deleted = true);
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      if (!mounted) return;
      context.go('/welcome');
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.statusCode == 403) {
        setState(() => _error = l10n.settingsDeleteAccountEmailMismatch);
      } else {
        setState(() => _error = l10n.settingsDeleteAccountError);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = l10n.settingsDeleteAccountError);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final backRoute =
        widget.isLawyerMode ? '/lawyer/settings' : '/consumer/settings';
    final userEmail = ref.watch(authControllerProvider).session?.user.email;

    if (!_emailInitialized && userEmail != null && userEmail.isNotEmpty) {
      _emailController.text = userEmail;
      _emailInitialized = true;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsDeleteAccount),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _submitting ? null : () => context.go(backRoute),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_deleted) ...[
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  l10n.settingsDeleteAccountSuccess,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
          ] else ...[
            Text(
              l10n.settingsDeleteAccountDescription,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        l10n.settingsDeleteAccountFormHeading,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.settingsDeleteAccountFormDescription,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        enabled: !_submitting,
                        decoration: InputDecoration(
                          labelText: l10n.settingsDeleteAccountEmailLabel,
                          hintText: userEmail ?? 'you@example.com',
                        ),
                        validator: (value) {
                          final trimmed = value?.trim() ?? '';
                          if (trimmed.isEmpty) {
                            return l10n.settingsDeleteAccountEmailRequired;
                          }
                          if (!trimmed.contains('@')) {
                            return l10n.authInvalidEmail;
                          }
                          return null;
                        },
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          style: const TextStyle(
                            color: AppColors.destructiveLight,
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor:
                              Theme.of(context).colorScheme.error,
                          foregroundColor:
                              Theme.of(context).colorScheme.onError,
                        ),
                        onPressed: _submitting ? null : _confirmAndDelete,
                        child: Text(
                          _submitting
                              ? l10n.settingsDeleteAccountSubmitting
                              : l10n.settingsDeleteAccountSubmit,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
