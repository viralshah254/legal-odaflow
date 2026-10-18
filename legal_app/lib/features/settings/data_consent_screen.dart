import '../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../widgets/legal_disclaimer.dart';

class DataConsentScreen extends ConsumerStatefulWidget {
  const DataConsentScreen({super.key, this.isLawyerMode = false});

  final bool isLawyerMode;

  @override
  ConsumerState<DataConsentScreen> createState() => _DataConsentScreenState();
}

class _DataConsentScreenState extends ConsumerState<DataConsentScreen> {
  bool _loading = true;
  bool _saving = false;
  bool _optIn = false;
  String? _error;
  String? _message;

  @override
  void initState() {
    super.initState();
    _loadConsent();
  }

  Future<void> _loadConsent() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final consent = await ref.read(trainingConsentApiProvider).getConsent();
      if (!mounted) return;
      setState(() {
        _optIn = consent.isGranted;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = AppLocalizations.of(context).settingsUnableToLoadConsentSettings;
        _loading = false;
      });
    }
  }

  Future<void> _saveConsent(bool value) async {
    final user = ref.read(authControllerProvider).session?.user;
    final countryCode = user?.countryCode ?? 'US';

    setState(() {
      _saving = true;
      _error = null;
      _message = null;
    });

    try {
      await ref
          .read(trainingConsentApiProvider)
          .updateConsent(optIn: value, jurisdictionCountryCode: countryCode);
      if (!mounted) return;
      setState(() {
        _optIn = value;
        _message = value
            ? AppLocalizations.of(context).settingsDataConsentEnabledMessage
            : AppLocalizations.of(context).settingsDataConsentDisabledMessage;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _error = AppLocalizations.of(context).settingsUnableToSaveConsentPreference,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _withdrawConsent() async {
    setState(() {
      _saving = true;
      _error = null;
      _message = null;
    });

    try {
      await ref.read(trainingConsentApiProvider).withdrawConsent();
      if (!mounted) return;
      setState(() {
        _optIn = false;
        _message = AppLocalizations.of(context).settingsDataConsentWithdrawnMessage;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _error = AppLocalizations.of(context).settingsUnableToWithdrawConsent,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final backRoute = widget.isLawyerMode
        ? '/lawyer/settings'
        : '/consumer/settings';
    final countryCode =
        ref.watch(authControllerProvider).session?.user.countryCode;
    final countryName = countryCode != null
        ? localizedCountryName(l10n, countryCode)
        : l10n.settingsYourJurisdiction;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsDataConsent),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(backRoute),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  widget.isLawyerMode
                      ? l10n.settingsDataConsentFirmTitle
                      : l10n.settingsDataConsentConsumerTitle,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                Text(
                  widget.isLawyerMode
                      ? l10n.settingsDataConsentFirmBody(countryName)
                      : l10n.settingsDataConsentConsumerBody,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                Card(
                  child: SwitchListTile(
                    title: Text(l10n.settingsUseAnonymizedDataForImprovement),
                    subtitle: Text(
                      _optIn
                          ? l10n.settingsDataConsentOptInActive
                          : l10n.settingsDataConsentOptOutDefault,
                    ),
                    value: _optIn,
                    onChanged: _saving ? null : _saveConsent,
                  ),
                ),
                if (_optIn) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _saving ? null : _withdrawConsent,
                    child: Text(l10n.settingsWithdrawConsent),
                  ),
                ],
                if (_message != null) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(_message!),
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                const LegalDisclaimer(compact: true),
              ],
            ),
    );
  }
}
