import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../credits/widgets/credit_usage_meter.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(authControllerProvider).session?.user;
    final backRoute = isLawyerMode ? '/lawyer' : '/consumer';
    final prefix = isLawyerMode ? '/lawyer' : '/consumer';
    final countryName =
        AppConfig.countryNames[user?.countryCode ?? ''] ?? user?.countryCode;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(backRoute),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            isLawyerMode ? l10n.settingsFirmSettings : l10n.settingsAccountSettings,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.settingsSettingsDescription,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.language_outlined),
                  title: Text(l10n.settingsLanguage),
                  subtitle: Text(l10n.settingsLanguageDescription),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('$prefix/settings/language'),
                ),
                const Divider(height: 1),
                if (AppConfig.enableSubscriptions)
                  ListTile(
                    leading: const Icon(Icons.auto_awesome_outlined),
                    title: Text(l10n.settingsAiUsagePlan),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.settingsAiUsageDescription),
                        const SizedBox(height: 8),
                        const CreditUsageMeter(compact: true, readOnly: true),
                      ],
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.go('$prefix/settings/ai-usage'),
                  ),
                if (AppConfig.enableSubscriptions) const Divider(height: 1),
                ListTile(
                  leading: Icon(
                    isLawyerMode
                        ? Icons.business_outlined
                        : Icons.person_outline,
                  ),
                  title: Text(
                    isLawyerMode ? l10n.settingsFirmAccount : l10n.settingsConsumerAccount,
                  ),
                  subtitle: Text(
                    user?.name?.isNotEmpty == true
                        ? user!.name!
                        : user?.email ?? l10n.settingsViewProfile,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('$prefix/settings/account'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: Text(l10n.settingsDataConsent),
                  subtitle: Text(l10n.settingsDataConsentDescription),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('$prefix/settings/data-consent'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.security_outlined),
                  title: Text(l10n.settingsPrivacySecurity),
                  subtitle: Text(l10n.settingsPrivacySecurityDescription),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () =>
                      context.go('$prefix/settings/privacy-security'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(
                    Icons.delete_forever_outlined,
                    color: Theme.of(context).colorScheme.error,
                  ),
                  title: Text(l10n.settingsDeleteAccount),
                  subtitle: Text(l10n.settingsDeleteAccountSettingsHint),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('$prefix/settings/delete-account'),
                ),
                if (!isLawyerMode) ...[
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.gavel_outlined),
                    title: Text(l10n.settingsLawyerReview),
                    subtitle: Text(l10n.settingsLawyerReviewDescription),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.go('/consumer/lawyer-review'),
                  ),
                ],
              ],
            ),
          ),
          if (countryName != null) ...[
            const SizedBox(height: 16),
            Text(
              l10n.commonSignedInFrom(countryName),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) context.go('/auth');
            },
            icon: const Icon(Icons.logout),
            label: Text(l10n.commonSignOut),
          ),
        ],
      ),
    );
  }
}
