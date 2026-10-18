import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/app_card.dart';
import '../../core/widgets/app_page_header.dart';
import '../../core/widgets/app_section_header.dart';

class _Integration {
  const _Integration({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.isConnected,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final bool isConnected;
  final IconData icon;
  final Color color;
}

class SettingsIntegrationsScreen extends ConsumerStatefulWidget {
  const SettingsIntegrationsScreen({super.key});

  @override
  ConsumerState<SettingsIntegrationsScreen> createState() =>
      _SettingsIntegrationsScreenState();
}

class _SettingsIntegrationsScreenState
    extends ConsumerState<SettingsIntegrationsScreen> {
  final _integrations = <_Integration>[
    const _Integration(
      id: 'gmail',
      name: 'Gmail',
      description: 'Sync emails and attach to matters automatically.',
      category: 'Communication',
      isConnected: true,
      icon: Icons.mail_outline,
      color: Colors.red,
    ),
    const _Integration(
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Sync court dates and deadlines to your calendar.',
      category: 'Productivity',
      isConnected: true,
      icon: Icons.calendar_today_outlined,
      color: Colors.blue,
    ),
    const _Integration(
      id: 'drive',
      name: 'Google Drive',
      description: 'Store and access documents from Drive.',
      category: 'Storage',
      isConnected: false,
      icon: Icons.folder_outlined,
      color: Colors.green,
    ),
    const _Integration(
      id: 'zoom',
      name: 'Zoom',
      description: 'Launch video meetings directly from matters.',
      category: 'Communication',
      isConnected: false,
      icon: Icons.video_call_outlined,
      color: Colors.blue,
    ),
    const _Integration(
      id: 'stripe',
      name: 'Stripe',
      description: 'Accept online payments from clients.',
      category: 'Finance',
      isConnected: false,
      icon: Icons.payment_outlined,
      color: Colors.purple,
    ),
    const _Integration(
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync billing and accounting with QuickBooks.',
      category: 'Finance',
      isConnected: false,
      icon: Icons.account_balance_outlined,
      color: Colors.green,
    ),
    const _Integration(
      id: 'docusign',
      name: 'DocuSign',
      description: 'Send documents for legally-binding e-signatures.',
      category: 'Documents',
      isConnected: false,
      icon: Icons.draw_outlined,
      color: Colors.orange,
    ),
    const _Integration(
      id: 'slack',
      name: 'Slack',
      description: 'Receive matter alerts and notifications in Slack.',
      category: 'Communication',
      isConnected: false,
      icon: Icons.message_outlined,
      color: Colors.purple,
    ),
  ];

  late final List<bool> _connectedStates;

  @override
  void initState() {
    super.initState();
    _connectedStates = _integrations.map((i) => i.isConnected).toList();
  }

  Map<String, List<int>> get _grouped {
    final map = <String, List<int>>{};
    for (var i = 0; i < _integrations.length; i++) {
      (map[_integrations[i].category] ??= []).add(i);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final connected = _connectedStates.where((c) => c).length;
    final grouped = _grouped;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'Integrations',
              subtitle: '$connected of ${_integrations.length} connected',
            ),
          ),
          for (final entry in grouped.entries) ...[
            SliverToBoxAdapter(
              child: AppSectionHeader(title: entry.key),
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final idx = entry.value[i];
                  return _IntegrationCard(
                    integration: _integrations[idx],
                    isConnected: _connectedStates[idx],
                    onToggle: (val) =>
                        setState(() => _connectedStates[idx] = val),
                  );
                },
                childCount: entry.value.length,
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }
}

class _IntegrationCard extends StatelessWidget {
  const _IntegrationCard({
    required this.integration,
    required this.isConnected,
    required this.onToggle,
  });
  final _Integration integration;
  final bool isConnected;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: integration.color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            integration.icon,
            color: integration.color,
            size: 22,
          ),
        ),
        title: Text(
          integration.name,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          integration.description,
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
          maxLines: 2,
        ),
        trailing: Switch(
          value: isConnected,
          onChanged: onToggle,
          activeTrackColor: cs.primary,
        ),
        isThreeLine: true,
      ),
    );
  }
}
