import 'package:flutter/material.dart';

import '../models/matter_intelligence.dart';
import '../../l10n/app_localizations.dart';

/// Full Matter Intelligence panel mirroring web MatterIntelligencePanel.
class MatterIntelligencePanel extends StatelessWidget {
  const MatterIntelligencePanel({
    super.key,
    this.profile,
    this.taskGraph,
    this.recommendedActions,
    this.issues,
    this.nextBestAction,
    this.recommendationMode,
    this.outcomeHint,
    this.onLowConfidenceAction,
  });

  final MatterProfile? profile;
  final MatterTaskGraph? taskGraph;
  final List<String>? recommendedActions;
  final List<String>? issues;
  final String? nextBestAction;
  final String? recommendationMode;
  final String? outcomeHint;
  final VoidCallback? onLowConfidenceAction;

  @override
  Widget build(BuildContext context) {
    if (profile == null) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final actions = recommendedActions ?? taskGraph?.recommendedActions ?? const <String>[];
    final issueList = issues ?? profile!.issues;
    final bestAction = nextBestAction ?? taskGraph?.nextBestAction;
    final showLowConfidence = recommendationMode == 'low_confidence';
    final confidencePct = (profile!.confidence * 100).round();

    final chips = <String>[
      if (profile!.practiceArea.isNotEmpty) _humanize(profile!.practiceArea),
      if (profile!.subPracticeArea != null) _humanize(profile!.subPracticeArea!),
      if (profile!.nature != 'unknown') _humanize(profile!.nature),
      if (profile!.forum != null && profile!.forum!.isNotEmpty)
        _humanize(profile!.forum!),
    ];

    return Semantics(
      label: 'Matter intelligence panel',
      child: Card(
        margin: const EdgeInsets.symmetric(vertical: 8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.psychology_outlined, color: theme.colorScheme.primary, size: 18),
                            const SizedBox(width: 8),
                            Text(l10n.matterIntelligenceTitle, style: theme.textTheme.titleSmall),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.matterIntelligenceSubtitle,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (showLowConfidence)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.amber.shade700.withValues(alpha: 0.5)),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        l10n.matterIntelligenceLowConfidenceBadge,
                        style: theme.textTheme.labelSmall?.copyWith(color: Colors.amber.shade800),
                      ),
                    ),
                ],
              ),
              if (chips.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: chips.map((c) => _TagChip(label: c)).toList(),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                l10n.matterIntelligenceConfidence.toUpperCase(),
                style: theme.textTheme.labelSmall?.copyWith(
                  letterSpacing: 0.6,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              _ConfidenceBar(confidence: profile!.confidence),
              if (outcomeHint != null && outcomeHint!.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(left: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      left: BorderSide(color: theme.colorScheme.primary.withValues(alpha: 0.4), width: 2),
                    ),
                  ),
                  child: Text(
                    outcomeHint!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
              if (bestAction != null && bestAction.trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: theme.colorScheme.primary.withValues(alpha: 0.25)),
                    color: theme.colorScheme.primary.withValues(alpha: 0.06),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.matterIntelligenceNextBestAction.toUpperCase(),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.primary,
                          letterSpacing: 0.6,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(bestAction, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ],
              if (actions.isNotEmpty) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(Icons.auto_awesome, size: 14, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Text(
                      l10n.matterIntelligenceRecommendedActions.toUpperCase(),
                      style: theme.textTheme.labelSmall?.copyWith(
                        letterSpacing: 0.6,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...actions.take(5).map(
                      (action) => Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: theme.colorScheme.outlineVariant),
                          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.arrow_forward, size: 16, color: theme.colorScheme.primary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(action, style: theme.textTheme.bodySmall)),
                          ],
                        ),
                      ),
                    ),
              ],
              if (issueList.isNotEmpty) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(Icons.list_alt_outlined, size: 14, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Text(
                      l10n.matterIntelligenceIssues.toUpperCase(),
                      style: theme.textTheme.labelSmall?.copyWith(
                        letterSpacing: 0.6,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...issueList.take(5).map(
                      (issue) => Padding(
                        padding: const EdgeInsets.only(bottom: 6, left: 4),
                        child: Container(
                          padding: const EdgeInsets.only(left: 12),
                          decoration: BoxDecoration(
                            border: Border(
                              left: BorderSide(color: theme.colorScheme.outlineVariant, width: 2),
                            ),
                          ),
                          child: Text(
                            issue,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ),
              ],
              if (showLowConfidence) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade700.withValues(alpha: 0.35)),
                    color: Colors.amber.shade50.withValues(alpha: 0.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.warning_amber_rounded, size: 18, color: Colors.amber.shade800),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              l10n.matterIntelligenceLowConfidenceBanner,
                              style: theme.textTheme.bodySmall?.copyWith(color: Colors.amber.shade900),
                            ),
                          ),
                        ],
                      ),
                      if (onLowConfidenceAction != null) ...[
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: onLowConfidenceAction,
                          child: Text(l10n.matterIntelligenceRefineDescription),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              if (taskGraph?.missingDocuments.isNotEmpty ?? false) ...[
                const SizedBox(height: 12),
                Text(
                  'Missing documents',
                  style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.error),
                ),
                ...taskGraph!.missingDocuments.take(4).map(
                      (doc) => Text('• $doc', style: theme.textTheme.bodySmall),
                    ),
              ],
              Semantics(
                label: 'Confidence $confidencePct percent',
                child: const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _humanize(String slug) =>
      slug.replaceAll('_', ' ').replaceFirst(slug[0], slug[0].toUpperCase());
}

class _ConfidenceBar extends StatelessWidget {
  const _ConfidenceBar({required this.confidence});

  final double confidence;

  @override
  Widget build(BuildContext context) {
    final pct = (confidence * 100).round().clamp(0, 100);
    final color = pct >= 80
        ? Colors.green
        : pct >= 50
            ? Colors.amber.shade600
            : Colors.red;

    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 6,
              backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text('$pct%', style: Theme.of(context).textTheme.labelMedium),
      ],
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
      backgroundColor: Theme.of(context).colorScheme.secondaryContainer.withValues(alpha: 0.5),
    );
  }
}
