import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/models/draft_intent.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

// ─── Model ─────────────────────────────────────────────────────────────────────

class DraftWorkspace {
  final String id;
  final String documentKind;
  final String? title;
  final String? clientName;
  final String status;
  final String? countryCode;
  final DateTime updatedAt;
  final int sectionCount;

  const DraftWorkspace({
    required this.id,
    required this.documentKind,
    this.title,
    this.clientName,
    required this.status,
    this.countryCode,
    required this.updatedAt,
    required this.sectionCount,
  });

  factory DraftWorkspace.fromJson(Map<String, dynamic> j) => DraftWorkspace(
        id: j['id'] as String,
        documentKind: j['documentKind'] as String? ??
            j['kind'] as String? ??
            'Document',
        title: j['title'] as String?,
        clientName: j['clientName'] as String?,
        status: j['status'] as String? ?? 'DRAFT',
        countryCode: j['countryCode'] as String?,
        updatedAt: DateTime.tryParse(j['updatedAt'] as String? ?? '') ??
            DateTime.now(),
        sectionCount: (j['sectionCount'] as num?)?.toInt() ?? 0,
      );
}

// ─── Provider ──────────────────────────────────────────────────────────────────

final savedDraftsProvider =
    FutureProvider.autoDispose<List<DraftWorkspace>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  final resp = await api.dio.get<dynamic>(
    '/drafting/workspaces',
    queryParameters: {'take': 50},
    options: tenantId.isNotEmpty
        ? Options(headers: {'X-Tenant-Id': tenantId})
        : null,
  );
  final list = (resp.data as List<dynamic>? ?? []);
  return list
      .whereType<Map<String, dynamic>>()
      .map(DraftWorkspace.fromJson)
      .toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
});

final draftHistoryProvider =
    FutureProvider.autoDispose<List<DraftHistoryItem>>((ref) async {
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId;
  return ref.watch(indiaDraftingApiProvider).getDraftHistory(
        limit: 30,
        tenantId: tenantId,
      );
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class SavedDraftsScreen extends ConsumerStatefulWidget {
  const SavedDraftsScreen({super.key});

  @override
  ConsumerState<SavedDraftsScreen> createState() => _SavedDraftsScreenState();
}

class _SavedDraftsScreenState extends ConsumerState<SavedDraftsScreen>
    with SingleTickerProviderStateMixin {
  String _filter = 'all';
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final draftsAsync = ref.watch(savedDraftsProvider);
    final historyAsync = ref.watch(draftHistoryProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Saved Drafts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New draft',
            onPressed: () => context.go('/lawyer/docu-draft'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(savedDraftsProvider);
              ref.invalidate(draftHistoryProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Workspaces'),
            Tab(text: 'AI history'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          draftsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: AppListSkeleton(itemCount: 6),
            ),
            error: (e, _) => AppErrorView(
              message: e is ApiException ? e.message : e.toString(),
              onRetry: () => ref.invalidate(savedDraftsProvider),
            ),
            data: (drafts) => _buildWorkspaces(drafts),
          ),
          historyAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: AppListSkeleton(itemCount: 6),
            ),
            error: (e, _) => AppErrorView(
              message: e is ApiException ? e.message : e.toString(),
              onRetry: () => ref.invalidate(draftHistoryProvider),
            ),
            data: (items) {
              if (items.isEmpty) {
                return const AppEmptyState(
                  icon: Icons.history,
                  label: 'No AI draft history yet',
                  sublabel: 'Generated India/US drafts will appear here.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final item = items[i];
                  return AppCard(
                    accentColor: const Color(0xFF7C3AED),
                    gradient: false,
                    onTap: () => context.go(
                      '/lawyer/docu-draft/draft'
                      '?kind=${Uri.encodeComponent(item.kind)}'
                      '&countryCode=${item.countryCode}'
                      '&draftId=${Uri.encodeComponent(item.id)}'
                      '&label=${Uri.encodeComponent(item.label ?? item.title)}'
                      '&details=${Uri.encodeComponent(item.preview)}',
                    ),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        item.preview,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(
                        item.kind,
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildWorkspaces(List<DraftWorkspace> drafts) {
    final statuses = drafts.map((d) => d.status).toSet().toList()..sort();
    final filterOptions = [
      AppFilterOption(id: 'all', label: 'All', count: drafts.length),
      for (final s in statuses)
        AppFilterOption(
          id: s,
          label: _statusLabel(s),
          count: drafts.where((d) => d.status == s).length,
        ),
    ];
    final filtered = _filter == 'all'
        ? drafts
        : drafts.where((d) => d.status == _filter).toList();

    return Column(
      children: [
        AppPageHeader(
          title: 'Saved Drafts',
          subtitle: 'Your AI-assisted document workspaces',
          count: drafts.length,
          accentColor: const Color(0xFF7C3AED),
          padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
        ),
        if (filterOptions.length > 1)
          AppFilterBar(
            options: filterOptions,
            selected: _filter,
            onSelected: (id) => setState(() => _filter = id),
          ),
        Expanded(
          child: filtered.isEmpty
              ? AppEmptyState(
                  icon: Icons.edit_note_outlined,
                  label: 'No drafts yet',
                  sublabel: 'Start a new draft from the DocuDraft hub.',
                  action: FilledButton.icon(
                    onPressed: () => context.go('/lawyer/docu-draft'),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('New draft'),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async => ref.invalidate(savedDraftsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) =>
                        _DraftCard(workspace: filtered[i]),
                  ),
                ),
        ),
      ],
    );
  }

  String _statusLabel(String s) => switch (s) {
        'DRAFT' => 'Draft',
        'IN_PROGRESS' => 'In progress',
        'COMPLETED' => 'Completed',
        'FINALIZED' => 'Finalized',
        _ => s[0].toUpperCase() + s.substring(1).toLowerCase(),
      };
}

class _DraftCard extends StatelessWidget {
  const _DraftCard({required this.workspace});
  final DraftWorkspace workspace;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final title = workspace.title?.isNotEmpty == true
        ? workspace.title!
        : workspace.documentKind;
    final subtitle = [
      if (workspace.clientName?.isNotEmpty == true) workspace.clientName,
      if (workspace.countryCode?.isNotEmpty == true) workspace.countryCode,
      if (workspace.sectionCount > 0)
        '${workspace.sectionCount} section${workspace.sectionCount != 1 ? 's' : ''}',
    ].join(' · ');

    return AppCard(
      accentColor: const Color(0xFF7C3AED),
      gradient: false,
      onTap: () {
        final kind = workspace.documentKind;
        final country = workspace.countryCode ?? 'IN';
        context.go(
          '/lawyer/docu-draft/draft'
          '?kind=${Uri.encodeComponent(kind)}'
          '&countryCode=$country'
          '&draftId=${Uri.encodeComponent(workspace.id)}'
          '&label=${Uri.encodeComponent(workspace.title ?? kind)}',
        );
      },
      child: Row(
        children: [
          AppIconBadge(
            icon: Icons.description_outlined,
            color: const Color(0xFF7C3AED),
            size: 42,
            iconSize: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: tt.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: tt.bodySmall?.copyWith(color: muted),
                      overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: 6),
                Text(
                  DateFormat('MMM d, yyyy').format(workspace.updatedAt),
                  style: tt.labelSmall?.copyWith(color: muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppStatusBadge(status: workspace.status),
              const SizedBox(height: 6),
              Icon(Icons.chevron_right, color: muted, size: 18),
            ],
          ),
        ],
      ),
    );
  }
}
