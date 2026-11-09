import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/clients_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/form_dropdown.dart';

const _clientTypes = ['INDIVIDUAL', 'COMPANY', 'NGO', 'PARTNERSHIP'];

bool _isCorporateType(String type) =>
    type == 'COMPANY' || type == 'NGO' || type == 'PARTNERSHIP';

String _clientTypeLabel(AppLocalizations l10n, String type) => switch (type) {
      'INDIVIDUAL' => l10n.clientsTypesINDIVIDUAL,
      'COMPANY' => l10n.clientsTypesCOMPANY,
      'NGO' => l10n.clientsTypesNGO,
      'PARTNERSHIP' => l10n.clientsTypesPARTNERSHIP,
      _ => type,
    };

/// Shows the same two-step client form as web (details → contacts).
Future<FirmClient?> showCreateClientSheet(
  BuildContext context,
  WidgetRef ref, {
  String? initialName,
}) async {
  final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) return null;

  final defaultCountry = await ref.read(workCountryProvider.future);
  if (!context.mounted) return null;

  return showModalBottomSheet<FirmClient>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _CreateClientSheet(
      tenantId: tenantId,
      defaultCountryCode: defaultCountry,
      initialName: initialName,
    ),
  );
}

class _CreateClientSheet extends ConsumerStatefulWidget {
  const _CreateClientSheet({
    required this.tenantId,
    required this.defaultCountryCode,
    this.initialName,
  });

  final String tenantId;
  final String defaultCountryCode;
  final String? initialName;

  @override
  ConsumerState<_CreateClientSheet> createState() => _CreateClientSheetState();
}

