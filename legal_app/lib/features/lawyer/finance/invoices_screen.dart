import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_stat_card.dart';
import '../../../core/widgets/app_status_badge.dart';
import 'create_invoice_sheet.dart';

class _Invoice {
  const _Invoice({
    required this.id,
    required this.number,
    required this.clientName,
    required this.amount,
    required this.status,
    required this.dueDate,
    required this.issuedDate,
    this.matterTitle,
    this.description,
    this.billingModel,
  });

  factory _Invoice.fromJson(Map<String, dynamic> json) {
    final meta = json['metadata'] as Map<String, dynamic>?;
    return _Invoice(
      id: json['id'] as String? ?? '',
      number: json['number'] as String? ??
          json['invoiceNumber'] as String? ??
          '#???',
      clientName: json['clientName'] as String? ?? 'Client',
      amount: (json['amount'] as num?)?.toDouble() ??
          (json['totalAmount'] as num?)?.toDouble() ??
          0,
      status: json['status'] as String? ?? 'DRAFT',
      dueDate: json['dueDate'] as String? ?? '',
      issuedDate: json['issuedDate'] as String? ??
          json['createdAt'] as String? ??
          '',
      matterTitle: json['matterTitle'] as String?,
      description: meta?['description'] as String?,
      billingModel: json['billingModel'] as String?,
    );
  }

  final String id;
  final String number;
  final String clientName;
  final double amount;
  final String status;
  final String dueDate;
  final String issuedDate;
  final String? matterTitle;
  final String? description;
  final String? billingModel;
}

final _invoicesProvider = FutureProvider.autoDispose<List<_Invoice>>(
  (ref) async {
    final tenantId =
        ref.watch(authControllerProvider).session?.user.tenantId ?? '';
    final api = ref.watch(apiClientProvider);
    try {
      final resp = await api.dio.get<dynamic>(
        '/billing/invoices',
        options: tenantId.isNotEmpty
            ? Options(headers: {'X-Tenant-Id': tenantId})
            : null,
      );
      final list = resp.data as List<dynamic>? ?? [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(_Invoice.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  },
);

class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen> {
  String _filter = 'ALL';

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All'),
    AppFilterOption(id: 'DRAFT', label: 'Draft'),
    AppFilterOption(id: 'SENT', label: 'Sent'),
    AppFilterOption(id: 'PAID', label: 'Paid'),
    AppFilterOption(id: 'OVERDUE', label: 'Overdue'),
  ];

  @override
  Widget build(BuildContext context) {
    final invoicesAsync = ref.watch(_invoicesProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(_invoicesProvider.future),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: AppPageHeader(
                title: 'Invoices',
                subtitle: 'Track and manage client invoices',
                actions: [
                  FilledButton.tonal(
                    onPressed: () async {
                      final created =
                          await showCreateInvoiceSheet(context, ref);
                      if (created) {
                        ref.invalidate(_invoicesProvider);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Invoice created.')),
                          );
                        }
                      }
                    },
                    child: const Text('New Invoice'),
                  ),
                ],
              ),
            ),
            invoicesAsync.maybeWhen(
              data: (invoices) {
                final totalBilled =
                    invoices.fold<double>(0, (s, i) => s + i.amount);
                final totalPaid = invoices
                    .where((i) => i.status == 'PAID')
                    .fold<double>(0, (s, i) => s + i.amount);
                final overdue = invoices
                    .where((i) => i.status == 'OVERDUE')
                    .fold<double>(0, (s, i) => s + i.amount);
                return SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        AppStatCard(
                          label: 'Billed',
                          value:
                              '₹${(totalBilled / 1000).toStringAsFixed(0)}k',
                        ),
                        const SizedBox(width: 8),
                        AppStatCard(
                          label: 'Collected',
                          value:
                              '₹${(totalPaid / 1000).toStringAsFixed(0)}k',
                        ),
                        const SizedBox(width: 8),
                        AppStatCard(
                          label: 'Overdue',
                          value:
                              '₹${(overdue / 1000).toStringAsFixed(0)}k',
                        ),
                      ],
                    ),
                  ),
                );
              },
              orElse: () => const SliverToBoxAdapter(child: SizedBox()),
            ),
            SliverToBoxAdapter(
              child: AppFilterBar(
                options: _filterOptions,
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
              ),
            ),
            invoicesAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 6),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: AppErrorView(
                  message: e.toString(),
                  onRetry: () => ref.refresh(_invoicesProvider.future),
                ),
              ),
              data: (invoices) {
                final filtered = _filter == 'ALL'
                    ? invoices
                    : invoices.where((i) => i.status == _filter).toList();

                if (filtered.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.receipt_outlined,
                      label: 'No invoices',
                      sublabel:
                          'Create your first invoice to start billing clients.',
                    ),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _InvoiceCard(invoice: filtered[i]),
                    childCount: filtered.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await showCreateInvoiceSheet(context, ref);
          if (created) {
            ref.invalidate(_invoicesProvider);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Invoice created.')),
              );
            }
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice});
  final _Invoice invoice;

  Color _statusColor(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (status) {
      case 'PAID':
        return Colors.green;
      case 'OVERDUE':
        return cs.error;
      case 'SENT':
        return cs.primary;
      default:
        return cs.outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final statusColor = _statusColor(context, invoice.status);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            Icons.receipt_outlined,
            color: statusColor,
            size: 20,
          ),
        ),
        title: Row(
          children: [
            Text(
              invoice.number,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                invoice.clientName,
                style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AppStatusBadge(status: invoice.status),
                if (invoice.dueDate.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    'Due ${invoice.dueDate}',
                    style: TextStyle(
                      fontSize: 11,
                      color: invoice.status == 'OVERDUE'
                          ? cs.error
                          : cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
            if (invoice.matterTitle != null)
              Text(
                invoice.matterTitle!,
                style: TextStyle(
                    color: cs.onSurfaceVariant, fontSize: 11),
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        trailing: Text(
          '₹${invoice.amount.toStringAsFixed(0)}',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 15,
            color: invoice.status == 'OVERDUE' ? cs.error : null,
          ),
        ),
        isThreeLine: invoice.matterTitle != null,
      ),
    );
  }
}
