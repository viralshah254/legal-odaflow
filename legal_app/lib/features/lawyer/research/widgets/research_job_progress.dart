import 'package:flutter/material.dart';

/// Real phased progress for async research jobs (mirrors web LegalResearchProgress).
class ResearchJobPhaseProgress extends StatelessWidget {
  const ResearchJobPhaseProgress({
    super.key,
    this.phase,
    this.message,
    this.partialMarkdown,
  });

  final String? phase;
  final String? message;
  final String? partialMarkdown;

  static const phases = [
    ('classifying', 'Classifying question', Icons.manage_search_outlined),
    ('retrieving', 'Retrieving authorities', Icons.balance_outlined),
    ('generating', 'Drafting research memo', Icons.auto_awesome_outlined),
    ('verifying', 'Verifying support', Icons.verified_outlined),
    ('citation_audit', 'Auditing citations', Icons.fact_check_outlined),
    ('finalizing', 'Finalising', Icons.check_circle_outline),
  ];

  int get _activeIndex {
    if (phase == null) return 0;
    final idx = phases.indexWhere((p) => p.$1 == phase);
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeIndex;
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message ?? 'Running verified research…',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 16),
                ...List.generate(phases.length, (i) {
                  final p = phases[i];
                  final done = i < active;
                  final current = i == active;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Icon(
                          done
                              ? Icons.check_circle
                              : current
                                  ? p.$3
                                  : Icons.circle_outlined,
                          size: 18,
                          color: done || current
                              ? colorScheme.primary
                              : colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            p.$2,
                            style: TextStyle(
                              fontWeight:
                                  current ? FontWeight.w700 : FontWeight.w400,
                              color: done || current
                                  ? colorScheme.onSurface
                                  : colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        if (current)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
        if (partialMarkdown != null && partialMarkdown!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            'Draft preview',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: 6),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                partialMarkdown!,
                maxLines: 12,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
