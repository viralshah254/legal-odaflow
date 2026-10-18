import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_semantic_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

final leadsInboxProvider = FutureProvider<List<MarketplaceLead>>((ref) async {
  return ref.watch(marketplaceApiProvider).listLeads();
});

class LeadsInboxScreen extends ConsumerStatefulWidget {
  const LeadsInboxScreen({super.key});

  @override
  ConsumerState<LeadsInboxScreen> createState() => _LeadsInboxScreenState();
}

class _LeadsInboxScreenState extends ConsumerState<LeadsInboxScreen> {
  String? _actionLeadId;
  String _filter = 'all';

  Future<void> _runLeadAction(
    BuildContext context,
    String leadId,
    Future<void> Function() action, {
    String? successMessage,
  }) async {
    setState(() => _actionLeadId = leadId);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      if (!mounted) return;
      ref.invalidate(leadsInboxProvider);
      if (successMessage != null) {
        messenger.showSnackBar(SnackBar(content: Text(successMessage)));
      }
    } on ApiException catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _actionLeadId = null);
    }
  }

  Future<void> _rejectLead(BuildContext context, MarketplaceLead lead) async {
    final l10n = AppLocalizations.of(context);
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.commonRejectLead),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(labelText: l10n.commonReasonOptional),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, reasonController.text),
            child: Text(l10n.commonReject),
          ),
        ],
      ),
    );
    if (reason == null || !context.mounted) return;
    await _runLeadAction(
      context,
      lead.id,
      () => ref
          .read(marketplaceApiProvider)
          .rejectLead(lead.id, reason: reason),
      successMessage: 'Lead rejected.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final leadsAsync = ref.watch(leadsInboxProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.commonLeadInbox),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/lawyer'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(leadsInboxProvider),
          ),
        ],
      ),
      body: leadsAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: AppListSkeleton(itemCount: 6),
        ),
        error: (error, _) => AppErrorView(
          message: error is ApiException ? error.message : error.toString(),
          onRetry: () => ref.invalidate(leadsInboxProvider),
        ),
        data: (leads) {
          final statuses = {
            'all': leads.length,
            'NEW': leads.where((l) => l.status == 'NEW').length,
            'OPEN': leads.where((l) => l.status == 'OPEN').length,
            'CONVERTED': leads.where((l) => l.status == 'CONVERTED').length,
            'REJECTED': leads.where((l) => l.status == 'REJECTED').length,
          };
          final filterOptions = [
            AppFilterOption(id: 'all', label: 'All', count: leads.length),
            if ((statuses['NEW'] ?? 0) > 0)
              AppFilterOption(
                  id: 'NEW', label: 'New', count: statuses['NEW']),
            if ((statuses['OPEN'] ?? 0) > 0)
              AppFilterOption(
                  id: 'OPEN', label: 'Open', count: statuses['OPEN']),
            if ((statuses['CONVERTED'] ?? 0) > 0)
              AppFilterOption(
                  id: 'CONVERTED',
                  label: 'Converted',
                  count: statuses['CONVERTED']),
            if ((statuses['REJECTED'] ?? 0) > 0)
              AppFilterOption(
                  id: 'REJECTED',
                  label: 'Rejected',
                  count: statuses['REJECTED']),
          ];
          final filtered = _filter == 'all'
              ? leads
              : leads.where((l) => l.status == _filter).toList();

          return Column(
            children: [
              AppPageHeader(
                title: l10n.commonLeadInbox,
                subtitle: l10n.commonMarketplaceLeads,
                count: leads.length,
                accentColor: const Color(0xFFF59E0B),
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
                        icon: Icons.inbox_outlined,
                        label: 'No leads',
                        sublabel: _filter == 'all'
                            ? l10n.lawyerNoLeadsInboxEmpty
                            : 'No leads with this status.',
                      )
                    : RefreshIndicator(
                        onRefresh: () async =>
                            ref.invalidate(leadsInboxProvider),
                        child: ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(20, 8, 20, 96),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final lead = filtered[i];
                            final isBusy = _actionLeadId == lead.id;
                            final canAccept = lead.status == 'NEW' ||
                                lead.status == 'OPEN';
                            final canReject = lead.status != 'REJECTED' &&
                                lead.status != 'CONVERTED';
                            return _LeadCard(
                              lead: lead,
                              isBusy: isBusy,
                              canAccept: canAccept,
                              canReject: canReject,
                              onTap: () =>
                                  context.go('/lawyer/leads/${lead.id}'),
                              onAccept: canAccept
                                  ? () => _runLeadAction(
                                        context,
                                        lead.id,
                                        () => ref
                                            .read(marketplaceApiProvider)
                                            .acceptLead(lead.id),
                                        successMessage: 'Lead accepted.',
                                      )
                                  : null,
                              onReject: canReject
                                  ? () => _rejectLead(context, lead)
                                  : null,
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Lead card ─────────────────────────────────────────────────────────────────

class _LeadCard extends StatelessWidget {
  const _LeadCard({
    required this.lead,
    required this.isBusy,
    required this.canAccept,
    required this.canReject,
    required this.onTap,
    this.onAccept,
    this.onReject,
  });

  final MarketplaceLead lead;
  final bool isBusy;
  final bool canAccept;
  final bool canReject;
  final VoidCallback onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onReject;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tt = Theme.of(context).textTheme;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    final location = [
      lead.countryCode,
      if (lead.jurisdiction != null) lead.jurisdiction,
    ].join(' · ');

    return AppCard(
      onTap: onTap,
      accentColor: AppSemanticColors.base(
          AppSemanticColors.toneForStatus(lead.status)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIconBadge(
                icon: Icons.inbox_outlined,
                color: const Color(0xFFF59E0B),
                size: 40,
                iconSize: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lead.issueType,
                        style: tt.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis),
                    if (location.isNotEmpty)
                      Text(location,
                          style: tt.bodySmall?.copyWith(color: muted)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AppStatusBadge(status: lead.status),
            ],
          ),
          if (lead.description != null &&
              lead.description!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              lead.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: tt.bodySmall?.copyWith(color: muted),
            ),
          ],
          if (canAccept || canReject) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (canAccept)
                  Expanded(
                    child: FilledButton(
                      onPressed: isBusy ? null : onAccept,
                      style: FilledButton.styleFrom(
                          padding:
                              const EdgeInsets.symmetric(vertical: 10)),
                      child: isBusy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white))
                          : const Text('Accept'),
                    ),
                  ),
                if (canAccept && canReject) const SizedBox(width: 8),
                if (canReject)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: isBusy ? null : onReject,
                      style: OutlinedButton.styleFrom(
                          padding:
                              const EdgeInsets.symmetric(vertical: 10)),
                      child: const Text('Reject'),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
