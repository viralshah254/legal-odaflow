import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/geo/jurisdiction_options.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../widgets/expanding_text_field.dart';
import '../issue_checker_constants.dart';

const _minChars = 20;

class IntakeMicroFlow extends ConsumerStatefulWidget {
  const IntakeMicroFlow({
    super.key,
    this.initialData,
    required this.onComplete,
  });

  final IssueCheckerWizardData? initialData;
  final void Function(IssueCheckerWizardData data) onComplete;

  @override
  ConsumerState<IntakeMicroFlow> createState() => _IntakeMicroFlowState();
}

class _IntakeMicroFlowState extends ConsumerState<IntakeMicroFlow> {
  final _factsController = TextEditingController();
  String? _countryCode;
  String? _countryName;
  String? _jurisdiction;
  bool _countryLoading = true;
  bool _showCountryPicker = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialData;
    if (initial != null) {
      _factsController.text = initial.facts;
      if (initial.countryCode.isNotEmpty) {
        _countryCode = initial.countryCode;
        _countryName = AppConfig.countryNames[initial.countryCode] ?? initial.countryCode;
        _jurisdiction = initial.jurisdiction.isEmpty ? null : initial.jurisdiction;
        _countryLoading = false;
      }
    }
    if (_countryCode == null) _loadCountry();
  }

  @override
  void dispose() {
    _factsController.dispose();
    super.dispose();
  }

  Future<void> _loadCountry() async {
    final stored = await ref.read(tokenStorageProvider).getCountryCode();
    if (stored != null && stored.isNotEmpty) {
      if (mounted) {
        setState(() {
          _countryCode = stored;
          _countryName = AppConfig.countryNames[stored] ?? stored;
          _countryLoading = false;
        });
      }
      return;
    }

    final detected = await ref
        .read(detectCountryServiceProvider)
        .detectCountry();
    await ref.read(tokenStorageProvider).saveCountryCode(detected.countryCode);
    if (mounted) {
      setState(() {
        _countryCode = detected.countryCode;
        _countryName = detected.countryName;
        _countryLoading = false;
        _jurisdiction = detected.jurisdiction;
      });
    }
  }

  Future<void> _selectCountry(String code) async {
    await ref.read(tokenStorageProvider).saveCountryCode(code);
    if (mounted) {
      setState(() {
        _countryCode = code;
        _countryName = AppConfig.countryNames[code] ?? code;
        _showCountryPicker = false;
        _jurisdiction = null;
      });
    }
  }

  List<String>? _jurisdictions() {
    return JurisdictionOptions.forCountry(_countryCode ?? '');
  }

  void _submit() {
    final facts = _factsController.text.trim();
    final code = _countryCode;
    if (facts.length < _minChars || code == null) return;

    widget.onComplete(
      IssueCheckerWizardData(
        facts: facts,
        countryCode: code,
        jurisdiction: _jurisdiction ?? '',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final facts = _factsController.text;
    final jurisdictions = _jurisdictions();
    final canSubmit = facts.trim().length >= _minChars && _countryCode != null;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.issueCheckerDescribeYourCase,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          ExpandingTextField(
            controller: _factsController,
            labelText: l10n.issueCheckerFacts,
            minLines: 5,
            hintText: l10n.issueCheckerDescribeYourSituationPartiesDatesWhatHappenedAndWhat,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          // Country selector
          InkWell(
            onTap: () => setState(() => _showCountryPicker = !_showCountryPicker),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              decoration: BoxDecoration(
                border: Border.all(
                  color: theme.colorScheme.outline,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.flag_outlined, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _countryLoading
                        ? Text(
                            '…',
                            style: TextStyle(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          )
                        : Text(_countryName ?? l10n.issueCheckerSelectCountry),
                  ),
                  Icon(
                    _showCountryPicker
                        ? Icons.expand_less
                        : Icons.expand_more,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (_showCountryPicker) ...[
            const SizedBox(height: 4),
            Container(
              constraints: const BoxConstraints(maxHeight: 220),
              decoration: BoxDecoration(
                border: Border.all(color: theme.colorScheme.outline),
                borderRadius: BorderRadius.circular(8),
                color: theme.colorScheme.surface,
              ),
              child: ListView(
                shrinkWrap: true,
                children: () {
                  final entries = AppConfig.countryNames.entries
                      .where((e) => e.key != 'OTHER')
                      .toList()
                    ..sort((a, b) => a.value.compareTo(b.value));
                  entries.add(MapEntry('OTHER', l10n.commonOther));
                  return entries
                      .map<Widget>(
                        (e) => ListTile(
                          dense: true,
                          title: Text(e.value),
                          selected: e.key == _countryCode,
                          onTap: () => _selectCountry(e.key),
                        ),
                      )
                      .toList();
                }(),
              ),
            ),
          ],
          if (jurisdictions != null && jurisdictions.isNotEmpty) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: jurisdictions.contains(_jurisdiction)
                  ? _jurisdiction
                  : null,
              hint: Text(l10n.mattersJurisdictionOptional),
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                labelText: l10n.mattersJurisdictionOptional,
              ),
              items: jurisdictions
                  .map(
                    (j) => DropdownMenuItem(value: j, child: Text(j)),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _jurisdiction = v),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: canSubmit ? _submit : null,
            child: Text(l10n.commonContinue),
          ),
        ],
      ),
    );
  }
}
