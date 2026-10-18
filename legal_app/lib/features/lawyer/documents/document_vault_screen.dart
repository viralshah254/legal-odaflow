import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

class _VaultDoc {
  const _VaultDoc({
    required this.id,
    required this.title,
    required this.documentType,
    required this.status,
  });

  factory _VaultDoc.fromJson(Map<String, dynamic> json) => _VaultDoc(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ??
            json['fileName'] as String? ??
            'Document',
        documentType: json['documentType'] as String? ?? 'GENERAL',
        status: json['status'] as String? ?? '',
      );

  final String id;
  final String title;
  final String documentType;
  final String status;
}

final _vaultDocsProvider = FutureProvider.autoDispose<List<_VaultDoc>>(
  (ref) async {
    final tenantId =
        ref.watch(authControllerProvider).session?.user.tenantId ?? '';
    final api = ref.watch(apiClientProvider);
    final resp = await api.dio.get<dynamic>(
      '/documents',
      options: tenantId.isNotEmpty
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(_VaultDoc.fromJson)
        .toList();
  },
);

class DocumentVaultScreen extends ConsumerStatefulWidget {
  const DocumentVaultScreen({super.key});

  @override
  ConsumerState<DocumentVaultScreen> createState() =>
      _DocumentVaultScreenState();
}

class _DocumentVaultScreenState extends ConsumerState<DocumentVaultScreen> {
  String _filter = 'ALL';
  String _search = '';
  final _searchCtrl = TextEditingController();

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All'),
    AppFilterOption(id: 'CONTRACT', label: 'Contracts'),
    AppFilterOption(id: 'BRIEF', label: 'Briefs'),
    AppFilterOption(id: 'PLEADING', label: 'Pleadings'),
    AppFilterOption(id: 'EVIDENCE', label: 'Evidence'),
    AppFilterOption(id: 'CORRESPONDENCE', label: 'Correspondence'),
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final docsAsync = ref.watch(_vaultDocsProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(_vaultDocsProvider.future),
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: AppPageHeader(
                title: 'Document Vault',
                subtitle: 'All firm documents in one place',
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search documents...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _search = '');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: cs.surfaceContainerHighest,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                  onChanged: (v) => setState(() => _search = v.toLowerCase()),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: AppFilterBar(
                options: _filterOptions,
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
              ),
            ),
            docsAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 8),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: AppErrorView(
                  message: e.toString(),
                  onRetry: () => ref.refresh(_vaultDocsProvider.future),
                ),
              ),
              data: (docs) {
                var filtered = docs;
                if (_filter != 'ALL') {
                  filtered = filtered
                      .where(
                          (d) => d.documentType.toUpperCase() == _filter)
                      .toList();
                }
                if (_search.isNotEmpty) {
                  filtered = filtered
                      .where((d) =>
                          d.title.toLowerCase().contains(_search) ||
                          d.documentType.toLowerCase().contains(_search))
                      .toList();
                }

                if (filtered.isEmpty) {
                  return SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.folder_open_outlined,
                      label: _search.isNotEmpty
                          ? 'No documents match'
                          : 'No documents',
                      sublabel: 'Upload documents from a matter to see them here.',
                    ),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _DocumentTile(doc: filtered[i]),
                    childCount: filtered.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.doc});
  final _VaultDoc doc;

  IconData _iconForType(String type) {
    switch (type.toUpperCase()) {
      case 'CONTRACT':
        return Icons.handshake_outlined;
      case 'BRIEF':
        return Icons.article_outlined;
      case 'PLEADING':
        return Icons.gavel_outlined;
      case 'EVIDENCE':
        return Icons.photo_library_outlined;
      case 'CORRESPONDENCE':
        return Icons.mail_outlined;
      default:
        return Icons.description_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            _iconForType(doc.documentType),
            color: cs.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          doc.title,
          style: const TextStyle(fontWeight: FontWeight.w600),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Row(
          children: [
            if (doc.documentType.isNotEmpty) ...[
              AppStatusBadge(status: doc.documentType),
              const SizedBox(width: 8),
            ],
            if (doc.status.isNotEmpty) AppStatusBadge(status: doc.status),
          ],
        ),
        trailing: PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert),
          onSelected: (_) {},
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'view', child: Text('View')),
            PopupMenuItem(value: 'download', child: Text('Download')),
            PopupMenuItem(value: 'share', child: Text('Share')),
          ],
        ),
      ),
    );
  }
}
