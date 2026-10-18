import 'package:flutter/material.dart';

import '../../../../core/models/models.dart';
import '../../../../l10n/app_localizations.dart';
import 'intake_analysis_progress.dart';

/// Bottom sheet that presents AI planning questions and lets the user submit
/// answers to drive a more precise full preview.
class RefinementSideSheet extends StatefulWidget {
  const RefinementSideSheet({
    super.key,
    required this.questions,
    required this.isLoading,
    required this.isRefining,
    required this.onRefine,
  });

  final List<LeadPlanQuestion> questions;
  final bool isLoading;
  final bool isRefining;
  final void Function(Map<String, dynamic> answers) onRefine;

  @override
  State<RefinementSideSheet> createState() => _RefinementSideSheetState();
}

class _RefinementSideSheetState extends State<RefinementSideSheet> {
  final Map<String, dynamic> _answers = {};

  void _onAnswerChanged(String key, dynamic value) {
    setState(() => _answers[key] = value);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (widget.isRefining) {
      return const SizedBox(height: 300, child: IntakeAnalysisProgress());
    }

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scroll) {
        return Column(
          children: [
            Container(
              height: 4,
              width: 40,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: widget.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _QuestionsBody(
                      questions: widget.questions,
                      answers: _answers,
                      onAnswerChanged: _onAnswerChanged,
                      scrollController: scroll,
                    ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                8,
                16,
                16 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: FilledButton(
                onPressed: widget.isLoading
                    ? null
                    : () => widget.onRefine(_answers),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                child: Text(l10n.issueCheckerGetPreviewCredit),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _QuestionsBody extends StatelessWidget {
  const _QuestionsBody({
    required this.questions,
    required this.answers,
    required this.onAnswerChanged,
    required this.scrollController,
  });

  final List<LeadPlanQuestion> questions;
  final Map<String, dynamic> answers;
  final void Function(String key, dynamic value) onAnswerChanged;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      children: [
        Text(
          l10n.matterIntelligenceRefineDescription,
          style: theme.textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.issueCheckerGeneratingTargetedQuestions,
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 20),
        if (questions.isEmpty)
          Text(
            l10n.issueCheckerFactsReady,
            style: theme.textTheme.bodyMedium,
          )
        else
          ...questions.map((q) {
            final key = q.key.isNotEmpty ? q.key : q.label;
            return Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: _QuestionWidget(
                question: q,
                answer: answers[key],
                onChanged: (v) => onAnswerChanged(key, v),
              ),
            );
          }),
      ],
    );
  }
}

class _QuestionWidget extends StatefulWidget {
  const _QuestionWidget({
    required this.question,
    required this.answer,
    required this.onChanged,
  });

  final LeadPlanQuestion question;
  final dynamic answer;
  final ValueChanged<dynamic> onChanged;

  @override
  State<_QuestionWidget> createState() => _QuestionWidgetState();
}

class _QuestionWidgetState extends State<_QuestionWidget> {
  late final TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(
      text: widget.answer?.toString() ?? '',
    );
  }

  @override
  void didUpdateWidget(covariant _QuestionWidget old) {
    super.didUpdateWidget(old);
    final next = widget.answer?.toString() ?? '';
    if (next != _textController.text) _textController.text = next;
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final q = widget.question;
    final answer = widget.answer;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          q.label,
          style: theme.textTheme.bodyMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        if (q.type == 'single')
          _SingleChoice(
            options: q.options,
            selected: answer as String?,
            onChanged: widget.onChanged,
          )
        else if (q.type == 'multi')
          _MultiChoice(
            options: q.options,
            selected: (answer as List?)?.cast<String>() ?? [],
            onChanged: widget.onChanged,
          )
        else
          TextField(
            controller: _textController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => widget.onChanged(v),
          ),
      ],
    );
  }
}

class _SingleChoice extends StatelessWidget {
  const _SingleChoice({
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  final List<String> options;
  final String? selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: options.map((o) {
        return ChoiceChip(
          label: Text(o),
          selected: selected == o,
          onSelected: (_) => onChanged(o),
        );
      }).toList(),
    );
  }
}

class _MultiChoice extends StatelessWidget {
  const _MultiChoice({
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  final List<String> options;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: options.map((o) {
        final isSelected = selected.contains(o);
        return FilterChip(
          label: Text(o),
          selected: isSelected,
          onSelected: (_) {
            final next = List<String>.from(selected);
            if (isSelected) {
              next.remove(o);
            } else {
              next.add(o);
            }
            onChanged(next);
          },
        );
      }).toList(),
    );
  }
}
