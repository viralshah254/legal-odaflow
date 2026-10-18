import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/network/api_client.dart';
import '../../../../../core/providers/app_providers.dart';
import '../../../../../widgets/legal_disclaimer.dart';

class CaseConsentTab extends ConsumerStatefulWidget {
  const CaseConsentTab({super.key, required this.caseId});

  final String caseId;

  @override
  ConsumerState<CaseConsentTab> createState() => _CaseConsentTabState();
}

class _CaseConsentTabState extends ConsumerState<CaseConsentTab> {
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
        _error = AppLocalizations.of(context)
            .settingsUnableToLoadConsentSettings;
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
      await ref.read(trainingConsentApiProvider).updateConsent(
            optIn: value,
            jurisdictionCountryCode: countryCode,
          );
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
        () => _error = AppLocalizations.of(context)
            .settingsUnableToSaveConsentPreference,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l10n.consumerDataConsentForThisCase,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          l10n.consumerAppliesToAccountChangesFuture,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 20),
        Card(
          child: SwitchListTile(
            title: Text(l10n.consumerTrainingImprovementConsent),
            subtitle: Text(l10n.settingsDataConsentConsumerBody),
            value: _optIn,
            onChanged: _saving ? null : _saveConsent,
          ),
        ),
        if (_message != null) ...[
          const SizedBox(height: 12),
          Text(_message!),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 24),
        const LegalDisclaimer(compact: true),
      ],
    );
  }
}
