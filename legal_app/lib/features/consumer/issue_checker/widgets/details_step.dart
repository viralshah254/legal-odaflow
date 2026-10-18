import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../issue_checker_constants.dart';

class DetailsStep extends StatefulWidget {
  const DetailsStep({
    super.key,
    required this.data,
    required this.onComplete,
    this.onBack,
    this.outcomeOptions = const [],
    this.loadingOutcomes = false,
  });

  final IssueCheckerWizardData data;
  final void Function(IssueCheckerWizardData data) onComplete;
  final VoidCallback? onBack;
  final List<String> outcomeOptions;
  final bool loadingOutcomes;

  @override
  State<DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends State<DetailsStep> {
  final _outcomeController = TextEditingController();
  final _partiesController = TextEditingController();
  String _urgencyLevel = 'MEDIUM';

  @override
  void initState() {
    super.initState();
    _urgencyLevel = widget.data.urgencyLevel.isNotEmpty
        ? widget.data.urgencyLevel
        : 'MEDIUM';
    _outcomeController.text = widget.data.desiredOutcome;
    _partiesController.text = widget.data.parties;
  }

  @override
  void dispose() {
    _outcomeController.dispose();
    _partiesController.dispose();
    super.dispose();
  }

  void _submit() {
    widget.onComplete(
      widget.data.copyWith(
        urgencyLevel: _urgencyLevel,
        desiredOutcome: _outcomeController.text.trim(),
        parties: _partiesController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.issueCheckerStepsDetails,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),

          // Urgency
          Text(
            l10n.issueCheckerChecklistUrgencyReviewed,
            style: theme.textTheme.labelLarge,
          ),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(
                value: 'LOW',
                label: Text(l10n.issueCheckerUrgencyLowShort),
              ),
              ButtonSegment(
                value: 'MEDIUM',
                label: Text(l10n.issueCheckerUrgencyMediumShort),
              ),
              ButtonSegment(
                value: 'HIGH',
                label: Text(l10n.issueCheckerUrgencyHighShort),
              ),
            ],
            selected: {_urgencyLevel},
            onSelectionChanged: (s) =>
                setState(() => _urgencyLevel = s.first),
          ),
          const SizedBox(height: 20),

          // Parties
          TextField(
            controller: _partiesController,
            decoration: InputDecoration(
              labelText: l10n.issueCheckerSuggestionFactsDefaultParties,
              hintText: l10n.issueCheckerParties,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Desired outcome
          if (widget.loadingOutcomes) ...[
            const LinearProgressIndicator(),
            const SizedBox(height: 8),
          ],
          if (widget.outcomeOptions.isNotEmpty) ...[
            Text(
              l10n.issueCheckerDesiredOutcomeOptional,
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: widget.outcomeOptions.map((o) {
                final selected = _outcomeController.text == o;
                return FilterChip(
                  label: Text(o),
                  selected: selected,
                  onSelected: (_) => setState(() {
                    _outcomeController.text = selected ? '' : o;
                  }),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _outcomeController,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: l10n.issueCheckerDesiredOutcomeOptional,
              border: const OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              if (widget.onBack != null) ...[
                OutlinedButton(
                  onPressed: widget.onBack,
                  child: Text(l10n.commonBack),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: FilledButton(
                  onPressed: _submit,
                  child: Text(l10n.commonContinue),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
