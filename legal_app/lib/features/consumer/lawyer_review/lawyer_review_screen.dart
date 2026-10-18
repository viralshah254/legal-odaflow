import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../widgets/legal_disclaimer.dart';
import '../subscription/payment_checkout_screen.dart';

final consumerCasesProvider = FutureProvider<List<ConsumerCase>>((ref) async {
  return ref.watch(consumersApiProvider).listCases();
});

class LawyerReviewScreen extends ConsumerStatefulWidget {
  const LawyerReviewScreen({super.key});

  @override
  ConsumerState<LawyerReviewScreen> createState() => _LawyerReviewScreenState();
}

class _LawyerReviewScreenState extends ConsumerState<LawyerReviewScreen> {
  String? _submittingCaseId;
  String? _message;
  String? _error;

  Future<void> _requestReview(ConsumerCase caseItem) async {
    if (!AppConfig.enableLawyerReview) {
      setState(() => _error = 'Lawyer review is not enabled.');
      return;
    }

    setState(() {
      _submittingCaseId = caseItem.id;
      _message = null;
      _error = null;
    });

    try {
      final pricing = await ref
          .read(pricingApiProvider)
          .getLawyerReviewPricing(caseItem.countryCode);

      ConsumerLegalReport? attachedReport;
      try {
        final caseDetail = await ref
            .read(consumersApiProvider)
            .getCase(caseItem.id);
        attachedReport = caseDetail.reports.isNotEmpty
            ? caseDetail.reports.first
            : null;
      } catch (_) {
        // Report attachment is optional.
      }

      final reviewRequest = await ref
          .read(marketplaceApiProvider)
          .createReviewRequest(
            consumerCaseId: caseItem.id,
            countryCode: caseItem.countryCode,
            issueType: caseItem.issueType,
            price: pricing.price,
            currency: pricing.currency,
            consumerReportId: attachedReport?.id,
            jurisdiction: caseItem.jurisdiction,
          );

      final paymentIntent = await ref
          .read(marketplaceApiProvider)
          .payForReviewRequest(reviewRequest.id);

      if (!mounted) return;

      if (paymentIntent.checkoutUrl != null &&
          paymentIntent.checkoutUrl!.isNotEmpty) {
        final paid = await openPaymentCheckout(
          context,
          checkoutUrl: paymentIntent.checkoutUrl!,
          title: 'Lawyer Review Payment',
        );

        if (!mounted) return;

        if (paid == true) {
          setState(() {
            _message =
                'Payment completed. Lawyer review request ${reviewRequest.id} is submitted — a verified lawyer will respond soon.';
          });
          return;
        }

        setState(() {
          _message =
              'Review request ${reviewRequest.id} created. Complete payment when ready.';
        });
        return;
      }

      setState(() {
        _message =
            'Lawyer review request submitted (${reviewRequest.id}). A verified lawyer will respond soon.';
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Unable to submit review request.');
    } finally {
      if (mounted) setState(() => _submittingCaseId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final casesAsync = ref.watch(consumerCasesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.consumerLawyerReview),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/consumer'),
        ),
      ),
      body: casesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              error is ApiException ? error.message : 'Unable to load cases',
              textAlign: TextAlign.center,
            ),
          ),
        ),
        data: (cases) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(l10n.consumerUpgradeToAVerifiedLawyerreviewedReport,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(l10n.consumerLawyerReviewDescription,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            const LegalDisclaimer(compact: true),
            if (_message != null) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(_message!),
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            if (cases.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Text(l10n.consumerNoCasesYetStartWithTheLegalIssueChecker,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => context.go('/consumer/issue-checker'),
                        child: Text(l10n.consumerCheckMyLegalIssue),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...cases.map((caseItem) {
                final countryName =
                    AppConfig.countryNames[caseItem.countryCode] ??
                    caseItem.countryCode;
                final isSubmitting = _submittingCaseId == caseItem.id;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  caseItem.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              Chip(label: Text(caseItem.status)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('${caseItem.issueType} · $countryName'),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              ElevatedButton.icon(
                                onPressed: isSubmitting
                                    ? null
                                    : () => _requestReview(caseItem),
                                icon: const Icon(Icons.gavel_outlined),
                                label: Text(
                                  isSubmitting
                                      ? 'Processing…'
                                      : 'Pay & Request Review',
                                ),
                              ),
                              OutlinedButton(
                                onPressed: () => context.go(
                                  '/consumer/cases/${caseItem.id}',
                                ),
                                child: Text(l10n.consumerViewCase),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
