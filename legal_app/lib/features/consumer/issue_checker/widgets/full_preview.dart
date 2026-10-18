import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/models/models.dart';
import '../../../../core/widgets/matter_intelligence_panel.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../widgets/legal_disclaimer.dart';
import 'win_probability_bar.dart';

const _riskColors = {
  'LOW': Color(0xFF16A34A),
  'MEDIUM': Color(0xFFD97706),
  'HIGH': Color(0xFFEA580C),
  'CRITICAL': Color(0xFFDC2626),
  'UNKNOWN': Color(0xFF6B7280),
};

class FullPreview extends StatelessWidget {
  const FullPreview({
    super.key,
    required this.preview,
  });

  final IssueCheckerPreviewResult preview;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final riskLevel = preview.riskLevel.toUpperCase();
    final riskColor = _riskColors[riskLevel] ?? _riskColors['UNKNOWN']!;
    final riskLabel = switch (riskLevel) {
      'LOW' => l10n.issueCheckerRiskLow,
      'HIGH' => l10n.issueCheckerRiskHigh,
      'CRITICAL' => l10n.issueCheckerRiskCritical,
      _ => l10n.issueCheckerRiskMedium,
    };

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Risk badge
        Wrap(
          spacing: 8,
          children: [
            Chip(
              label: Text(riskLabel),
              backgroundColor: riskColor.withValues(alpha: 0.12),
              side: BorderSide(color: riskColor.withValues(alpha: 0.4)),
              labelStyle: TextStyle(color: riskColor),
            ),
            if (preview.creditsRemaining != null)
              Chip(
                label: Text(
                  l10n.issueCheckerCreditsRemaining(
                      '${preview.creditsRemaining}'),
                ),
                avatar: const Icon(Icons.stars_outlined, size: 14),
              ),
          ],
        ),
        const SizedBox(height: 16),

        // Win probability
        if (preview.winProbability != null) ...[
          WinProbabilityBar(winProbability: preview.winProbability!),
          const SizedBox(height: 8),
        ],

        // Matter intelligence
        if (preview.matterProfile != null) ...[
          MatterIntelligencePanel(
            profile: preview.matterProfile,
            taskGraph: preview.matterTaskGraph,
          ),
          const SizedBox(height: 8),
        ],

        // Full markdown report
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: MarkdownBody(
              data: preview.outputMarkdown,
              selectable: true,
            ),
          ),
        ),

        if (preview.disclaimer.isNotEmpty) ...[
          const SizedBox(height: 12),
          const LegalDisclaimer(compact: true),
        ],

        // Case workspace CTA
        if (preview.caseId.isNotEmpty) ...[
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () =>
                context.go('/consumer/cases/${preview.caseId}'),
            icon: const Icon(Icons.folder_open_outlined),
            label: Text(l10n.issueCheckerOpenCaseWorkspace),
          ),
        ] else ...[
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => context.go('/consumer'),
            child: Text(l10n.commonGoToDashboard),
          ),
        ],
        const SizedBox(height: 40),
      ],
    );
  }
}
