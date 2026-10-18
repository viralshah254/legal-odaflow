import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

Options _dOpts(String tenantId) =>
    Options(headers: {'X-Tenant-Id': tenantId});

// ─── Models ──────────────────────────────────────────────────────────────────

class _TenantDoc {
  const _TenantDoc({
    required this.id,
    required this.title,
    required this.documentType,
  });

  factory _TenantDoc.fromJson(Map<String, dynamic> json) => _TenantDoc(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ??
            json['fileName'] as String? ??
            'Document',
        documentType: json['documentType'] as String? ?? 'GENERAL',
      );

  final String id;
  final String title;
  final String documentType;
}

class _DiligenceFinding {
  const _DiligenceFinding({
    required this.documentTitle,
    required this.issue,
    required this.riskLevel,
    this.recommendation,
  });

  factory _DiligenceFinding.fromJson(Map<String, dynamic> json) =>
      _DiligenceFinding(
        documentTitle: json['documentTitle'] as String? ?? 'Document',
        issue: json['issue'] as String? ?? '',
        riskLevel: json['riskLevel'] as String? ?? 'LOW',
        recommendation: json['recommendation'] as String?,
      );

  final String documentTitle;
  final String issue;
  final String riskLevel;
  final String? recommendation;
}

class _DiligenceJob {
  const _DiligenceJob({
    required this.id,
    required this.status,
    this.findings = const [],
    this.documentCount = 0,
    required this.createdAt,
  });

  factory _DiligenceJob.fromJson(Map<String, dynamic> json) {
    final findingsRaw = json['findings'] as List<dynamic>? ?? [];
    return _DiligenceJob(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      findings: findingsRaw
          .whereType<Map<String, dynamic>>()
          .map(_DiligenceFinding.fromJson)
          .toList(),
      documentCount: (json['documentCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  final String id;
  final String status;
  final List<_DiligenceFinding> findings;
  final int documentCount;
  final String createdAt;
}

// ─── Providers ───────────────────────────────────────────────────────────────

final _matterDocsProvider = FutureProvider.autoDispose
    .family<List<_TenantDoc>, ({String tenantId, String matterId})>(
  (ref, args) async {
    final api = ref.watch(apiClientProvider);
    final resp = await api.dio.get<dynamic>(
      '/documents',
      queryParameters: {'matterId': args.matterId},
      options: args.tenantId.isNotEmpty ? _dOpts(args.tenantId) : null,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(_TenantDoc.fromJson)
        .toList();
  },
);

final _diligenceJobsProvider = FutureProvider.autoDispose
    .family<List<_DiligenceJob>, ({String tenantId, String matterId})>(
  (ref, args) async {
    final api = ref.watch(apiClientProvider);
    try {
      final resp = await api.dio.get<dynamic>(
        '/matters/${args.matterId}/diligence',
        options: args.tenantId.isNotEmpty ? _dOpts(args.tenantId) : null,
      );
      final list = resp.data as List<dynamic>? ?? [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(_DiligenceJob.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  },
);

// ─── Screen ──────────────────────────────────────────────────────────────────

class MatterDiligenceScreen extends ConsumerStatefulWidget {
  const MatterDiligenceScreen({super.key, required this.matterId});
  final String matterId;

  @override
  ConsumerState<MatterDiligenceScreen> createState() =>
      _MatterDiligenceScreenState();
}

class _MatterDiligenceScreenState
    extends ConsumerState<MatterDiligenceScreen> {
  final Set<String> _selectedDocIds = {};
  bool _running = false;
  String? _expandedJobId;

  @override
  Widget build(BuildContext context) {
    final tenantId =
        ref.watch(authControllerProvider).session?.user.tenantId ?? '';
    final args = (tenantId: tenantId, matterId: widget.matterId);
    final docsAsync = ref.watch(_matterDocsProvider(args));
    final jobsAsync = ref.watch(_diligenceJobsProvider(args));

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            ref.refresh(_matterDocsProvider(args).future),
            ref.refresh(_diligenceJobsProvider(args).future),
          ]);
        },
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: AppPageHeader(
                title: 'Due Diligence',
                subtitle: 'Select documents and run AI review',
              ),
            ),

            // Run button
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(
                  children: [
                    Text(
                      'Select Documents to Review',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    if (_selectedDocIds.isNotEmpty)
                      FilledButton.tonal(
                        onPressed: _running
                            ? null
                            : () => _runDiligence(tenantId),
                        child: _running
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text('Run (${_selectedDocIds.length})'),
                      ),
                  ],
                ),
              ),
            ),

            docsAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 4),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: AppErrorView(
                  message: e.toString(),
                  onRetry: () {
                    // ignore: unused_result
                    ref.refresh(_matterDocsProvider(args).future);
                  },
                ),
              ),
              data: (docs) {
                if (docs.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.file_copy_outlined,
                      label: 'No documents',
                      sublabel:
                          'Upload documents to this matter to run diligence.',
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _DocSelectTile(
                      doc: docs[i],
                      selected: _selectedDocIds.contains(docs[i].id),
                      onToggle: () => setState(() {
                        if (_selectedDocIds.contains(docs[i].id)) {
                          _selectedDocIds.remove(docs[i].id);
                        } else {
                          _selectedDocIds.add(docs[i].id);
                        }
                      }),
                    ),
                    childCount: docs.length,
                  ),
                );
              },
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
                child: Text(
                  'Previous Reviews',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ),

            jobsAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 3),
              ),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
              data: (jobs) {
                if (jobs.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.history_outlined,
                      label: 'No reviews yet',
                      sublabel:
                          'Select documents above and run your first AI diligence review.',
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _DiligenceJobCard(
                      job: jobs[i],
                      expanded: _expandedJobId == jobs[i].id,
                      onToggle: () => setState(() {
                        _expandedJobId = _expandedJobId == jobs[i].id
                            ? null
                            : jobs[i].id;
                      }),
                    ),
                    childCount: jobs.length,
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }

  Future<void> _runDiligence(String tenantId) async {
    if (_selectedDocIds.isEmpty) return;
    setState(() => _running = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post<dynamic>(
        '/matters/${widget.matterId}/diligence',
        data: {'documentIds': _selectedDocIds.toList()},
        options: tenantId.isNotEmpty ? _dOpts(tenantId) : null,
      );
      setState(() => _selectedDocIds.clear());
      final args = (tenantId: tenantId, matterId: widget.matterId);
      // ignore: unused_result
      ref.refresh(_diligenceJobsProvider(args).future);
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Diligence review started. Results will appear shortly.',
          ),
        ),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }
}

