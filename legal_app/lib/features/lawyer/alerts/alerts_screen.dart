import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

final alertsProvider = FutureProvider<List<AppAlert>>((ref) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(alertsApiProvider).listAlerts(tenantId: tenantId);
});

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final alertsAsync = ref.watch(alertsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.commonAlerts),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(alertsProvider),
          ),
        ],
      ),
      body: alertsAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: AppListSkeleton(itemCount: 6),
        ),
        error: (error, _) => AppErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(alertsProvider),
        ),
        data: (alerts) {
          final filtered = _filter == 'all'
              ? alerts
              : alerts.where((a) =>
                  (a.severity ?? 'INFO').toLowerCase() == _filter).toList();

          final filterOptions = [
            AppFilterOption(id: 'all', label: 'All', count: alerts.length),
            for (final sev in ['critical', 'high', 'medium', 'low'])
              if (alerts.any((a) =>
                  (a.severity ?? '').toLowerCase() == sev))
                AppFilterOption(
                  id: sev,
                  label: sev[0].toUpperCase() + sev.substring(1),
                  count: alerts
                      .where((a) =>
                          (a.severity ?? '').toLowerCase() == sev)
                      .length,
                ),
          ];

          return Column(
            children: [
              AppPageHeader(
                title: l10n.commonAlerts,
                count: alerts.length,
                padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
              ),
              if (filterOptions.length > 1)
                AppFilterBar(
                  options: filterOptions,
                  selected: _filter,
                  onSelected: (id) => setState(() => _filter = id),
                ),
              Expanded(
                child: filtered.isEmpty
                    ? AppEmptyState(
                        icon: Icons.check_circle_outline_rounded,
                        label: 'All clear',
                        sublabel:
                            'No active alerts. Deadlines and matter events will appear here.',
                      )
                    : RefreshIndicator(
                        onRefresh: () async =>
                            ref.invalidate(alertsProvider),
                        child: ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(16, 8, 16, 96),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) =>
                              _AlertCard(alert: filtered[i]),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});

  final AppAlert alert;

  Color _severityColor(String? severity) {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return const Color(0xFFEF4444);
      case 'MEDIUM':
        return const Color(0xFFF59E0B);
      case 'LOW':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF226FEF);
    }
  }

  IconData _severityIcon(String? severity) {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return Icons.error_outline_rounded;
      case 'MEDIUM':
        return Icons.warning_amber_rounded;
      case 'LOW':
        return Icons.info_outline_rounded;
      default:
        return Icons.notifications_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final textColor = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedColor = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final sColor = _severityColor(alert.severity);
    final resolved = alert.status == 'RESOLVED' || alert.status == 'DISMISSED';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: resolved ? border : sColor.withValues(alpha: 0.3)),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: resolved ? mutedColor.withValues(alpha: 0.3) : sColor,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: (resolved ? mutedColor : sColor).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _severityIcon(alert.severity),
                        color: resolved ? mutedColor : sColor,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            alert.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: resolved
                                  ? textColor.withValues(alpha: 0.5)
                                  : textColor,
                              decoration: resolved ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          if (alert.message != null && alert.message!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              alert.message!,
                              style: TextStyle(fontSize: 12, color: mutedColor),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              if (alert.severity != null)
                                _Chip(
                                  label: alert.severity!,
                                  color: resolved ? mutedColor : sColor,
                                ),
                              const SizedBox(width: 6),
                              _Chip(
                                label: alert.status,
                                color: mutedColor,
                              ),
                            ],
                          ),
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
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
