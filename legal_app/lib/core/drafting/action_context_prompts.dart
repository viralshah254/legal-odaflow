class ActionContextField {
  const ActionContextField({
    required this.id,
    required this.label,
    required this.placeholder,
    this.multiline = false,
  });

  final String id;
  final String label;
  final String placeholder;
  final bool multiline;
}

class ActionContextPrompt {
  const ActionContextPrompt({
    required this.actionKey,
    required this.label,
    this.description,
    required this.placeholder,
    this.fields,
  });

  final String actionKey;
  final String label;
  final String? description;
  final String placeholder;
  final List<ActionContextField>? fields;
}

const _impugnedOrderPrompt = ActionContextPrompt(
  actionKey: 'obtain_impugned_order',
  label: 'Do you have the impugned order?',
  description:
      'Add court, date, section cited, and amount ordered — this improves form matching.',
  placeholder:
      'e.g. Family Court Ahmedabad, interim maintenance ₹1,00,000/month under DV Act §23, order dated 15 Feb 2025',
  fields: [
    ActionContextField(
      id: 'order_details',
      label: 'Order details',
      placeholder: 'Court, date, section, amount, parties',
      multiline: true,
    ),
  ],
);

final _obtainPrefix = RegExp(r'^Obtain:\s*(.+)$', caseSensitive: false);

ActionContextPrompt? getActionContextPrompt(String action) {
  final trimmed = action.trim();
  if (trimmed.isEmpty) return null;

  final obtainMatch = _obtainPrefix.firstMatch(trimmed);
  if (obtainMatch != null) {
    final item = obtainMatch.group(1)!.trim();
    if (RegExp(r'impugned\s+order', caseSensitive: false).hasMatch(item)) {
      return _impugnedOrderPrompt;
    }
    return ActionContextPrompt(
      actionKey: 'obtain_${item.toLowerCase().replaceAll(RegExp(r'\s+'), '_')}',
      label: 'Add details for: $item',
      description: 'Provide what you know — court, date, parties, or key excerpts.',
      placeholder: 'Details about $item…',
      fields: [
        ActionContextField(
          id: 'details',
          label: item,
          placeholder: 'Paste or describe $item',
          multiline: true,
        ),
      ],
    );
  }

  if (RegExp(r'draft|prepare|file|review|identify|gather|send', caseSensitive: false)
      .hasMatch(trimmed)) {
    return ActionContextPrompt(
      actionKey:
          'step_${trimmed.toLowerCase().replaceAll(RegExp(r'\s+'), '_').substring(0, trimmed.length.clamp(0, 40))}',
      label: 'Tell us more about this step',
      description: trimmed,
      placeholder: 'Additional context for: $trimmed',
      fields: const [
        ActionContextField(
          id: 'details',
          label: 'Your context',
          placeholder: 'What have you already done or what details apply?',
          multiline: true,
        ),
      ],
    );
  }

  return ActionContextPrompt(
    actionKey:
        'action_${trimmed.toLowerCase().replaceAll(RegExp(r'\s+'), '_').substring(0, trimmed.length.clamp(0, 40))}',
    label: 'Add context for this action',
    description: trimmed,
    placeholder: 'Details relevant to: $trimmed',
    fields: const [
      ActionContextField(
        id: 'details',
        label: 'Details',
        placeholder: 'Add any facts that help narrow the right form or draft',
        multiline: true,
      ),
    ],
  );
}

String buildSupplementalFromActionNotes(Map<String, String> actionNotes) {
  final lines = actionNotes.entries
      .where((e) => e.value.trim().isNotEmpty)
      .map((e) => 'Regarding "${e.key}": ${e.value.trim()}');
  return lines.join('\n').length > 2000
      ? lines.join('\n').substring(0, 2000)
      : lines.join('\n');
}
