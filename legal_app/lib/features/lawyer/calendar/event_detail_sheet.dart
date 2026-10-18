import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/calendar_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import 'calendar_helpers.dart';
import 'create_event_sheet.dart';

Future<void> showEventDetailSheet(
  BuildContext context,
  WidgetRef ref, {
  required CalendarEventItem event,
  required VoidCallback onChanged,
}) async {
  final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _EventDetailSheet(
      tenantId: tenantId,
      event: event,
      onChanged: onChanged,
    ),
  );
}

class _EventDetailSheet extends ConsumerStatefulWidget {
  const _EventDetailSheet({
    required this.tenantId,
    required this.event,
    required this.onChanged,
  });

  final String tenantId;
  final CalendarEventItem event;
  final VoidCallback onChanged;

  @override
  ConsumerState<_EventDetailSheet> createState() => _EventDetailSheetState();
}

class _EventDetailSheetState extends ConsumerState<_EventDetailSheet> {
  bool _deleting = false;

  Future<void> _delete() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.commonDelete),
        content: Text('Delete "${widget.event.displayTitle}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.commonDelete),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      await ref.read(calendarApiProvider).deleteEvent(
            tenantId: widget.tenantId,
            eventId: widget.event.id,
          );
      if (mounted) {
        Navigator.pop(context);
        widget.onChanged();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${widget.event.displayTitle} deleted')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.message),
            backgroundColor: AppColors.destructiveLight,
          ),
        );
      }
    }
  }

  Future<void> _edit() async {
    Navigator.pop(context);
    final saved = await showCreateEventSheet(
      context,
      ref,
      existing: widget.event,
    );
    if (saved != null) widget.onChanged();
  }

  String? get _taskId {
    if (widget.event.taskId != null) return widget.event.taskId;
    if (widget.event.id.startsWith('task-')) {
      return widget.event.id.replaceFirst('task-', '');
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final event = widget.event;
    final isTask = event.isSyntheticTaskDeadline;
    final typeColor = calendarEventTypeColor(event.type);
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isTask ? Icons.check_box_outlined : calendarEventTypeIcon(event.type),
                  color: typeColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.displayTitle,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isTask
                          ? 'Task deadline'
                          : calendarEventTypeLabel(l10n, event.type),
                      style: TextStyle(color: muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (event.description != null && event.description!.isNotEmpty) ...[
            Text(event.description!, style: TextStyle(color: muted)),
            const SizedBox(height: 16),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.access_time, size: 18, color: muted),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE, MMMM d, yyyy').format(event.startAt.toLocal()),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    if (!isTask && !event.isAllDay)
                      Text(
                        '${DateFormat('h:mm a').format(event.startAt.toLocal())} – ${DateFormat('h:mm a').format(event.endAt.toLocal())}',
                        style: TextStyle(color: muted, fontSize: 13),
                      ),
                    if (!isTask && event.isAllDay)
                      Text('All day', style: TextStyle(color: muted, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
          if (event.matterId != null) ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                context.push('/lawyer/matters/${event.matterId}');
              },
              icon: const Icon(Icons.folder_outlined, size: 18),
              label: const Text('View matter'),
            ),
          ],
          if (isTask) ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                final taskId = _taskId;
                if (taskId != null) {
                  context.push('/lawyer/tasks?highlight=$taskId');
                } else {
                  context.push('/lawyer/tasks');
                }
              },
              icon: const Icon(Icons.checklist_rtl, size: 18),
              label: const Text('Open in Tasks'),
            ),
          ],
          if (!isTask) ...[
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _deleting ? null : _edit,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: Text(l10n.commonEdit),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _deleting ? null : _delete,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.destructiveLight,
                    ),
                    icon: _deleting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.delete_outline, size: 18),
                    label: Text(l10n.commonDelete),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
