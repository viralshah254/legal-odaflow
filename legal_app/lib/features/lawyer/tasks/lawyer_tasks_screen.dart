import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

final lawyerTasksProvider = FutureProvider<List<LawyerTask>>((ref) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(tasksApiProvider).listTasks(tenantId: tenantId);
});

class LawyerTasksScreen extends ConsumerStatefulWidget {
  const LawyerTasksScreen({super.key});

  @override
  ConsumerState<LawyerTasksScreen> createState() => _LawyerTasksScreenState();
}

class _LawyerTasksScreenState extends ConsumerState<LawyerTasksScreen> {
  String _filter = 'all';

  // Optimistically update a task's status without waiting for a network round-trip.
  final Map<String, String> _optimisticStatus = {};

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tasksAsync = ref.watch(lawyerTasksProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.commonTasks),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _optimisticStatus.clear();
              ref.invalidate(lawyerTasksProvider);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('New task'),
      ),
      body: tasksAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: AppListSkeleton(itemCount: 7),
        ),
        error: (error, _) => AppErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(lawyerTasksProvider),
        ),
        data: (tasks) {
          // Apply optimistic status overrides
          final resolved = tasks.map((t) {
            final override = _optimisticStatus[t.id];
            if (override == null) return t;
            return LawyerTask(
              id: t.id,
              title: t.title,
              status: override,
              priority: t.priority,
              matterId: t.matterId,
              dueDate: t.dueDate,
            );
          }).toList();

          // Filter
          final filtered = _filter == 'all'
              ? resolved
              : resolved
                  .where((t) => t.status == _filter.toUpperCase())
                  .toList();

          final todo =
              filtered.where((t) => t.status == 'TODO').toList();
          final inProgress =
              filtered.where((t) => t.status == 'IN_PROGRESS').toList();
          final done = filtered
              .where((t) =>
                  t.status == 'DONE' || t.status == 'COMPLETED')
              .toList();

          // Filter counts from unfiltered resolved list
          final filterOptions = [
            AppFilterOption(id: 'all', label: 'All', count: resolved.length),
            AppFilterOption(
                id: 'todo',
                label: 'To do',
                count: resolved
                    .where((t) => t.status == 'TODO')
                    .length),
            AppFilterOption(
                id: 'in_progress',
                label: 'In progress',
                count: resolved
                    .where((t) => t.status == 'IN_PROGRESS')
                    .length),
            AppFilterOption(
                id: 'done',
                label: 'Done',
                count: resolved
                    .where((t) =>
                        t.status == 'DONE' || t.status == 'COMPLETED')
                    .length),
          ];

          return Column(
            children: [
              AppPageHeader(
                title: l10n.commonTasks,
                count: resolved.length,
                padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
              ),
              AppFilterBar(
                options: filterOptions,
                selected: _filter,
                onSelected: (id) => setState(() => _filter = id),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? AppEmptyState(
                        icon: Icons.checklist_rounded,
                        label: 'No tasks',
                        sublabel: _filter == 'all'
                            ? 'Tap + to create your first task.'
                            : 'No tasks in this category.',
                        action: _filter == 'all'
                            ? FilledButton.icon(
                                onPressed: () =>
                                    _showCreateSheet(context),
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('New task'),
                              )
                            : null,
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          _optimisticStatus.clear();
                          ref.invalidate(lawyerTasksProvider);
                        },
                        child: ListView(
                          padding:
                              const EdgeInsets.fromLTRB(16, 8, 16, 120),
                          children: [
                            if (inProgress.isNotEmpty) ...[
                              _SectionHeader(
                                label: 'In Progress',
                                count: inProgress.length,
                                color: const Color(0xFF226FEF),
                              ),
                              ...inProgress.map(
                                (t) => _TaskCard(
                                  task: t,
                                  onStatusTap: () =>
                                      _cycleStatus(t),
                                ),
                              ),
                            ],
                            if (todo.isNotEmpty) ...[
                              _SectionHeader(
                                label: 'To Do',
                                count: todo.length,
                                color: const Color(0xFFF59E0B),
                              ),
                              ...todo.map(
                                (t) => _TaskCard(
                                  task: t,
                                  onStatusTap: () =>
                                      _cycleStatus(t),
                                ),
                              ),
                            ],
                            if (done.isNotEmpty) ...[
                              _SectionHeader(
                                label: 'Done',
                                count: done.length,
                                color: const Color(0xFF10B981),
                              ),
                              ...done.map(
                                (t) => _TaskCard(
                                  task: t,
                                  muted: true,
                                  onStatusTap: () =>
                                      _cycleStatus(t),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _cycleStatus(LawyerTask task) async {
    final next = switch (task.status) {
      'TODO' => 'IN_PROGRESS',
      'IN_PROGRESS' => 'DONE',
      _ => 'TODO',
    };
    setState(() => _optimisticStatus[task.id] = next);
    try {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;
      if (tenantId == null) return;
      await ref.read(tasksApiProvider).updateTaskStatus(
            tenantId: tenantId,
            taskId: task.id,
            status: next,
          );
      if (!mounted) return;
      ref.invalidate(lawyerTasksProvider);
    } catch (_) {
      if (!mounted) return;
      setState(() => _optimisticStatus.remove(task.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to update status')),
      );
    }
  }

  void _showCreateSheet(BuildContext context) {
    final titleCtrl = TextEditingController();
    String priority = 'MEDIUM';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? AppColors.logoBlueSurface
          : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            24, 20, 24, MediaQuery.of(ctx).viewInsets.bottom + 32),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.mutedForegroundDark.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text('New task',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Task title',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppColors.radius),
                  ),
                ),
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 16),
              Text('Priority',
                  style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final p in ['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(p[0] + p.substring(1).toLowerCase()),
                        selected: priority == p,
                        onSelected: (_) =>
                            setSheetState(() => priority = p),
                        selectedColor: _priorityColor(p).withValues(alpha: 0.2),
                        labelStyle: TextStyle(
                          color: priority == p
                              ? _priorityColor(p)
                              : null,
                          fontWeight: priority == p
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    final title = titleCtrl.text.trim();
                    if (title.isEmpty) return;
                    Navigator.pop(ctx);
                    final messenger = ScaffoldMessenger.of(context);
                    try {
                      final tenantId = ref
                          .read(authControllerProvider)
                          .session
                          ?.user
                          .tenantId;
                      if (tenantId == null) return;
                      await ref.read(tasksApiProvider).createTask(
                            tenantId: tenantId,
                            title: title,
                            priority: priority,
                          );
                      if (!mounted) return;
                      ref.invalidate(lawyerTasksProvider);
                    } catch (_) {
                      messenger.showSnackBar(
                        const SnackBar(
                            content: Text('Failed to create task')),
                      );
                    }
                  },
                  child: const Text('Create task'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _priorityColor(String p) => switch (p) {
        'HIGH' || 'URGENT' => const Color(0xFFEF4444),
        'MEDIUM' => const Color(0xFFF59E0B),
        _ => const Color(0xFF10B981),
      };
}

// ─── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(
      {required this.label, required this.count, required this.color});

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 16,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppColors.foregroundDark
                  : AppColors.foregroundLight,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Task card ─────────────────────────────────────────────────────────────────

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.onStatusTap,
    this.muted = false,
  });

  final LawyerTask task;
  final VoidCallback onStatusTap;
  final bool muted;

  Color _priorityColor(String p) => switch (p) {
        'HIGH' || 'URGENT' => const Color(0xFFEF4444),
        'MEDIUM' => const Color(0xFFF59E0B),
        _ => const Color(0xFF10B981),
      };

  IconData _statusIcon(String s) => switch (s) {
        'IN_PROGRESS' => Icons.radio_button_checked,
        'DONE' || 'COMPLETED' => Icons.check_circle,
        _ => Icons.radio_button_unchecked,
      };

  Color _statusIconColor(String s) => switch (s) {
        'IN_PROGRESS' => const Color(0xFF226FEF),
        'DONE' || 'COMPLETED' => const Color(0xFF10B981),
        _ => AppColors.mutedForegroundDark,
      };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final textColor = (isDark
            ? AppColors.foregroundDark
            : AppColors.foregroundLight)
        .withValues(alpha: muted ? 0.5 : 1.0);
    final mutedColor = isDark
        ? AppColors.mutedForegroundDark
        : AppColors.mutedForegroundLight;
    final pColor = _priorityColor(task.priority);
    final isOverdue = task.dueDate != null &&
        task.dueDate!.isBefore(DateTime.now()) &&
        !muted;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(8, 12, 14, 12),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isOverdue
              ? const Color(0xFFEF4444).withValues(alpha: 0.4)
              : border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status toggle button
          IconButton(
            onPressed: onStatusTap,
            icon: Icon(
              _statusIcon(task.status),
              color: _statusIconColor(task.status),
              size: 22,
            ),
            tooltip: 'Cycle status',
            padding: const EdgeInsets.fromLTRB(4, 0, 8, 0),
            constraints: const BoxConstraints(),
          ),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                    decoration: muted ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _Chip(label: task.priority, color: pColor),
                    if (task.dueDate != null)
                      _Chip(
                        label: isOverdue
                            ? 'Overdue · ${DateFormat('MMM d').format(task.dueDate!)}'
                            : 'Due ${DateFormat('MMM d').format(task.dueDate!)}',
                        color: isOverdue
                            ? const Color(0xFFEF4444)
                            : mutedColor,
                        icon: isOverdue ? Icons.schedule : null,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: color),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}
