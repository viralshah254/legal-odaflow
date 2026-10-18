import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../core/models/models.dart';
import '../../../../core/widgets/matter_intelligence_panel.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../widgets/legal_disclaimer.dart';
import 'inline_social_sign_up.dart';
import 'refinement_side_sheet.dart';
import 'win_probability_bar.dart';

const _riskColors = {
  'LOW': Color(0xFF16A34A),
  'MEDIUM': Color(0xFFD97706),
  'HIGH': Color(0xFFEA580C),
  'CRITICAL': Color(0xFFDC2626),
};

class TeaserPreview extends StatefulWidget {
  const TeaserPreview({
    super.key,
    required this.teaser,
    required this.refinementQuestions,
    required this.refinementQuestionsLoading,
    required this.isRefining,
    required this.onRefine,
    /// When provided (e.g. landing/welcome path), sign-in calls this instead of
    /// opening the refinement sheet. When null, the sheet opens on sign-in.
    this.onSignInSuccess,
  });

  final IssueCheckerTeaserResult teaser;
  final List<LeadPlanQuestion> refinementQuestions;
  final bool refinementQuestionsLoading;
  final bool isRefining;
  final void Function(Map<String, dynamic> answers) onRefine;
  final VoidCallback? onSignInSuccess;

  @override
  State<TeaserPreview> createState() => _TeaserPreviewState();
}

class _TeaserPreviewState extends State<TeaserPreview> {
  bool _sheetOpen = false;

  void _handleSignIn() {
    if (widget.onSignInSuccess != null) {
      widget.onSignInSuccess!();
    } else {
      setState(() => _sheetOpen = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final teaser = widget.teaser;
    final riskLevel = teaser.inferredRiskLevel;
    final riskColor = _riskColors[riskLevel] ?? _riskColors['MEDIUM']!;
    final riskLabel = switch (riskLevel) {
      'LOW' => l10n.issueCheckerRiskLow,
      'HIGH' => l10n.issueCheckerRiskHigh,
      'CRITICAL' => l10n.issueCheckerRiskCritical,
      _ => l10n.issueCheckerRiskMedium,
    };

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Header badges
            Wrap(
              spacing: 8,
              children: [
                Chip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.auto_awesome, size: 14),
                      const SizedBox(width: 4),
                      Text(l10n.issueCheckerFreeLegalPreview),
                    ],
                  ),
                ),
                Chip(
                  label: Text(riskLabel),
                  backgroundColor: riskColor.withValues(alpha: 0.12),
                  side: BorderSide(color: riskColor.withValues(alpha: 0.4)),
                  labelStyle: TextStyle(color: riskColor),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Title
            Text(
              teaser.suggestedTitle,
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              '${teaser.detectedIssueType} · ${l10n.issueCheckerSignUpForFullAnalysis}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),

            // Key bullets
            if (teaser.keyBullets.isNotEmpty) ...[
              const SizedBox(height: 16),
              ...teaser.keyBullets.map(
                (b) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 16, color: theme.colorScheme.primary),
                      const SizedBox(width: 8),
                      Expanded(child: Text(b)),
                    ],
                  ),
                ),
              ),
            ],

            // Win probability
            if (teaser.winProbability != null) ...[
              const SizedBox(height: 16),
              WinProbabilityBar(winProbability: teaser.winProbability!),
            ],

            // Matter intelligence
            if (teaser.matterProfile != null) ...[
              const SizedBox(height: 8),
              MatterIntelligencePanel(
                profile: teaser.matterProfile,
                taskGraph: teaser.matterTaskGraph,
              ),
            ],

            // Blurred teaser markdown
            if (teaser.teaserMarkdown.isNotEmpty) ...[
              const SizedBox(height: 16),
              Stack(
                children: [
                  IgnorePointer(
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: MarkdownBody(
                          data: teaser.teaserMarkdown,
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            theme.colorScheme.surface.withValues(alpha: 0.0),
                            theme.colorScheme.surface.withValues(alpha: 0.85),
                            theme.colorScheme.surface,
                          ],
                          stops: const [0.0, 0.55, 0.85],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ],

            // Refinement question chips
            if (widget.refinementQuestionsLoading) ...[
              const SizedBox(height: 16),
              const LinearProgressIndicator(),
            ] else if (widget.refinementQuestions.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                l10n.issueCheckerGeneratingTargetedQuestions,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: widget.refinementQuestions.take(3).map((q) {
                  return ActionChip(
                    label: Text(
                      q.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onPressed: _handleSignIn,
                  );
                }).toList(),
              ),
            ],

            // Sign-up CTA
            const SizedBox(height: 20),
            InlineSocialSignUp(
              onSuccess: _handleSignIn,
            ),

            if (teaser.disclaimer.isNotEmpty) ...[
              const SizedBox(height: 16),
              const LegalDisclaimer(compact: true),
            ],
            const SizedBox(height: 40),
          ],
        ),

        // Refinement bottom sheet
        if (_sheetOpen)
          GestureDetector(
            onTap: () => setState(() => _sheetOpen = false),
            child: Container(color: Colors.black38),
          ),
        if (_sheetOpen)
          Align(
            alignment: Alignment.bottomCenter,
            child: RefinementSideSheet(
              questions: widget.refinementQuestions,
              isLoading: widget.refinementQuestionsLoading,
              isRefining: widget.isRefining,
              onRefine: (answers) {
                setState(() => _sheetOpen = false);
                widget.onRefine(answers);
              },
            ),
          ),
      ],
    );
  }
}
