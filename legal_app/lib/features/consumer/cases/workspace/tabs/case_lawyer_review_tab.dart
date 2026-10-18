import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/config/app_config.dart';
import '../../../../../core/legal/report_sections.dart';
import '../../../../../core/network/api_client.dart';
import '../../../../../core/providers/app_providers.dart';
import '../../../../../widgets/legal_disclaimer.dart';
import '../../../subscription/payment_checkout_screen.dart';
import '../case_workspace_providers.dart';

class CaseLawyerReviewTab extends ConsumerStatefulWidget {
  const CaseLawyerReviewTab({super.key, required this.caseId});

  final String caseId;

  @override
  ConsumerState<CaseLawyerReviewTab> createState() =>
      _CaseLawyerReviewTabState();
}

class _CaseLawyerReviewTabState extends ConsumerState<CaseLawyerReviewTab> {
  final _notesController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!AppConfig.enableLawyerReview) {
      setState(() => _error = 'Lawyer review is not enabled.');
      return;
    }

    final caseDetail = ref.read(caseDetailProvider(widget.caseId)).valueOrNull;
    if (caseDetail == null) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final pricing = await ref
          .read(pricingApiProvider)
          .getLawyerReviewPricing(caseDetail.countryCode);

      final report = pickFullReport(caseDetail.reports) ??
          (caseDetail.reports.isNotEmpty ? caseDetail.reports.first : null);

      final reviewRequest = await ref
          .read(marketplaceApiProvider)
          .createReviewRequest(
            consumerCaseId: caseDetail.id,
            countryCode: caseDetail.countryCode,
            issueType: caseDetail.issueType,
            price: pricing.price,
            currency: pricing.currency,
            consumerReportId: report?.id,
            jurisdiction: caseDetail.jurisdiction,
          );

      final payResult = await ref
          .read(marketplaceApiProvider)
          .payForReviewRequest(reviewRequest.id);

      if (!mounted) return;

      if (payResult.checkoutUrl != null &&
          payResult.checkoutUrl!.isNotEmpty) {
        final paid = await openPaymentCheckout(
          context,
          checkoutUrl: payResult.checkoutUrl!,
          title: AppLocalizations.of(context).consumerLawyerReview,
        );
        if (!mounted) return;
        if (paid == true) {
          setState(() => _submitted = true);
          return;
        }
      }

      setState(() => _submitted = true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Unable to submit review request.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final caseAsync = ref.watch(caseDetailProvider(widget.caseId));
    final pricingAsync = caseAsync.maybeWhen(
      data: (item) => ref.watch(lawyerReviewPricingProvider(item.countryCode)),
      orElse: () => null,
    );

    if (_submitted) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            color: Colors.green.withValues(alpha: 0.08),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 48, color: Colors.green.shade700),
                  const SizedBox(height: 12),
                  Text(
                    l10n.consumerLawyerReviewRequest,
                    style: Theme.of(context).textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.consumerUpgradeToAVerifiedLawyerreviewedReport2,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton.tonal(
                    onPressed: () =>
                        context.go('/consumer/cases/${widget.caseId}/report'),
                    child: Text(l10n.consumerViewFullReport),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return caseAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(
          error is ApiException ? error.message : 'Unable to load case',
        ),
      ),
      data: (caseDetail) {
        final report = pickFullReport(caseDetail.reports) ??
            (caseDetail.reports.isNotEmpty ? caseDetail.reports.first : null);

        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              l10n.consumerLawyerReviewRequest,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(l10n.consumerLawyerReviewDescription),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      caseDetail.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text('${caseDetail.issueType} · ${caseDetail.countryCode}'),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Text(l10n.consumerReviewFee),
                        const Spacer(),
                        pricingAsync?.when(
                              loading: () => const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                              error: (_, __) => const Text('—'),
                              data: (pricing) => Text(
                                '${pricing.price.toStringAsFixed(0)} ${pricing.currency}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ) ??
                            const Text('—'),
                      ],
                    ),
                    if (report != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Report: ${report.title}'
                        '${report.isPreview ? ' (${l10n.consumerPreview})' : ''}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text(l10n.consumerAdditionalContextOptional),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _notesController,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: l10n
                            .consumerDeadlinesPartiesOrQuestionsForTheReviewingLawyer,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _submitting ? null : _submit,
                        icon: _submitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.payment_outlined),
                        label: Text(
                          _submitting
                              ? l10n.consumerGenerating
                              : l10n.consumerPayAndRequestReview,
                        ),
                      ),
                    ),
                    if (report != null) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () => context.go(
                            '/consumer/cases/${widget.caseId}/report',
                          ),
                          child: Text(l10n.consumerViewFullReport),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const LegalDisclaimer(compact: true),
          ],
        );
      },
    );
  }
}
