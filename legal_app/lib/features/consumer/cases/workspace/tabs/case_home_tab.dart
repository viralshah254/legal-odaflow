import '../../../../../core/widgets/matter_intelligence_summary_card.dart';
import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/config/app_config.dart';
import '../../../../../core/models/models.dart';
import '../../../../../core/network/api_client.dart';
import '../../../../../core/providers/app_providers.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../widgets/legal_disclaimer.dart';
import '../../../../consent/ai_inference_consent_dialog.dart';
import '../../../../credits/widgets/credit_gate.dart';
import '../case_workspace_providers.dart';
import '../case_workspace_utils.dart';

class CaseHomeTab extends ConsumerStatefulWidget {
  const CaseHomeTab({super.key, required this.caseId});

  final String caseId;

  @override
  ConsumerState<CaseHomeTab> createState() => _CaseHomeTabState();
}

class _CaseHomeTabState extends ConsumerState<CaseHomeTab> {
  bool _generatingReport = false;
  String? _reportError;

  Future<void> _generateReport() async {
    final l10n = AppLocalizations.of(context);

    // Require AI inference consent before sending user data to third-party AI.
    final hasConsent = await requireAiInferenceConsent(context);
    if (!hasConsent || !mounted) return;

    setState(() {
      _generatingReport = true;
      _reportError = null;
    });
    try {
      await ref.read(consumersApiProvider).generateFullReport(widget.caseId);
      if (!mounted) return;
      ref.invalidate(caseDetailProvider(widget.caseId));
      ref.invalidate(creditWalletProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.consumerFullReportGenerated)),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _reportError = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _reportError = l10n.consumerFailedToGenerateReport);
    } finally {
      if (mounted) setState(() => _generatingReport = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final caseAsync = ref.watch(caseDetailProvider(widget.caseId));

    return caseAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox.shrink(),
      data: (item) => RefreshIndicator(
        onRefresh: () async =>
            ref.invalidate(caseDetailProvider(widget.caseId)),
        child: ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            MatterIntelligenceSummaryCard(
              profile: item.matterProfile,
              taskGraph: item.matterTaskGraph,
            ),
            if (item.facts != null && item.facts!.isNotEmpty) ...[
              _SectionHeader(title: l10n.consumerFacts),
              const SizedBox(height: 8),
              _BodyCard(child: Text(item.facts!)),
              const SizedBox(height: 16),
            ],
            if (item.desiredOutcome != null &&
                item.desiredOutcome!.isNotEmpty) ...[
              _SectionHeader(title: l10n.consumerDesiredOutcome),
              const SizedBox(height: 8),
              _BodyCard(child: Text(item.desiredOutcome!)),
              const SizedBox(height: 16),
            ],
            _SectionHeader(title: l10n.consumerNavReports),
            const SizedBox(height: 8),
            if (_reportError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _reportError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (item.reports.isEmpty)
              CreditGate(
                cost: 20,
                feature: 'Full Report',
                featureIcon: Icons.article_outlined,
                child: _BodyCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.consumerNoReportsYet),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed:
                              _generatingReport ? null : _generateReport,
                          icon: _generatingReport
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.auto_awesome, size: 18),
                          label: Text(
                            _generatingReport
                                ? l10n.consumerGenerating
                                : l10n.consumerGenerateFullReport,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...item.reports.map(
                (report) => _ReportSummaryCard(
                  report: report,
                  caseId: widget.caseId,
                ),
              ),
            if (item.reports.isNotEmpty) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _generatingReport ? null : _generateReport,
                icon: _generatingReport
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 16),
                label: Text(
                  _generatingReport
                      ? l10n.consumerGenerating
                      : l10n.consumerGenerateFullReport,
                ),
              ),
            ],
            const SizedBox(height: 20),
            _SectionHeader(title: l10n.consumerQuickLinks),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: () =>
                      context.go('/consumer/cases/${widget.caseId}/documents'),
                  child: Text(l10n.consumerNavDocuments),
                ),
                OutlinedButton(
                  onPressed: () => context.push(
                    '/consumer/documents?caseId=${widget.caseId}',
                  ),
                  child: Text(l10n.consumerUploadDocument2),
                ),
                if (AppConfig.enableLawyerReview)
                  OutlinedButton(
                    onPressed: () => context.push(
                      '/consumer/cases/${widget.caseId}/lawyer-review',
                    ),
                    child: Text(l10n.consumerRequestReview),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            const LegalDisclaimer(compact: true),
          ],
        ),
      ),
    );
  }
}

class _ReportSummaryCard extends StatelessWidget {
  const _ReportSummaryCard({required this.report, required this.caseId});

  final ConsumerLegalReport report;
  final String caseId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final riskColor = caseRiskColor(report.riskLevel);
    final preview = report.contentMarkdown ?? '';
    final excerpt = preview.length > 280
        ? '${preview.substring(0, 280).trim()}…'
        : preview;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  report.isPreview ? Icons.preview : Icons.article_outlined,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    report.title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (report.riskLevel != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: riskColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      report.riskLevel!,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: riskColor,
                      ),
                    ),
                  ),
              ],
            ),
            if (report.isPreview)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  l10n.consumerPreview,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.orange.shade700,
                  ),
                ),
              ),
            if (excerpt.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                excerpt,
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 12),
            const LegalDisclaimer(compact: true),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                FilledButton.tonal(
                  onPressed: () =>
                      context.go('/consumer/cases/$caseId/report'),
                  child: Text(l10n.consumerViewFullReport),
                ),
                if (AppConfig.enableLawyerReview)
                  FilledButton(
                    onPressed: () => context.push(
                      '/consumer/cases/$caseId/lawyer-review',
                    ),
                    child: Text(l10n.consumerRequestReview),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context)
          .textTheme
          .titleMedium
          ?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

class _BodyCard extends StatelessWidget {
  const _BodyCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppColors.radius),
      ),
      child: child,
    );
  }
}
