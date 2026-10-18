import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/drafting/draft_navigation.dart';
import '../../../../core/models/draft_intent.dart';
import '../../../../core/widgets/matter_intelligence_panel.dart';
import '../../../../l10n/app_localizations.dart';
import '../providers/docu_draft_controller.dart';
import 'action_context_refine_block.dart';

const _accentColor = Color(0xFF7C3AED);

const _courtLabels = {
  'family_court': 'Family Court',
  'magistrate': 'Magistrate Court',
  'high_court': 'High Court',
  'district_court': 'District Court',
  'sessions_court': 'Sessions Court',
};

const _statuteLabels = {
  'hma_24': 'HMA §24',
  'bnss_144': 'BNSS §144',
  'dv_act': 'Domestic Violence Act',
};

const _orderTypeLabels = {
  'interim': 'Interim Order',
  'final': 'Final Order',
};

const _stateNames = {
  'GJ': 'Gujarat',
  'MH': 'Maharashtra',
  'KA': 'Karnataka',
  'TN': 'Tamil Nadu',
  'DL': 'Delhi',
};

class DraftIntentInputStep extends ConsumerWidget {
  const DraftIntentInputStep({
    super.key,
    this.fieldKey,
    required this.queryController,
    required this.intentFocusNode,
    this.heroCollapsed = false,
  });

  final Key? fieldKey;
  final TextEditingController queryController;
  final FocusNode intentFocusNode;
  final bool heroCollapsed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(docuDraftControllerProvider);
    final controller = ref.read(docuDraftControllerProvider.notifier);
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.docuDraftWhatToDraft,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            TextField(
              key: fieldKey,
              controller: queryController,
              focusNode: intentFocusNode,
              maxLines: heroCollapsed ? 4 : 6,
              minLines: heroCollapsed ? 3 : 4,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: 'e.g. maintenance petition, bail application, divorce…',
                filled: true,
                fillColor: theme.colorScheme.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: controller.setQuery,
            ),
            if (state.error != null) ...[
              const SizedBox(height: 12),
              Text(state.error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
          ],
        ),
      ),
    );
  }
}

class DraftContextReviewStep extends ConsumerWidget {
  const DraftContextReviewStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(docuDraftControllerProvider);
    final controller = ref.read(docuDraftControllerProvider.notifier);
    final analysis = state.analysisResult!;
    final ctx = analysis.context;
    final theme = Theme.of(context);

