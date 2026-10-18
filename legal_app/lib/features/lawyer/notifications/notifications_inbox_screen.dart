import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';

final notificationsInboxProvider = FutureProvider<List<AppNotification>>((
  ref,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(notificationsApiProvider).listInbox(tenantId: tenantId);
});

class NotificationsInboxScreen extends ConsumerWidget {
  const NotificationsInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final inboxAsync = ref.watch(notificationsInboxProvider);
    final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.commonNotificationsInbox),
        actions: [
          inboxAsync.whenOrNull(
            data: (rows) {
              final unread = rows.where((n) => !n.isRead).length;
              if (unread == 0) return const SizedBox.shrink();
              return TextButton.icon(
                onPressed: tenantId == null
                    ? null
                    : () async {
                        await ref
                            .read(notificationsApiProvider)
                            .markAllRead(tenantId: tenantId);
                        ref.invalidate(notificationsInboxProvider);
                      },
                icon: const Icon(Icons.done_all, size: 16),
                label: Text(l10n.commonMarkAllRead),
              );
            },
          ) ?? const SizedBox.shrink(),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(notificationsInboxProvider),
          ),
        ],
      ),
      body: inboxAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: AppListSkeleton(itemCount: 7, showLeadingIcon: false),
        ),
        error: (error, _) => AppErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(notificationsInboxProvider),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return AppEmptyState(
              icon: Icons.notifications_none_outlined,
              label: 'No notifications',
              sublabel: 'You\'re all caught up. Updates about your matters and firm will appear here.',
            );
          }

          final now = DateTime.now();
          final today = DateTime(now.year, now.month, now.day);
          final todayItems = rows.where((n) {
            if (n.createdAt == null) return false;
            final d = DateTime(n.createdAt!.year, n.createdAt!.month, n.createdAt!.day);
            return d == today;
          }).toList();
          final earlierItems = rows.where((n) {
            if (n.createdAt == null) return true;
            final d = DateTime(n.createdAt!.year, n.createdAt!.month, n.createdAt!.day);
            return d != today;
          }).toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsInboxProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                if (todayItems.isNotEmpty) ...[
                  _SectionLabel(label: 'Today'),
                  ...todayItems.map((n) => _NotificationCard(notification: n, tenantId: tenantId)),
                ],
                if (earlierItems.isNotEmpty) ...[
                  _SectionLabel(label: 'Earlier'),
                  ...earlierItems.map((n) => _NotificationCard(notification: n, tenantId: tenantId)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 0, 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
          color: isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight,
        ),
      ),
    );
  }
}

class _NotificationCard extends ConsumerWidget {
  const _NotificationCard({required this.notification, required this.tenantId});

  final AppNotification notification;
  final String? tenantId;

  String? _routeFromNotification() {
    final meta = notification.metadata;
    if (meta != null) {
      final link = meta['link'] as String?;
      if (link != null && link.isNotEmpty) return link;
      final matterId = meta['matterId'] as String?;
      if (matterId != null) return '/lawyer/matters/$matterId';
      final taskId = meta['taskId'] as String?;
      if (taskId != null) return '/lawyer/tasks';
      final leadId = meta['leadId'] as String?;
      if (leadId != null) return '/lawyer/leads';
    }
    switch (notification.type) {
      case 'TASK':
      case 'TASK_DUE':
      case 'TASK_OVERDUE':
        return '/lawyer/tasks';
      case 'MATTER':
        return '/lawyer/matters';
      case 'PAYMENT':
      case 'BILLING':
        return '/lawyer/billing';
      case 'ALERT':
        return '/lawyer/alerts';
      case 'COPILOT_DRAFT_READY':
        return '/lawyer/matters';
      case 'LEAD_SLA_ESCALATION':
        return '/lawyer/leads';
      case 'CALENDAR':
        return '/lawyer/calendar';
      default:
        return null;
    }
  }

  Future<void> _handleTap(BuildContext context, WidgetRef ref) async {
    if (tenantId != null && !notification.isRead) {
      try {
        await ref.read(notificationsApiProvider).markRead(
              tenantId: tenantId!,
              notificationId: notification.id,
            );
        ref.invalidate(notificationsInboxProvider);
      } catch (_) {
        // Best-effort mark-read; still navigate.
      }
    }
    final route = _routeFromNotification();
    if (route != null && context.mounted) {
      try {
        ref.read(routerProvider).go(route);
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final textColor = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedColor = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final accent = const Color(0xFF226FEF);
    final unread = !notification.isRead;
    return GestureDetector(
      onTap: () => _handleTap(context, ref),
      child: Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: unread
            ? (isDark
                ? accent.withValues(alpha: 0.06)
                : accent.withValues(alpha: 0.03))
            : surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: unread ? accent.withValues(alpha: 0.2) : border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: unread ? 0.12 : 0.06),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(
                  _typeIcon(notification.type),
                  color: unread ? accent : mutedColor,
                  size: 18,
                ),
              ),
              if (unread)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: accent,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isDark ? AppColors.logoBlue : Colors.white,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notification.title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: unread ? FontWeight.w600 : FontWeight.w500,
                    color: textColor,
                  ),
                ),
                if (notification.body != null && notification.body!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    notification.body!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: mutedColor, height: 1.4),
                  ),
                ],
                if (notification.createdAt != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    DateFormat('MMM d · HH:mm').format(notification.createdAt!),
                    style: TextStyle(fontSize: 11, color: mutedColor.withValues(alpha: 0.7)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }

  IconData _typeIcon(String? type) {
    switch (type) {
      case 'TASK':
        return Icons.checklist_outlined;
      case 'MATTER':
        return Icons.folder_open_outlined;
      case 'PAYMENT':
        return Icons.receipt_long_outlined;
      case 'ALERT':
        return Icons.warning_amber_outlined;
      case 'SYSTEM':
        return Icons.info_outline;
      default:
        return Icons.notifications_outlined;
    }
  }
}
