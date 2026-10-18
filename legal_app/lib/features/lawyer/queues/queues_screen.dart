import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_page_header.dart';

// ─── Screen ──────────────────────────────────────────────────────────────────

class QueuesScreen extends ConsumerStatefulWidget {
  const QueuesScreen({super.key});

  @override
  ConsumerState<QueuesScreen> createState() => _QueuesScreenState();
}

class _QueuesScreenState extends ConsumerState<QueuesScreen> {
  String _activeQueue = 'All';
  List<OfflineWorkItem> _items = [];
  bool _loading = true;
  Timer? _replayTimer;

  @override
  void initState() {
    super.initState();
    _load();
    // Poll every 30 seconds to replay queued items when online
    _replayTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _replayQueued(),
    );
  }

  @override
  void dispose() {
    _replayTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final items = await OfflineQueue.loadAll();
    if (mounted) {
      setState(() {
        _items = items;
        _loading = false;
      });
    }
  }

  /// Attempt to replay queued/failed items that haven't exceeded max retries.
  Future<void> _replayQueued() async {
    final items = await OfflineQueue.loadAll();
    final pending = items.where(
      (i) =>
          (i.status == OfflineWorkStatus.queued ||
              i.status == OfflineWorkStatus.failed) &&
          i.canRetry,
    );

    final api = ref.read(apiClientProvider);
    for (final item in pending) {
      try {
        await OfflineQueue.updateStatus(item.id, OfflineWorkStatus.uploading);
        if (mounted) setState(() {});

        await _dispatchItem(api, item);
        await OfflineQueue.updateStatus(item.id, OfflineWorkStatus.done);
      } catch (_) {
        await OfflineQueue.incrementRetry(item.id);
        final updated = (await OfflineQueue.loadAll()).firstWhere(
          (i) => i.id == item.id,
          orElse: () => item,
        );
        await OfflineQueue.updateStatus(
          item.id,
          updated.canRetry ? OfflineWorkStatus.failed : OfflineWorkStatus.failed,
        );
      }
    }

    await _load();
  }

  Future<void> _dispatchItem(ApiClient api, OfflineWorkItem item) async {
    switch (item.type) {
      case 'evidence_upload':
        await api.dio.post<dynamic>(
          '/evidence/matters/${item.payload['matterId']}',
          data: item.payload,
        );
      case 'form_submission':
        await api.dio.post<dynamic>(
          '/forms/submissions/${item.payload['submissionId']}/complete',
          data: {'tenantId': item.payload['tenantId']},
        );
      case 'draft_request':
        await api.dio.post<dynamic>(
          '/platform/drafting/workspaces',
          data: item.payload,
        );
      default:
        // Unknown type — mark as failed to avoid infinite retry
        throw UnimplementedError('Unknown queue type: ${item.type}');
    }
  }

  Future<void> _retryItem(OfflineWorkItem item) async {
    final api = ref.read(apiClientProvider);
    await OfflineQueue.updateStatus(item.id, OfflineWorkStatus.uploading);
    await _load();

    try {
      await _dispatchItem(api, item);
      await OfflineQueue.updateStatus(item.id, OfflineWorkStatus.done);
    } catch (e) {
      await OfflineQueue.incrementRetry(item.id);
      await OfflineQueue.updateStatus(item.id, OfflineWorkStatus.failed);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Retry failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
    await _load();
  }

  Future<void> _removeItem(OfflineWorkItem item) async {
    await OfflineQueue.remove(item.id);
    await _load();
  }

  List<String> get _queueNames => [
        'All',
        ..._items.map((i) => i.queue).toSet(),
      ];

  List<OfflineWorkItem> get _filtered => _activeQueue == 'All'
      ? _items
      : _items.where((i) => i.queue == _activeQueue).toList();

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final queued = filtered.where((i) => i.status == OfflineWorkStatus.queued).length;
    final uploading = filtered.where((i) => i.status == OfflineWorkStatus.uploading).length;
    final failed = filtered.where((i) => i.status == OfflineWorkStatus.failed).length;

    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: AppPageHeader(
                    title: 'Work Queue',
                    subtitle: '$queued queued · $uploading uploading · $failed failed',
                  ),
                ),

                if (uploading > 0)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: LinearProgressIndicator(),
                    ),
                  ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        _QueueStat(label: 'Queued', count: queued, color: Colors.blue),
                        const SizedBox(width: 8),
                        _QueueStat(label: 'Failed', count: failed, color: Colors.red),
                        const SizedBox(width: 8),
                        _QueueStat(
                          label: 'Done',
                          count: filtered.where((i) => i.status == OfflineWorkStatus.done).length,
                          color: Colors.green,
                        ),
                      ],
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: AppFilterBar(
                    options: _queueNames
                        .map((q) => AppFilterOption(id: q, label: q))
                        .toList(),
                    selected: _activeQueue,
                    onSelected: (q) => setState(() => _activeQueue = q),
                  ),
                ),

                if (failed > 0)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: TextButton.icon(
                        onPressed: _replayQueued,
                        icon: const Icon(Icons.replay, size: 16),
                        label: Text('Retry $failed failed item${failed != 1 ? 's' : ''}'),
                        style: TextButton.styleFrom(foregroundColor: Colors.red),
                      ),
                    ),
                  ),

                if (filtered.isEmpty)
                  const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.inbox_outlined,
                      label: 'Queue is empty',
                      sublabel: 'Items queued while offline will appear here.',
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _QueueItemCard(
                        item: filtered[i],
                        onRetry: () => _retryItem(filtered[i]),
                        onRemove: () => _removeItem(filtered[i]),
                      ),
                      childCount: filtered.length,
                    ),
                  ),

                const SliverToBoxAdapter(child: SizedBox(height: 40)),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _replayQueued,
        icon: const Icon(Icons.sync),
        label: const Text('Sync'),
      ),
    );
  }
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

