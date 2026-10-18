import 'package:flutter/material.dart';

import '../../core/models/matter_intelligence.dart';

/// Compact Matter Intelligence summary for lawyer matter detail + consumer case tabs (P19).
class MatterIntelligenceSummaryCard extends StatelessWidget {
  const MatterIntelligenceSummaryCard({
    super.key,
    this.profile,
    this.taskGraph,
  });

  final MatterProfile? profile;
  final MatterTaskGraph? taskGraph;

  @override
  Widget build(BuildContext context) {
    if (profile == null) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final actions = taskGraph?.recommendedActions ?? const <String>[];
    final issues = profile!.issues;
    final confidencePct = (profile!.confidence * 100).round();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.psychology_outlined, color: theme.colorScheme.primary, size: 20),
                const SizedBox(width: 8),
                Text('Matter intelligence', style: theme.textTheme.titleSmall),
                const Spacer(),
                Text('$confidencePct%', style: theme.textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (profile!.practiceArea.isNotEmpty)
                  Chip(label: Text(_humanize(profile!.practiceArea)), visualDensity: VisualDensity.compact),
                if (profile!.subPracticeArea != null)
                  Chip(label: Text(_humanize(profile!.subPracticeArea!)), visualDensity: VisualDensity.compact),
                if (profile!.nature != 'unknown')
                  Chip(label: Text(_humanize(profile!.nature)), visualDensity: VisualDensity.compact),
              ],
            ),
            if (taskGraph?.nextBestAction != null) ...[
              const SizedBox(height: 12),
              Text('Next best action', style: theme.textTheme.labelMedium),
              const SizedBox(height: 4),
              Text(taskGraph!.nextBestAction!, style: theme.textTheme.bodyMedium, maxLines: 4, overflow: TextOverflow.ellipsis),
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Recommended actions', style: theme.textTheme.labelMedium),
              const SizedBox(height: 4),
              ...actions.take(4).map(
                (a) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• '),
                      Expanded(child: Text(a, maxLines: 3, overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                ),
              ),
            ],
            if (issues.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Issues spotted', style: theme.textTheme.labelMedium),
              const SizedBox(height: 4),
              ...issues.take(3).map(
                (issue) => Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text('• $issue', style: theme.textTheme.bodySmall),
                ),
              ),
            ],
            if (taskGraph?.missingDocuments.isNotEmpty ?? false) ...[
              const SizedBox(height: 12),
              Text('Missing documents', style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.error)),
              ...taskGraph!.missingDocuments.take(3).map(
                (doc) => Text('• $doc', style: theme.textTheme.bodySmall),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _humanize(String slug) =>
      slug.replaceAll('_', ' ').replaceFirstMapped(RegExp(r'^\w'), (m) => m.group(0)!.toUpperCase());
}
