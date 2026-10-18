import 'package:flutter/material.dart';

import '../../../../core/drafting/action_context_prompts.dart';

class ActionContextRefineBlock extends StatefulWidget {
  const ActionContextRefineBlock({
    super.key,
    this.nextBestAction,
    this.recommendedActions = const [],
    required this.actionNotes,
    required this.onActionNotesChange,
    required this.onRefine,
    this.loading = false,
    required this.title,
    required this.subtitle,
    required this.updateLabel,
  });

  final String? nextBestAction;
  final List<String> recommendedActions;
  final Map<String, String> actionNotes;
  final ValueChanged<Map<String, String>> onActionNotesChange;
  final VoidCallback onRefine;
  final bool loading;
  final String title;
  final String subtitle;
  final String updateLabel;

  @override
  State<ActionContextRefineBlock> createState() => _ActionContextRefineBlockState();
}

class _ActionContextRefineBlockState extends State<ActionContextRefineBlock> {
  late Set<String> _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.nextBestAction != null ? {widget.nextBestAction!} : {};
  }

  List<String> get _actions => [
        if (widget.nextBestAction != null) widget.nextBestAction!,
        ...widget.recommendedActions.where((a) => a != widget.nextBestAction),
      ];

  bool get _hasNotes =>
      widget.actionNotes.values.any((v) => v.trim().isNotEmpty);

  @override
  Widget build(BuildContext context) {
    if (_actions.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(widget.subtitle, style: theme.textTheme.bodySmall),
            const SizedBox(height: 12),
            ..._actions.map((action) {
              final prompt = getActionContextPrompt(action);
              final expanded = _expanded.contains(action);
              final isPrimary = action == widget.nextBestAction;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: isPrimary
                      ? theme.colorScheme.primary.withValues(alpha: 0.06)
                      : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                  child: Column(
                    children: [
                      ListTile(
                        title: Text(action, style: theme.textTheme.bodyMedium),
                        trailing: Icon(
                          expanded ? Icons.expand_less : Icons.expand_more,
                        ),
                        onTap: () => setState(() {
                          if (expanded) {
                            _expanded.remove(action);
                          } else {
                            _expanded.add(action);
                          }
                        }),
                      ),
                      if (expanded && prompt != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(prompt.label, style: theme.textTheme.labelMedium),
                              const SizedBox(height: 8),
                              TextField(
                                maxLines: 3,
                                decoration: InputDecoration(
                                  hintText: prompt.placeholder,
                                  border: const OutlineInputBorder(),
                                ),
                                controller: TextEditingController(
                                  text: widget.actionNotes[action] ?? '',
                                )..selection = TextSelection.collapsed(
                                    offset: (widget.actionNotes[action] ?? '').length,
                                  ),
                                onChanged: (v) => widget.onActionNotesChange({
                                  ...widget.actionNotes,
                                  action: v,
                                }),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonalIcon(
                onPressed: widget.loading || !_hasNotes ? null : widget.onRefine,
                icon: widget.loading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 18),
                label: Text(widget.updateLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
