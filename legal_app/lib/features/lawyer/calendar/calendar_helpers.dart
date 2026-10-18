import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/network/calendar_api.dart';
import '../../../l10n/app_localizations.dart';

const calendarEventTypeValues = [
  'Meeting',
  'Hearing',
  'Deadline',
  'Appointment',
  'Other',
];

String calendarEventTypeLabel(AppLocalizations l10n, String? type) {
  switch (CalendarEventItem(
    id: '',
    title: '',
    startAt: DateTime.now(),
    endAt: DateTime.now(),
    type: type,
  ).normalizedType) {
    case 'MEETING':
      return l10n.commonMeeting;
    case 'COURT_DATE':
      return l10n.commonHearing;
    case 'DEADLINE':
      return l10n.commonDeadline;
    case 'APPOINTMENT':
      return l10n.commonAppointment;
    default:
      return l10n.commonOther;
  }
}

Color calendarEventTypeColor(String? type) {
  switch (CalendarEventItem(
    id: '',
    title: '',
    startAt: DateTime.now(),
    endAt: DateTime.now(),
    type: type,
  ).normalizedType) {
    case 'COURT_DATE':
      return const Color(0xFFEF4444);
    case 'DEADLINE':
      return const Color(0xFFF59E0B);
    case 'MEETING':
      return const Color(0xFF226FEF);
    case 'APPOINTMENT':
      return const Color(0xFF10B981);
    default:
      return const Color(0xFF64748B);
  }
}

IconData calendarEventTypeIcon(String? type) {
  switch (CalendarEventItem(
    id: '',
    title: '',
    startAt: DateTime.now(),
    endAt: DateTime.now(),
    type: type,
  ).normalizedType) {
    case 'COURT_DATE':
      return Icons.gavel;
    case 'DEADLINE':
      return Icons.warning_amber;
    case 'MEETING':
      return Icons.people_outline;
    case 'APPOINTMENT':
      return Icons.event_available_outlined;
    default:
      return Icons.event;
  }
}

extension CalendarEventItemX on CalendarEventItem {
  bool get isSyntheticTaskDeadline =>
      isTaskDeadline || id.startsWith('task-') || taskId != null;

  String get displayTitle =>
      isSyntheticTaskDeadline ? title.replaceFirst(RegExp(r'^📋\s*'), '') : title;
}

CalendarEventItem calendarEventFromTask(LawyerTask task) {
  final due = task.dueDate!;
  return CalendarEventItem(
    id: 'task-${task.id}',
    title: '📋 ${task.title}',
    startAt: due,
    endAt: due,
    matterId: task.matterId,
    taskId: task.id,
    type: 'DEADLINE',
    isTaskDeadline: true,
  );
}

List<CalendarEventItem> mergeCalendarEventsWithTasks({
  required List<CalendarEventItem> events,
  required List<LawyerTask> tasks,
  required bool showTasks,
}) {
  if (!showTasks) return List<CalendarEventItem>.from(events);

  final serverTaskIds = events
      .where((event) => event.taskId != null)
      .map((event) => event.taskId!)
      .toSet();
  final merged = List<CalendarEventItem>.from(events);

  for (final task in tasks) {
    if (task.dueDate == null) continue;
    if (serverTaskIds.contains(task.id)) continue;
    final status = task.status.toUpperCase();
    if (status == 'DONE' || status == 'COMPLETED') continue;
    merged.add(calendarEventFromTask(task));
  }

  merged.sort((a, b) => a.startAt.compareTo(b.startAt));
  return merged;
}