// ─── Sub-widgets ─────────────────────────────────────────────────────────────

class _DocSelectTile extends StatelessWidget {
  const _DocSelectTile({
    required this.doc,
    required this.selected,
    required this.onToggle,
  });
  final _TenantDoc doc;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: CheckboxListTile(
        value: selected,
        onChanged: (_) => onToggle(),
        title: Text(
          doc.title,
          style: const TextStyle(fontWeight: FontWeight.w600),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          doc.documentType,
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
        ),
        secondary: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.description_outlined,
            color: cs.onPrimaryContainer,
            size: 20,
          ),
        ),
        activeColor: cs.primary,
        controlAffinity: ListTileControlAffinity.leading,
      ),
    );
  }
}

class _DiligenceJobCard extends StatelessWidget {
  const _DiligenceJobCard({
    required this.job,
    required this.expanded,
    required this.onToggle,
  });
  final _DiligenceJob job;
  final bool expanded;
  final VoidCallback onToggle;

  Color _statusColor(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return Colors.green;
      case 'RUNNING':
      case 'PENDING':
        return cs.primary;
      case 'FAILED':
        return cs.error;
      default:
        return cs.outline;
    }
  }

  Color _riskColor(BuildContext context, String risk) {
    switch (risk.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return Theme.of(context).colorScheme.error;
      case 'MEDIUM':
        return Colors.orange;
      default:
        return Colors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final statusColor = _statusColor(context, job.status);
    final criticalCount = job.findings
        .where((f) =>
            f.riskLevel.toUpperCase() == 'CRITICAL' ||
            f.riskLevel.toUpperCase() == 'HIGH')
        .length;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        children: [
          ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: job.status.toUpperCase() == 'RUNNING' ||
                      job.status.toUpperCase() == 'PENDING'
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: statusColor,
                      ),
                    )
                  : Icon(
                      job.status.toUpperCase() == 'COMPLETED'
                          ? Icons.check_circle_outline
                          : Icons.error_outline,
                      color: statusColor,
                      size: 20,
                    ),
            ),
            title: Text(
              '${job.documentCount} doc${job.documentCount == 1 ? '' : 's'} reviewed',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              '${job.findings.length} findings'
              '${criticalCount > 0 ? ' · $criticalCount high risk' : ''}',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    job.status,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  expanded ? Icons.expand_less : Icons.expand_more,
                  color: cs.onSurfaceVariant,
                ),
              ],
            ),
            onTap: onToggle,
          ),
          if (expanded && job.findings.isNotEmpty)
            ...job.findings.map(
              (f) => Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: _riskColor(context, f.riskLevel),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            f.riskLevel,
                            style: TextStyle(
                              color: _riskColor(context, f.riskLevel),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              f.documentTitle,
                              style: TextStyle(
                                color: cs.onSurfaceVariant,
                                fontSize: 11,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        f.issue,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      if (f.recommendation != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          f.recommendation!,
                          style: TextStyle(
                            color: cs.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          if (expanded && job.findings.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                'No findings for this review.',
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }
}
