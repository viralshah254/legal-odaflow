import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/matter_parties_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

final _matterPartiesProvider = FutureProvider.autoDispose
    .family<List<MatterPartyRecord>, ({String tenantId, String matterId})>(
  (ref, args) => ref.watch(matterPartiesApiProvider).listParties(
        tenantId: args.tenantId,
        matterId: args.matterId,
      ),
);

class MatterPartiesScreen extends ConsumerStatefulWidget {
  const MatterPartiesScreen({super.key, required this.matterId});
  final String matterId;

  @override
  ConsumerState<MatterPartiesScreen> createState() =>
      _MatterPartiesScreenState();
}

class _MatterPartiesScreenState extends ConsumerState<MatterPartiesScreen> {
  String _filter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final tenantId =
        ref.watch(authControllerProvider).session?.user.tenantId ?? '';
    final args = (tenantId: tenantId, matterId: widget.matterId);
    final partiesAsync = ref.watch(_matterPartiesProvider(args));
    final cs = Theme.of(context).colorScheme;

    final filterOptions = [
      const AppFilterOption(id: 'ALL', label: 'All'),
      const AppFilterOption(id: 'CLIENT', label: 'Client'),
      const AppFilterOption(id: 'OPPOSING_PARTY', label: 'Opposing'),
      const AppFilterOption(id: 'OPPOSING_COUNSEL', label: 'Opp. Counsel'),
      const AppFilterOption(id: 'WITNESS', label: 'Witness'),
      const AppFilterOption(id: 'EXPERT', label: 'Expert'),
    ];

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.refresh(_matterPartiesProvider(args).future),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: AppPageHeader(
                title: 'Parties',
                subtitle: 'Manage all parties on this matter',
                actions: [
                  IconButton(
                    icon: const Icon(Icons.person_add_outlined),
                    tooltip: 'Add Party',
                    onPressed: () => _showAddSheet(context, tenantId),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: AppFilterBar(
                options: filterOptions,
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
              ),
            ),
            partiesAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: AppListSkeleton(itemCount: 5),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: AppErrorView(
                  message: e.toString(),
                  onRetry: () =>
                      ref.refresh(_matterPartiesProvider(args).future),
                ),
              ),
              data: (parties) {
                final filtered = _filter == 'ALL'
                    ? parties
                    : parties.where((p) => p.role == _filter).toList();

                if (filtered.isEmpty) {
                  return SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.people_outline,
                      label: _filter == 'ALL'
                          ? 'No parties yet'
                          : 'No ${partyRoleLabel(_filter)} parties',
                      sublabel:
                          'Tap + to add the first party to this matter.',
                    ),
                  );
                }

                final grouped = <String, List<MatterPartyRecord>>{};
                for (final p in filtered) {
                  (grouped[p.role] ??= []).add(p);
                }

