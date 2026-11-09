import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';

const _kAccent = Color(0xFF7C3AED);

// ── Data models ───────────────────────────────────────────────────────────

class _WorkbenchMatter {
  final String id;
  final String title;
  final String? practiceArea;
  final String? stage;
  final String? jurisdiction;

  const _WorkbenchMatter({
    required this.id,
    required this.title,
    this.practiceArea,
    this.stage,
    this.jurisdiction,
  });

  factory _WorkbenchMatter.fromJson(Map<String, dynamic> j) => _WorkbenchMatter(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Matter',
        practiceArea: j['practiceArea'] as String?,
        stage: j['stage'] as String?,
        jurisdiction: j['jurisdiction'] as String?,
      );
}

class _IntelligenceCard {
  final List<String> topIssues;
  final int activeContradictions;
  final int pendingDeadlines;
  final double? outcomeScore;
  final String? riskLevel;

  const _IntelligenceCard({
    required this.topIssues,
    required this.activeContradictions,
    required this.pendingDeadlines,
    this.outcomeScore,
    this.riskLevel,
  });

  factory _IntelligenceCard.fromJson(Map<String, dynamic> j) => _IntelligenceCard(
        topIssues: List<String>.from(j['topIssues'] as List<dynamic>? ?? []),
        activeContradictions: j['activeContradictions'] as int? ?? 0,
        pendingDeadlines: j['pendingDeadlines'] as int? ?? 0,
        outcomeScore: (j['outcomeScore'] as num?)?.toDouble(),
        riskLevel: j['riskLevel'] as String?,
      );
}

class _TimelineEvent {
  final String id;
  final String label;
  final String date;
  final String type;

  const _TimelineEvent({
    required this.id,
    required this.label,
    required this.date,
    required this.type,
  });

  factory _TimelineEvent.fromJson(Map<String, dynamic> j) => _TimelineEvent(
        id: j['id'] as String,
        label: j['label'] as String? ?? '',
        date: j['date'] as String? ?? '',
        type: j['type'] as String? ?? 'event',
      );
}

class _IssueItem {
  final String id;
  final String title;
  final String? status;
  final int elementCount;
  final int supportedElements;

  const _IssueItem({
    required this.id,
    required this.title,
    this.status,
    required this.elementCount,
    required this.supportedElements,
  });

  factory _IssueItem.fromJson(Map<String, dynamic> j) => _IssueItem(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Issue',
        status: j['status'] as String?,
        elementCount: j['elementCount'] as int? ?? 0,
        supportedElements: j['supportedElements'] as int? ?? 0,
      );
}

// ── Screen ────────────────────────────────────────────────────────────────

class MatterWorkbenchScreen extends ConsumerStatefulWidget {
  const MatterWorkbenchScreen({
    super.key,
    required this.matterId,
  });

  final String matterId;

  @override
  ConsumerState<MatterWorkbenchScreen> createState() =>
      _MatterWorkbenchScreenState();
}

class _MatterWorkbenchScreenState extends ConsumerState<MatterWorkbenchScreen> {
  _WorkbenchMatter? _matter;
  _IntelligenceCard? _intelligence;
  List<_TimelineEvent> _timeline = [];
  List<_IssueItem> _issues = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _tenantId =>
      ref.read(authControllerProvider).session?.user.tenantId;

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final tenantId = _tenantId ?? '';
      final matterId = widget.matterId;

      // Fetch matter details
      final matterResp = await api.dio.get<dynamic>('/matters/$matterId?tenantId=$tenantId');
      final matterData = matterResp.data as Map<String, dynamic>? ?? {};

      // Fetch intelligence data (non-fatal)
      Map<String, dynamic>? intelligenceData;
      try {
        final resp = await api.dio.get<dynamic>(
          '/platform/matter-intelligence/workbench/$matterId?tenantId=$tenantId',
        );
        intelligenceData = resp.data as Map<String, dynamic>?;
      } catch (_) {}

      // Fetch issues (non-fatal)
      List<dynamic>? issuesData;
      try {
        final resp = await api.dio.get<dynamic>(
          '/platform/matter-intelligence/issues/$matterId?tenantId=$tenantId',
        );
        issuesData = resp.data as List<dynamic>?;
      } catch (_) {}