    final chips = <Widget>[];
    if (ctx.jurisdiction != null) {
      chips.add(_contextBadge(Icons.location_on_outlined, _stateNames[ctx.jurisdiction] ?? ctx.jurisdiction!));
    }
    if (ctx.court != null) {
      chips.add(_contextBadge(Icons.balance_outlined, _courtLabels[ctx.court] ?? ctx.court!));
    }
    if (ctx.statute != null) {
      chips.add(_contextBadge(Icons.menu_book_outlined, _statuteLabels[ctx.statute] ?? ctx.statute!));
    }
    if (ctx.orderType != null) {
      chips.add(_contextBadge(Icons.description_outlined, _orderTypeLabels[ctx.orderType] ?? ctx.orderType!));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.docuDraftContextDetected, style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        if (analysis.extractedFacts?.summaryLines.isNotEmpty == true ||
            chips.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (chips.isNotEmpty) ...[
                    Wrap(spacing: 8, runSpacing: 8, children: chips),
                    const SizedBox(height: 12),
                  ],
                  if (analysis.extractedFacts?.summaryLines.isNotEmpty == true) ...[
                    Text(l10n.docuDraftWhatWeUnderstood, style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    ...analysis.extractedFacts!.summaryLines.map(
                      (line) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• '),
                            Expanded(child: Text(line)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        if (analysis.matterProfile != null)
          MatterIntelligencePanel(
            profile: analysis.matterProfile,
            taskGraph: analysis.taskGraph,
            recommendedActions: analysis.recommendedActions,
            issues: analysis.matterProfile!.issues,
            nextBestAction: analysis.nextBestAction,
            recommendationMode: analysis.recommendationMode,
            onLowConfidenceAction: () {
              // Scroll/focus handled by refine block below.
            },
          ),
        ActionContextRefineBlock(
          nextBestAction: analysis.nextBestAction,
          recommendedActions: analysis.recommendedActions ?? [],
          actionNotes: state.actionNotes,
          onActionNotesChange: (notes) {
            for (final e in notes.entries) {
              controller.setActionNote(e.key, e.value);
            }
          },
          onRefine: () => controller.refineAnalysis(),
          loading: state.analyzing,
          title: l10n.docuDraftRefineContext,
          subtitle: l10n.docuDraftRefineHint,
          updateLabel: l10n.docuDraftUpdateAnalysis,
        ),
        const SizedBox(height: 12),
        ...analysis.questions.map((q) => _QuestionCard(
              question: q,
              selected: state.answers[q.id],
              onSelect: (v) => controller.setAnswer(q.id, v),
            )),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: _accentColor),
            onPressed: state.loading ||
                    analysis.questions.any((q) => state.answers[q.id] == null)
                ? null
                : () => controller.resolve(),
            icon: state.loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.search),
            label: Text(l10n.docuDraftFindMatchingForms),
          ),
        ),
        if (state.error != null) ...[
          const SizedBox(height: 8),
          Text(state.error!, style: TextStyle(color: theme.colorScheme.error)),
        ],
      ],
    );
  }

  Widget _contextBadge(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _accentColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _accentColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: _accentColor),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.selected,
    required this.onSelect,
  });

  final ClarifyingQuestion question;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(question.prompt, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 8),
            RadioGroup<String>(
              groupValue: selected,
              onChanged: (v) {
                if (v != null) onSelect(v);
              },
              child: Column(
                children: question.options
                    .map(
                      (opt) => RadioListTile<String>(
                        title: Text(opt.label),
                        subtitle: opt.hint != null ? Text(opt.hint!) : null,
                        value: opt.value,
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DraftResultsStep extends ConsumerWidget {
  const DraftResultsStep({
    super.key,
    required this.onOpenWorkspace,
  });

  final void Function(DocuDraftRouteParams params) onOpenWorkspace;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(docuDraftControllerProvider);
    final controller = ref.read(docuDraftControllerProvider.notifier);
    final result = state.resolveResult!;
    final theme = Theme.of(context);

    final bundleMatches = result.matches
        .whereType<DraftIntentCuratedDraftMatch>()
        .where((m) => m.bundleRecommended)
        .toList()
      ..sort((a, b) => (a.bundleOrder ?? 0).compareTo(b.bundleOrder ?? 0));

    final hero = result.matches
        .whereType<DraftIntentCuratedDraftMatch>()
        .where((m) => !m.bundleRecommended)
        .cast<DraftIntentCuratedDraftMatch>()
        .fold<DraftIntentCuratedDraftMatch?>(
          null,
          (best, m) => best == null || m.confidence > best.confidence ? m : best,
        );

    final secondary = result.matches.where((m) {
      if (m is DraftIntentCuratedDraftMatch && m.bundleRecommended) return false;
      return m != hero;
    }).toList();

    final needsMiClarify = result.recommendationMode == 'clarification_required' &&
        (result.clarifyingQuestions?.isNotEmpty ?? false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${l10n.docuDraftResultsFor}: ${state.query.length > 60 ? '${state.query.substring(0, 60)}…' : state.query}',
          style: theme.textTheme.titleSmall,
        ),
        if (result.matterProfile != null)
          MatterIntelligencePanel(
            profile: result.matterProfile,
            taskGraph: result.taskGraph,
            recommendedActions: result.recommendedActions,
            issues: result.matterProfile!.issues,
            nextBestAction: result.nextBestAction,
            recommendationMode: result.recommendationMode,
            outcomeHint: result.outcomeHint,
          ),
        if (needsMiClarify) ...[
          ...(result.clarifyingQuestions ?? []).map(
            (q) => _MiQuestionCard(
              question: q,
              selected: state.answers[q.id],
              onSelect: (v) => controller.setAnswer(q.id, v),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: state.loading ? null : () => controller.resolve(),
              child: Text(l10n.docuDraftFindMatchingForms),
            ),
          ),
        ] else ...[
          if (bundleMatches.isNotEmpty) ...[
            Text(l10n.docuDraftRecommendedFilingSet, style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            ...bundleMatches.map(
              (m) => CheckboxListTile(
                value: state.selectedBundleKinds.contains(m.kind),
                onChanged: (v) => controller.toggleBundleKind(m.kind, v == true),
                title: Text(m.label),
                subtitle: Text('${(m.confidence * 100).round()}% match'),
              ),
            ),
            FilledButton.icon(
              onPressed: state.selectedBundleKinds.isEmpty
                  ? null
                  : () async {
                      final items = controller.selectedBundleItems();
                      await initDraftSet(items);
                      if (items.isNotEmpty) {
                        onOpenWorkspace(parseDraftUrl(items.first.draftUrl).copyWith(
                          details: state.query,
                          autoGenerate: true,
                        ));
                      }
                    },
              icon: const Icon(Icons.folder_copy_outlined),
              label: Text(l10n.docuDraftDraftSelected(state.selectedBundleKinds.length)),
            ),
            const SizedBox(height: 16),
          ],
          if (hero != null) ...[
            Card(
              color: _accentColor.withValues(alpha: 0.08),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(hero.label, style: theme.textTheme.titleMedium),
                    if (hero.proceduralNote != null) ...[
                      const SizedBox(height: 8),
                      Text(hero.proceduralNote!, style: theme.textTheme.bodySmall),
                    ],
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => onOpenWorkspace(
                        parseDraftUrl(hero.draftUrl).copyWith(details: state.query),
                      ),
                      child: Text(l10n.docuDraftDraftNow),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (secondary.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(l10n.docuDraftOtherMatches, style: theme.textTheme.labelLarge),
            ...secondary.map(
              (m) => ListTile(
                title: Text(m.summary),
                subtitle: Text('${m.type} · ${(m.confidence * 100).round()}%'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  final url = _matchUrl(m);
                  if (url != null) {
                    onOpenWorkspace(parseDraftUrl(url).copyWith(details: state.query));
                  }
                },
              ),
            ),
          ],
        ],
      ],
    );
  }

  String? _matchUrl(DraftIntentMatch m) {
    if (m is DraftIntentCuratedDraftMatch) return m.draftUrl;
    if (m is DraftIntentOfficialFormMatch) return m.draftUrl;
    if (m is DraftIntentGenerateMatch) return m.draftUrl;
    if (m is DraftIntentImportEditMatch) return m.draftUrl;
    return null;
  }
}

class _MiQuestionCard extends StatelessWidget {
  const _MiQuestionCard({
    required this.question,
    required this.selected,
    required this.onSelect,
  });

  final MiClarifyingQuestion question;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(question.text),
            RadioGroup<String>(
              groupValue: selected,
              onChanged: (v) {
                if (v != null) onSelect(v);
              },
              child: Column(
                children: question.options
                    .map(
                      (opt) => RadioListTile<String>(
                        title: Text(opt),
                        value: opt,
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
