import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/tutorials/tutorial_flow.dart';
import '../../../core/tutorials/tutorial_progress_store.dart';
import '../../../core/tutorials/tutorial_strings.dart';
import '../../../core/tutorials/tutorial_theme.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';

final firmInvoicesProvider = FutureProvider.family<List<FirmInvoice>, String?>((
  ref,
  matterId,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref
      .watch(billingApiProvider)
      .listInvoices(tenantId: tenantId, matterId: matterId);
});

final firmPaymentsProvider = FutureProvider<List<AppPayment>>((ref) async {
  return ref.watch(paymentsApiProvider).listPayments();
});

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key, this.matterId});

  final String? matterId;

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  final _statsKey = GlobalKey();
  final _tabsKey = GlobalKey();
  bool _tourStarted = false;

  Future<void> _maybeStartTour() async {
    if (widget.matterId != null) return;
    if (_tourStarted || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null) return;

    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey('mobile.lawyer.billing')) return;

    if (!mounted) return;
    _tourStarted = true;

    await runTutorialWithWelcome(
      context: context,
      showcaseKeys: [_statsKey, _tabsKey],
      onSkip: () => store.markSkipped(userId, 'mobile.lawyer.billing'),
      onComplete: () => store.markCompleted(userId, 'mobile.lawyer.billing'),
      onDismiss: () => _tourStarted = false,
      welcomeBody: TutorialStrings.billingWelcomeBody,
      welcomeBullets: const [
        TutorialStrings.billingWelcomeBullet1,
        TutorialStrings.billingWelcomeBullet2,
        TutorialStrings.billingWelcomeBullet3,
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final invoicesAsync = ref.watch(firmInvoicesProvider(widget.matterId));
    final paymentsAsync = ref.watch(firmPaymentsProvider);
    final isTopLevel = widget.matterId == null;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(isTopLevel ? l10n.lawyerNavBilling : 'Matter Billing'),
        actions: [
          if (isTopLevel)
            IconButton(
              tooltip: 'Help & tour',
              onPressed: () => ShowCaseWidget.of(context)
                  .startShowCase([_statsKey, _tabsKey]),
              icon: const Icon(Icons.help_outline, size: 20),
            ),
        ],
      ),
      body: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            // Stats strip
            invoicesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const SizedBox.shrink(),
              data: (invoices) => UmbrellaShowcase(
                showcaseKey: _statsKey,
                title: TutorialStrings.lawyerBillingStatsTitle,
                description: TutorialStrings.lawyerBillingStatsBody,
                child: _InvoiceStats(invoices: invoices),
              ),
            ),
            // Tab bar
            UmbrellaShowcase(
              showcaseKey: _tabsKey,
              title: TutorialStrings.lawyerBillingTabsTitle,
              description: TutorialStrings.lawyerBillingTabsBody,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TabBar(
                  tabs: [
                    Tab(text: l10n.billingInvoices),
                    Tab(text: l10n.billingPayments),
                  ],
                ),
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  invoicesAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (error, _) => AppErrorView(
                      message: error.toString(),
                      onRetry: () => ref.invalidate(
                          firmInvoicesProvider(widget.matterId)),
                    ),
                    data: (invoices) => _InvoicesList(invoices: invoices),
                  ),
                  paymentsAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (error, _) => AppErrorView(
                      message: error.toString(),
                      onRetry: () => ref.invalidate(firmPaymentsProvider),
                    ),
                    data: (payments) => _PaymentsList(payments: payments),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InvoiceStats extends StatelessWidget {
  const _InvoiceStats({required this.invoices});

  final List<FirmInvoice> invoices;

  String _money(double amount) {
    final currency = invoices.isNotEmpty ? invoices.first.currency : 'USD';
    return '$currency ${amount.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final total = invoices.fold<double>(0, (sum, i) => sum + i.amount);
    final outstanding = invoices
        .where((i) => i.status != 'PAID')
        .fold<double>(0, (sum, i) => sum + i.amount);
    final paidThisMonth = invoices
        .where(
          (i) =>
              i.status == 'PAID' &&
              i.createdAt != null &&
              i.createdAt!.month == DateTime.now().month &&
              i.createdAt!.year == DateTime.now().year,
        )
        .fold<double>(0, (sum, i) => sum + i.amount);

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Container(
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border),
        ),
        child: Row(
          children: [
            Expanded(
              child: _StatCell(
                label: 'Total billed',
                value: _money(total),
                color: const Color(0xFF226FEF),
              ),
            ),
            Container(width: 1, height: 48, color: border),
            Expanded(
              child: _StatCell(
                label: 'Outstanding',
                value: _money(outstanding),
                color: const Color(0xFFF59E0B),
              ),
            ),
            Container(width: 1, height: 48, color: border),
            Expanded(
              child: _StatCell(
                label: 'Paid / mo',
                value: _money(paidThisMonth),
                color: const Color(0xFF10B981),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell(
      {required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isDark
                  ? AppColors.mutedForegroundDark
                  : AppColors.mutedForegroundLight,
            ),
          ),
        ],
      ),
    );
  }
}

Color _invoiceStatusColor(String status) {
  switch (status.toUpperCase()) {
    case 'PAID':
      return const Color(0xFF10B981);
    case 'OVERDUE':
      return const Color(0xFFEF4444);
    case 'SENT':
    case 'PENDING':
      return const Color(0xFFF59E0B);
    case 'DRAFT':
      return const Color(0xFF94A3B8);
    default:
      return const Color(0xFF226FEF);
  }
}

Color _paymentStatusColor(String status) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
    case 'PAID':
      return const Color(0xFF10B981);
    case 'FAILED':
      return const Color(0xFFEF4444);
    default:
      return const Color(0xFFF59E0B);
  }
}

class _InvoicesList extends StatelessWidget {
  const _InvoicesList({required this.invoices});

  final List<FirmInvoice> invoices;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (invoices.isEmpty) {
      return AppEmptyState(
        icon: Icons.receipt_long_outlined,
        label: l10n.billingNoInvoicesYet,
        sublabel: 'Invoices you create for clients will appear here.',
      );
    }
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final fg = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedFg = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      itemCount: invoices.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final invoice = invoices[index];
        final sColor = _invoiceStatusColor(invoice.status);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: sColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.receipt_long_outlined, color: sColor, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.invoiceNumber ?? 'Invoice ${invoice.id.substring(0, 8)}',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: fg),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${invoice.currency} ${invoice.amount.toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, color: mutedFg),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: sColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  invoice.status,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: sColor),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PaymentsList extends StatelessWidget {
  const _PaymentsList({required this.payments});

  final List<AppPayment> payments;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (payments.isEmpty) {
      return AppEmptyState(
        icon: Icons.payments_outlined,
        label: l10n.billingNoPaymentRecordsYet,
        sublabel: 'Recorded payments from clients will appear here.',
      );
    }
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final fg = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedFg = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      itemCount: payments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final payment = payments[index];
        final sColor = _paymentStatusColor(payment.status);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.payments_outlined,
                    color: Color(0xFF10B981), size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payment.purpose ?? 'Payment',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: fg),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${payment.currency} ${payment.amount.toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, color: mutedFg),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: sColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  payment.status,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: sColor),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
