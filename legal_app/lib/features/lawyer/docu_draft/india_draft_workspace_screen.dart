import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';

// DEPRECATED: Section-based drafting-v2 UI is now folded into
// [DocuDraftWorkspaceScreen] via DraftAccuracyPanel + async v3 job polling.
// This file is kept for reference only and is not routed.
// Prefer `/lawyer/docu-draft/draft`.

// ── Data models ───────────────────────────────────────────────────────────

const _kAccent = Color(0xFF7C3AED);

enum SectionStatus {
  pending,
  generating,
  generated,
  failedVerification,
  repaired,
  edited,
  approved;

  static SectionStatus fromString(String s) {
    return switch (s) {
      'pending' => SectionStatus.pending,
      'generating' => SectionStatus.generating,
      'generated' => SectionStatus.generated,
      'failed_verification' => SectionStatus.failedVerification,
      'repaired' => SectionStatus.repaired,
      'edited' => SectionStatus.edited,
      'approved' => SectionStatus.approved,
      _ => SectionStatus.pending,
    };
  }

  String get label => switch (this) {
        SectionStatus.pending => 'Pending',
        SectionStatus.generating => 'Generating…',
        SectionStatus.generated => 'Generated',
        SectionStatus.failedVerification => 'Needs Repair',
        SectionStatus.repaired => 'Repaired',
        SectionStatus.edited => 'Edited',
        SectionStatus.approved => 'Approved',
      };

  Color get color => switch (this) {
        SectionStatus.pending => Colors.grey,
        SectionStatus.generating => _kAccent,
        SectionStatus.generated => Colors.blue,
        SectionStatus.failedVerification => Colors.red,
        SectionStatus.repaired => Colors.orange,
        SectionStatus.edited => Colors.purple,
        SectionStatus.approved => Colors.green,
      };
}

class DraftSection {
  final String id;
  final String title;
  final String sectionType;
  final String? content;
  final SectionStatus status;
  final int version;
  final int orderIndex;
  final String? modelUsed;

  const DraftSection({
    required this.id,
    required this.title,
    required this.sectionType,
    this.content,
    required this.status,
    required this.version,
    required this.orderIndex,
    this.modelUsed,
  });

  factory DraftSection.fromJson(Map<String, dynamic> json) {
    return DraftSection(
      id: json['id'] as String,
      title: json['title'] as String,
      sectionType: json['sectionType'] as String,
      content: json['content'] as String?,
      status: SectionStatus.fromString(json['status'] as String? ?? 'pending'),
      version: json['version'] as int? ?? 1,
      orderIndex: json['orderIndex'] as int? ?? 0,
      modelUsed: json['modelUsed'] as String?,
    );
  }
}

class DraftWorkspace {
  final String id;
  final String title;
  final String status;
  final double? costUsd;
  final String? jurisdiction;
  final List<DraftSection> sections;

  const DraftWorkspace({
    required this.id,
    required this.title,
    required this.status,
    this.costUsd,
    this.jurisdiction,
    required this.sections,
  });

  factory DraftWorkspace.fromJson(Map<String, dynamic> json) {
    final sectionsJson = json['sections'] as List<dynamic>? ?? [];
    return DraftWorkspace(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'draft',
      costUsd: (json['costUsd'] as num?)?.toDouble(),
      jurisdiction: json['jurisdiction'] as String?,
      sections: sectionsJson
          .map((s) => DraftSection.fromJson(s as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex)),
    );
  }
}

// ── Section status chip ───────────────────────────────────────────────────

