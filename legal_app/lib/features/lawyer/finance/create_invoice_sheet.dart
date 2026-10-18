import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';

enum _InvoiceFor { matter, client, general }

/// Shows the Create Invoice bottom sheet and returns true if an invoice
/// was successfully created (so the caller can refresh its list).
Future<bool> showCreateInvoiceSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _CreateInvoiceSheet(),
  );
  return result ?? false;
}

class _CreateInvoiceSheet extends ConsumerStatefulWidget {
  const _CreateInvoiceSheet();

  @override
  ConsumerState<_CreateInvoiceSheet> createState() =>
      _CreateInvoiceSheetState();
}

class _CreateInvoiceSheetState extends ConsumerState<_CreateInvoiceSheet> {
  final _formKey = GlobalKey<FormState>();

  _InvoiceFor _mode = _InvoiceFor.matter;

  // Pickers
  String? _selectedMatterId;
  String? _selectedClientId;

  // Fields
  final _descController = TextEditingController();
  final _amountController = TextEditingController();
  String _billingModel = 'FIXED';
  String _status = 'DRAFT';
  DateTime? _dueDate;

  bool _submitting = false;
  String? _error;

  // Loaded data
  List<FirmMatter> _matters = [];
  List<FirmClient> _clients = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _descController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    if (tenantId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    try {
      final results = await Future.wait([
        ref
            .read(mattersApiProvider)
            .listMatters(tenantId: tenantId),
        ref
            .read(clientsApiProvider)
            .listClients(tenantId: tenantId),
      ]);
      if (mounted) {
        setState(() {
          _matters = results[0] as List<FirmMatter>;
          _clients = results[1] as List<FirmClient>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canSubmit {
    if (_submitting) return false;
    if (_dueDate == null) return false;
    final amt = double.tryParse(_amountController.text.replaceAll(',', ''));
    if (amt == null || amt <= 0) return false;
    switch (_mode) {
      case _InvoiceFor.matter:
        return _selectedMatterId != null;
      case _InvoiceFor.client:
        return _selectedClientId != null;
      case _InvoiceFor.general:
        return _descController.text.trim().isNotEmpty;
    }
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    if (tenantId.isEmpty) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final amount =
          double.parse(_amountController.text.replaceAll(',', ''));
      final dueDate = _dueDate!.toIso8601String().substring(0, 10);

      String? matterId;
      String? clientId;

      if (_mode == _InvoiceFor.matter && _selectedMatterId != null) {
        matterId = _selectedMatterId;
        final matter = _matters.firstWhere(
          (m) => m.id == _selectedMatterId,
          orElse: () => _matters.first,
        );
        clientId = matter.clientId;
      } else if (_mode == _InvoiceFor.client && _selectedClientId != null) {
        clientId = _selectedClientId;
      }

      await ref.read(billingApiProvider).createInvoice(
            tenantId: tenantId,
            matterId: matterId,
            clientId: clientId,
            description: _descController.text.trim().isNotEmpty
                ? _descController.text.trim()
                : null,
            amount: amount,
            currency: 'USD',
            dueDate: dueDate,
            billingModel: _billingModel,
            status: _status,
          );

      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate:
          _dueDate ?? DateTime.now().add(const Duration(days: 30)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.88,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 16, 0),
              child: Row(
                children: [
                  Text('New Invoice',
                      style: tt.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            if (_loading)
              const Expanded(
                child: Center(child: CircularProgressIndicator()),
              )
            else
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                    children: [
                      // ── Mode selector ─────────────────────────────────
                      Text('Invoice for',
                          style: tt.labelMedium
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      SegmentedButton<_InvoiceFor>(
                        segments: const [
                          ButtonSegment(
                            value: _InvoiceFor.matter,
                            label: Text('Matter'),
                            icon: Icon(Icons.work_outline, size: 16),
                          ),
                          ButtonSegment(
                            value: _InvoiceFor.client,
                            label: Text('Client'),
                            icon: Icon(Icons.business_outlined, size: 16),
                          ),
                          ButtonSegment(
                            value: _InvoiceFor.general,
                            label: Text('General'),
                            icon: Icon(Icons.receipt_long_outlined, size: 16),
                          ),
                        ],
                        selected: {_mode},
                        onSelectionChanged: (s) => setState(() {
                          _mode = s.first;
                          _selectedMatterId = null;
                          _selectedClientId = null;
                        }),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        switch (_mode) {
                          _InvoiceFor.matter =>
                            'Hourly, fixed, contingency or milestone billing for a case',
                          _InvoiceFor.client =>
                            'Retainer, subscription or advisory fee billed to a client',
                          _InvoiceFor.general =>
                            'Platform fees, disbursements or services not tied to anyone',
                        },
                        style: tt.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.mutedForegroundDark
                              : AppColors.mutedForegroundLight,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // ── Matter picker ──────────────────────────────────
                      if (_mode == _InvoiceFor.matter) ...[
                        _fieldLabel('Matter *'),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedMatterId,
                          hint: const Text('Select a matter'),
                          isExpanded: true,
                          items: _matters
                              .map((m) => DropdownMenuItem(
                                    value: m.id,
                                    child: Text(
                                      m.title,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedMatterId = v),
                          validator: (v) =>
                              v == null ? 'Please select a matter' : null,
                        ),
                        const SizedBox(height: 16),
                      ],

                      // ── Client picker ──────────────────────────────────
                      if (_mode == _InvoiceFor.client) ...[
                        _fieldLabel('Client *'),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedClientId,
                          hint: const Text('Select a client'),
                          isExpanded: true,
                          items: _clients
                              .map((c) => DropdownMenuItem(
                                    value: c.id,
                                    child: Text(
                                      c.name,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedClientId = v),
                          validator: (v) =>
                              v == null ? 'Please select a client' : null,
                        ),
                        const SizedBox(height: 16),
                      ],

                      // ── Description ────────────────────────────────────
                      _fieldLabel(
                        _mode == _InvoiceFor.general
                            ? 'Description *'
                            : 'Description (optional)',
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _descController,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: switch (_mode) {
                            _InvoiceFor.matter =>
                              'e.g. Legal services — Q2 hearing and filings',
                            _InvoiceFor.client =>
                              'e.g. Monthly retainer — July 2026',
                            _InvoiceFor.general =>
                              'e.g. Annual platform subscription',
                          },
                          border: const OutlineInputBorder(),
                        ),
                        validator: _mode == _InvoiceFor.general
                            ? (v) => (v == null || v.trim().isEmpty)
                                ? 'Description is required'
                                : null
                            : null,
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 16),

                      // ── Amount ─────────────────────────────────────────
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _fieldLabel('Amount *'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _amountController,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                          decimal: true),
                                  inputFormatters: [
                                    FilteringTextInputFormatter.allow(
                                        RegExp(r'[\d.,]')),
                                  ],
                                  decoration: const InputDecoration(
                                    hintText: '0.00',
                                    border: OutlineInputBorder(),
                                  ),
                                  validator: (v) {
                                    final n = double.tryParse(
                                        v?.replaceAll(',', '') ?? '');
                                    if (n == null || n <= 0) {
                                      return 'Enter a valid amount';
                                    }
                                    return null;
                                  },
                                  onChanged: (_) => setState(() {}),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _fieldLabel('Billing model'),
                                const SizedBox(height: 6),
                                DropdownButtonFormField<String>(
                                  initialValue: _billingModel,
                                  isExpanded: true,
                                  items: const [
                                    DropdownMenuItem(
                                        value: 'FIXED',
                                        child: Text('Fixed')),
                                    DropdownMenuItem(
                                        value: 'HOURLY',
                                        child: Text('Hourly')),
                                    DropdownMenuItem(
                                        value: 'SUBSCRIPTION',
                                        child: Text('Subscription')),
                                    DropdownMenuItem(
                                        value: 'CONTINGENCY',
                                        child: Text('Contingency')),
                                    DropdownMenuItem(
                                        value: 'MILESTONE',
                                        child: Text('Milestone')),
                                  ],
                                  onChanged: (v) => setState(
                                      () => _billingModel = v ?? 'FIXED'),
                                  decoration: const InputDecoration(
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // ── Due date ───────────────────────────────────────
                      _fieldLabel('Due date *'),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: _pickDate,
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            suffixIcon:
                                Icon(Icons.calendar_today_outlined, size: 18),
                          ),
                          child: Text(
                            _dueDate != null
                                ? '${_dueDate!.day.toString().padLeft(2, '0')}/'
                                    '${_dueDate!.month.toString().padLeft(2, '0')}/'
                                    '${_dueDate!.year}'
                                : 'Select due date',
                            style: _dueDate == null
                                ? TextStyle(
                                    color: isDark
                                        ? AppColors.mutedForegroundDark
                                        : AppColors.mutedForegroundLight,
                                  )
                                : null,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // ── Status ─────────────────────────────────────────
                      _fieldLabel('Status'),
                      const SizedBox(height: 6),
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(
                              value: 'DRAFT', label: Text('Save as draft')),
                          ButtonSegment(
                              value: 'SENT', label: Text('Send now')),
                        ],
                        selected: {_status},
                        onSelectionChanged: (s) =>
                            setState(() => _status = s.first),
                      ),

                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: cs.errorContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _error!,
                            style:
                                TextStyle(color: cs.onErrorContainer),
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),

                      // ── Submit ─────────────────────────────────────────
                      FilledButton(
                        onPressed: _canSubmit ? _submit : null,
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Create Invoice'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _fieldLabel(String label) => Text(
        label,
        style: Theme.of(context)
            .textTheme
            .labelMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      );
}
