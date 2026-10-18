import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../widgets/legal_disclaimer.dart';
import '../../credits/widgets/credit_gate.dart';
import '../../credits/widgets/credit_usage_meter.dart';
import '../cases/cases_list_screen.dart';

import '../../../core/tutorials/tutorial_progress_store.dart';
import '../../../core/tutorials/tutorial_strings.dart';
import '../../../core/tutorials/tutorial_theme.dart';
import '../../../core/tutorials/tutorial_flow.dart';

class ConsumerDashboardScreen extends ConsumerStatefulWidget {
  const ConsumerDashboardScreen({super.key});

  @override
  ConsumerState<ConsumerDashboardScreen> createState() =>
      _ConsumerDashboardScreenState();
}

class _ConsumerDashboardScreenState extends ConsumerState<ConsumerDashboardScreen> {
  final _casesKey = GlobalKey();
  final _actionsKey = GlobalKey();
  bool _tourStarted = false;

  Future<void> _maybeStartTour() async {
    if (_tourStarted || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null) return;

    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey('mobile.consumer.dashboard')) return;

    if (!mounted) return;
    _tourStarted = true;

    await runTutorialWithWelcome(
      context: context,
      showcaseKeys: [_casesKey, _actionsKey],
      onSkip: () => store.markSkipped(userId, 'mobile.consumer.dashboard'),
      onComplete: () => store.markCompleted(userId, 'mobile.consumer.dashboard'),
      onDismiss: () => _tourStarted = false,
      welcomeBody: TutorialStrings.consumerWelcomeBody,
      welcomeBullets: const [
        TutorialStrings.consumerWelcomeBullet1,
        TutorialStrings.consumerWelcomeBullet2,
        TutorialStrings.consumerWelcomeBullet3,
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
  }

  Color _statusColor(BuildContext context, String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return Colors.blue;
      case 'pending':
        return Colors.amber.shade700;
      case 'resolved':
        return Colors.green;
      case 'closed':
        return Theme.of(context).colorScheme.outline;
      default:
        return Theme.of(context).colorScheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(authControllerProvider).session?.user;
    final casesAsync = ref.watch(casesListProvider);
    
    final activeCases = casesAsync.maybeWhen(
      data: (list) => list.where((c) => c.status.toLowerCase() == 'open').length,
      orElse: () => 0,
    );
    final reportsCases = casesAsync.maybeWhen(
      data: (list) => list.length,
      orElse: () => 0,
    );
    final country = user?.countryCode ?? '—';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          user?.name != null
              ? '${l10n.consumerHello}, ${user!.name!.split(' ').first}'
              : l10n.consumerHello,
        ),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: l10n.commonSettings,
            onPressed: () => context.push('/consumer/settings'),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(casesListProvider);
          ref.invalidate(creditWalletProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            // Stats row — Active Cases, Total Cases, Country
            UmbrellaShowcase(
              showcaseKey: _casesKey,
              title: TutorialStrings.consumerCasesTitle,
              description: TutorialStrings.consumerCasesBody,
              child: Row(
              children: [
                Expanded(
                  child: _StatCard(
                    icon: Icons.folder_open_outlined,
                    label: l10n.consumerActiveCases,
                    value: '$activeCases',
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatCard(
                    icon: Icons.description_outlined,
                    label: l10n.consumerTotalCases,
                    value: '$reportsCases',
                    color: Colors.green,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatCard(
                    icon: Icons.public,
                    label: l10n.commonCountry,
                    value: country,
                    color: Colors.orange,
                  ),
                ),
              ],
            ),
            ),
            const SizedBox(height: 16),

            // Compact AI usage row — taps into Settings for full detail.
            // Full meter with model selector lives in Settings.
            if (AppConfig.enableSubscriptions) ...[
              _AiUsageSummaryTile(
                onTap: () => context.push('/consumer/settings'),
              ),
              const SizedBox(height: 16),
            ],

            // Quick actions
            UmbrellaShowcase(
              showcaseKey: _actionsKey,
              title: TutorialStrings.consumerActionsTitle,
              description: TutorialStrings.consumerActionsBody,
              child: Row(
              children: [
                Expanded(
                  child: CreditGate(
                    cost: 1,
                    feature: 'Issue Checker',
                    featureIcon: Icons.search,
                    child: _ActionButton(
                      icon: Icons.search,
                      label: l10n.consumerNewIssueCheck,
                      onTap: () => context.push('/consumer/issue-checker'),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.upload_file_outlined,
                    label: l10n.consumerUploadDocument,
                    onTap: () => context.push('/consumer/documents'),
                  ),
                ),
              ],
            ),
            ),
            const SizedBox(height: 20),

            // Recent cases
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l10n.dashboardRecentCases,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                TextButton(
                  onPressed: () => context.go('/consumer/cases'),
                  child: Text(l10n.commonViewAll),
                ),
              ],
            ),
            const SizedBox(height: 8),
            casesAsync.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (e, _) => _EmptyState(
                icon: Icons.error_outline,
                message: e is ApiException ? e.message : l10n.consumerUnableToLoadCases,
              ),
              data: (cases) {
                if (cases.isEmpty) {
                  return _EmptyState(
                    icon: Icons.folder_open_outlined,
                    message: l10n.consumerNoCasesYet2,
                    action: TextButton.icon(
                      onPressed: () => context.push('/consumer/issue-checker'),
                      icon: const Icon(Icons.search, size: 16),
                      label: Text(l10n.consumerRunIssueChecker),
                    ),
                  );
                }
                final recent = cases.take(5).toList();
                return Column(
                  children: recent.map((item) {
                    final color = _statusColor(context, item.status);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 6),
                        leading: Container(
                          width: 10,
                          height: double.infinity,
                          decoration: BoxDecoration(
                            color: color,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        title: Text(
                          item.title,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(item.issueType),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                item.status,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: color,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                        onTap: () => context.push('/consumer/cases/${item.id}'),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 16),

            // More quick links
            Text(l10n.dashboardMore,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            _QuickLink(
              icon: Icons.description_outlined,
              title: l10n.consumerNavReports,
              subtitle: l10n.consumerReviewGeneratedReports,
              onTap: () => context.push('/consumer/reports'),
            ),
            _QuickLink(
              icon: Icons.manage_search_outlined,
              title: l10n.consumerDocumentReview,
              subtitle: l10n.consumerDocumentReviewSubtitle,
              onTap: () => context.push('/consumer/document-review'),
            ),
            _QuickLink(
              icon: Icons.search_outlined,
              title: l10n.consumerLegalResearch,
              subtitle: l10n.consumerLegalResearchSubtitle,
              onTap: () => context.push('/consumer/research'),
            ),
            if (AppConfig.enableLawyerReview)
              _QuickLink(
                icon: Icons.gavel_outlined,
                title: l10n.consumerLawyerReview,
                subtitle: l10n.consumerUpgradeToAVerifiedLawyerreviewedReport,
                onTap: () => context.push('/consumer/lawyer-review'),
              ),
            if (AppConfig.enableSubscriptions)
              _QuickLink(
                icon: AppConfig.enableInAppPurchasing
                    ? Icons.credit_card_outlined
                    : Icons.bolt_outlined,
                title: l10n.consumerAiUsageAndPlans,
                subtitle: l10n.consumerViewModelBudgetAndUpgrade,
                onTap: () => context.push('/consumer/subscription'),
              ),
            const SizedBox(height: 16),
            const LegalDisclaimer(compact: true),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
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
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppColors.radius),
          border: Border.all(color: primary.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: primary),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: primary,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppColors.radius),
          ),
          child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact AI usage summary tile — taps into Settings for full detail
// ---------------------------------------------------------------------------

class _AiUsageSummaryTile extends StatelessWidget {
  const _AiUsageSummaryTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(Icons.auto_awesome, size: 18, color: colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(l10n.commonAiUsage,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const CreditUsageMeter(compact: true),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                size: 18,
                color: colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message, this.action});

  final IconData icon;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Icon(icon, size: 40,
              color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          if (action != null) ...[const SizedBox(height: 8), action!],
        ],
      ),
    );
  }
}