class SectionStatusChip extends StatelessWidget {
  const SectionStatusChip({super.key, required this.status});
  final SectionStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: status.color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == SectionStatus.generating)
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: status.color,
              ),
            ),
          if (status == SectionStatus.generating) const SizedBox(width: 4),
          if (status == SectionStatus.approved)
            Icon(Icons.check_circle_outline, size: 12, color: status.color),
          if (status == SectionStatus.approved) const SizedBox(width: 4),
          if (status == SectionStatus.failedVerification)
            Icon(Icons.warning_amber_outlined, size: 12, color: status.color),
          if (status == SectionStatus.failedVerification) const SizedBox(width: 4),
          Text(
            status.label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: status.color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section item (expandable) ─────────────────────────────────────────────

class _SectionItem extends StatefulWidget {
  const _SectionItem({
    required this.section,
    required this.tenantId,
    required this.onApprove,
    required this.onGenerate,
    required this.onSave,
  });

  final DraftSection section;
  final String tenantId;
  final Future<void> Function(String sectionId) onApprove;
  final Future<void> Function(String sectionId) onGenerate;
  final Future<void> Function(String sectionId, String content) onSave;

  @override
  State<_SectionItem> createState() => _SectionItemState();
}

class _SectionItemState extends State<_SectionItem> {
  bool _expanded = false;
  late TextEditingController _contentController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _contentController = TextEditingController(text: widget.section.content ?? '');
  }

  @override
  void didUpdateWidget(covariant _SectionItem old) {
    super.didUpdateWidget(old);
    if (old.section.content != widget.section.content) {
      _contentController.text = widget.section.content ?? '';
    }
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isApproved = widget.section.status == SectionStatus.approved;
    final hasContent = (widget.section.content ?? '').isNotEmpty;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isApproved
            ? BorderSide(color: Colors.green.withValues(alpha: 0.4), width: 1.5)
            : BorderSide.none,
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.section.title,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SectionStatusChip(status: widget.section.status),
                  if (widget.section.version > 1) ...[
                    const SizedBox(width: 6),
                    Text(
                      'v${widget.section.version}',
                      style: TextStyle(
                        fontSize: 10,
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_expanded)
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: theme.dividerColor)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!hasContent && widget.section.status == SectionStatus.pending)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          const Text(
                            'No content yet.',
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () => widget.onGenerate(widget.section.id),
                            icon: const Icon(Icons.auto_awesome, size: 16),
                            label: const Text('Generate'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kAccent,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (widget.section.status == SectionStatus.generating)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: Column(
                          children: [
                            CircularProgressIndicator(strokeWidth: 2),
                            SizedBox(height: 8),
                            Text('Generating…', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          ],
                        ),
                      ),
                    )
                  else ...[
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: TextField(
                        controller: _contentController,
                        maxLines: null,
                        minLines: 5,
                        readOnly: isApproved,
                        style: const TextStyle(fontSize: 13, height: 1.6),
                        decoration: InputDecoration(
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          filled: true,
                          fillColor: isApproved
                              ? Colors.green.withValues(alpha: 0.05)
                              : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                          hintText: 'Section content…',
                        ),
                      ),
                    ),
                    if (!isApproved)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(
                          children: [
                            OutlinedButton(
                              onPressed: _saving
                                  ? null
                                  : () async {
                                      setState(() => _saving = true);
                                      try {
                                        await widget.onSave(
                                          widget.section.id,
                                          _contentController.text,
                                        );
                                      } finally {
                                        if (mounted) setState(() => _saving = false);
                                      }
                                    },
                              child: _saving
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Text('Save'),
                            ),
                            const SizedBox(width: 8),
                            if (widget.section.status == SectionStatus.generated ||
                                widget.section.status == SectionStatus.repaired ||
                                widget.section.status == SectionStatus.edited)
                              ElevatedButton.icon(
                                onPressed: () => widget.onApprove(widget.section.id),
                                icon: const Icon(Icons.shield_outlined, size: 16),
                                label: const Text('Approve'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.green,
                                  foregroundColor: Colors.white,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                  if (widget.section.modelUsed != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
                      child: Text(
                        'via ${widget.section.modelUsed}',
                        style: TextStyle(
                          fontSize: 10,
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Main screen ───────────────────────────────────────────────────────────

class IndiaDraftWorkspaceScreen extends ConsumerStatefulWidget {
  const IndiaDraftWorkspaceScreen({
    super.key,
    required this.workspaceId,
    required this.matterId,
  });

  final String workspaceId;
  final String matterId;

  @override
  ConsumerState<IndiaDraftWorkspaceScreen> createState() =>
      _IndiaDraftWorkspaceScreenState();
}

class _IndiaDraftWorkspaceScreenState
    extends ConsumerState<IndiaDraftWorkspaceScreen> {
  DraftWorkspace? _workspace;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWorkspace();
  }

  String? get _tenantId =>
      ref.read(authControllerProvider).session?.user.tenantId;

  Future<void> _loadWorkspace() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final tenantId = _tenantId ?? '';
      final resp = await client.dio.get<dynamic>(
        '/platform/drafting/workspaces/${widget.workspaceId}?tenantId=$tenantId',
      );
      final data = resp.data as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _workspace = DraftWorkspace.fromJson(data);
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

  Future<void> _generateSection(String sectionId) async {
    final tenantId = _tenantId ?? '';
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post<dynamic>(
        '/platform/drafting/sections/$sectionId/generate',
        data: {'tenantId': tenantId},
      );
      await _loadWorkspace();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Generate failed: $e')),
        );
      }
    }
  }

  Future<void> _approveSection(String sectionId) async {
    final tenantId = _tenantId ?? '';
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post<dynamic>(
        '/platform/drafting/sections/$sectionId/approve',
        data: {'tenantId': tenantId},
      );
      await _loadWorkspace();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Approve failed: $e')),
        );
      }
    }
  }

  Future<void> _saveSection(String sectionId, String content) async {
    final tenantId = _tenantId ?? '';
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch<dynamic>(
        '/platform/drafting/sections/$sectionId',
        data: {'content': content, 'tenantId': tenantId},
      );
      await _loadWorkspace();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e')),
        );
      }
    }
  }

  int get _approvedCount =>
      _workspace?.sections.where((s) => s.status == SectionStatus.approved).length ?? 0;

  int get _totalSections => _workspace?.sections.length ?? 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _workspace?.title ?? 'Drafting Workspace',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        actions: [
          if (_workspace != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text(
                  '$_approvedCount/$_totalSections',
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadWorkspace,
            tooltip: 'Refresh',
          ),
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
                      ElevatedButton(
                        onPressed: _loadWorkspace,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _workspace == null || _workspace!.sections.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.description_outlined,
                            size: 48,
                            color: Colors.grey,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No sections yet.',
                            style: TextStyle(color: Colors.grey),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Generate the draft plan to begin.',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadWorkspace,
                      child: Column(
                        children: [
                          // Progress bar
                          if (_totalSections > 0)
                            LinearProgressIndicator(
                              value: _approvedCount / _totalSections,
                              backgroundColor: Colors.grey.withValues(alpha: 0.15),
                              color: Colors.green,
                              minHeight: 3,
                            ),
                          Expanded(
                            child: ListView(
                              padding: const EdgeInsets.all(12),
                              children: [
                                // Summary chip row
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    if (_workspace!.jurisdiction != null)
                                      Chip(
                                        label: Text(
                                          _workspace!.jurisdiction!,
                                          style: const TextStyle(fontSize: 11),
                                        ),
                                        materialTapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    if (_workspace!.costUsd != null)
                                      Chip(
                                        label: Text(
                                          '\$${_workspace!.costUsd!.toStringAsFixed(4)}',
                                          style: const TextStyle(fontSize: 11),
                                        ),
                                        materialTapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                        visualDensity: VisualDensity.compact,
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                // Sections
                                for (final section in _workspace!.sections)
                                  _SectionItem(
                                    section: section,
                                    tenantId: _tenantId ?? '',
                                    onApprove: _approveSection,
                                    onGenerate: _generateSection,
                                    onSave: _saveSection,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }
}