class _CreateClientSheetState extends ConsumerState<_CreateClientSheet> {
  final _detailsFormKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  int _step = 1;
  String _clientType = 'INDIVIDUAL';
  late String _countryCode;
  final List<Map<String, String>> _contactPeople = [];
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _countryCode = widget.defaultCountryCode;
    if (widget.initialName?.trim().isNotEmpty == true) {
      _nameCtrl.text = widget.initialName!.trim();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  bool get _canProceed => _nameCtrl.text.trim().length >= 2;

  List<ClientContactPersonInput> _buildContactPeople() {
    if (!_isCorporateType(_clientType)) return const [];
    return _contactPeople
        .where((c) => c['name']?.trim().isNotEmpty == true)
        .map(
          (c) => ClientContactPersonInput(
            name: c['name']!.trim(),
            role: c['role']?.trim(),
            email: c['email']?.trim(),
            phone: c['phone']?.trim(),
          ),
        )
        .toList();
  }

  Future<void> _create({required bool minimal}) async {
    if (!_canProceed) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final client = await ref.read(clientsApiProvider).createClient(
            tenantId: widget.tenantId,
            name: _nameCtrl.text.trim(),
            countryCode: _countryCode,
            type: _clientType,
            email: minimal ? null : _emailCtrl.text.trim(),
            phone: minimal ? null : _phoneCtrl.text.trim(),
            contactPeople: minimal ? null : _buildContactPeople(),
          );
      if (mounted) context.pop(client);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = AppLocalizations.of(context).clientsFailedToCreate);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _addContact() {
    setState(
      () => _contactPeople.add({'name': '', 'role': '', 'email': '', 'phone': ''}),
    );
  }

  void _removeContact(int index) {
    setState(() => _contactPeople.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final isCorporate = _isCorporateType(_clientType);

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.88,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.clientsAddNewClient,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.clientsCreateClientProfile,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: _StepTab(
                        label: l10n.clientsClientDetails,
                        selected: _step == 1,
                        enabled: true,
                        onTap: () => setState(() => _step = 1),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _StepTab(
                        label: l10n.clientsContacts,
                        selected: _step == 2,
                        enabled: _canProceed,
                        onTap: _canProceed ? () => setState(() => _step = 2) : null,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  children: [
                    if (_step == 1) ...[
                      Form(
                        key: _detailsFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              l10n.clientsClientTypeLabel,
                              style: Theme.of(context).textTheme.labelMedium,
                            ),
                            const SizedBox(height: 6),
                            FormDropdown<String>(
                              value: _clientType,
                              items: _clientTypes
                                  .map(
                                    (type) => DropdownMenuItem(
                                      value: type,
                                      child: Text(_clientTypeLabel(l10n, type)),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) {
                                if (v == null) return;
                                setState(() {
                                  _clientType = v;
                                  if (_isCorporateType(v) &&
                                      _contactPeople.isEmpty) {
                                    _contactPeople.add({
                                      'name': '',
                                      'role': '',
                                      'email': '',
                                      'phone': '',
                                    });
                                  }
                                });
                              },
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _nameCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: InputDecoration(
                                labelText: '${l10n.clientsClientName} *',
                                hintText: l10n.clientsEnterClientName,
                              ),
                              onChanged: (_) => setState(() {}),
                              validator: (v) {
                                if (v == null || v.trim().length < 2) {
                                  return l10n.clientsClientNameRequired;
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: colorScheme.error)),
                      ],
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: TextButton.icon(
                              onPressed: !_canProceed || _submitting
                                  ? null
                                  : () => _create(minimal: true),
                              icon: _submitting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.save_outlined, size: 18),
                              label: const Text('Save basic & complete later'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: _canProceed
                                ? () {
                                    if (_detailsFormKey.currentState?.validate() ??
                                        false) {
                                      setState(() => _step = 2);
                                    }
                                  }
                                : null,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(l10n.clientsNextContacts),
                                const SizedBox(width: 4),
                                const Icon(Icons.arrow_forward, size: 16),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: l10n.clientsEmail,
                          hintText: l10n.clientsClientexamplecom,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: l10n.clientsPhone,
                          hintText: l10n.clients700000000,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        l10n.clientsCountry,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      const SizedBox(height: 6),
                      FormDropdown<String>(
                        value: _countryCode,
                        items: {...AppConfig.supportedCountryCodes, _countryCode}
                            .map(
                              (code) => DropdownMenuItem(
                                value: code,
                                child: Text(
                                  AppConfig.countryNames[code] ?? code,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => _countryCode = v);
                        },
                      ),
                      if (isCorporate) ...[
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Contact people',
                                style: Theme.of(context)
                                    .textTheme
                                    .labelLarge
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: _addContact,
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Add contact'),
                            ),
                          ],
                        ),
                        if (_contactPeople.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Add named contacts for this ${_clientTypeLabel(l10n, _clientType).toLowerCase()}.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                            ),
                          ),
                        ..._contactPeople.asMap().entries.map(
                              (entry) => _ContactPersonCard(
                                index: entry.key,
                                contact: entry.value,
                                onChanged: (field, value) {
                                  setState(() => entry.value[field] = value);
                                },
                                onRemove: _contactPeople.length > 1
                                    ? () => _removeContact(entry.key)
                                    : null,
                              ),
                            ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: colorScheme.error)),
                      ],
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          OutlinedButton.icon(
                            onPressed: _submitting
                                ? null
                                : () => setState(() => _step = 1),
                            icon: const Icon(Icons.arrow_back, size: 16),
                            label: Text(l10n.commonBack),
                          ),
                          const Spacer(),
                          FilledButton(
                            onPressed: _submitting
                                ? null
                                : () => _create(minimal: false),
                            child: _submitting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(l10n.clientsCreateClient),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StepTab extends StatelessWidget {
  const _StepTab({
    required this.label,
    required this.selected,
    required this.enabled,
    this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: selected
          ? colorScheme.primary
          : colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected
                  ? colorScheme.onPrimary
                  : enabled
                      ? colorScheme.onSurface
                      : colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ),
      ),
    );
  }
}

class _ContactPersonCard extends StatelessWidget {
  const _ContactPersonCard({
    required this.index,
    required this.contact,
    required this.onChanged,
    this.onRemove,
  });

  final int index;
  final Map<String, String> contact;
  final void Function(String field, String value) onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Contact ${index + 1}',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              if (onRemove != null)
                IconButton(
                  icon: const Icon(Icons.close, size: 16),
                  onPressed: onRemove,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            onChanged: (v) => onChanged('name', v),
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: 'Name *',
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            onChanged: (v) => onChanged('role', v),
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: 'Role / Title',
              hintText: 'e.g. CEO, Director',
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            onChanged: (v) => onChanged('email', v),
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: l10n.clientsEmail,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            onChanged: (v) => onChanged('phone', v),
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: l10n.clientsPhone,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }
}
