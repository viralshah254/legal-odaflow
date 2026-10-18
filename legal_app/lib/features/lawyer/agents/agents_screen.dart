import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/widgets.dart';

// ─── Model ───────────────────────────────────────────────────────────────────

class AgentDefinition {
  const AgentDefinition({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.capabilities,
    required this.isRunning,
    this.lastRun,
    this.runsToday = 0,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final List<String> capabilities;
  final bool isRunning;
  final String? lastRun;
  final int runsToday;
  final IconData icon;
  final Color color;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

class AgentsScreen extends ConsumerStatefulWidget {
  const AgentsScreen({super.key});

  @override
  ConsumerState<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends ConsumerState<AgentsScreen> {
  String _filter = 'All';

  final _agents = <AgentDefinition>[
    AgentDefinition(
      id: 'research',
      name: 'Legal Research Agent',
      description:
          'Autonomously searches case law, statutes, and regulations to build comprehensive research memos.',
      category: 'Research',
      capabilities: [
        'Case law search',
        'Statute analysis',
        'Citation verification',
        'Research memos',
      ],
      isRunning: false,
      lastRun: '2 hours ago',
      runsToday: 5,
      icon: Icons.search_outlined,
      color: Colors.blue,
    ),
    AgentDefinition(
      id: 'drafting',
      name: 'Drafting Agent',
      description:
          'Generates first drafts of legal documents based on matter context and firm templates.',
      category: 'Drafting',
      capabilities: [
        'Document generation',
        'Template matching',
        'Clause library',
        'Redlining',
      ],
      isRunning: true,
      lastRun: 'Running now',
      runsToday: 3,
      icon: Icons.edit_outlined,
      color: Colors.purple,
    ),
    AgentDefinition(
      id: 'intake',
      name: 'Client Intake Agent',
      description:
          'Handles initial client screening, conflicts checks, and intake questionnaire processing.',
      category: 'Intake',
      capabilities: [
        'Conflict checks',
        'KYC screening',
        'Intake forms',
        'Lead scoring',
      ],
      isRunning: false,
      lastRun: '1 day ago',
      runsToday: 8,
      icon: Icons.person_search_outlined,
      color: Colors.teal,
    ),
    AgentDefinition(
      id: 'monitor',
      name: 'Regulatory Monitor Agent',
      description:
          'Continuously monitors legal developments, regulation changes, and court decisions relevant to active matters.',
      category: 'Monitoring',
      capabilities: [
        'Real-time alerts',
        'Regulation tracking',
        'Case law updates',
        'Matter matching',
      ],
      isRunning: true,
      lastRun: 'Active',
      runsToday: 0,
      icon: Icons.monitor_outlined,
      color: Colors.orange,
    ),
    AgentDefinition(
      id: 'billing',
      name: 'Billing Agent',
      description:
          'Reviews time entries, generates pre-bills, and flags billing anomalies for partner review.',
      category: 'Finance',
      capabilities: [
        'Time review',
        'Pre-bill generation',
        'UTBMS coding',
        'Anomaly detection',
      ],
      isRunning: false,
      lastRun: '3 days ago',
      runsToday: 0,
      icon: Icons.receipt_outlined,
      color: Colors.green,
    ),
    AgentDefinition(
      id: 'diligence',
      name: 'Due Diligence Agent',
      description:
          'Reviews uploaded documents for key risks, missing clauses, and compliance issues.',
      category: 'Review',
      capabilities: [
        'Risk identification',
        'Clause extraction',
        'Compliance review',
        'Issue flagging',
      ],
      isRunning: false,
      lastRun: '4 hours ago',
      runsToday: 2,
      icon: Icons.policy_outlined,
      color: Colors.red,
    ),
  ];

  List<String> get _categories => [
        'All',
        ..._agents.map((a) => a.category).toSet(),
      ];

  List<AgentDefinition> get _filtered => _filter == 'All'
      ? _agents
      : _agents.where((a) => a.category == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final running = _agents.where((a) => a.isRunning).length;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'AI Agents',
              subtitle: '$running running · ${_agents.length} total',
            ),
          ),

          SliverToBoxAdapter(
            child: AppFilterBar(
              options: _categories
                  .map((c) => AppFilterOption(id: c, label: c))
                  .toList(),
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
          ),

          SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => _AgentCard(agent: _filtered[i]),
              childCount: _filtered.length,
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

class _AgentCard extends StatefulWidget {
  const _AgentCard({required this.agent});
  final AgentDefinition agent;

  @override
  State<_AgentCard> createState() => _AgentCardState();
}

class _AgentCardState extends State<_AgentCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final agent = widget.agent;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
              color: agent.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(agent.icon, color: agent.color, size: 22),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    agent.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (agent.isRunning)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: cs.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: cs.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Running',
                          style: TextStyle(
                            fontSize: 10,
                            color: cs.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            subtitle: Text(
              agent.category,
              style: TextStyle(color: agent.color, fontSize: 12),
            ),
            trailing: IconButton(
              icon: Icon(
                _expanded ? Icons.expand_less : Icons.expand_more,
              ),
              onPressed: () => setState(() => _expanded = !_expanded),
            ),
            onTap: () => setState(() => _expanded = !_expanded),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: Text(
              agent.description,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
            ),
          ),

          if (_expanded) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: Text(
                'Capabilities',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurfaceVariant,
                  letterSpacing: 0.8,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: agent.capabilities
                    .map(
                      (cap) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: agent.color.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          cap,
                          style: TextStyle(
                            fontSize: 11,
                            color: agent.color,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                children: [
                  if (agent.lastRun != null) ...[
                    Icon(
                      Icons.history_outlined,
                      size: 13,
                      color: cs.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      agent.lastRun!,
                      style: TextStyle(
                        fontSize: 11,
                        color: cs.onSurfaceVariant,
                      ),
                    ),
                  ],
                  if (agent.runsToday > 0) ...[
                    const SizedBox(width: 12),
                    Text(
                      '${agent.runsToday} runs today',
                      style: TextStyle(
                        fontSize: 11,
                        color: cs.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const Spacer(),
                  FilledButton.tonal(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            agent.isRunning
                                ? '${agent.name} stopped'
                                : '${agent.name} triggered',
                          ),
                        ),
                      );
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: agent.isRunning
                          ? cs.errorContainer
                          : agent.color.withValues(alpha: 0.15),
                      foregroundColor:
                          agent.isRunning ? cs.onErrorContainer : agent.color,
                    ),
                    child: Text(agent.isRunning ? 'Stop' : 'Run Now'),
                  ),
                ],
              ),
            ),
          ] else
            const SizedBox(height: 16),
        ],
      ),
    );
  }
}
