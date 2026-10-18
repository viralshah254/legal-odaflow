import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

// ─── Models ─────────────────────────────────────────────────────────────────

class MonitorHit {
  final String id;
  final String title;
  final String? aiSummary;
  final String severity;
  final double relevanceScore;
  final String status;
  final DateTime createdAt;

  const MonitorHit({
    required this.id,
    required this.title,
    this.aiSummary,
    required this.severity,
    required this.relevanceScore,
    required this.status,
    required this.createdAt,
  });

  factory MonitorHit.fromJson(Map<String, dynamic> json) => MonitorHit(
        id: json['id'] as String,
        title: json['title'] as String,
        aiSummary: json['aiSummary'] as String?,
        severity: json['severity'] as String? ?? 'INFO',
        relevanceScore: (json['relevanceScore'] as num?)?.toDouble() ?? 0.5,
        status: json['status'] as String? ?? 'NEW',
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class Monitor {
  final String id;
  final String name;
  final String jurisdiction;
  final List<String> topics;
  final String frequency;
  final bool isActive;
  final int newHitCount;
  final int totalHitCount;
  final DateTime? lastRunAt;

  const Monitor({
    required this.id,
    required this.name,
    required this.jurisdiction,
    required this.topics,
    required this.frequency,
    required this.isActive,
    required this.newHitCount,
    required this.totalHitCount,
    this.lastRunAt,
  });

  factory Monitor.fromJson(Map<String, dynamic> json) => Monitor(
        id: json['id'] as String,
        name: json['name'] as String,
        jurisdiction: json['jurisdiction'] as String? ?? '',
        topics: (json['topics'] as List<dynamic>?)?.cast<String>() ?? [],
        frequency: json['frequency'] as String? ?? 'DAILY',
        isActive: json['isActive'] as bool? ?? true,
        newHitCount: json['newHitCount'] as int? ?? 0,
        totalHitCount: json['totalHitCount'] as int? ?? 0,
        lastRunAt: json['lastRunAt'] != null
            ? DateTime.parse(json['lastRunAt'] as String)
            : null,
      );
}

// ─── Providers ───────────────────────────────────────────────────────────────

final monitorsProvider = FutureProvider.autoDispose<List<Monitor>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';

  final resp = await api.dio.get<dynamic>(
    '/monitors',
    options: tenantId.isNotEmpty ? Options(headers: {'X-Tenant-Id': tenantId}) : null,
  );

  final list = resp.data as List<dynamic>;
  return list
      .cast<Map<String, dynamic>>()
      .map(Monitor.fromJson)
      .toList();
});

final monitorHitsProvider =
    FutureProvider.autoDispose.family<List<MonitorHit>, String>((ref, monitorId) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';

  final resp = await api.dio.get<dynamic>(
    '/monitors/$monitorId/hits',
    options: tenantId.isNotEmpty ? Options(headers: {'X-Tenant-Id': tenantId}) : null,
  );

  final list = resp.data as List<dynamic>;
  return list
      .cast<Map<String, dynamic>>()
      .map(MonitorHit.fromJson)
      .toList();
});

/// Returns { totalUnread, criticalCount, warningCount, infoCount }
final monitorsSummaryProvider =
    FutureProvider.autoDispose<Map<String, int>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  try {
    final resp = await api.dio.get<dynamic>(
      '/monitors',
      queryParameters: {'summary': 'true'},
      options: tenantId.isNotEmpty
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    final data = resp.data as Map<String, dynamic>? ?? {};
    return {
      'criticalCount': (data['criticalCount'] as num?)?.toInt() ?? 0,
      'warningCount': (data['warningCount'] as num?)?.toInt() ?? 0,
      'infoCount': (data['infoCount'] as num?)?.toInt() ?? 0,
      'totalUnread': (data['totalUnread'] as num?)?.toInt() ?? 0,
    };
  } catch (_) {
    return {};
  }
});

// ─── Monitors List Screen ────────────────────────────────────────────────────