      if (mounted) {
        setState(() {
          _matter = _WorkbenchMatter.fromJson(matterData);
          _intelligence = intelligenceData != null
              ? _IntelligenceCard.fromJson(intelligenceData)
              : null;
          _timeline = (intelligenceData?['timeline'] as List<dynamic>? ?? [])
              .map((e) => _TimelineEvent.fromJson(e as Map<String, dynamic>))
              .toList();
          _issues = (issuesData ?? [])
              .map((e) => _IssueItem.fromJson(e as Map<String, dynamic>))
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final matter = _matter;

    return Scaffold(
      appBar: AppBar(
        title: Text(matter?.title ?? 'Matter Workbench'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 40),
                      const SizedBox(height: 12),
                      Text('Error: $_error', textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (matter != null) _MatterHeader(matter: matter),
                        const SizedBox(height: 16),
                        if (_intelligence != null) ...[
                          _IntelligenceOverviewCard(card: _intelligence!),
                          const SizedBox(height: 16),
                        ],
                        if (_timeline.isNotEmpty) ...[
                          _TimelineMiniCard(events: _timeline),
                          const SizedBox(height: 16),
                        ],
                        if (_issues.isNotEmpty) ...[
                          _IssueTrackerCard(issues: _issues),
                          const SizedBox(height: 16),
                        ],
                        _QuickLaunchCard(matterId: widget.matterId),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
    );
  }
}

// ── Matter header card ────────────────────────────────────────────────────

class _MatterHeader extends StatelessWidget {
  const _MatterHeader({required this.matter});
  final _WorkbenchMatter matter;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              matter.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                if (matter.practiceArea != null)
                  _MatterChip(matter.practiceArea!, Icons.gavel_outlined),
                if (matter.stage != null)
                  _MatterChip(matter.stage!, Icons.timeline_outlined),
                if (matter.jurisdiction != null)
                  _MatterChip(matter.jurisdiction!, Icons.flag_outlined),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MatterChip extends StatelessWidget {
  const _MatterChip(this.label, this.icon);
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 14),
      label: Text(label, style: const TextStyle(fontSize: 11)),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }
}

// ── AI intelligence overview card ─────────────────────────────────────────

class _IntelligenceOverviewCard extends StatelessWidget {
  const _IntelligenceOverviewCard({required this.card});
  final _IntelligenceCard card;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.psychology_outlined, size: 18, color: _kAccent),
                const SizedBox(width: 8),
                const Text(
                  'AI Intelligence',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                if (card.riskLevel != null) _RiskBadge(card.riskLevel!),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _StatBubble(
                  label: 'Contradictions',
                  value: '${card.activeContradictions}',
                  color: card.activeContradictions > 0 ? Colors.red : Colors.green,
                  icon: Icons.warning_amber_outlined,
                ),
                const SizedBox(width: 8),
                _StatBubble(
                  label: 'Deadlines',
                  value: '${card.pendingDeadlines}',
                  color: card.pendingDeadlines > 0 ? Colors.orange : Colors.green,
                  icon: Icons.event_outlined,
                ),
                if (card.outcomeScore != null) ...[
                  const SizedBox(width: 8),
                  _StatBubble(
                    label: 'Outcome',
                    value: '${(card.outcomeScore! * 100).toStringAsFixed(0)}%',
                    color: _kAccent,
                    icon: Icons.trending_up,
                  ),
                ],
              ],
            ),
            if (card.topIssues.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Top Issues',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 4),
              for (final issue in card.topIssues.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    children: [
                      const Icon(Icons.chevron_right, size: 14, color: Colors.grey),
                      Expanded(
                        child: Text(issue, style: const TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RiskBadge extends StatelessWidget {
  const _RiskBadge(this.level);
  final String level;

  Color get _color => switch (level.toLowerCase()) {
        'critical' => Colors.red,
        'high' => Colors.orange,
        'medium' => Colors.amber,
        _ => Colors.green,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: _color.withValues(alpha: 0.3)),
      ),
      child: Text(
        level,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _color),
      ),
    );
  }
}

class _StatBubble extends StatelessWidget {
  const _StatBubble({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 18),
            ),
            Text(label, style: TextStyle(fontSize: 10, color: color)),
          ],
        ),
      ),
    );
  }
}

