import 'package:flutter/material.dart';

import '../../../../core/models/prompt_refinement.dart';
import '../../../../l10n/app_localizations.dart';

/// Shows a bottom sheet for reviewing an AI-refined prompt.
/// Returns the accepted query, or null if the user cancelled.
Future<String?> showPromptRefineSheet({
  required BuildContext context,
  required String originalPrompt,
  required String refinedPrompt,
  PromptRefinementHints? hints,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _PromptRefineSheet(
      originalPrompt: originalPrompt,
      refinedPrompt: refinedPrompt,
      hints: hints,
    ),
  );
}

class _PromptRefineSheet extends StatefulWidget {
  const _PromptRefineSheet({
    required this.originalPrompt,
    required this.refinedPrompt,
    this.hints,
  });

  final String originalPrompt;
  final String refinedPrompt;
  final PromptRefinementHints? hints;

  @override
  State<_PromptRefineSheet> createState() => _PromptRefineSheetState();
}

class _PromptRefineSheetState extends State<_PromptRefineSheet> {
  late final TextEditingController _controller;
  bool _showOriginal = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.refinedPrompt);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final hints = widget.hints;
    final chips = <Widget>[];
    if (hints?.jurisdiction != null) {
      chips.add(_hintChip(theme, l10n.promptRefineHintJurisdiction, hints!.jurisdiction!));
    }
    if (hints?.documentKind != null) {
      chips.add(_hintChip(theme, l10n.promptRefineHintDocument, hints!.documentKind!));
    }
    for (final party in hints?.parties ?? const <String>[]) {
      chips.add(_hintChip(theme, l10n.promptRefineHintParty, party));
    }
    for (final statute in hints?.statutes ?? const <String>[]) {
      chips.add(_hintChip(theme, l10n.promptRefineHintStatute, statute));
    }

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.promptRefineTitle,
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.promptRefineDescription,
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          InkWell(
            onTap: () => setState(() => _showOriginal = !_showOriginal),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.promptRefineYourOriginal,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  Icon(
                    _showOriginal ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
          if (_showOriginal) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Text(
                widget.originalPrompt,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            l10n.promptRefineRefinedLabel,
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            maxLines: 8,
            minLines: 5,
            decoration: InputDecoration(
              filled: true,
              fillColor: theme.colorScheme.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: chips),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              final text = _controller.text.trim();
              if (text.length < 3) return;
              Navigator.of(context).pop(text);
            },
            child: Text(l10n.promptRefineContinueRefined),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => Navigator.of(context).pop(widget.originalPrompt.trim()),
            child: Text(l10n.promptRefineUseOriginal),
          ),
        ],
      ),
    );
  }

  Widget _hintChip(ThemeData theme, String label, String value) {
    return Chip(
      label: Text('$label: $value', style: theme.textTheme.labelSmall),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}
