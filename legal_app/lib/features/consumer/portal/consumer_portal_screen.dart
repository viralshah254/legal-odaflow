import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';

import '../subscription/payment_checkout_screen.dart';

final consumerPortalProgressProvider = FutureProvider<List<ConsumerCase>>((
  ref,
) async {
  return ref.watch(consumersApiProvider).listCases();
});

final consumerPortalMessagesProvider = FutureProvider<List<AppNotification>>((
  ref,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) return const <AppNotification>[];
  return ref.watch(notificationsApiProvider).listInbox(tenantId: tenantId);
});

final consumerPortalPaymentsProvider = FutureProvider<List<AppPayment>>((
  ref,
) async {
  return ref.watch(paymentsApiProvider).listPayments();
});

class ConsumerPortalScreen extends ConsumerStatefulWidget {
  const ConsumerPortalScreen({super.key});

  @override
  ConsumerState<ConsumerPortalScreen> createState() =>
      _ConsumerPortalScreenState();
}

class _ConsumerPortalScreenState extends ConsumerState<ConsumerPortalScreen> {
  String? _payingPaymentId;

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(consumerPortalProgressProvider);
    ref.invalidate(consumerPortalMessagesProvider);
    ref.invalidate(consumerPortalPaymentsProvider);
  }

  Future<void> _payPendingInvoice(AppPayment payment) async {
    final l10n = AppLocalizations.of(context);
    final countryCode =
        ref.read(authControllerProvider).session?.user.countryCode ?? 'US';

    setState(() => _payingPaymentId = payment.id);

    try {
      final result = await ref.read(paymentsApiProvider).createPaymentIntent(
            amount: payment.amount,
            currency: payment.currency,
            countryCode: countryCode,
            purpose: payment.purpose ?? 'PAYMENT',
            metadata: {'previousPaymentId': payment.id},
          );

      if (!mounted) return;

      if (result.checkoutUrl != null && result.checkoutUrl!.isNotEmpty) {
        final paid = await openPaymentCheckout(
          context,
          checkoutUrl: result.checkoutUrl!,
          title: l10n.commonPayInvoice,
        );
        if (!mounted) return;
        if (paid == true) {
          ref.invalidate(consumerPortalPaymentsProvider);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.consumerPayment)),
          );
        }
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.consumerCheckoutUrlUnavailable)),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.consumerUnableToStartCheckout)),
      );
    } finally {
      if (mounted) setState(() => _payingPaymentId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final progressAsync = ref.watch(consumerPortalProgressProvider);
    final messagesAsync = ref.watch(consumerPortalMessagesProvider);
    final paymentsAsync = ref.watch(consumerPortalPaymentsProvider);

    final unreadCount = messagesAsync.maybeWhen(
      data: (msgs) => msgs.where((m) => !m.isRead).length,
      orElse: () => 0,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.consumerMyPortal),
        automaticallyImplyLeading: false,
        actions: [
          if (unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Badge(
                label: Text(l10n.consumerUnreadcount),
                child: const Icon(Icons.notifications_outlined),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            // Matter Progress
            _SectionHeader(title: l10n.consumerMatterProgress, icon: Icons.folder_outlined),
            const SizedBox(height: 10),
            progressAsync.when(
              loading: () => const _LoadingPlaceholder(),
              error: (e, _) => _ErrorText(
                e is ApiException ? e.message : l10n.consumerUnableToLoad,
              ),
              data: (cases) {
                if (cases.isEmpty) {
                  return _EmptySection(
                    message: l10n.consumerNoMattersYet,
                    onAction: () => context.push('/consumer/issue-checker'),
                    actionLabel: l10n.consumerStartIssueCheck,
                  );
                }
                return Column(
                  children: cases.take(3).map((c) {
                    final color = _statusColor(c.status);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    c.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                _StatusBadge(status: c.status, color: color),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              c.issueType,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                            const SizedBox(height: 10),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: _progressForStatus(c.status),
                                minHeight: 6,
                                backgroundColor: color.withValues(alpha: 0.15),
                                valueColor:
                                    AlwaysStoppedAnimation<Color>(color),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _nextStepForStatus(l10n, c.status),
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 20),

            // Messages
            _SectionHeader(
              title: l10n.consumerMessages,
              icon: Icons.chat_bubble_outline,
              badge: unreadCount > 0 ? '$unreadCount' : null,
            ),
            const SizedBox(height: 10),
            messagesAsync.when(
              loading: () => const _LoadingPlaceholder(),
              error: (e, _) => _ErrorText(
                e is ApiException ? e.message : l10n.consumerNoMessages,
              ),
              data: (messages) {
                if (messages.isEmpty) {
                  return _EmptySection(
                    message: l10n.consumerNoMessagesYet,
                  );
                }
                return Column(
                  children: messages.take(5).map((m) {
                    final isUnread = !m.isRead;
                    final dateStr = m.createdAt != null
                        ? _formatDateShort(m.createdAt!)
                        : '';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: isUnread
                                  ? Theme.of(context).colorScheme.primary
                                  : Theme.of(context)
                                      .colorScheme
                                      .surfaceContainerHighest,
                              child: Icon(
                                Icons.person,
                                size: 18,
                                color: isUnread
                                    ? Colors.white
                                    : Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                              ),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    m.title,
                                    style: TextStyle(
                                      fontWeight: isUnread
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                      fontSize: 14,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Text(
                                  dateStr,
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                ),
                              ],
                            ),
                            subtitle: m.body != null
                                ? Text(
                                    m.body!,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  )
                                : null,
                            onTap: () {
                              final caseId = m.metadata?['caseId'] as String?;
                              if (caseId != null && caseId.isNotEmpty) {
                                context.push('/consumer/cases/$caseId/messages');
                              }
                            },
                          ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 20),

            // Invoices / Payments
            _SectionHeader(
                title: l10n.consumerInvoices, icon: Icons.receipt_long_outlined),
            const SizedBox(height: 10),
            paymentsAsync.when(
              loading: () => const _LoadingPlaceholder(),
              error: (e, _) =>
                  _EmptySection(message: l10n.consumerNoInvoicesYet),
              data: (payments) {
                if (payments.isEmpty) {
                  return const _EmptySection(message: 'No invoices yet.');
                }
                return Column(
                  children: payments.map((p) {
                    final isPending = p.status.toUpperCase() == 'PENDING';
                    final statusColor =
                        isPending ? Colors.amber.shade700 : Colors.green;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius:
                                BorderRadius.circular(AppColors.radius),
                          ),
                          child: Icon(
                            Icons.receipt_outlined,
                            color: statusColor,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          '${p.currency} ${p.amount.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(p.purpose ?? l10n.consumerPayment),
                        trailing: isPending
                            ? (AppConfig.enableInAppPurchasing
                                ? FilledButton.tonal(
                                    onPressed: _payingPaymentId == p.id
                                        ? null
                                        : () => _payPendingInvoice(p),
                                    child: _payingPaymentId == p.id
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : Text(l10n.consumerPay),
                                  )
                                : Text(
                                    l10n.consumerCreditsDesktopOnly,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                    textAlign: TextAlign.end,
                                  ))
                            : _StatusBadge(
                                status: p.status,
                                color: statusColor,
                              ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 20),

            // Quick actions
            _SectionHeader(title: l10n.consumerQuickActions, icon: Icons.flash_on_outlined),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _PortalActionCard(
                    icon: Icons.upload_file_outlined,
                    label: l10n.consumerUploadDocument,
                    onTap: () => context.push('/consumer/documents'),
                  ),
                ),
                if (AppConfig.enableLawyerReview) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: _PortalActionCard(
                      icon: Icons.gavel_outlined,
                      label: l10n.consumerLawyerReview,
                      onTap: () => context.push('/consumer/lawyer-review'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  double _progressForStatus(String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return 0.5;
      case 'pending':
        return 0.2;
      case 'resolved':
        return 1.0;
      case 'closed':
        return 1.0;
      default:
        return 0.1;
    }
  }

  String _nextStepForStatus(AppLocalizations l10n, String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return l10n.consumerUnderReviewByLegalTeam;
      case 'pending':
        return l10n.consumerAwaitingDocumentsOrInfo;
      case 'resolved':
        return l10n.consumerMatterResolved;
      case 'closed':
        return l10n.consumerCaseClosed;
      default:
        return l10n.consumerProcessing;
    }
  }
}

String _formatDateShort(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${date.day} ${months[date.month - 1]}';
}

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'open':
      return Colors.blue;
    case 'pending':
      return Colors.amber.shade700;
    case 'resolved':
      return Colors.green;
    case 'closed':
      return Colors.grey;
    default:
      return Colors.blueGrey;
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.color});

  final String status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.icon,
    this.badge,
  });

  final String title;
  final IconData icon;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon,
            size: 18, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        if (badge != null) ...[
          const SizedBox(width: 8),
          Badge(label: Text(badge!)),
        ],
      ],
    );
  }
}

class _LoadingPlaceholder extends StatelessWidget {
  const _LoadingPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        message,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    );
  }
}

class _EmptySection extends StatelessWidget {
  const _EmptySection({required this.message, this.onAction, this.actionLabel});

  final String message;
  final VoidCallback? onAction;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: Column(
        children: [
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          if (onAction != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: onAction,
              child: Text(actionLabel ?? AppLocalizations.of(context).consumerGetStarted),
            ),
          ],
        ],
      ),
    );
  }
}

class _PortalActionCard extends StatelessWidget {
  const _PortalActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(AppColors.radius),
          border: Border.all(color: primary.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: primary, size: 22),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
