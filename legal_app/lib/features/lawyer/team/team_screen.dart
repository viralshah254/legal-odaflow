import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

// ─── Model ─────────────────────────────────────────────────────────────────────

class TeamMember {
  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String? avatarUrl;
  final String? practiceArea;
  final int? openMatterCount;

  const TeamMember({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
    this.avatarUrl,
    this.practiceArea,
    this.openMatterCount,
  });

  factory TeamMember.fromJson(Map<String, dynamic> j) => TeamMember(
        id: j['id'] as String,
        name: j['name'] as String? ?? j['email'] as String? ?? 'User',
        email: j['email'] as String? ?? '',
        role: j['tenantRole'] as String? ?? j['role'] as String? ?? 'MEMBER',
        status: j['status'] as String? ?? 'ACTIVE',
        avatarUrl: j['avatarUrl'] as String?,
        practiceArea: j['practiceArea'] as String?,
        openMatterCount: (j['openMatterCount'] as num?)?.toInt(),
      );
}

// ─── Provider ──────────────────────────────────────────────────────────────────

final teamProvider = FutureProvider.autoDispose<List<TeamMember>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  final resp = await api.dio.get<dynamic>(
    '/users',
    options: tenantId.isNotEmpty
        ? Options(headers: {'X-Tenant-Id': tenantId})
        : null,
  );
  final list = resp.data as List<dynamic>? ?? [];
  return list
      .whereType<Map<String, dynamic>>()
      .map(TeamMember.fromJson)
      .toList()
    ..sort((a, b) => a.name.compareTo(b.name));
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  String _filter = 'all';
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final teamAsync = ref.watch(teamProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Team'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(teamProvider),
          ),
        ],
      ),
      body: teamAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: AppListSkeleton(itemCount: 6, showTrailing: false),
        ),
        error: (e, _) => AppErrorView(
          message: e.toString(),
          onRetry: () => ref.invalidate(teamProvider),
        ),
        data: (members) {
          // Apply search + role filter
          var result = members;
          if (_searchQuery.isNotEmpty) {
            final q = _searchQuery.toLowerCase();
            result = result
                .where((m) =>
                    m.name.toLowerCase().contains(q) ||
                    m.email.toLowerCase().contains(q))
                .toList();
          }
          if (_filter != 'all') {
            result = result.where((m) => m.role == _filter).toList();
          }

          final roles = members.map((m) => m.role).toSet().toList()..sort();
          final filterOptions = [
            AppFilterOption(id: 'all', label: 'All', count: members.length),
            for (final r in roles)
              AppFilterOption(
                id: r,
                label: _roleLabel(r),
                count: members.where((m) => m.role == r).length,
              ),
          ];

          return Column(
            children: [
              AppPageHeader(
                title: 'Team',
                subtitle: 'Manage firm members and roles',
                count: members.length,
                accentColor: cs.primary,
                padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
              ),
              // Search bar
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: SearchBar(
                  controller: _searchCtrl,
                  hintText: 'Search members…',
                  leading: Icon(Icons.search, color: muted),
                  trailing: _searchQuery.isNotEmpty
                      ? [
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => setState(() {
                              _searchCtrl.clear();
                              _searchQuery = '';
                            }),
                          ),
                        ]
                      : null,
                  onChanged: (v) => setState(() => _searchQuery = v),
                  elevation: const WidgetStatePropertyAll(0),
                  backgroundColor: WidgetStatePropertyAll(surface),
                  shape: WidgetStatePropertyAll(RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radius),
                    side: BorderSide(color: border),
                  )),
                ),
              ),
              const SizedBox(height: 4),
              if (filterOptions.length > 1)
                AppFilterBar(
                  options: filterOptions,
                  selected: _filter,
                  onSelected: (id) => setState(() => _filter = id),
                ),
              Expanded(
                child: result.isEmpty
                    ? AppEmptyState(
                        icon: Icons.people_outline,
                        label: _searchQuery.isNotEmpty
                            ? 'No results for "$_searchQuery"'
                            : 'No team members',
                        sublabel: 'Invite team members from the web app.',
                      )
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(teamProvider),
                        child: ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(20, 8, 20, 96),
                          itemCount: result.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) =>
                              _MemberCard(member: result[i]),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _roleLabel(String r) => switch (r) {
        'OWNER' => 'Owner',
        'ADMIN' => 'Admin',
        'LAWYER' => 'Lawyer',
        'PARALEGAL' => 'Paralegal',
        'MEMBER' => 'Member',
        _ => r[0].toUpperCase() + r.substring(1).toLowerCase(),
      };
}

// ─── Member card ───────────────────────────────────────────────────────────────

class _MemberCard extends StatelessWidget {
  const _MemberCard({required this.member});
  final TeamMember member;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final initials = member.name.isNotEmpty
        ? member.name
            .split(' ')
            .take(2)
            .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
            .join()
        : '?';

    return AppCard(
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 22,
            backgroundColor: cs.primary.withValues(alpha: 0.15),
            backgroundImage: member.avatarUrl != null
                ? NetworkImage(member.avatarUrl!)
                : null,
            child: member.avatarUrl == null
                ? Text(
                    initials,
                    style: TextStyle(
                        color: cs.primary, fontWeight: FontWeight.w700),
                  )
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(member.name,
                    style: tt.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(member.email,
                    style: tt.bodySmall?.copyWith(color: muted),
                    overflow: TextOverflow.ellipsis),
                if (member.practiceArea?.isNotEmpty == true) ...[
                  const SizedBox(height: 2),
                  Text(
                    member.practiceArea!,
                    style: tt.labelSmall?.copyWith(color: muted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppSemanticColors.bg(
                      AppSemanticColors.toneForStatus(member.status),
                      isDark: isDark),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _roleLabel(member.role),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: cs.primary,
                  ),
                ),
              ),
              if (member.openMatterCount != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${member.openMatterCount} matters',
                  style: tt.labelSmall?.copyWith(color: muted),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _roleLabel(String r) => switch (r) {
        'OWNER' => 'Owner',
        'ADMIN' => 'Admin',
        'LAWYER' => 'Lawyer',
        'PARALEGAL' => 'Paralegal',
        'MEMBER' => 'Member',
        _ => r,
      };
}
