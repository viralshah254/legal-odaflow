import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';

class CountrySelectorScreen extends ConsumerStatefulWidget {
  const CountrySelectorScreen({super.key});

  @override
  ConsumerState<CountrySelectorScreen> createState() =>
      _CountrySelectorScreenState();
}

class _CountrySelectorScreenState extends ConsumerState<CountrySelectorScreen> {
  String? _detectedCode;
  String? _detectedName;
  bool _loading = true;
  bool _showAllCountries = false;

  @override
  void initState() {
    super.initState();
    _detectCountry();
  }

  Future<void> _detectCountry() async {
    final detected = await ref
        .read(detectCountryServiceProvider)
        .detectCountry();
    if (!mounted) return;
    setState(() {
      _detectedCode = detected.countryCode;
      _detectedName = detected.countryName;
      _loading = false;
    });
  }

  Future<void> _continueWith(String code) async {
    await ref.read(tokenStorageProvider).saveCountryCode(code);
    ref.invalidate(countryCodeProvider);
    if (mounted) {
      context.go('/onboarding/language?country=$code');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.commonConfirmCountry)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            l10n.commonCountryLanguageHint,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(l10n.commonYourCountryIsDetectedAutomaticallyYouCanChangeItIf,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.mutedForegroundDark
                  : AppColors.mutedForegroundLight,
            ),
          ),
          const SizedBox(height: 24),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (!_showAllCountries && _detectedCode != null) ...[
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.12),
                  child: Text(
                    _detectedCode!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
                title: Text('Detected: ${_detectedName ?? _detectedCode!}'),
                subtitle: Text(l10n.commonTapContinueToUseThisCountry),
                trailing: const Icon(Icons.check_circle_outline),
                onTap: () => _continueWith(_detectedCode!),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _continueWith(_detectedCode!),
              child: Text(l10n.commonContinue),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => setState(() => _showAllCountries = true),
              child: Text(l10n.commonSelectCountry),
            ),
          ] else
            ...AppConfig.supportedCountryCodes.map((code) {
              final name = AppConfig.countryNames[code] ?? code;
              final isDetected = code == _detectedCode;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radius),
                    ),
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.12),
                      child: Text(
                        code,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    title: Text(name),
                    subtitle: Text(
                      isDetected ? 'Detected location' : 'Country code: $code',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _continueWith(code),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
