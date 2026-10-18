import '../../../l10n/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_status_badge.dart';

// ─── Providers ─────────────────────────────────────────────────────────────────

final clientDetailProvider = FutureProvider.family<FirmClientDetail, String>((
  ref,
  clientId,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref
      .watch(clientsApiProvider)
      .getClient(tenantId: tenantId, clientId: clientId);
});

final _clientDocumentsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((
  ref,
  clientId,
) async {
  final api = ref.watch(apiClientProvider);
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  final resp = await api.dio.get<dynamic>(
    '/documents',
    queryParameters: {'clientId': clientId},
    options: tenantId != null
        ? Options(headers: {'X-Tenant-Id': tenantId})
        : null,
  );
  final data = resp.data;
  if (data is List) {
    return data.whereType<Map<String, dynamic>>().toList();
  }
  if (data is Map && data['items'] is List) {
    return (data['items'] as List).whereType<Map<String, dynamic>>().toList();
  }
  return [];
});

final _clientInvoicesProvider =
    FutureProvider.family<List<FirmInvoice>, String>((
  ref,
  clientId,
) async {
  final api = ref.watch(apiClientProvider);
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  final resp = await api.dio.get<dynamic>(
    '/billing/invoices',
    queryParameters: {'clientId': clientId},
    options: tenantId != null
        ? Options(headers: {'X-Tenant-Id': tenantId})
        : null,
  );
  final list = resp.data as List<dynamic>? ?? [];
  return list.whereType<Map<String, dynamic>>().map(FirmInvoice.fromJson).toList();
});

// ─── Notes state ───────────────────────────────────────────────────────────────

