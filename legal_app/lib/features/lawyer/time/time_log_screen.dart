import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';

final timeEntriesProvider = FutureProvider<List<AppTimeEntry>>((ref) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(timeApiProvider).listEntries(tenantId: tenantId);
});

class TimeLogScreen extends ConsumerWidget {
  const TimeLogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final entriesAsync = ref.watch(timeEntriesProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.commonTimeLog),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(timeEntriesProvider),
          ),
        ],
      ),
      body: entriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AppErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(timeEntriesProvider),
        ),
        data: (entries) {
          if (entries.isEmpty) {
            return AppEmptyState(
              icon: Icons.schedule_outlined,
              label: 'No time entries yet',
              sublabel: 'Log time against matters to track billable hours.',
            );
          }

          final totalMinutes = entries.fold<int>(0, (sum, e) => sum + e.minutes);
          final totalHours = (totalMinutes / 60).toStringAsFixed(1);
          final billable = entries.where((e) => e.status == 'APPROVED' || e.status == 'PENDING').fold<int>(0, (sum, e) => sum + e.minutes);
          final billableHours = (billable / 60).toStringAsFixed(1);

          final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
          final border = isDark ? AppColors.borderDark : AppColors.borderLight;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(timeEntriesProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                // Summary banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _SummaryCell(
                          label: 'Total hours',
                          value: totalHours,
                          color: const Color(0xFF226FEF),
                        ),
                      ),
                      Container(width: 1, height: 40, color: border),
                      Expanded(
                        child: _SummaryCell(
                          label: 'Billable',
                          value: billableHours,
                          color: const Color(0xFF10B981),
                        ),
                      ),
                      Container(width: 1, height: 40, color: border),
                      Expanded(
                        child: _SummaryCell(
                          label: 'Entries',
                          value: '${entries.length}',
                          color: const Color(0xFFF59E0B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ...entries.map((entry) => _TimeEntryCard(entry: entry)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight,
          ),
        ),
      ],
    );
  }
}

class _TimeEntryCard extends StatelessWidget {
  const _TimeEntryCard({required this.entry});

  final AppTimeEntry entry;

  Color _statusColor(String status) {
    switch (status) {
      case 'APPROVED':
        return const Color(0xFF10B981);
      case 'REJECTED':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final textColor = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedColor = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final sColor = _statusColor(entry.status);
    final hours = (entry.minutes / 60).toStringAsFixed(1);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF226FEF).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  hours,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF226FEF),
                  ),
                ),
                Text(
                  'hrs',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF226FEF),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.narrative ?? 'No description',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: entry.narrative != null ? textColor : mutedColor,
                    fontStyle: entry.narrative != null ? FontStyle.normal : FontStyle.italic,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: sColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        entry.status,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: sColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${entry.minutes} min',
                      style: TextStyle(fontSize: 11, color: mutedColor),
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