// ── Timeline mini card ────────────────────────────────────────────────────

class _TimelineMiniCard extends StatelessWidget {
  const _TimelineMiniCard({required this.events});
  final List<_TimelineEvent> events;

  @override
  Widget build(BuildContext context) {
    final shown = events.take(5).toList();
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.timeline, size: 18, color: _kAccent),
                SizedBox(width: 8),
                Text('Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 10),
            for (int i = 0; i < shown.length; i++)
              _TimelineRow(event: shown[i], isLast: i == shown.length - 1),
          ],
        ),
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.event, required this.isLast});
  final _TimelineEvent event;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(event.date);
    final dateStr = date != null ? DateFormat('MMM d').format(date) : event.date;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: _kAccent,
                shape: BoxShape.circle,
              ),
            ),
            if (!isLast)
              Container(
                width: 1,
                height: 28,
                color: Colors.grey.shade300,
              ),
          ],
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(event.label, style: const TextStyle(fontSize: 12)),
                ),
                Text(
                  dateStr,
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Issue tracker card ────────────────────────────────────────────────────

class _IssueTrackerCard extends StatelessWidget {
  const _IssueTrackerCard({required this.issues});
  final List<_IssueItem> issues;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.scale_outlined, size: 18, color: _kAccent),
                SizedBox(width: 8),
                Text('Issue Tracker', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 10),
            for (final issue in issues.take(5)) _IssueRow(issue: issue),
          ],
        ),
      ),
    );
  }
}

class _IssueRow extends StatelessWidget {
  const _IssueRow({required this.issue});
  final _IssueItem issue;

  @override
  Widget build(BuildContext context) {
    final progress = issue.elementCount > 0
        ? issue.supportedElements / issue.elementCount
        : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  issue.title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
              if (issue.elementCount > 0)
                Text(
                  '${issue.supportedElements}/${issue.elementCount}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
            ],
          ),
          if (issue.elementCount > 0) ...[
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.grey.shade200,
              color: progress >= 0.75
                  ? Colors.green
                  : progress >= 0.5
                      ? Colors.orange
                      : Colors.red,
              minHeight: 4,
              borderRadius: BorderRadius.circular(2),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Quick-launch actions card ─────────────────────────────────────────────

class _QuickLaunchCard extends StatelessWidget {
  const _QuickLaunchCard({required this.matterId});
  final String matterId;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Quick Actions',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 1.1,
              children: [
                _ActionButton(
                  icon: Icons.description_outlined,
                  label: 'Draft',
                  color: const Color(0xFF7C3AED),
                  onTap: () => context.push('/lawyer/matters/$matterId/draft'),
                ),
                _ActionButton(
                  icon: Icons.search_outlined,
                  label: 'Research',
                  color: const Color(0xFF0EA5E9),
                  onTap: () => context.push('/lawyer/research?matterId=${Uri.encodeComponent(matterId)}'),
                ),
                _ActionButton(
                  icon: Icons.file_copy_outlined,
                  label: 'Review',
                  color: const Color(0xFF10B981),
                  onTap: () => context.push('/lawyer/document-review'),
                ),
                _ActionButton(
                  icon: Icons.shield_outlined,
                  label: 'Evidence',
                  color: const Color(0xFFF59E0B),
                  onTap: () => context.push('/lawyer/matters/$matterId/evidence'),
                ),
                _ActionButton(
                  icon: Icons.analytics_outlined,
                  label: 'Intelligence',
                  color: const Color(0xFFEF4444),
                  onTap: () => context.push('/lawyer/matters/$matterId/ai'),
                ),
                _ActionButton(
                  icon: Icons.people_outlined,
                  label: 'Parties',
                  color: const Color(0xFF6B7280),
                  onTap: () => context.push('/lawyer/matters/$matterId/parties'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
