import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

// ─── Model ───────────────────────────────────────────────────────────────────

class _InboxMsg {
  const _InboxMsg({
    required this.id,
    required this.subject,
    required this.body,
    required this.from,
    required this.type,
    required this.isRead,
    required this.createdAt,
  });

  // ignore: unused_element
  factory _InboxMsg.fromJson(Map<String, dynamic> json) => _InboxMsg(
        id: json['id'] as String? ?? '',
        subject: json['subject'] as String? ?? '(No subject)',
        body: json['body'] as String? ?? '',
        from: json['from'] as String? ?? 'System',
        type: json['type'] as String? ?? 'NOTIFICATION',
        isRead: json['isRead'] as bool? ?? false,
        createdAt: json['createdAt'] as String? ?? '',
      );

  final String id;
  final String subject;
  final String body;
  final String from;
  final String type;
  final bool isRead;
  final String createdAt;
}

// ─── Provider ────────────────────────────────────────────────────────────────

// Inbox returns empty for now – real backend endpoint wires in later.
final _inboxProvider = FutureProvider.autoDispose<List<_InboxMsg>>(
  (_) async => const [],
);

// ─── Screen ──────────────────────────────────────────────────────────────────

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  String _filter = 'ALL';

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All'),
    AppFilterOption(id: 'UNREAD', label: 'Unread'),
    AppFilterOption(id: 'CLIENT', label: 'From Clients'),
    AppFilterOption(id: 'SYSTEM', label: 'System'),
    AppFilterOption(id: 'ALERT', label: 'Alerts'),
  ];

  @override
  Widget build(BuildContext context) {
    final inboxAsync = ref.watch(_inboxProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(_inboxProvider.future),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: inboxAsync.maybeWhen(
                data: (msgs) => AppPageHeader(
                  title: 'Inbox',
                  subtitle:
                      '${msgs.where((m) => !m.isRead).length} unread',
                ),
                orElse: () => const AppPageHeader(title: 'Inbox'),
              ),
            ),
            SliverToBoxAdapter(
              child: AppFilterBar(
                options: _filterOptions,
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
              ),
            ),
            inboxAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 8),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: AppErrorView(
                  message: e.toString(),
                  onRetry: () => ref.refresh(_inboxProvider.future),
                ),
              ),
              data: (messages) {
                var filtered = messages;
                switch (_filter) {
                  case 'UNREAD':
                    filtered = messages.where((m) => !m.isRead).toList();
                  case 'CLIENT':
                    filtered =
                        messages.where((m) => m.type == 'CLIENT').toList();
                  case 'SYSTEM':
                    filtered = messages
                        .where((m) =>
                            m.type == 'SYSTEM' ||
                            m.type == 'NOTIFICATION')
                        .toList();
                  case 'ALERT':
                    filtered =
                        messages.where((m) => m.type == 'ALERT').toList();
                }

                if (filtered.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.inbox_outlined,
                      label: 'Inbox is empty',
                      sublabel:
                          'All messages and notifications will appear here.',
                    ),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _InboxTile(message: filtered[i]),
                    childCount: filtered.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}

// ─── Tile ────────────────────────────────────────────────────────────────────

class _InboxTile extends StatelessWidget {
  const _InboxTile({required this.message});
  final _InboxMsg message;

  IconData _iconForType(String type) {
    switch (type) {
      case 'CLIENT':
        return Icons.person_outline;
      case 'ALERT':
        return Icons.warning_amber_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color _colorForType(BuildContext context, String type) {
    final cs = Theme.of(context).colorScheme;
    switch (type) {
      case 'ALERT':
        return cs.error;
      case 'CLIENT':
        return cs.tertiary;
      default:
        return cs.primary;
    }
  }

  String _formatDate(String dateStr) {
    try {
      final dt = DateTime.parse(dateStr);
      final now = DateTime.now();
      if (dt.day == now.day &&
          dt.month == now.month &&
          dt.year == now.year) {
        return DateFormat.jm().format(dt);
      }
      if (now.difference(dt).inDays < 7) {
        return DateFormat.E().format(dt);
      }
      return DateFormat.MMMd().format(dt);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final typeColor = _colorForType(context, message.type);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Stack(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: typeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _iconForType(message.type),
                color: typeColor,
                size: 20,
              ),
            ),
            if (!message.isRead)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: cs.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: cs.surface, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
        title: Text(
          message.subject,
          style: TextStyle(
            fontWeight: message.isRead ? FontWeight.normal : FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.from,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
            Text(
              message.body,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        trailing: Text(
          _formatDate(message.createdAt),
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
        ),
        isThreeLine: true,
      ),
    );
  }
}
