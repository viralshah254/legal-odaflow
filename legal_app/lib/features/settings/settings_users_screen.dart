import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/app_card.dart';
import '../../core/widgets/app_empty_state.dart';
import '../../core/widgets/app_filter_bar.dart';
import '../../core/widgets/app_page_header.dart';
import '../../core/widgets/app_status_badge.dart';

class _FirmUser {
  const _FirmUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
    required this.joinedAt,
    this.avatarInitials,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String joinedAt;
  final String? avatarInitials;
}

class SettingsUsersScreen extends ConsumerStatefulWidget {
  const SettingsUsersScreen({super.key});

  @override
  ConsumerState<SettingsUsersScreen> createState() =>
      _SettingsUsersScreenState();
}

class _SettingsUsersScreenState extends ConsumerState<SettingsUsersScreen> {
  String _filter = 'ALL';

  final _users = const <_FirmUser>[
    _FirmUser(
      id: '1',
      name: 'Vikram Mehta',
      email: 'vikram@lawfirm.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: '1 year ago',
      avatarInitials: 'VM',
    ),
    _FirmUser(
      id: '2',
      name: 'Priya Sharma',
      email: 'priya@lawfirm.com',
      role: 'LAWYER',
      status: 'ACTIVE',
      joinedAt: '8 months ago',
      avatarInitials: 'PS',
    ),
    _FirmUser(
      id: '3',
      name: 'Rahul Gupta',
      email: 'rahul@lawfirm.com',
      role: 'PARALEGAL',
      status: 'ACTIVE',
      joinedAt: '3 months ago',
      avatarInitials: 'RG',
    ),
    _FirmUser(
      id: '4',
      name: 'Aisha Patel',
      email: 'aisha@lawfirm.com',
      role: 'LAWYER',
      status: 'INVITED',
      joinedAt: '2 days ago',
      avatarInitials: 'AP',
    ),
    _FirmUser(
      id: '5',
      name: 'Sanjay Kumar',
      email: 'sanjay@lawfirm.com',
      role: 'BILLING',
      status: 'ACTIVE',
      joinedAt: '6 months ago',
      avatarInitials: 'SK',
    ),
  ];

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All Users'),
    AppFilterOption(id: 'ACTIVE', label: 'Active'),
    AppFilterOption(id: 'INVITED', label: 'Invited'),
    AppFilterOption(id: 'ADMIN', label: 'Admins'),
    AppFilterOption(id: 'LAWYER', label: 'Lawyers'),
  ];

  List<_FirmUser> get _filtered {
    if (_filter == 'ALL') return _users;
    if (_filter == 'ACTIVE' || _filter == 'INVITED') {
      return _users.where((u) => u.status == _filter).toList();
    }
    return _users.where((u) => u.role == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final filtered = _filtered;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'Users & Permissions',
              subtitle: '${_users.length} team members',
              actions: [
                FilledButton.tonal(
                  onPressed: () => _showInviteSheet(context),
                  child: const Text('Invite'),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: AppFilterBar(
              options: _filterOptions,
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
          ),
          if (filtered.isEmpty)
            const SliverToBoxAdapter(
              child: AppEmptyState(
                icon: Icons.group_outlined,
                label: 'No users found',
                sublabel: 'Invite team members to collaborate.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _UserTile(user: filtered[i]),
                childCount: filtered.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showInviteSheet(context),
        backgroundColor: cs.primary,
        child: const Icon(Icons.person_add_outlined),
      ),
    );
  }

  void _showInviteSheet(BuildContext context) {
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
            Text('Invite Team Member',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Email Address',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: 'LAWYER',
              decoration: const InputDecoration(
                labelText: 'Role',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
              items: const [
                DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                DropdownMenuItem(value: 'LAWYER', child: Text('Lawyer')),
                DropdownMenuItem(
                    value: 'PARALEGAL', child: Text('Paralegal')),
                DropdownMenuItem(value: 'BILLING', child: Text('Billing')),
              ],
              onChanged: (_) {},
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Send Invitation'),
            ),
          ],
        ),
      ),
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});
  final _FirmUser user;

  Color _roleColor(BuildContext context, String role) {
    final cs = Theme.of(context).colorScheme;
    switch (role) {
      case 'ADMIN':
        return cs.error;
      case 'LAWYER':
        return cs.primary;
      case 'PARALEGAL':
        return cs.tertiary;
      default:
        return cs.outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final roleColor = _roleColor(context, user.role);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: roleColor.withValues(alpha: 0.15),
          child: Text(
            user.avatarInitials ?? user.name[0].toUpperCase(),
            style: TextStyle(
              color: roleColor,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                user.name,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            if (user.status == 'INVITED')
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Invited',
                  style: TextStyle(
                    fontSize: 10,
                    color: cs.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              user.email,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
            Row(
              children: [
                AppStatusBadge(status: user.role),
                const SizedBox(width: 8),
                Text(
                  'Joined ${user.joinedAt}',
                  style: TextStyle(
                      color: cs.onSurfaceVariant, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (_) {},
          itemBuilder: (_) => const [
            PopupMenuItem(
                value: 'edit', child: Text('Edit Role')),
            PopupMenuItem(
                value: 'resend',
                child: Text('Resend Invite')),
            PopupMenuItem(
                value: 'remove',
                child: Text('Remove User')),
          ],
        ),
        isThreeLine: true,
      ),
    );
  }
}
