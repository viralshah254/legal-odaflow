import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/widgets.dart';

class AutomationRule {
  const AutomationRule({
    required this.id,
    required this.name,
    required this.description,
    required this.trigger,
    required this.action,
    required this.isActive,
    this.runCount = 0,
    this.lastRunAt,
  });

  final String id;
  final String name;
  final String description;
  final String trigger;
  final String action;
  final bool isActive;
  final int runCount;
  final String? lastRunAt;
}

class AutomationsScreen extends ConsumerStatefulWidget {
  const AutomationsScreen({super.key});

  @override
  ConsumerState<AutomationsScreen> createState() => _AutomationsScreenState();
}

class _AutomationsScreenState extends ConsumerState<AutomationsScreen> {
  final _automations = <AutomationRule>[
    const AutomationRule(
      id: '1',
      name: 'Auto-assign new leads',
      description:
          'When a new lead arrives from the marketplace, automatically assign to the intake queue and notify the intake team.',
      trigger: 'New Lead Received',
      action: 'Assign to Intake Queue + Notify Team',
      isActive: true,
      runCount: 42,
      lastRunAt: '2 hours ago',
    ),
    const AutomationRule(
      id: '2',
      name: 'Invoice overdue reminder',
      description:
          'Send automated payment reminder when an invoice is 7 days overdue.',
      trigger: 'Invoice 7 days overdue',
      action: 'Send Payment Reminder Email',
      isActive: true,
      runCount: 18,
      lastRunAt: '1 day ago',
    ),
    const AutomationRule(
      id: '3',
      name: 'Matter status alert',
      description:
          'Alert assigned lawyer when a monitored regulation changes and affects an active matter.',
      trigger: 'Monitor Alert Triggered',
      action: 'Notify Assigned Lawyer',
      isActive: true,
      runCount: 7,
      lastRunAt: '3 days ago',
    ),
    const AutomationRule(
      id: '4',
      name: 'Deadline reminder',
      description:
          'Send a reminder 48 hours before any court deadline.',
      trigger: 'Court Deadline in 48h',
      action: 'Send Calendar Reminder + Notify',
      isActive: false,
      runCount: 0,
    ),
    const AutomationRule(
      id: '5',
      name: 'Document executed notification',
      description:
          'When a client signs a document, notify the matter lawyer and update the matter timeline.',
      trigger: 'Document Signed (e-Sign)',
      action: 'Notify Lawyer + Update Timeline',
      isActive: false,
      runCount: 3,
      lastRunAt: '1 week ago',
    ),
  ];

  late final List<bool> _activeStates;

  @override
  void initState() {
    super.initState();
    _activeStates = _automations.map((a) => a.isActive).toList();
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeStates.where((a) => a).length;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'Automations',
              subtitle: '$active of ${_automations.length} active',
              actions: [
                FilledButton.tonal(
                  onPressed: () => _showNewAutomationSheet(context),
                  child: const Text('New'),
                ),
              ],
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cs.primaryContainer.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.bolt_outlined,
                      color: cs.primary,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Automations run in the background and save hours of manual work each week.',
                        style: TextStyle(
                          color: cs.onPrimaryContainer,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => _AutomationCard(
                rule: _automations[i],
                isActive: _activeStates[i],
                onToggle: (val) => setState(() => _activeStates[i] = val),
              ),
              childCount: _automations.length,
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  void _showNewAutomationSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          top: 24,
          left: 24,
          right: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'New Automation',
              style: Theme.of(ctx).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Custom automation builder coming soon. Contact support to set up custom automations for your firm.',
              style: TextStyle(
                color: Theme.of(ctx).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AutomationCard extends StatelessWidget {
  const _AutomationCard({
    required this.rule,
    required this.isActive,
    required this.onToggle,
  });
  final AutomationRule rule;
  final bool isActive;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isActive
                        ? cs.primaryContainer
                        : cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.bolt,
                    color: isActive ? cs.primary : cs.onSurfaceVariant,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    rule.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
                Switch(
                  value: isActive,
                  onChanged: onToggle,
                  activeTrackColor: cs.primary,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              rule.description,
              style: TextStyle(
                color: cs.onSurfaceVariant,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _FlowBadge(
                  label: rule.trigger,
                  icon: Icons.play_arrow_outlined,
                  color: cs.tertiary,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(
                    Icons.arrow_forward,
                    size: 14,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                _FlowBadge(
                  label: rule.action,
                  icon: Icons.flash_on_outlined,
                  color: cs.primary,
                ),
              ],
            ),
            if (rule.runCount > 0 || rule.lastRunAt != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    Icons.history_outlined,
                    size: 13,
                    color: cs.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${rule.runCount} runs${rule.lastRunAt != null ? ' · Last: ${rule.lastRunAt}' : ''}',
                    style: TextStyle(
                      fontSize: 11,
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FlowBadge extends StatelessWidget {
  const _FlowBadge({
    required this.label,
    required this.icon,
    required this.color,
  });
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
