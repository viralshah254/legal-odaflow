import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/models.dart';
import '../../../core/network/calendar_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/lawyer_shell_scope.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import 'calendar_helpers.dart';
import 'create_event_sheet.dart';
import 'event_detail_sheet.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  List<CalendarEventItem> _events = [];
  bool _loading = true;
  String? _error;
  DateTime _focusedMonth = DateTime.now();
  DateTime? _selectedDay;
  bool _showTasks = true;

  @override
  void initState() {
    super.initState();
    _selectedDay = DateTime.now();
    _load();
  }

  Future<void> _load() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'No active tenant';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final from = DateTime.now().subtract(const Duration(days: 30));
      final to = DateTime.now().add(const Duration(days: 90));
      final results = await Future.wait([
        ref.read(calendarApiProvider).listEvents(
              tenantId: tenantId,
              from: from,
              to: to,
            ),
        ref.read(tasksApiProvider).listTasks(tenantId: tenantId),
      ]);

      final events = results[0] as List<CalendarEventItem>;
      final tasks = results[1] as List<LawyerTask>;

      setState(() {
        _events = mergeCalendarEventsWithTasks(
          events: events,
          tasks: tasks,
          showTasks: _showTasks,
        );
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<CalendarEventItem> get _eventsForSelected {
    if (_selectedDay == null) return [];
    return _events.where((event) {
      final start = event.startAt.toLocal();
      return start.year == _selectedDay!.year &&
          start.month == _selectedDay!.month &&
          start.day == _selectedDay!.day;
    }).toList();
  }

  Map<DateTime, List<CalendarEventItem>> get _eventsByDay {
    final map = <DateTime, List<CalendarEventItem>>{};
    for (final event in _events) {
      final start = event.startAt.toLocal();
      final day = DateTime(start.year, start.month, start.day);
      map.putIfAbsent(day, () => []).add(event);
    }
    return map;
  }

  void _previousMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
    });
  }

  Future<void> _openCreateSheet() async {
    final saved = await showCreateEventSheet(
      context,
      ref,
      initialDate: _selectedDay,
    );
    if (saved != null) await _load();
  }

  Future<void> _openEventDetail(CalendarEventItem event) async {
    await showEventDetailSheet(
      context,
      ref,
      event: event,
      onChanged: _load,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final accent = AppColors.logoAccent;
    final mutedFg =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final fg = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final eventsByDay = _eventsByDay;

    final firstDay = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final lastDay = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0);
    final startWeekday = firstDay.weekday % 7;
    final totalCells = startWeekday + lastDay.day;
    final rows = (totalCells / 7).ceil();

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: const LawyerMenuButton(),
        title: Text(l10n.commonCalendar),
        actions: [
          IconButton(
            tooltip: _showTasks ? 'Hide tasks' : 'Show tasks',
            onPressed: () {
              setState(() => _showTasks = !_showTasks);
              _load();
            },
            icon: Icon(
              _showTasks ? Icons.check_box_outlined : Icons.check_box_outline_blank,
            ),
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                      child: Container(
                        decoration: BoxDecoration(
                          color: surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: border),
                        ),
                        child: Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 8,
                              ),
                              child: Row(
                                children: [
                                  IconButton(
                                    onPressed: _previousMonth,
                                    icon: const Icon(Icons.chevron_left),
                                    splashRadius: 20,
                                  ),
                                  Expanded(
                                    child: Text(
                                      DateFormat('MMMM yyyy').format(_focusedMonth),
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: fg,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: _nextMonth,
                                    icon: const Icon(Icons.chevron_right),
                                    splashRadius: 20,
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Row(
                                children: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                                    .map(
                                      (day) => Expanded(
                                        child: Center(
                                          child: Text(
                                            day,
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: mutedFg,
                                            ),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                              child: Column(
                                children: List.generate(rows, (rowIdx) {
                                  return Row(
                                    children: List.generate(7, (colIdx) {
                                      final cellIdx = rowIdx * 7 + colIdx;
                                      final dayNum = cellIdx - startWeekday + 1;
                                      if (dayNum < 1 || dayNum > lastDay.day) {
                                        return const Expanded(
                                          child: SizedBox(height: 44),
                                        );
                                      }
                                      final day = DateTime(
                                        _focusedMonth.year,
                                        _focusedMonth.month,
                                        dayNum,
                                      );
                                      final isToday = day == today;
                                      final isSelected = _selectedDay != null &&
                                          day.year == _selectedDay!.year &&
                                          day.month == _selectedDay!.month &&
                                          day.day == _selectedDay!.day;
                                      final dayEvents = eventsByDay[day] ?? [];
                                      final hasEvent = dayEvents.isNotEmpty;
                                      final eventColors = dayEvents
                                          .take(3)
                                          .map((event) =>
                                              calendarEventTypeColor(event.type))
                                          .toList();

                                      return Expanded(
                                        child: GestureDetector(
                                          onTap: () =>
                                              setState(() => _selectedDay = day),
                                          child: Container(
                                            height: 48,
                                            margin: const EdgeInsets.all(2),
                                            decoration: BoxDecoration(
                                              color: isSelected
                                                  ? accent
                                                  : isToday
                                                      ? accent.withValues(alpha: 0.12)
                                                      : null,
                                              borderRadius: BorderRadius.circular(10),
                                              border: isToday && !isSelected
                                                  ? Border.all(
                                                      color: accent.withValues(
                                                        alpha: 0.4,
                                                      ),
                                                      width: 1.5,
                                                    )
                                                  : null,
                                            ),
                                            child: Column(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              children: [
                                                Text(
                                                  '$dayNum',
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: isToday || isSelected
                                                        ? FontWeight.w700
                                                        : FontWeight.w400,
                                                    color: isSelected ? Colors.white : fg,
                                                  ),
                                                ),
                                                if (hasEvent)
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(top: 2),
                                                    child: Row(
                                                      mainAxisAlignment:
                                                          MainAxisAlignment.center,
                                                      children: eventColors
                                                          .map(
                                                            (color) => Container(
                                                              width: 5,
                                                              height: 5,
                                                              margin: const EdgeInsets
                                                                  .symmetric(
                                                                horizontal: 1,
                                                              ),
                                                              decoration: BoxDecoration(
                                                                color: isSelected
                                                                    ? Colors.white
                                                                        .withValues(
                                                                        alpha: 0.8,
                                                                      )
                                                                    : color,
                                                                shape: BoxShape.circle,
                                                              ),
                                                            ),
                                                          )
                                                          .toList(),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      );
                                    }),
                                  );
                                }),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_selectedDay != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Row(
                          children: [
                            Text(
                              DateFormat('EEEE, MMMM d').format(_selectedDay!),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: mutedFg,
                              ),
                            ),
                            if (_eventsForSelected.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: accent.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '${_eventsForSelected.length}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: accent,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: _eventsForSelected.isEmpty
                          ? AppEmptyState(
                              icon: Icons.event_available_outlined,
                              label: _selectedDay != null
                                  ? 'No events on ${DateFormat('MMM d').format(_selectedDay!)}'
                                  : 'Select a day',
                              sublabel:
                                  'Tap a day on the calendar to view or add events.',
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                              itemCount: _eventsForSelected.length,
                              itemBuilder: (ctx, i) {
                                final event = _eventsForSelected[i];
                                final eventColor =
                                    calendarEventTypeColor(event.type);
                                return Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: () => _openEventDetail(event),
                                    borderRadius: BorderRadius.circular(12),
                                    child: Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      decoration: BoxDecoration(
                                        color: surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: border),
                                      ),
                                      child: IntrinsicHeight(
                                        child: Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            Container(
                                              width: 4,
                                              decoration: BoxDecoration(
                                                color: eventColor,
                                                borderRadius:
                                                    const BorderRadius.only(
                                                  topLeft: Radius.circular(12),
                                                  bottomLeft: Radius.circular(12),
                                                ),
                                              ),
                                            ),
                                            Expanded(
                                              child: Padding(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 14,
                                                  vertical: 12,
                                                ),
                                                child: Row(
                                                  children: [
                                                    Container(
                                                      width: 38,
                                                      height: 38,
                                                      decoration: BoxDecoration(
                                                        color: eventColor.withValues(
                                                          alpha: 0.1,
                                                        ),
                                                        borderRadius:
                                                            BorderRadius.circular(9),
                                                      ),
                                                      child: Icon(
                                                        event.isSyntheticTaskDeadline
                                                            ? Icons.check_box_outlined
                                                            : calendarEventTypeIcon(
                                                                event.type,
                                                              ),
                                                        color: eventColor,
                                                        size: 18,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment.start,
                                                        children: [
                                                          Text(
                                                            event.title,
                                                            style: TextStyle(
                                                              fontSize: 14,
                                                              fontWeight:
                                                                  FontWeight.w600,
                                                              color: fg,
                                                            ),
                                                          ),
                                                          const SizedBox(height: 4),
                                                          Row(
                                                            children: [
                                                              Icon(
                                                                Icons.access_time,
                                                                size: 11,
                                                                color: mutedFg,
                                                              ),
                                                              const SizedBox(width: 4),
                                                              Text(
                                                                event.isSyntheticTaskDeadline
                                                                    ? 'Task deadline'
                                                                    : event.isAllDay
                                                                        ? 'All day'
                                                                        : '${DateFormat('HH:mm').format(event.startAt.toLocal())} – ${DateFormat('HH:mm').format(event.endAt.toLocal())}',
                                                                style: TextStyle(
                                                                  fontSize: 12,
                                                                  color: mutedFg,
                                                                ),
                                                              ),
                                                            ],
                                                          ),
                                                          if (event.matterTitle !=
                                                              null) ...[
                                                            const SizedBox(height: 2),
                                                            Text(
                                                              event.matterTitle!,
                                                              style: TextStyle(
                                                                fontSize: 11,
                                                                color: mutedFg
                                                                    .withValues(
                                                                  alpha: 0.7,
                                                                ),
                                                              ),
                                                            ),
                                                          ],
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreateSheet,
        child: const Icon(Icons.add),
      ),
    );
  }
}
