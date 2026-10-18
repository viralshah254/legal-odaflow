import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_localizations.dart';
import '../../core/config/app_config.dart';
import '../../core/config/locale_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/locale_provider.dart';
import '../../core/theme/app_colors.dart';

class LanguageSelectorScreen extends ConsumerWidget {
  const LanguageSelectorScreen({
    super.key,
    this.countryCode,
    this.fromSettings = false,
  });

  /// When set (from onboarding), persist country before language selection.
  final String? countryCode;

  /// When true, return to settings after selection instead of sign-in.
  final bool fromSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final rawCountry = countryCode ??
        ref.watch(countryCodeProvider).maybeWhen(data: (v) => v, orElse: () => null);
    final effectiveCountry = rawCountry ?? AppConfig.defaultCountry;
    final locales = availableLocalesForCountry(effectiveCountry);
    final currentLocale = ref.watch(localeProvider).maybeWhen(data: (v) => v, orElse: () => defaultLocale);
    final isIndia = effectiveCountry.toUpperCase() == 'IN';

    // For India, split into English first, then Indian languages grouped under
    // a section header for easier scanning of 13 options.
    final englishLocales = isIndia ? locales.where((l) => l.code == 'en').toList() : locales;
    final indianLocales = isIndia ? locales.where((l) => l.code != 'en').toList() : <LocaleDefinition>[];

    Widget buildLocaleCard(LocaleDefinition loc) {
      final selected = currentLocale == loc.code;
      return Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          title: Text(loc.nativeName, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(loc.englishName),
          trailing: selected ? Icon(Icons.check_circle, color: AppColors.primaryDark) : null,
          onTap: () async {
            final ok = await ref
                .read(localeProvider.notifier)
                .setLocale(loc.code, countryCode: effectiveCountry);
            if (!context.mounted) return;
            if (!ok) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(l10n.commonInvalidLocaleForCountry)),
              );
              return;
            }
            // Persist the chosen locale to the server so it survives reinstall.
            if (fromSettings) {
              try {
                await ref
                    .read(profileApiProvider)
                    .updateMyPreferences(preferredLocale: loc.code);
              } catch (_) {
                // Best-effort — local selection already applied.
              }
            }
            if (!context.mounted) return;
            if (fromSettings) {
              context.pop();
            } else if (countryCode != null) {
              context.go('/auth');
            } else {
              context.pop();
            }
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.commonSelectLanguage)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            l10n.commonCountryLanguageHint,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (isIndia) ...[
            const SizedBox(height: 4),
            Text(
              localizedCountryName(l10n, effectiveCountry),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(height: 20),
          ...englishLocales.map(buildLocaleCard),
          if (isIndia && indianLocales.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 12),
              child: Text(
                l10n.commonIndia,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
            ...indianLocales.map(buildLocaleCard),
          ],
          if (isIndia) ...[
            const SizedBox(height: 16),
            _KeyboardTipCard(),
          ],
        ],
      ),
    );
  }
}

/// Tip card shown for India users explaining how to enable a language keyboard
/// on their device so they can type in the chosen language.
class _KeyboardTipCard extends StatelessWidget {
  const _KeyboardTipCard();

  Future<void> _openKeyboardSettings() async {
    // Android: open the system input method settings page directly.
    final uri = Uri.parse('android-app://com.android.settings/.inputmethod.InputMethodAndLanguageSettings');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      // Fallback to the generic settings action URI.
      final fallback = Uri.parse('android.settings://INPUT_METHOD_SETTINGS');
      if (await canLaunchUrl(fallback)) {
        await launchUrl(fallback);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isAndroid = Platform.isAndroid;

    return Card(
      margin: EdgeInsets.zero,
      color: colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.keyboard_outlined, size: 18, color: colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Typing in your language',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colorScheme.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              isAndroid
                  ? 'To type in Hindi, Bengali, or any Indian language, add that keyboard in your device settings.'
                  : 'To type in Hindi, Bengali, or any Indian language, go to:\nSettings → General → Keyboard → Keyboards → Add New Keyboard',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
            ),
            if (isAndroid) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _openKeyboardSettings,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open keyboard settings'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
