import '../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';

class AccountSettingsScreen extends ConsumerStatefulWidget {
  const AccountSettingsScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  ConsumerState<AccountSettingsScreen> createState() =>
      _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends ConsumerState<AccountSettingsScreen> {
  bool _updatingCountry = false;

  bool _canChangeCountry(String? tenantRole, String userType) {
    if (userType == 'CONSUMER') return true;
    // Lawyers: only FIRM_ADMIN or PARTNER can change country.
    return tenantRole == 'FIRM_ADMIN' || tenantRole == 'PARTNER';
  }

  Future<void> _pickCountry(
    BuildContext context,
    AppLocalizations l10n,
    String? currentCode,
  ) async {
    // Capture context-dependent values before any async gap.
    final messenger = ScaffoldMessenger.of(context);
    final errorColor = Theme.of(context).colorScheme.error;

    final picked = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _CountryPickerSheet(
        currentCode: currentCode,
        l10n: l10n,
      ),
    );
    if (picked == null || picked == currentCode || !mounted) return;

    setState(() => _updatingCountry = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateCountry(picked);
      messenger.showSnackBar(
        SnackBar(
          content: Text(l10n.settingsRegionUpdated),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(l10n.settingsRegionUpdateFailed),
          backgroundColor: errorColor,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _updatingCountry = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(authControllerProvider).session?.user;
    final backRoute =
        widget.isLawyerMode ? '/lawyer/settings' : '/consumer/settings';
    final countryCode = user?.countryCode;
    final countryName = countryCode != null
        ? localizedCountryName(l10n, countryCode)
        : null;
    final canChange =
        _canChangeCountry(user?.tenantRole, user?.userType ?? '');

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isLawyerMode
              ? l10n.settingsFirmAccount
              : l10n.settingsConsumerAccount,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(backRoute),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            widget.isLawyerMode
                ? l10n.settingsFirmProfileDescription
                : l10n.settingsAccountProfileDescription,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.commonProfile,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 16),
                  _ProfileField(
                    label: l10n.commonEmail,
                    value: user?.email ?? '',
                  ),
                  const SizedBox(height: 12),
                  _ProfileField(
                    label: l10n.settingsName,
                    value: user?.name ?? l10n.settingsNotSet,
                  ),
                  if (countryName != null) ...[
                    const SizedBox(height: 12),
                    _CountryField(
                      label: l10n.settingsCountry,
                      value: countryName,
                      countryCode: countryCode,
                      canChange: canChange && !_updatingCountry,
                      loading: _updatingCountry,
                      onTap: canChange && !_updatingCountry
                          ? () => _pickCountry(context, l10n, countryCode)
                          : null,
                    ),
                  ],
                  if (widget.isLawyerMode && user?.tenantRole != null) ...[
                    const SizedBox(height: 12),
                    _ProfileField(
                      label: l10n.settingsRole,
                      value: user!.tenantRole!,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Widgets ───────────────────────────────────────────────────────────────────

class _ProfileField extends StatelessWidget {
  const _ProfileField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.7),
              ),
        ),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _CountryField extends StatelessWidget {
  const _CountryField({
    required this.label,
    required this.value,
    required this.countryCode,
    required this.canChange,
    required this.loading,
    this.onTap,
  });

  final String label;
  final String value;
  final String? countryCode;
  final bool canChange;
  final bool loading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.7),
              ),
        ),
        const SizedBox(height: 4),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (loading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else if (canChange)
                  Icon(
                    Icons.edit_outlined,
                    size: 16,
                    color: Theme.of(context).colorScheme.primary,
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CountryPickerSheet extends StatelessWidget {
  const _CountryPickerSheet({
    required this.currentCode,
    required this.l10n,
  });

  final String? currentCode;
  final AppLocalizations l10n;

  static const _flags = {
    'IN': '🇮🇳',
    'US': '🇺🇸',
    'KE': '🇰🇪',
    'GB': '🇬🇧',
  };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Text(
                l10n.settingsChangeRegion,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                l10n.settingsChangeRegionHint,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
            const Divider(height: 1),
            ...AppConfig.supportedCountryCodes.map((code) {
              final name = localizedCountryName(l10n, code);
              final isSelected = code == currentCode;
              return ListTile(
                leading: Text(
                  _flags[code] ?? '🌍',
                  style: const TextStyle(fontSize: 28),
                ),
                title: Text(name),
                trailing: isSelected
                    ? Icon(
                        Icons.check_circle,
                        color: Theme.of(context).colorScheme.primary,
                      )
                    : null,
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppColors.radius),
                ),
                onTap: () => Navigator.of(context).pop(code),
              );
            }),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