final _clientNotesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((
  ref,
  clientId,
) async {
  final api = ref.watch(apiClientProvider);
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  try {
    final resp = await api.dio.get<dynamic>(
      '/clients/$clientId/notes',
      options: tenantId != null
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list.whereType<Map<String, dynamic>>().toList();
  } catch (_) {
    return [];
  }
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class ClientDetailScreen extends ConsumerWidget {
  const ClientDetailScreen({super.key, required this.clientId});

  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final clientAsync = ref.watch(clientDetailProvider(clientId));

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      body: clientAsync.when(
        loading: () => const Scaffold(
          body: Padding(
            padding: EdgeInsets.fromLTRB(20, 80, 20, 0),
            child: AppListSkeleton(itemCount: 5, showTrailing: false),
          ),
        ),
        error: (error, _) => Scaffold(
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            title: Text(l10n.clientsClient360),
          ),
          body: AppErrorView(
            message: error.toString(),
            onRetry: () => ref.invalidate(clientDetailProvider(clientId)),
          ),
        ),
        data: (client) => DefaultTabController(
          length: 5,
          child: Scaffold(
            backgroundColor: isDark ? AppColors.logoBlue : null,
            body: NestedScrollView(
              headerSliverBuilder: (ctx, _) => [
                // ── Sliver app bar with client info ─────────────────────
                SliverAppBar(
                  expandedHeight: 140,
                  pinned: true,
                  backgroundColor:
                      isDark ? AppColors.logoBlue : Colors.white,
                  foregroundColor: isDark
                      ? AppColors.foregroundDark
                      : AppColors.foregroundLight,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      padding:
                          const EdgeInsets.fromLTRB(20, 80, 20, 16),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.logoBlue : Colors.white,
                        border: Border(
                          bottom: BorderSide(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight,
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          // Avatar
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color:
                                  cs.primary.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                client.name.isNotEmpty
                                    ? client.name[0].toUpperCase()
                                    : '?',
                                style: tt.titleLarge?.copyWith(
                                  color: cs.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(client.name,
                                    style: tt.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 3),
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    if (client.clientCode != null)
                                      Text(client.clientCode!,
                                          style: tt.bodySmall
                                              ?.copyWith(color: muted)),
                                    if (client.type != null)
                                      AppStatusBadge(
                                          status: client.type!),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.edit_outlined),
                            tooltip: 'Edit client',
                            onPressed: () =>
                                _showEditDialog(context, ref, client),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // ── Pinned tab bar ───────────────────────────────────────
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _TabBarDelegate(
                    TabBar(
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      tabs: [
                        Tab(text: l10n.clientsTabsOverview),
                        Tab(text: l10n.clientsTabsMatters),
                        Tab(text: l10n.clientsTabsDocuments),
                        Tab(text: l10n.clientsTabsBilling),
                        Tab(text: l10n.clientsTabsNotes),
                      ],
                    ),
                    isDark,
                  ),
                ),
              ],
              body: TabBarView(
                children: [
                  _OverviewTab(client: client),
                  _MattersTab(clientId: clientId, matters: client.matters),
                  _DocumentsTab(clientId: clientId),
                  _BillingTab(clientId: clientId),
                  _NotesTab(clientId: clientId),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showEditDialog(
      BuildContext context, WidgetRef ref, FirmClientDetail client) {
    final emailCtrl = TextEditingController(text: client.email ?? '');
    final phoneCtrl = TextEditingController(text: client.phone ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit client'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(
                  labelText: 'Email', border: OutlineInputBorder()),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              decoration: const InputDecoration(
                  labelText: 'Phone', border: OutlineInputBorder()),
              keyboardType: TextInputType.phone,
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final tenantId = ref
                    .read(authControllerProvider)
                    .session
                    ?.user
                    .tenantId;
                if (tenantId == null) return;
                await ref.read(clientsApiProvider).patchClient(
                      tenantId: tenantId,
                      clientId: clientId,
                      email: emailCtrl.text.trim().isNotEmpty
                          ? emailCtrl.text.trim()
                          : null,
                      phone: phoneCtrl.text.trim().isNotEmpty
                          ? phoneCtrl.text.trim()
                          : null,
                    );
                ref.invalidate(clientDetailProvider(clientId));
              } catch (_) {}
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

// ─── Tab bar delegate (for SliverPersistentHeader) ─────────────────────────────

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar, this.isDark);
  final TabBar tabBar;
  final bool isDark;

  @override
  Widget build(
          BuildContext context, double shrinkOffset, bool overlapsContent) =>
      Container(
        color: isDark ? AppColors.logoBlue : Colors.white,
        child: tabBar,
      );

  @override
  double get maxExtent => 48;
  @override
  double get minExtent => 48;
  @override
  bool shouldRebuild(_TabBarDelegate old) => false;
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.client});
  final FirmClientDetail client;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    Widget infoRow(IconData icon, String label, String? value) => ListTile(
          dense: true,
          leading: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: cs.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: cs.primary, size: 16),
          ),
          title: Text(label,
              style:
                  tt.labelSmall?.copyWith(color: muted, letterSpacing: 0.2)),
          subtitle: Text(value?.isNotEmpty == true ? value! : '—',
              style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
      children: [
        Container(
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(color: border),
          ),
          child: Column(
            children: [
              infoRow(Icons.email_outlined, l10n.adminEmail, client.email),
              Divider(height: 1, color: border),
              infoRow(Icons.phone_outlined, l10n.authPhone, client.phone),
              Divider(height: 1, color: border),
              infoRow(Icons.public, l10n.adminCountry, client.countryCode),
              if (client.type != null) ...[
                Divider(height: 1, color: border),
                infoRow(Icons.business_outlined, 'Client type', client.type),
              ],
              if (client.clientCode != null) ...[
                Divider(height: 1, color: border),
                infoRow(
                    Icons.tag_outlined, 'Client code', client.clientCode),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(color: border),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.folder_open_outlined,
                    color: Color(0xFF10B981), size: 16),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.clientsActiveMatters,
                      style:
                          tt.labelSmall?.copyWith(color: muted)),
                  const SizedBox(height: 2),
                  Text(
                    l10n.clientsLinkedMattersCount(client.matters.length),
                    style: tt.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (client.contactPeople.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: cs.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Icon(Icons.people_outline,
                            color: cs.primary, size: 14),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Key Contacts',
                        style: tt.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: border),
                ...client.contactPeople.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final person = entry.value;
                  final initials = person.name
                      .split(' ')
                      .take(2)
                      .where((w) => w.isNotEmpty)
                      .map((w) => w[0].toUpperCase())
                      .join();
                  final subtitle = [
                    if (person.role != null && person.role!.isNotEmpty)
                      person.role!,
                    if (person.email != null && person.email!.isNotEmpty)
                      person.email!,
                  ].join(' · ');
                  return Column(
                    children: [
                      if (idx > 0) Divider(height: 1, color: border),
                      ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          radius: 16,
                          backgroundColor: cs.primary.withValues(alpha: 0.12),
                          child: Text(
                            initials,
                            style: tt.labelSmall?.copyWith(
                              color: cs.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(person.name,
                            style: tt.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w500)),
                        subtitle: subtitle.isNotEmpty
                            ? Text(subtitle,
                                style:
                                    tt.labelSmall?.copyWith(color: muted))
                            : null,
                        trailing: person.phone != null
                            ? Text(person.phone!,
                                style:
                                    tt.labelSmall?.copyWith(color: muted))
                            : null,
                      ),
                    ],
                  );
                }),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Matters tab ───────────────────────────────────────────────────────────────

class _MattersTab extends StatelessWidget {
  const _MattersTab({required this.clientId, required this.matters});
  final String clientId;
  final List<FirmMatter> matters;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final tt = Theme.of(context).textTheme;

    if (matters.isEmpty) {
      return AppEmptyState(
        icon: Icons.folder_off_outlined,
        label: l10n.clientsNoLinkedMatters,
        sublabel: l10n.clientsNoLinkedMattersHint,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
      itemCount: matters.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final matter = matters[index];
        return InkWell(
          onTap: () => context.go('/lawyer/matters/${matter.id}'),
          borderRadius: BorderRadius.circular(AppColors.radius),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(color: border),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(matter.title,
                          style: tt.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Text(
                          matter.practiceArea.isNotEmpty
                              ? matter.practiceArea
                              : '—',
                          style: tt.bodySmall?.copyWith(color: muted)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                AppStatusBadge(status: matter.status),
                const SizedBox(width: 6),
                Icon(Icons.chevron_right, color: muted, size: 18),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Documents tab ─────────────────────────────────────────────────────────────

class _DocumentsTab extends ConsumerWidget {
  const _DocumentsTab({required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(_clientDocumentsProvider(clientId));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme; // used for doc icon colour
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final tt = Theme.of(context).textTheme;

    return docsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: AppListSkeleton(itemCount: 5),
      ),
      error: (e, _) => AppErrorView(
        message: e.toString(),
        onRetry: () => ref.invalidate(_clientDocumentsProvider(clientId)),
      ),
      data: (docs) {
        if (docs.isEmpty) {
          return const AppEmptyState(
            icon: Icons.description_outlined,
            label: 'No documents yet',
            sublabel: 'Documents linked to this client matters will appear here.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(_clientDocumentsProvider(clientId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final doc = docs[i];
              final name = doc['fileName'] as String? ??
                  doc['name'] as String? ??
                  'Document';
              final mimeType =
                  doc['mimeType'] as String? ?? '';
              final sizeBytes =
                  (doc['fileSizeBytes'] as num?)?.toInt();
              final status = doc['ocrStatus'] as String?;
              return Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  border: Border.all(color: border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: cs.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        mimeType.contains('image')
                            ? Icons.image_outlined
                            : Icons.description_outlined,
                        color: cs.primary,
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: tt.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 2),
                          Text(
                            [
                              if (status != null) status,
                              if (sizeBytes != null)
                                '${(sizeBytes / 1024).toStringAsFixed(1)} KB',
                            ].join(' · '),
                            style:
                                tt.bodySmall?.copyWith(color: muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ─── Billing tab ───────────────────────────────────────────────────────────────

class _BillingTab extends ConsumerWidget {
  const _BillingTab({required this.clientId});
  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(_clientInvoicesProvider(clientId));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final tt = Theme.of(context).textTheme;

    return invoicesAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: AppListSkeleton(itemCount: 4),
      ),
      error: (e, _) => AppErrorView(
        message: e.toString(),
        onRetry: () =>
            ref.invalidate(_clientInvoicesProvider(clientId)),
      ),
      data: (invoices) {
        if (invoices.isEmpty) {
          return const AppEmptyState(
            icon: Icons.receipt_long_outlined,
            label: 'No invoices yet',
            sublabel: 'Invoices for this client will appear here.',
          );
        }
        final fmt = NumberFormat('#,##0.00');
        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(_clientInvoicesProvider(clientId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
            itemCount: invoices.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final inv = invoices[i];
              return Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 13),
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  border: Border.all(color: border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppSemanticColors.bg(
                            AppSemanticColors.toneForStatus(inv.status),
                            isDark: isDark),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.receipt_long_outlined,
                        color: AppSemanticColors.fg(
                            AppSemanticColors.toneForStatus(inv.status),
                            isDark: isDark),
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            inv.invoiceNumber ?? 'Invoice',
                            style: tt.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${inv.currency} ${fmt.format(inv.amount)}',
                            style:
                                tt.bodySmall?.copyWith(color: muted),
                          ),
                        ],
                      ),
                    ),
                    AppStatusBadge(status: inv.status),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ─── Notes tab ─────────────────────────────────────────────────────────────────

class _NotesTab extends ConsumerStatefulWidget {
  const _NotesTab({required this.clientId});
  final String clientId;

  @override
  ConsumerState<_NotesTab> createState() => _NotesTabState();
}

class _NotesTabState extends ConsumerState<_NotesTab> {
  bool _adding = false;
  final _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _addNote() async {
    final text = _noteCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _adding = true);
    try {
      final api = ref.read(apiClientProvider);
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;
      await api.dio.post<dynamic>(
        '/clients/${widget.clientId}/notes',
        data: {'content': text},
        options: tenantId != null
            ? Options(headers: {'X-Tenant-Id': tenantId})
            : null,
      );
      _noteCtrl.clear();
      ref.invalidate(_clientNotesProvider(widget.clientId));
    } catch (_) {}
    if (mounted) setState(() => _adding = false);
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(_clientNotesProvider(widget.clientId));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final tt = Theme.of(context).textTheme;

    return Column(
      children: [
        // Add note input
        Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: border),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _noteCtrl,
                  decoration: InputDecoration(
                    hintText: 'Add a note…',
                    filled: true,
                    fillColor: isDark ? AppColors.logoBlueSurface : Colors.white,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppColors.radius)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    isDense: true,
                  ),
                  maxLines: null,
                ),
              ),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: _adding ? null : _addNote,
                style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12)),
                child: _adding
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send, size: 16),
              ),
            ],
          ),
        ),
        // Notes list
        Expanded(
          child: notesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: AppListSkeleton(
                  itemCount: 4, showLeadingIcon: false, showTrailing: false),
            ),
            error: (e, _) => AppErrorView(message: e.toString()),
            data: (notes) {
              if (notes.isEmpty) {
                return AppEmptyState(
                  icon: Icons.notes_outlined,
                  label: 'No notes yet',
                  sublabel: 'Add internal notes about this client.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
                itemCount: notes.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final note = notes[i];
                  final content = note['content'] as String? ?? '';
                  final createdAt =
                      DateTime.tryParse(note['createdAt'] as String? ?? '');
                  final author = (note['author'] as Map<String, dynamic>?)?['name']
                          as String? ??
                      'You';
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: surface,
                      borderRadius: BorderRadius.circular(AppColors.radius),
                      border: Border.all(color: border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(content, style: tt.bodyMedium),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text(author,
                                style: tt.labelSmall?.copyWith(
                                    color: cs.primary,
                                    fontWeight: FontWeight.w600)),
                            const SizedBox(width: 6),
                            Text(
                              createdAt != null
                                  ? DateFormat('MMM d, yyyy').format(createdAt)
                                  : '',
                              style: tt.labelSmall
                                  ?.copyWith(color: muted),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
