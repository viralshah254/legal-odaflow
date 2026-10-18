import '../../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../../core/config/app_config.dart';
import '../../../../../../core/legal/report_sections.dart';
import '../../../../../../core/models/models.dart';
import '../../../../../../core/widgets/matter_intelligence_summary_card.dart';
import '../../../../../../widgets/legal_disclaimer.dart';

class ConsumerReportViewer extends StatelessWidget {
  const ConsumerReportViewer({
    super.key,
    required this.caseDetail,
    required this.isGenerating,
    required this.onGenerate,
    this.showBackButton = false,
    this.onBack,
  });

  final ConsumerCaseDetail caseDetail;
  final bool isGenerating;
  final VoidCallback onGenerate;
  final bool showBackButton;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final report = pickFullReport(caseDetail.reports);
    if (report == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(l10n.consumerNoReportAvailable),
        ),
      );
    }

    final sections = parseReportSections(report.contentMarkdown ?? '');

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (showBackButton && onBack != null)
          Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: onBack),
              Expanded(
                child: Text(
                  report.title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          )
        else
          Text(
            report.title,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              label: Text(
                report.isPreview ? l10n.consumerPreview : l10n.consumerFullReport,
              ),
            ),
            if (report.riskLevel != null)
              Chip(label: Text(l10n.consumerRiskLabel(report.riskLevel!))),
          ],
        ),
        const SizedBox(height: 8),
        Text('${caseDetail.issueType} · ${caseDetail.countryCode}'),
        if (caseDetail.matterProfile != null) ...[
          const SizedBox(height: 16),
          MatterIntelligenceSummaryCard(
            profile: caseDetail.matterProfile,
            taskGraph: caseDetail.matterTaskGraph,
          ),
        ],
        if (report.isPreview) ...[
          const SizedBox(height: 16),
          FilledButton(
            onPressed: isGenerating ? null : onGenerate,
            child: Text(
              isGenerating
                  ? l10n.consumerGenerating
                  : l10n.consumerGenerateFullReport,
            ),
          ),
        ],
        const SizedBox(height: 16),
        ...sections.map(
          (section) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${section.index + 1}. ${section.title}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    if (section.content.isEmpty)
                      Text(
                        l10n.consumerNotIncludedInThisReport,
                        style: Theme.of(context).textTheme.bodySmall,
                      )
                    else
                      SelectableText(section.content),
                  ],
                ),
              ),
            ),
          ),
        ),
        const LegalDisclaimer(compact: true),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.consumerGetThisReviewedByALawyer,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        l10n.consumerUpgradeToAVerifiedLawyerreviewedReport2,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                FilledButton.tonal(
                  onPressed: AppConfig.enableLawyerReview
                      ? () => context.push(
                            '/consumer/cases/${caseDetail.id}/lawyer-review',
                          )
                      : null,
                  child: Text(l10n.consumerRequestReview),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