                final rows = <Widget>[];
                for (final entry in grouped.entries) {
                  rows.add(_GroupHeader(role: entry.key));
                  for (final party in entry.value) {
                    rows.add(_PartyTile(
                      party: party,
                      onEdit: () =>
                          _showEditSheet(context, tenantId, party),
                      onDelete: () =>
                          _confirmDelete(context, tenantId, party),
                    ));
                  }
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => rows[i],
                    childCount: rows.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddSheet(context, tenantId),
        backgroundColor: cs.primary,
        child: const Icon(Icons.person_add_outlined),
      ),
    );
  }

  Future<void> _showAddSheet(BuildContext context, String tenantId) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _PartyFormSheet(
        tenantId: tenantId,
        matterId: widget.matterId,
        onSaved: () {
          unawaited(
            ref.refresh(
              _matterPartiesProvider(
                (tenantId: tenantId, matterId: widget.matterId),
              ).future,
            ),
          );
        },
      ),
    );
  }

  Future<void> _showEditSheet(
    BuildContext context,
    String tenantId,
    MatterPartyRecord party,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _PartyFormSheet(
        tenantId: tenantId,
        matterId: widget.matterId,
        editing: party,
        onSaved: () {
          unawaited(
            ref.refresh(
              _matterPartiesProvider(
                (tenantId: tenantId, matterId: widget.matterId),
              ).future,
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    String tenantId,
    MatterPartyRecord party,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Party'),
        content: Text('Remove "${party.name}" from this matter?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(matterPartiesApiProvider).deleteParty(
            tenantId: tenantId,
            matterId: widget.matterId,
            partyId: party.id,
          );
      unawaited(
        ref.refresh(
          _matterPartiesProvider(
            (tenantId: tenantId, matterId: widget.matterId),
          ).future,
        ),
      );
      messenger.showSnackBar(
        const SnackBar(content: Text('Party removed')),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      child: Text(
        partyRoleLabel(role).toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: cs.onSurfaceVariant,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _PartyTile extends StatelessWidget {
  const _PartyTile({
    required this.party,
    required this.onEdit,
    required this.onDelete,
  });
  final MatterPartyRecord party;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  Color _roleColor(BuildContext context, String role) {
    final cs = Theme.of(context).colorScheme;
    if (role == 'CLIENT') return cs.primary;
    if (role == 'OPPOSING_PARTY' || role == 'OPPOSING_COUNSEL') {
      return cs.error;
    }
    if (role == 'WITNESS' || role == 'EXPERT') return cs.tertiary;
    return cs.outline;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final roleColor = _roleColor(context, party.role);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: roleColor.withValues(alpha: 0.15),
          child: Text(
            party.name.isNotEmpty ? party.name[0].toUpperCase() : '?',
            style: TextStyle(
              color: roleColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Text(
          party.name,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (party.organization != null && party.organization!.isNotEmpty)
              Text(
                party.organization!,
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              ),
            if (party.email != null && party.email!.isNotEmpty)
              Text(
                party.email!,
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              ),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (val) {
            if (val == 'edit') onEdit();
            if (val == 'delete') onDelete();
          },
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'delete', child: Text('Remove')),
          ],
        ),
        isThreeLine:
            (party.organization?.isNotEmpty ?? false) ||
            (party.email?.isNotEmpty ?? false),
      ),
    );
  }
}

class _PartyFormSheet extends ConsumerStatefulWidget {
  const _PartyFormSheet({
    required this.tenantId,
    required this.matterId,
    this.editing,
    required this.onSaved,
  });
  final String tenantId;
  final String matterId;
  final MatterPartyRecord? editing;
  final VoidCallback onSaved;

  @override
  ConsumerState<_PartyFormSheet> createState() => _PartyFormSheetState();
}

class _PartyFormSheetState extends ConsumerState<_PartyFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _organization;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late final TextEditingController _notes;
  late String _role;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    _name = TextEditingController(text: e?.name ?? '');
    _organization = TextEditingController(text: e?.organization ?? '');
    _email = TextEditingController(text: e?.email ?? '');
    _phone = TextEditingController(text: e?.phone ?? '');
    _notes = TextEditingController(text: e?.notes ?? '');
    _role = e?.role ?? 'OPPOSING_PARTY';
  }

  @override
  void dispose() {
    _name.dispose();
    _organization.dispose();
    _email.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final api = ref.read(matterPartiesApiProvider);
      if (widget.editing != null) {
        await api.updateParty(
          tenantId: widget.tenantId,
          matterId: widget.matterId,
          partyId: widget.editing!.id,
          name: _name.text.trim(),
          role: _role,
          organization: _organization.text.trim(),
          email: _email.text.trim(),
          phone: _phone.text.trim(),
          notes: _notes.text.trim(),
        );
      } else {
        await api.createParty(
          tenantId: widget.tenantId,
          matterId: widget.matterId,
          name: _name.text.trim(),
          role: _role,
          organization: _organization.text.trim(),
          email: _email.text.trim(),
          phone: _phone.text.trim(),
          notes: _notes.text.trim(),
        );
      }
      widget.onSaved();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.editing != null;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      isEdit ? 'Edit Party' : 'Add Party',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Full Name *',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Name is required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _role,
                decoration: const InputDecoration(
                  labelText: 'Role *',
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                items: partyRoles
                    .map(
                      (r) => DropdownMenuItem(
                        value: r,
                        child: Text(partyRoleLabel(r)),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _role = v ?? _role),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _organization,
                decoration: const InputDecoration(
                  labelText: 'Organization',
                  prefixIcon: Icon(Icons.business_outlined),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notes,
                decoration: const InputDecoration(
                  labelText: 'Notes',
                  prefixIcon: Icon(Icons.notes_outlined),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(isEdit ? 'Save Changes' : 'Add Party'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
