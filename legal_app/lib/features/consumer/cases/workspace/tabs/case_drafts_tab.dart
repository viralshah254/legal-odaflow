import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/network/api_client.dart';
import '../case_workspace_providers.dart';
import '../../../../../core/widgets/matter_intelligence_panel.dart';
import '../case_workspace_utils.dart';

class CaseDraftsTab extends ConsumerWidget {
  const CaseDraftsTab({super.key, required this.caseId});

  final String caseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final draftsAsync = ref.watch(caseDraftsProvider(caseId));
    final caseAsync = ref.watch(caseDetailProvider(caseId));

    return draftsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            error is ApiException ? error.message : 'Unable to load drafts',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (drafts) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(caseDraftsProvider(caseId)),
        child: ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            caseAsync.maybeWhen(
              data: (item) => item.matterProfile != null
                  ? MatterIntelligencePanel(
                      profile: item.matterProfile,
                      taskGraph: item.matterTaskGraph,
                      nextBestAction: item.matterTaskGraph?.nextBestAction,
                    )
                  : const SizedBox.shrink(),
              orElse: () => const SizedBox.shrink(),
            ),
            Text(
              l10n.consumerDrafts,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              l10n.consumerEmptyDraftsDescription,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            if (drafts.isEmpty)
              _EmptyPanel(
                icon: Icons.edit_note_outlined,
                title: l10n.consumerNoDraftsYet,
                description: l10n.consumerEmptyDraftsDescription,
              )
            else
              ...drafts.map(
                (draft) => Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                draft.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primaryContainer,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                draft.status,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onPrimaryContainer,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (draft.updatedAt != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            formatCaseDate(draft.updatedAt!),
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ],
                        if (draft.content.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            draft.content.length > 240
                                ? '${draft.content.substring(0, 240).trim()}…'
                                : draft.content,
                            style: Theme.of(context).textTheme.bodySmall,
                            maxLines: 5,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 10),
                        FilledButton.tonal(
                          onPressed: () =>
                              context.go('/consumer/cases/$caseId/report'),
                          child: Text(l10n.consumerViewFullReport),
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