class _QueueStat extends StatelessWidget {
  const _QueueStat({
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 22,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueItemCard extends StatelessWidget {
  const _QueueItemCard({
    required this.item,
    required this.onRetry,
    required this.onRemove,
  });
  final OfflineWorkItem item;
  final VoidCallback onRetry;
  final VoidCallback onRemove;

  Color _statusColor(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return switch (item.status) {
      OfflineWorkStatus.uploading => cs.primary,
      OfflineWorkStatus.done => Colors.green,
      OfflineWorkStatus.failed => cs.error,
      _ => cs.outline,
    };
  }

  String get _statusLabel => switch (item.status) {
        OfflineWorkStatus.queued => 'Queued',
        OfflineWorkStatus.uploading => 'Uploading…',
        OfflineWorkStatus.done => 'Done',
        OfflineWorkStatus.failed => 'Failed',
      };

  Color _priorityColor(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return switch (item.priority) {
      'CRITICAL' => cs.error,
      'HIGH' => Colors.orange,
      'MEDIUM' => Colors.blue,
      _ => cs.outline,
    };
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final pColor = _priorityColor(context);
    final sColor = _statusColor(context);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            leading: Container(
              width: 4,
              height: 40,
              decoration: BoxDecoration(
                color: pColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            minLeadingWidth: 4,
            title: Text(
              item.title,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            subtitle: Text(
              item.description,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: sColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: item.status == OfflineWorkStatus.uploading
                  ? SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 2, color: sColor),
                    )
                  : Text(
                      _statusLabel,
                      style: TextStyle(
                        color: sColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                _Tag(label: item.queue, icon: Icons.folder_outlined),
                const SizedBox(width: 8),
                _Tag(label: item.priority, icon: Icons.flag_outlined),
                if (item.clientName != null) ...[
                  const SizedBox(width: 8),
                  _Tag(label: item.clientName!, icon: Icons.person_outlined),
                ],
                const Spacer(),
                if (item.status == OfflineWorkStatus.failed && item.canRetry)
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.replay, size: 14),
                    label: const Text('Retry'),
                    style: TextButton.styleFrom(
                      foregroundColor: cs.error,
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                if (item.status == OfflineWorkStatus.done)
                  IconButton(
                    icon: Icon(Icons.close, size: 16, color: cs.outline),
                    onPressed: onRemove,
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ),
          if (item.retryCount > 0)
            Padding(
              padding: const EdgeInsets.only(left: 16, bottom: 8),
              child: Text(
                'Retry ${item.retryCount}/${OfflineWorkItem.maxRetries}',
                style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(fontSize: 11, color: color)),
      ],
    );
  }
}