class MonitorsScreen extends ConsumerWidget {
  const MonitorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final monitorsAsync = ref.watch(monitorsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Regulatory Monitors'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(monitorsProvider),
          ),
        ],
      ),
      body: monitorsAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: AppListSkeleton(itemCount: 5),
        ),
        error: (err, _) => AppErrorView(
          message: err.toString(),
          onRetry: () => ref.invalidate(monitorsProvider),
        ),
        data: (monitors) {
          if (monitors.isEmpty) {
            return const AppEmptyState(
              icon: Icons.radar_rounded,
              label: 'No monitors yet',
              sublabel:
                  'Set up regulatory monitors in the web app to track changes here.',
            );
          }

          return Column(
            children: [
              AppPageHeader(
                title: 'Regulatory Monitors',
                count: monitors.length,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => ref.invalidate(monitorsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    itemCount: monitors.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final m = monitors[i];
                      return _MonitorCard(
                        monitor: m,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => MonitorDetailScreen(monitor: m),
                            ),
                          );
                        },
                      );
                    },
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

class _MonitorCard extends StatelessWidget {
  final Monitor monitor;
  final VoidCallback onTap;

  const _MonitorCard({required this.monitor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasNew = monitor.newHitCount > 0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.radar_rounded,
                    size: 18,
                    color: monitor.isActive
                        ? theme.colorScheme.primary
                        : Colors.grey,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      monitor.name,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (hasNew)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${monitor.newHitCount} new',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _InfoChip(label: monitor.jurisdiction),
                  const SizedBox(width: 6),
                  _InfoChip(label: monitor.frequency.toLowerCase()),
                  const SizedBox(width: 6),
                  _InfoChip(
                      label: monitor.isActive ? 'active' : 'paused',
                      isActive: monitor.isActive),
                ],
              ),
              if (monitor.topics.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  monitor.topics.take(3).join(', ') +
                      (monitor.topics.length > 3 ? ' +${monitor.topics.length - 3}' : ''),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.grey[600]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String label;
  final bool? isActive;

  const _InfoChip({required this.label, this.isActive});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isActiveMonitor = isActive == true;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isActiveMonitor
            ? theme.colorScheme.primary.withValues(alpha:0.1)
            : theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: isActiveMonitor ? theme.colorScheme.primary : null,
          fontWeight: isActiveMonitor ? FontWeight.w600 : null,
        ),
      ),
    );
  }
}

// ─── Monitor Detail Screen ───────────────────────────────────────────────────

class MonitorDetailScreen extends ConsumerWidget {
  final Monitor monitor;

  const MonitorDetailScreen({super.key, required this.monitor});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hitsAsync = ref.watch(monitorHitsProvider(monitor.id));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(monitor.name, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(monitorHitsProvider(monitor.id)),
          ),
        ],
      ),
      body: hitsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Failed to load hits: $err')),
        data: (hits) {
          if (hits.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none_rounded,
                      size: 56,
                      color: theme.colorScheme.primary.withValues(alpha:0.3)),
                  const SizedBox(height: 12),
                  Text('No hits yet',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text('New regulatory changes will appear here.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.grey)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(monitorHitsProvider(monitor.id)),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: hits.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _HitCard(hit: hits[i]),
            ),
          );
        },
      ),
    );
  }
}

class _HitCard extends StatelessWidget {
  final MonitorHit hit;

  const _HitCard({required this.hit});

  Color _severityColor(BuildContext context) {
    return switch (hit.severity) {
      'CRITICAL' => Colors.red,
      'WARNING' => Colors.orange,
      _ => Colors.blueGrey,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _severityColor(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: hit.severity == 'NEW' ? color.withValues(alpha:0.3) : Colors.transparent,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  hit.severity,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${(hit.relevanceScore * 100).round()}% relevant',
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: Colors.grey),
                ),
                const Spacer(),
                if (hit.status == 'NEW')
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary.withValues(alpha:0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('NEW',
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              hit.title,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (hit.aiSummary != null) ...[
              const SizedBox(height: 6),
              Text(
                hit.aiSummary!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: Colors.grey[600]),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 8),
            Text(
              _formatDate(hit.createdAt),
              style:
                  theme.textTheme.labelSmall?.copyWith(color: Colors.grey[500]),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
