import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/config/app_config.dart';
import '../../../../../core/network/api_client.dart';
import '../case_workspace_providers.dart';
import '../case_workspace_utils.dart';

class CasePaymentsTab extends ConsumerWidget {
  const CasePaymentsTab({super.key, required this.caseId});

  final String caseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final caseAsync = ref.watch(caseDetailProvider(caseId));
    final paymentsAsync = ref.watch(casePaymentsProvider(caseId));

    return caseAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox.shrink(),
      data: (caseItem) {
        final pricingAsync =
            ref.watch(lawyerReviewPricingProvider(caseItem.countryCode));

        return paymentsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                error is ApiException
                    ? error.message
                    : 'Unable to load payments',
                textAlign: TextAlign.center,
              ),
            ),
          ),
          data: (payments) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(casePaymentsProvider(caseId));
              ref.invalidate(caseDetailProvider(caseId));
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (AppConfig.enableLawyerReview) ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.consumerLawyerReviewFee,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          pricingAsync.when(
                            loading: () => const LinearProgressIndicator(),
                            error: (_, __) => Text(
                              l10n.consumerPayAndRequestReview,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            data: (pricing) => Text(
                              '${pricing.price.toStringAsFixed(0)} ${pricing.currency}',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: () => context.push(
                              '/consumer/cases/$caseId/lawyer-review',
                            ),
                            child: Text(l10n.consumerPayAndRequestReview),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                Text(
                  l10n.consumerPaymentHistory,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                if (payments.isEmpty)
                  _EmptyPanel(
                    icon: Icons.payment_outlined,
                    title: l10n.consumerNoPaymentsYet,
                    description: l10n.consumerEmptyPaymentsDescription,
                  )
                else
                  ...payments.map(
                    (payment) => Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        title: Text(
                          payment.description ?? l10n.consumerPayment,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: payment.createdAt != null
                            ? Text(formatCaseDate(payment.createdAt!))
                            : null,
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '${payment.amount.toStringAsFixed(0)} ${payment.currency}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              payment.status,
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(description, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
