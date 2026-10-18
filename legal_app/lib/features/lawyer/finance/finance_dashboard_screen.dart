import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_section_header.dart';
import '../../../core/widgets/app_stat_card.dart';

// ─── Providers ─────────────────────────────────────────────────────────────────

final _financeSummaryProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  try {
    final resp = await api.dio.get<dynamic>(
      '/billing/summary',
      options: tenantId.isNotEmpty
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    return (resp.data as Map<String, dynamic>?) ?? {};
  } catch (_) {
    return {};
  }
});

final _recentInvoicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  try {
    final resp = await api.dio.get<dynamic>(
      '/billing/invoices',
      queryParameters: {'take': 5, 'sort': 'createdAt:desc'},
      options: tenantId.isNotEmpty
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    final data = resp.data;
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().take(5).toList();
    }
    return [];
  } catch (_) {
    return [];
  }
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class FinanceDashboardScreen extends ConsumerWidget {
  const FinanceDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final summaryAsync = ref.watch(_financeSummaryProvider);
    final invoicesAsync = ref.watch(_recentInvoicesProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Finance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(_financeSummaryProvider);
              ref.invalidate(_recentInvoicesProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_financeSummaryProvider);
          ref.invalidate(_recentInvoicesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            AppPageHeader(
              title: 'Finance',
              subtitle: 'Revenue, billing, and trust accounts',
              accentColor: const Color(0xFF10B981),
              padding: const EdgeInsets.fromLTRB(0, 16, 0, 16),
            ),

            // ── KPI stats ────────────────────────────────────────────────────
            const AppSectionHeader(title: 'At a glance'),
            const SizedBox(height: 8),
            summaryAsync.when(
              loading: () => const _StatsPlaceholder(),
              error: (e, _) => AppErrorView(message: e.toString()),
              data: (summary) {
                final currency = summary['currency'] as String? ?? 'USD';
                final billed =
                    (summary['totalBilled'] as num?)?.toDouble() ?? 0;
                final collected =
                    (summary['totalCollected'] as num?)?.toDouble() ?? 0;
                final outstanding =
                    (summary['outstanding'] as num?)?.toDouble() ?? 0;
                final overdue =
                    (summary['overdue'] as num?)?.toDouble() ?? 0;

                return GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 2.2,
                  children: [
                    AppStatCard(
                      label: 'Total billed',
                      value: _fmt(billed, currency),
                      icon: Icons.receipt_long_outlined,
                      accentColor: cs.primary,
                    ),
                    AppStatCard(
                      label: 'Collected',
                      value: _fmt(collected, currency),
                      icon: Icons.check_circle_outlined,
                      accentColor: const Color(0xFF10B981),
                    ),
                    AppStatCard(
                      label: 'Outstanding',
                      value: _fmt(outstanding, currency),
                      icon: Icons.hourglass_empty,
                      accentColor: const Color(0xFFF59E0B),
                    ),
                    AppStatCard(
                      label: 'Overdue',
                      value: _fmt(overdue, currency),
                      icon: Icons.warning_amber_outlined,
                      accentColor: const Color(0xFFEF4444),
                      deltaPositive: overdue > 0 ? false : null,
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 24),

            // ── Quick actions ────────────────────────────────────────────────
            const AppSectionHeader(title: 'Manage'),
            const SizedBox(height: 8),
            _QuickAction(
              icon: Icons.receipt_long_outlined,
              color: cs.primary,
              title: 'Billing & Invoices',
              subtitle: 'View and create invoices',
              onTap: () => context.go('/lawyer/billing'),
            ),
            const SizedBox(height: 8),
            _QuickAction(
              icon: Icons.account_balance_wallet_outlined,
              color: const Color(0xFF10B981),
              title: 'Trust Accounts',
              subtitle: 'IOLTA and client trust management',
              onTap: () => context.go('/lawyer/trust'),
            ),
            const SizedBox(height: 8),
            _QuickAction(
              icon: Icons.schedule_outlined,
              color: const Color(0xFF226FEF),
              title: 'Time Entries',
              subtitle: 'Log and review billable hours',
              onTap: () => context.go('/lawyer/time'),
            ),
            const SizedBox(height: 24),

            // ── Recent invoices ──────────────────────────────────────────────
            Row(
              children: [
                const Expanded(child: AppSectionHeader(title: 'Recent invoices')),
                TextButton(
                  onPressed: () => context.go('/lawyer/billing'),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            invoicesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) =>
                  Text(e.toString(), style: TextStyle(color: muted)),
              data: (invoices) {
                if (invoices.isEmpty) {
                  return Text('No invoices yet.',
                      style: tt.bodySmall?.copyWith(color: muted));
                }
                return Column(
                  children: invoices.indexed.map((record) {
                    final idx = record.$1;
                    final inv = record.$2;
                    final status = inv['status'] as String? ?? 'DRAFT';
                    final amount =
                        (inv['amount'] as num?)?.toDouble() ?? 0;
                    final currency =
                        inv['currency'] as String? ?? 'USD';
                    final invoiceNum = inv['invoiceNumber'] as String?;
                    final tone =
                        AppSemanticColors.toneForStatus(status);
                    return Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.logoBlueSurface
                                : Colors.white,
                            borderRadius:
                                BorderRadius.circular(AppColors.radius),
                            border: Border.all(
                              color: isDark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppSemanticColors.bg(tone,
                                      isDark: isDark),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.receipt_long_outlined,
                                    color: AppSemanticColors.fg(tone,
                                        isDark: isDark),
                                    size: 17),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(invoiceNum ?? 'Invoice',
                                    style: tt.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w600)),
                              ),
                              Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    _fmt(amount, currency),
                                    style: tt.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 2),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppSemanticColors.bg(
                                          tone,
                                          isDark: isDark),
                                      borderRadius:
                                          BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      status,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: AppSemanticColors.fg(
                                            tone,
                                            isDark: isDark),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        if (idx < invoices.length - 1)
                          const SizedBox(height: 8),
                      ],
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(double amount, String currency) {
    final sym = currency == 'USD'
        ? '\$'
        : currency == 'EUR'
            ? '€'
            : currency == 'GBP'
                ? '£'
                : '$currency ';
    if (amount >= 1000000) {
      return '$sym${(amount / 1000000).toStringAsFixed(1)}M';
    }
    if (amount >= 1000) {
      return '$sym${(amount / 1000).toStringAsFixed(1)}K';
    }
    return '$sym${amount.toStringAsFixed(0)}';
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          AppIconBadge(icon: icon, color: color, size: 42, iconSize: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style:
                        tt.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: tt.bodySmall?.copyWith(color: muted)),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: muted, size: 18),
        ],
      ),
    );
  }
}

class _StatsPlaceholder extends StatelessWidget {
  const _StatsPlaceholder();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.2,
      children: List.generate(
        4,
        (_) => Container(
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(color: border),
          ),
        ),
      ),
    );
  }
}
