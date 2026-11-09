import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/calendar_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/form_dropdown.dart';
import 'calendar_helpers.dart';

Future<CalendarEventItem?> showCreateEventSheet(
  BuildContext context,
  WidgetRef ref, {
  DateTime? initialDate,
  CalendarEventItem? existing,
}) async {
  final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) return null;

  return showModalBottomSheet<CalendarEventItem>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _CreateEventSheet(
      tenantId: tenantId,
      initialDate: initialDate,
      existing: existing,
    ),
  );
}

class _CreateEventSheet extends ConsumerStatefulWidget {
  const _CreateEventSheet({
    required this.tenantId,
    this.initialDate,
    this.existing,
  });

  final String tenantId;
  final DateTime? initialDate;
  final CalendarEventItem? existing;

  @override
  ConsumerState<_CreateEventSheet> createState() => _CreateEventSheetState();
}

class _CreateEventSheetState extends ConsumerState<_CreateEventSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  String _type = 'Meeting';
  String? _clientId;
  String? _matterId;
  String? _selectedMatterTitle;
  int? _reminderMinutes = 30;
  List<FirmMatter> _matters = [];
  bool _loadingMatters = true;
  bool _matterLoadError = false;
  int _matterRequest = 0;
  Timer? _matterSearchTimer;
  final _matterSearchCtrl = TextEditingController();
  List<FirmClient> _clients = [];
  bool _loadingClients = true;
  bool _submitting = false;
  String? _error;

  late DateTime _startDate;
  late TimeOfDay _startTime;
  late DateTime _endDate;
  late TimeOfDay _endTime;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleCtrl.text = existing.displayTitle;
      _descriptionCtrl.text = existing.description ?? '';
      _type = _normalizeTypeForForm(existing.type);
      _clientId = existing.clientId;
      _matterId = existing.matterId;
      _selectedMatterTitle = existing.matterTitle;
      _reminderMinutes = existing.reminderMinutes;
      _startDate = DateUtils.dateOnly(existing.startAt.toLocal());
      _startTime = TimeOfDay.fromDateTime(existing.startAt.toLocal());
      _endDate = DateUtils.dateOnly(existing.endAt.toLocal());
      _endTime = TimeOfDay.fromDateTime(existing.endAt.toLocal());
    } else {
      final base = widget.initialDate ?? DateTime.now();
      _startDate = DateTime(base.year, base.month, base.day);
      _startTime = const TimeOfDay(hour: 9, minute: 0);
      _endDate = _startDate;
      _endTime = const TimeOfDay(hour: 10, minute: 0);
    }
    unawaited(_loadClients());
    unawaited(_loadMatters());
  }

  @override
  void dispose() {
    _matterSearchTimer?.cancel();
    _matterSearchCtrl.dispose();
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  String _normalizeTypeForForm(String? type) {
    switch (CalendarEventItem(
      id: '',
      title: '',
      startAt: DateTime.now(),
      endAt: DateTime.now(),
      type: type,
    ).normalizedType) {
      case 'COURT_DATE':
        return 'Hearing';
      case 'DEADLINE':
        return 'Deadline';
      case 'APPOINTMENT':
        return 'Appointment';
      case 'OTHER':
        return 'Other';
      default:
        return 'Meeting';
    }
  }

  Future<void> _loadClients() async {
    try {
      final clients = await ref
          .read(clientsApiProvider)
          .listClients(tenantId: widget.tenantId);
      if (mounted) {
        setState(() {
          _clients = clients;
          _loadingClients = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingClients = false);
      }
    }
  }

  Future<void> _loadMatters() async {
    final request = ++_matterRequest;
    if (mounted) setState(() { _loadingMatters = true; _matterLoadError = false; });
    try {
      final matters = await ref.read(mattersApiProvider).listMatters(tenantId: widget.tenantId,
        search: _matterSearchCtrl.text.trim(), clientId: _clientId);
      if (mounted && request == _matterRequest) setState(() { _matters = matters; _loadingMatters = false; });
    } catch (_) {
      if (mounted && request == _matterRequest) setState(() { _loadingMatters = false; _matterLoadError = true; });
    }
  }

  DateTime _combine(DateTime date, TimeOfDay time) {
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _pickDate({
    required DateTime initial,
    required ValueChanged<DateTime> onChanged,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) onChanged(picked);
  }

  Future<void> _pickTime({
    required TimeOfDay initial,
    required ValueChanged<TimeOfDay> onChanged,
  }) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (picked != null) onChanged(picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final startAt = _combine(_startDate, _startTime);
    final endAt = _combine(_endDate, _endTime);
    if (!endAt.isAfter(startAt)) {
      setState(() => _error = 'End time must be after start time.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final calendarApi = ref.read(calendarApiProvider);
      final CalendarEventItem saved;
      if (_isEditing) {
        saved = await calendarApi.updateEvent(
          tenantId: widget.tenantId,
          eventId: widget.existing!.id,
          input: UpdateCalendarEventInput(
            title: _titleCtrl.text.trim(),
            description: _descriptionCtrl.text.trim(),
            type: _type,
            clientId: _clientId,
            matterId: _matterId,
            reminderMinutes: _reminderMinutes,
            updateReminder: true,
            updateMatterLink: true,
            updateClientLink: true,
            startAt: startAt,
            endAt: endAt,
          ),
        );
      } else {
        saved = await calendarApi.createEvent(
          tenantId: widget.tenantId,
          input: CreateCalendarEventInput(
            title: _titleCtrl.text.trim(),
            description: _descriptionCtrl.text.trim(),
            type: _type,
            clientId: _clientId,
            matterId: _matterId,
            reminderMinutes: _reminderMinutes,
            startAt: startAt,
            endAt: endAt,
          ),
        );
      }
      if (mounted) Navigator.pop(context, saved);
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
          _submitting = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _isEditing ? l10n.commonEdit : l10n.commonCreateEvent,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    onPressed: _submitting ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _titleCtrl,
                decoration: InputDecoration(
                  labelText: l10n.commonTitle,
                  border: const OutlineInputBorder(),
                ),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              Text('Type', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              FormDropdown<String>(
                value: _type,
                items: calendarEventTypeValues
                    .map(
                      (value) => DropdownMenuItem(
                        value: value,
                        child: Text(calendarEventTypeLabel(l10n, value)),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) setState(() => _type = value);
                },
              ),
              const SizedBox(height: 12),
              Text(l10n.billingClient,
                  style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              FormDropdown<String?>(
                value: _clientId,
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(l10n.commonNone),
                  ),
                  if (_clientId != null && !_clients.any((client) => client.id == _clientId))
                    DropdownMenuItem<String?>(value: _clientId, child: Text(l10n.billingClient)),
                  ..._clients.map(
                    (client) => DropdownMenuItem<String?>(
                      value: client.id,
                      child: Text('${client.name} (${client.type ?? ''})'),
                    ),
                  ),
                ],
                onChanged: _loadingClients
                    ? null
                    : (value) {
                        setState(() { _clientId = value; _matterId = null; _selectedMatterTitle = null; });
                        unawaited(_loadMatters());
                      },
              ),
              const SizedBox(height: 12),
              Text(l10n.commonCalendarLinkedMatter, style: Theme.of(context).textTheme.labelMedium),
              TextField(controller: _matterSearchCtrl, decoration: InputDecoration(labelText: l10n.commonCalendarSearchMatters),
                onChanged: (_) { _matterSearchTimer?.cancel(); _matterSearchTimer = Timer(const Duration(milliseconds: 300), () => unawaited(_loadMatters())); }),
              FormDropdown<String?>(value: _matterId, items: [
                DropdownMenuItem<String?>(value: null, child: Text(l10n.commonNone)),
                if (_matterId != null && !_matters.any((matter) => matter.id == _matterId))
                  DropdownMenuItem<String?>(value: _matterId, child: Text(_selectedMatterTitle ?? l10n.commonCalendarLinkedMatter)),
                ..._matters.map((matter) => DropdownMenuItem<String?>(value: matter.id, child: Text(matter.title))),
              ], onChanged: _loadingMatters ? null : (value) {
                final matches = _matters.where((matter) => matter.id == value);
                setState(() { _matterId = value; _selectedMatterTitle = matches.isEmpty ? null : matches.first.title;
                  if (matches.isNotEmpty && matches.first.clientId != null) _clientId = matches.first.clientId; });
              }),
              if (_matterLoadError) TextButton(onPressed: () => unawaited(_loadMatters()), child: Text(l10n.commonCalendarMattersUnavailable)),
              const SizedBox(height: 12),
              Text(l10n.commonCalendarReminder, style: Theme.of(context).textTheme.labelMedium),
              FormDropdown<int?>(value: _reminderMinutes, items: [
                DropdownMenuItem<int?>(value: null, child: Text(l10n.commonCalendarReminderOff)),
                DropdownMenuItem<int?>(value: 0, child: Text(l10n.commonCalendarReminderAtStart)),
                ...[15, 30, 60, 1440].map((minutes) => DropdownMenuItem<int?>(value: minutes, child: Text(l10n.commonCalendarReminderMinutes(minutes.toString())))),
                if (_reminderMinutes != null && ![0, 15, 30, 60, 1440].contains(_reminderMinutes))
                  DropdownMenuItem<int?>(value: _reminderMinutes, child: Text(l10n.commonCalendarReminderMinutes(_reminderMinutes!.toString()))),
              ], onChanged: (value) => setState(() => _reminderMinutes = value)),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionCtrl,
                decoration: InputDecoration(
                  labelText: l10n.commonDescription,
                  border: const OutlineInputBorder(),
                ),
                minLines: 2,
                maxLines: 4,
              ),
              const SizedBox(height: 12),
              _DateTimeRow(
                dateLabel: l10n.commonStartDate,
                timeLabel: l10n.commonStartTime,
                date: _startDate,
                time: _startTime,
                onPickDate: () => _pickDate(
                  initial: _startDate,
                  onChanged: (value) => setState(() => _startDate = value),
                ),
                onPickTime: () => _pickTime(
                  initial: _startTime,
                  onChanged: (value) => setState(() => _startTime = value),
                ),
              ),
              const SizedBox(height: 12),
              _DateTimeRow(
                dateLabel: l10n.commonEndDate,
                timeLabel: l10n.commonEndTime,
                date: _endDate,
                time: _endTime,
                onPickDate: () => _pickDate(
                  initial: _endDate,
                  onChanged: (value) => setState(() => _endDate = value),
                ),
                onPickTime: () => _pickTime(
                  initial: _endTime,
                  onChanged: (value) => setState(() => _endTime = value),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: AppColors.destructiveLight),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_isEditing ? l10n.commonSave : l10n.commonCreateEvent),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DateTimeRow extends StatelessWidget {
  const _DateTimeRow({
    required this.dateLabel,
    required this.timeLabel,
    required this.date,
    required this.time,
    required this.onPickDate,
    required this.onPickTime,
  });

  final String dateLabel;
  final String timeLabel;
  final DateTime date;
  final TimeOfDay time;
  final VoidCallback onPickDate;
  final VoidCallback onPickTime;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: onPickDate,
            borderRadius: BorderRadius.circular(8),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: dateLabel,
                border: const OutlineInputBorder(),
              ),
              child: Text(DateFormat('MMM d, yyyy').format(date)),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: InkWell(
            onTap: onPickTime,
            borderRadius: BorderRadius.circular(8),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: timeLabel,
                border: const OutlineInputBorder(),
              ),
              child: Text(time.format(context)),
            ),
          ),
        ),
      ],
    );
  }
}
