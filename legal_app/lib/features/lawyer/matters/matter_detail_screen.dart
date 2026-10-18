import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/widgets/matter_intelligence_summary_card.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/matter_outcome_api.dart';
import '../../../core/network/matter_analysis_api.dart';
import '../../../core/providers/app_providers.dart';
import '../meetings/record_meeting_screen.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../l10n/app_localizations.dart';
import '../billing/billing_screen.dart';

// ── Matter stages in order (API values) ─────────────────────────────
const _kMatterStages = [
  'Intake',
  'Active',
  'Discovery',
  'Negotiation',
  'Closing',
  'Closed',
];

String _stageLabel(AppLocalizations l10n, String stage) {
  switch (stage) {
    case 'Intake':
      return l10n.mattersStagesIntake;
    case 'Active':
      return l10n.mattersStagesActive;
    case 'Discovery':
      return 'Discovery';
    case 'Negotiation':
      return l10n.mattersStagesNegotiation;
    case 'Closing':
      return 'Closing';
    case 'Closed':
      return l10n.mattersStagesClosed;
    default:
      return stage;
  }
}

// Matter status values (for reference in UI validation)
// ignore: unused_element
const _kMatterStatusValues = ['OPEN', 'ACTIVE', 'ON_HOLD', 'CLOSED'];

final matterDetailProvider = FutureProvider.family<MatterDetail, String>((
  ref,
  matterId,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref
      .watch(mattersApiProvider)
      .getMatterDetail(tenantId: tenantId, matterId: matterId);
});

final matterOutcomeProvider =
    FutureProvider.family<List<MatterOutcomeAnalysis>, String>((
      ref,
      matterId,
    ) async {
      final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
      if (tenantId == null || tenantId.isEmpty) {
        throw ApiException('Tenant ID is required.');
      }
      return ref
          .watch(matterOutcomeApiProvider)
          .listAnalyses(tenantId: tenantId, matterId: matterId);
    });

final matterTasksProvider = FutureProvider.family<List<LawyerTask>, String>((
  ref,
  matterId,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref
      .watch(tasksApiProvider)
      .listTasks(tenantId: tenantId, matterId: matterId);
});

final matterStrategyProvider =
    FutureProvider.family<List<MatterStrategyMemo>, String>((
      ref,
      matterId,
    ) async {
      final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
      if (tenantId == null || tenantId.isEmpty) {
        throw ApiException('Tenant ID is required.');
      }
      return ref
          .watch(matterAnalysisApiProvider)
          .listStrategyMemos(tenantId: tenantId, matterId: matterId);
    });

final matterSimilarCasesProvider =
    FutureProvider.family<List<MatterAnalysisRun>, String>((
      ref,
      matterId,
    ) async {
      final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
      if (tenantId == null || tenantId.isEmpty) {
        throw ApiException('Tenant ID is required.');
      }
      return ref
          .watch(matterAnalysisApiProvider)
          .listSimilarCases(tenantId: tenantId, matterId: matterId);
    });

final matterOpponentProvider =
    FutureProvider.family<List<MatterAnalysisRun>, String>((
      ref,
      matterId,
    ) async {
      final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
      if (tenantId == null || tenantId.isEmpty) {
        throw ApiException('Tenant ID is required.');
      }
      return ref
          .watch(matterAnalysisApiProvider)
          .listOpponentAnalyses(tenantId: tenantId, matterId: matterId);
    });

class MatterDetailScreen extends ConsumerStatefulWidget {
  const MatterDetailScreen({super.key, required this.matterId});

  final String matterId;

  @override
  ConsumerState<MatterDetailScreen> createState() => _MatterDetailScreenState();
}

class _MatterDetailScreenState extends ConsumerState<MatterDetailScreen>
    with SingleTickerProviderStateMixin {
  bool _closingMatter = false;
  bool _clientBannerDismissed = false;
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 9, vsync: this);
    _loadBannerDismissal();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadBannerDismissal() async {
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getBool(
          'dismissed_client_banner_${widget.matterId}',
        ) ??
        false;
    if (mounted && dismissed) {
      setState(() => _clientBannerDismissed = true);
    }
  }

  Future<void> _dismissBanner() async {
    setState(() => _clientBannerDismissed = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(
      'dismissed_client_banner_${widget.matterId}',
      true,
    );
  }

  Future<void> _showClientIncompleteSheet(
    String clientId,
    String? currentEmail,
    String? currentPhone,
  ) async {
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    final emailCtrl =
        TextEditingController(text: currentEmail ?? '');
    final phoneCtrl =
        TextEditingController(text: currentPhone ?? '');
    bool saving = false;
    String? saveError;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(ctx).bottom,
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Theme.of(ctx)
                              .colorScheme
                              .onSurfaceVariant
                              .withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Text(
                      'Complete client profile',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Add contact details to complete this client record.',
                      style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                            color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    if (saveError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        saveError!.length > 200
                            ? '${saveError!.substring(0, 200)}…'
                            : saveError!,
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Theme.of(ctx).colorScheme.error,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: saving
                          ? null
                          : () async {
                              setSheetState(() {
                                saving = true;
                                saveError = null;
                              });
                              try {
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
                                ref.invalidate(
                                    matterDetailProvider(widget.matterId));
                                if (ctx.mounted) ctx.pop(true);
                              } on ApiException catch (e) {
                                setSheetState(() {
                                  saveError = e.message;
                                  saving = false;
                                });
                              } catch (_) {
                                setSheetState(() {
                                  saveError =
                                      'Failed to save. Please try again.';
                                  saving = false;
                                });
                              }
                            },
                      child: Text(saving ? 'Saving…' : 'Save'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    emailCtrl.dispose();
    phoneCtrl.dispose();

    if (saved == true) {
      _dismissBanner();
    }
  }

  bool _isClientIncomplete(MatterDetail matter) {
    if (matter.clientId == null) return false;
    final emailMissing =
        matter.clientEmail == null || matter.clientEmail!.isEmpty;
    final phoneMissing =
        matter.clientPhone == null || matter.clientPhone!.isEmpty;
    return emailMissing || phoneMissing;
  }

  Future<void> _closeMatter() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.mattersCloseMatterConfirm),
        content: Text(l10n.mattersCloseMatterBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            child: Text(l10n.mattersCloseMatter),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() => _closingMatter = true);
    try {
      await ref
          .read(mattersApiProvider)
          .closeMatter(tenantId: tenantId, matterId: widget.matterId);
      ref.invalidate(matterDetailProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.mattersMatterClosed)),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _closingMatter = false);
    }
  }

  Future<void> _updateStage(String stage) async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    try {
      await ref
          .read(mattersApiProvider)
          .updateMatter(tenantId: tenantId, matterId: widget.matterId, stage: stage);
      ref.invalidate(matterDetailProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context).mattersStageUpdated(stage),
            ),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  void _showStageSheet(String currentStage) {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 12),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              l10n.mattersUpdateStage,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          ..._kMatterStages.map((stage) => ListTile(
                title: Text(_stageLabel(l10n, stage)),
                leading: currentStage == stage
                    ? const Icon(Icons.check_circle, color: Colors.green)
                    : const Icon(Icons.radio_button_unchecked),
                onTap: () {
                  Navigator.pop(ctx);
                  if (stage != currentStage) _updateStage(stage);
                },
              )),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final matterAsync = ref.watch(matterDetailProvider(widget.matterId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mattersTitle),
        actions: [
          IconButton(
            tooltip: l10n.mattersMatterAi,
            onPressed: () =>
                context.go('/lawyer/matters/${widget.matterId}/ai'),
            icon: const Icon(Icons.auto_awesome_outlined),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            enabled: !_closingMatter,
            onSelected: (value) async {
              if (value == 'stage') {
                final matter = matterAsync.valueOrNull;
                _showStageSheet(matter?.stage ?? 'Intake');
              } else if (value == 'generate_doc') {
                context.go('/lawyer/matters/${widget.matterId}/generate-document');
              } else if (value == 'docu_draft') {
                final matter = matterAsync.valueOrNull;
                final narrative = matter?.factsSummary?.trim() ?? matter?.title ?? '';
                final q = Uri.encodeComponent(narrative);
                context.go(q.isEmpty ? '/lawyer/docu-draft' : '/lawyer/docu-draft?q=$q');
              } else if (value == 'evidence') {
                final matter = matterAsync.valueOrNull;
                final title = Uri.encodeComponent(matter?.title ?? 'Matter');
                context.go('/lawyer/matters/${widget.matterId}/evidence?title=$title');
              } else if (value == 'parties') {
                context.push('/lawyer/matters/${widget.matterId}/parties');
              } else if (value == 'diligence') {
                context.push('/lawyer/matters/${widget.matterId}/diligence');
              } else if (value == 'workspace') {
                final matter = matterAsync.valueOrNull;
                final title = Uri.encodeComponent(matter?.title ?? 'Matter');
                context.push('/lawyer/matters/${widget.matterId}/workspace?title=$title');
              } else if (value == 'record_meeting') {
                final matter = matterAsync.valueOrNull;
                final meetingId = await Navigator.push<String>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => RecordMeetingScreen(
                      args: RecordMeetingArgs(
                        matterId: widget.matterId,
                        clientId: matter?.clientId,
                        clientName: matter?.clientName,
                      ),
                    ),
                    fullscreenDialog: true,
                  ),
                );
                if (meetingId != null && context.mounted) {
                  context.push('/lawyer/meetings/$meetingId');
                }
              } else if (value == 'close') {
                _closeMatter();
              }
            },
            itemBuilder: (context) {
              final isClosed =
                  matterAsync.valueOrNull?.status.toUpperCase() == 'CLOSED';
              return [
                if (!isClosed)
                  PopupMenuItem(
                    value: 'stage',
                    child: Text(l10n.mattersUpdateStage),
                  ),
                PopupMenuItem(
                  value: 'generate_doc',
                  child: Text(l10n.mattersGenerateDocument),
                ),
                PopupMenuItem(
                  value: 'docu_draft',
                  child: Text(l10n.docuDraftTitle),
                ),
                PopupMenuItem(
                  value: 'evidence',
                  child: Text(l10n.mattersEvidenceVault),
                ),
                const PopupMenuItem(
                  value: 'parties',
                  child: Text('Parties'),
                ),
                const PopupMenuItem(
                  value: 'diligence',
                  child: Text('Due Diligence'),
                ),
                const PopupMenuItem(
                  value: 'workspace',
                  child: Row(
                    children: [
                      Icon(Icons.grid_view_outlined, size: 16),
                      SizedBox(width: 8),
                      Text('Research Workspace'),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'record_meeting',
                  child: Text(l10n.mattersRecordMeeting),
                ),
                if (!isClosed) ...[
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: 'close',
                    child: Text(
                      l10n.mattersCloseMatter,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              ];
            },
          ),
        ],
      ),
      body: matterAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(error.toString()),
          ),
        ),
        data: (matter) => Column(
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * 0.38,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Client incomplete banner
                    if (!_clientBannerDismissed && _isClientIncomplete(matter))
                      Material(
                        color: Colors.amber.shade50,
                        child: InkWell(
                          onTap: () => _showClientIncompleteSheet(
                            matter.clientId!,
                            matter.clientEmail,
                            matter.clientPhone,
                          ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: Colors.amber.shade200,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.warning_amber_rounded,
                                    size: 18, color: Colors.amber.shade800),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Client profile incomplete — tap to add contact details',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.amber.shade900,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  icon: Icon(Icons.close,
                                      size: 16, color: Colors.amber.shade700),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: _dismissBanner,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                    if (matter.matterProfile != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: MatterIntelligenceSummaryCard(
                          profile: matter.matterProfile,
                          taskGraph: matter.matterTaskGraph,
                        ),
                      ),

                    // Matter header with stage chip
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  matter.title,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    _StatusBadge(matter.status),
                                    if (matter.stage != null) ...[
                                      const SizedBox(width: 6),
                                      _StageBadge(matter.stage!),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (matter.status != 'CLOSED')
                            TextButton.icon(
                              onPressed: () =>
                                  _showStageSheet(matter.stage ?? 'Intake'),
                              icon: const Icon(Icons.edit_note, size: 16),
                              label: Text(l10n.mattersStage),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
                Tab(text: l10n.mattersOverview),
                Tab(text: l10n.mattersTimeline),
                Tab(text: l10n.mattersDocuments),
                Tab(text: l10n.mattersTasks),
                Tab(text: l10n.mattersBilling),
                Tab(text: l10n.mattersOutcome),
                const Tab(text: 'Strategy'),
                const Tab(text: 'Similar Cases'),
                const Tab(text: 'Opponent'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Overview tab — summary + AI actions
                  _MatterOverviewTab(
                    matter: matter,
                    matterId: widget.matterId,
                    onUpdateStage: () => _showStageSheet(matter.stage ?? 'Intake'),
                  ),

                  // Timeline tab
                  _TimelineTab(events: matter.timelineEvents),

                  // Documents tab with upload + generate CTA
                  _DocumentsTab(
                    matterId: widget.matterId,
                    documents: matter.documents,
                  ),

                  // Tasks
                  _TasksTab(matterId: widget.matterId),

                  // Billing + time entry
                  _MatterBillingTab(
                    matterId: widget.matterId,
                    clientId: matter.clientId,
                  ),

                  // Outcome
                  _OutcomeTab(matterId: widget.matterId),

                  // Strategy Memos
                  _StrategyTab(matterId: widget.matterId),

                  // Similar Cases
                  _SimilarCasesTab(matterId: widget.matterId),

                  // Opponent Analysis
                  _OpponentTab(matterId: widget.matterId),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    Color bg;
    switch (status.toUpperCase()) {
      case 'CLOSED':
        bg = colorScheme.outline.withValues(alpha: 0.2);
      case 'ON_HOLD':
        bg = Colors.orange.withValues(alpha: 0.15);
      case 'ACTIVE':
        bg = Colors.green.withValues(alpha: 0.15);
      default:
        bg = colorScheme.primary.withValues(alpha: 0.1);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
      ),
    );
  }
}

class _StageBadge extends StatelessWidget {
  const _StageBadge(this.stage);
  final String stage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        stage,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSecondaryContainer,
            ),
      ),
    );
  }
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

class _MatterOverviewTab extends ConsumerStatefulWidget {
  const _MatterOverviewTab({
    required this.matter,
    required this.matterId,
    required this.onUpdateStage,
  });

  final MatterDetail matter;
  final String matterId;
  final VoidCallback onUpdateStage;

  @override
  ConsumerState<_MatterOverviewTab> createState() => _MatterOverviewTabState();
}

class _MatterOverviewTabState extends ConsumerState<_MatterOverviewTab> {
  // AI action state
  final Map<String, bool> _loadingAction = {};
  final Map<String, String?> _actionResult = {};
  final Map<String, String?> _actionError = {};
  String? _copilotSessionId;

  Future<void> _runAction(String actionId, String prompt) async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    setState(() {
      _loadingAction[actionId] = true;
      _actionResult[actionId] = null;
      _actionError[actionId] = null;
    });
    try {
      final response = await ref.read(copilotApiProvider).chat(
            message: prompt,
            tenantId: tenantId,
            sessionId: _copilotSessionId,
            context: {
              'matterId': widget.matter.id,
              'selectedMatterId': widget.matter.id,
              'matterTitle': widget.matter.title,
              'countryCode': widget.matter.countryCode,
              'practiceArea': widget.matter.practiceArea,
            },
          );
      if (!mounted) return;
      setState(() {
        _actionResult[actionId] = response.message;
        _copilotSessionId = response.sessionId ?? _copilotSessionId;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _actionError[actionId] = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _actionError[actionId] = 'Action failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loadingAction[actionId] = false);
    }
  }

  Future<void> _runKickoff() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    setState(() => _loadingAction['kickoff'] = true);
    try {
      await ref.read(mattersApiProvider).runKickoffAgent(
            tenantId: tenantId,
            matterId: widget.matterId,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kickoff complete. Tasks created.')),
      );
      ref.invalidate(matterDetailProvider(widget.matterId));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Kickoff agent failed.')));
    } finally {
      if (mounted) setState(() => _loadingAction['kickoff'] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final matter = widget.matter;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Matter Details Card ───────────────────────────────────
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.folder_outlined, size: 16, color: colorScheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      l10n.mattersMatterDetails,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (matter.clientName != null)
                  _DetailRow(
                    icon: Icons.person_outline,
                    label: l10n.commonClient,
                    value: matter.clientName!,
                    color: colorScheme.primary,
                  ),
                if (matter.practiceArea != null && matter.practiceArea!.isNotEmpty)
                  _DetailRow(
                    icon: Icons.gavel_outlined,
                    label: l10n.mattersPracticeArea,
                    value: matter.practiceArea!.replaceAll('_', ' '),
                  ),
                if (matter.countryCode != null)
                  _DetailRow(
                    icon: Icons.public_outlined,
                    label: l10n.commonCountry,
                    value: matter.countryCode!,
                  ),
                if (matter.jurisdiction != null)
                  _DetailRow(
                    icon: Icons.account_balance_outlined,
                    label: l10n.mattersJurisdiction,
                    value: matter.jurisdiction!,
                  ),
                if (matter.factsSummary != null && matter.factsSummary!.isNotEmpty) ...[
                  const Divider(height: 20),
                  Text(
                    l10n.mattersSummary,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    matter.factsSummary!,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 6,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ── Kickoff Agent (Intake stage only) ─────────────────────
        if (matter.stage == 'Intake') ...[
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colorScheme.primary.withValues(alpha: 0.3)),
              color: colorScheme.primary.withValues(alpha: 0.04),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.auto_awesome, size: 16, color: colorScheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      l10n.mattersMatterKickoffAgent,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.mattersMatterKickoffDescription,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: (_loadingAction['kickoff'] ?? false) ? null : _runKickoff,
                  icon: (_loadingAction['kickoff'] ?? false)
                      ? const SizedBox(
                          width: 14, height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.rocket_launch_outlined, size: 16),
                  label: Text((_loadingAction['kickoff'] ?? false)
                      ? l10n.mattersGenerating
                      : l10n.mattersRunKickoff),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // ── AI Actions ────────────────────────────────────────────
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.auto_awesome_outlined, size: 16, color: colorScheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      l10n.mattersAiActions,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const Spacer(),
                    Text(
                      'Powered by Copilot',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _AiActionBlock(
                  icon: Icons.mail_outline,
                  label: l10n.mattersDraftClientUpdate,
                  description: l10n.mattersDraftClientUpdateDescription,
                  loading: _loadingAction['draft-update'] ?? false,
                  result: _actionResult['draft-update'],
                  error: _actionError['draft-update'],
                  onRun: () => _runAction(
                    'draft-update',
                    'Please draft a professional client update email for this matter with the current status and next steps.',
                  ),
                  onClear: () => setState(() {
                    _actionResult['draft-update'] = null;
                    _actionError['draft-update'] = null;
                  }),
                ),
                const Divider(height: 24),
                _AiActionBlock(
                  icon: Icons.checklist_outlined,
                  label: l10n.mattersSuggestNextTasks,
                  description: l10n.mattersSuggestNextTasksDescription,
                  loading: _loadingAction['suggest-tasks'] ?? false,
                  result: _actionResult['suggest-tasks'],
                  error: _actionError['suggest-tasks'],
                  onRun: () => _runAction(
                    'suggest-tasks',
                    'Suggest the next 5 actionable tasks for this matter based on its current stage and facts.',
                  ),
                  onClear: () => setState(() {
                    _actionResult['suggest-tasks'] = null;
                    _actionError['suggest-tasks'] = null;
                  }),
                ),
                const Divider(height: 24),
                _AiActionBlock(
                  icon: Icons.receipt_long_outlined,
                  label: l10n.mattersBillingNarrative,
                  description: l10n.mattersBillingNarrativeDescription,
                  loading: _loadingAction['billing-narrative'] ?? false,
                  result: _actionResult['billing-narrative'],
                  error: _actionError['billing-narrative'],
                  onRun: () => _runAction(
                    'billing-narrative',
                    'Generate a professional billing narrative for this matter summarising activities, time spent, and value delivered.',
                  ),
                  onClear: () => setState(() {
                    _actionResult['billing-narrative'] = null;
                    _actionError['billing-narrative'] = null;
                  }),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: mutedColor),
          const SizedBox(width: 6),
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: mutedColor),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: color,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiActionBlock extends StatelessWidget {
  const _AiActionBlock({
    required this.icon,
    required this.label,
    required this.description,
    required this.loading,
    required this.result,
    required this.error,
    required this.onRun,
    required this.onClear,
  });

  final IconData icon;
  final String label;
  final String description;
  final bool loading;
  final String? result;
  final String? error;
  final VoidCallback onRun;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: colorScheme.onSurfaceVariant),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  Text(description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          )),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (loading)
              const SizedBox(
                width: 20, height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else if (result == null && error == null)
              FilledButton.tonal(
                onPressed: onRun,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(60, 32),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                  textStyle: const TextStyle(fontSize: 13),
                ),
                child: const Text('Run'),
              )
            else
              IconButton(
                icon: const Icon(Icons.refresh, size: 18),
                tooltip: 'Regenerate',
                onPressed: onRun,
              ),
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: 8),
          Text(error!,
              style: TextStyle(color: colorScheme.error, fontSize: 12)),
        ],
        if (result != null) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SelectableText(
                  result!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: result!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Copied to clipboard'),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      },
                      icon: const Icon(Icons.copy, size: 14),
                      label: const Text('Copy'),
                      style: TextButton.styleFrom(
                          textStyle: const TextStyle(fontSize: 12)),
                    ),
                    TextButton.icon(
                      onPressed: onClear,
                      icon: const Icon(Icons.close, size: 14),
                      label: const Text('Dismiss'),
                      style: TextButton.styleFrom(
                          textStyle: const TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

IconData _eventTypeIcon(String eventType) {
  switch (eventType.toLowerCase()) {
    case 'matter_created':
    case 'created':
      return Icons.add_circle_outline;
    case 'document_uploaded':
    case 'document':
      return Icons.insert_drive_file_outlined;
    case 'task_created':
    case 'task':
      return Icons.task_alt_outlined;
    case 'stage_changed':
    case 'stage':
      return Icons.alt_route_outlined;
    case 'meeting':
    case 'meeting_created':
      return Icons.video_call_outlined;
    case 'note':
    case 'comment':
      return Icons.sticky_note_2_outlined;
    case 'invoice':
    case 'billing':
      return Icons.receipt_outlined;
    default:
      return Icons.circle_outlined;
  }
}

class _TimelineTab extends StatelessWidget {
  const _TimelineTab({required this.events});

  final List<MatterTimelineEvent> events;

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          AppEmptyState(
            icon: Icons.timeline_outlined,
            label: 'No timeline events yet',
            sublabel:
                'Events are recorded as you work on this matter — documents, tasks, meetings, and more will appear here.',
          ),
        ],
      );
    }

    final colorScheme = Theme.of(context).colorScheme;

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      itemCount: events.length,
      itemBuilder: (context, index) {
        final event = events[index];
        final isLast = index == events.length - 1;
        final icon = _eventTypeIcon(event.eventType);

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Vertical connector + icon
              SizedBox(
                width: 32,
                child: Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        border: Border.all(
                            color: colorScheme.primary.withValues(alpha: 0.3)),
                      ),
                      child: Icon(icon, size: 14, color: colorScheme.primary),
                    ),
                    if (!isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          color: colorScheme.outlineVariant.withValues(alpha: 0.4),
                          margin: const EdgeInsets.symmetric(vertical: 2),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Event content
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${event.eventType.replaceAll('_', ' ')} · '
                        '${event.occurredAt.toLocal().toString().split(' ').first}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                      ),
                      if (event.description != null &&
                          event.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          event.description!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DocumentsTab extends ConsumerStatefulWidget {  const _DocumentsTab({required this.matterId, required this.documents});
  final String matterId;
  final List<MatterDocument> documents;

  @override
  ConsumerState<_DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends ConsumerState<_DocumentsTab> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    // Let user pick a file
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg'],
      withData: false,
      withReadStream: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final fileName = file.name;
    final mimeType = file.extension != null
        ? _mimeForExtension(file.extension!)
        : 'application/octet-stream';

    setState(() => _uploading = true);
    try {
      // 1. Get presigned upload URL
      final presignedData = await ref.read(mattersApiProvider).getPresignedUploadUrl(
            tenantId: tenantId,
            fileName: fileName,
            mimeType: mimeType,
          );
      final uploadUrl = presignedData['uploadUrl'] as String?;
      final fileUrl = presignedData['fileUrl'] as String? ?? presignedData['url'] as String? ?? '';

      // 2. Upload file bytes to presigned URL (if available)
      if (uploadUrl != null && uploadUrl.isNotEmpty && file.readStream != null) {
        final bytes = <int>[];
        await for (final chunk in file.readStream!) {
          bytes.addAll(chunk);
        }
        await Dio().put<void>(
          uploadUrl,
          data: Stream.fromIterable([bytes]),
          options: Options(
            headers: {
              'Content-Type': mimeType,
              'Content-Length': bytes.length,
            },
            sendTimeout: const Duration(seconds: 120),
            receiveTimeout: const Duration(seconds: 30),
          ),
        );
      }

      // 3. Register document in backend
      await ref.read(mattersApiProvider).uploadDocument(
            tenantId: tenantId,
            matterId: widget.matterId,
            fileName: fileName,
            fileUrl: fileUrl,
            mimeType: mimeType,
          );

      // 4. Refresh matter details
      ref.invalidate(matterDetailProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context).mattersFilenameUploaded(fileName),
            ),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(
              content: Text(
                AppLocalizations.of(context).mattersUploadFailed(e.toString()),
              ),
            ));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String _mimeForExtension(String ext) {
    switch (ext.toLowerCase()) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/msword';
      case 'txt': return 'text/plain';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      default: return 'application/octet-stream';
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.auto_awesome, color: Colors.deepPurple),
            title: Text(l10n.mattersGenerateFromTemplate),
            subtitle: Text(l10n.mattersGenerateFromTemplateSubtitle),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context
                .go('/lawyer/matters/${widget.matterId}/generate-document'),
          ),
        ),
        const SizedBox(height: 12),

        // Upload CTA
        OutlinedButton.icon(
          onPressed: _uploading ? null : _pickAndUpload,
          icon: _uploading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.upload_file_outlined),
          label: Text(_uploading ? l10n.mattersUploading : l10n.mattersUploadDocument),
        ),
        const SizedBox(height: 16),

        if (widget.documents.isEmpty)
          Text(
            l10n.mattersNoDocumentsYet,
            style: const TextStyle(color: Colors.grey),
          )
        else ...[
          Text(
            l10n.mattersDocumentsCount('${widget.documents.length}'),
            style: Theme.of(context).textTheme.labelMedium,
          ),
          const SizedBox(height: 8),
          ...widget.documents.map(
            (doc) => Card(
              child: ListTile(
                leading: const Icon(Icons.insert_drive_file_outlined),
                title: Text(doc.fileName),
                subtitle: doc.fileUrl != null
                    ? Text(doc.fileUrl!, overflow: TextOverflow.ellipsis)
                    : null,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _OutcomeTab extends ConsumerStatefulWidget {
  const _OutcomeTab({required this.matterId});

  final String matterId;

  @override
  ConsumerState<_OutcomeTab> createState() => _OutcomeTabState();
}

class _OutcomeTabState extends ConsumerState<_OutcomeTab> {
  bool _generating = false;
  String? _error;
  CancelToken? _cancelToken;
  MatterOutcomeAnalysis? _freshAnalysis;

  @override
  void dispose() {
    _cancelToken?.cancel('Outcome tab disposed');
    super.dispose();
  }

  Future<void> _generate() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty || _generating) return;

    _cancelToken?.cancel();
    final cancelToken = CancelToken();
    setState(() {
      _generating = true;
      _error = null;
      _cancelToken = cancelToken;
    });

    try {
      final analysis = await ref.read(matterOutcomeApiProvider).generateAnalysis(
            tenantId: tenantId,
            matterId: widget.matterId,
            cancelToken: cancelToken,
          );
      if (!mounted) return;
      setState(() {
        _freshAnalysis = analysis;
        _generating = false;
        _cancelToken = null;
      });
      ref.invalidate(matterOutcomeProvider(widget.matterId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context).mattersOutcomeAnalysisGenerated,
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.kind == ApiErrorKind.unknown &&
          cancelToken.isCancelled) {
        setState(() {
          _generating = false;
          _cancelToken = null;
        });
        return;
      }
      setState(() {
        _error = error.message;
        _generating = false;
        _cancelToken = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _generating = false;
        _cancelToken = null;
      });
    }
  }

  void _cancelGenerate() {
    _cancelToken?.cancel('Cancelled by user');
    if (mounted) {
      setState(() {
        _generating = false;
        _cancelToken = null;
      });
    }
  }

  List<MatterOutcomeAnalysis> _mergeAnalyses(List<MatterOutcomeAnalysis> remote) {
    final fresh = _freshAnalysis;
    if (fresh == null) return remote;
    return [
      fresh,
      ...remote.where((item) => item.id != fresh.id),
    ];
  }

  Future<void> _togglePortal(
    MatterOutcomeAnalysis analysis,
    bool visible,
  ) async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    try {
      await ref.read(matterOutcomeApiProvider).updateAnalysis(
            tenantId: tenantId,
            matterId: widget.matterId,
            analysisId: analysis.id,
            portalVisible: visible,
            status: visible ? 'PUBLISHED' : analysis.status,
          );
      ref.invalidate(matterOutcomeProvider(widget.matterId));
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              visible ? l10n.mattersPublishedToPortal : l10n.mattersRemovedFromPortal,
            ),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    }
  }

  Widget _bulletList(String title, List<String>? items) {
    if (items == null || items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('• '),
                Expanded(child: Text(item)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGeneratePanel(AppLocalizations l10n, {required bool empty}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (empty) Text(l10n.mattersNoOutcomeAnalysis),
        if (_generating) ...[
          const SizedBox(height: 12),
          const LinearProgressIndicator(minHeight: 2),
          const SizedBox(height: 8),
          Text(
            'AI analysis in progress — this can take up to 3 minutes.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 16),
        if (_generating)
          OutlinedButton.icon(
            onPressed: _cancelGenerate,
            icon: const Icon(Icons.close, size: 18),
            label: const Text('Cancel'),
          )
        else
          ElevatedButton.icon(
            onPressed: _generate,
            icon: const Icon(Icons.auto_graph_outlined),
            label: Text(
              empty ? l10n.mattersGenerateAnalysis : l10n.mattersRegenerate,
            ),
          ),
      ],
    );
  }

  Widget _buildAnalysisView(
    AppLocalizations l10n,
    MatterOutcomeAnalysis latest,
  ) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_generating) ...[
          const LinearProgressIndicator(minHeight: 2),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.mattersLatestAnalysis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Chip(label: Text(latest.status)),
          ],
        ),
        const SizedBox(height: 8),
        Text(l10n.mattersOverall(latest.overallBand.replaceAll('_', ' '))),
        Text(l10n.mattersConfidence(latest.confidence)),
        if (latest.winProbability != null) ...[
          const SizedBox(height: 12),
          Text(
            l10n.mattersWinProbability(
              '${latest.winProbability!.mid.round()}',
            ),
          ),
        ],
        if (latest.settlementProbability != null) ...[
          Text(
            l10n.mattersSettlementProbability(
              '${latest.settlementProbability!.mid.round()}',
            ),
          ),
        ],
        if (latest.lossProbability != null) ...[
          Text(
            l10n.mattersLossProbability(
              '${latest.lossProbability!.mid.round()}',
            ),
          ),
        ],
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.mattersPublishToClientPortal),
          subtitle: Text(
            latest.portalVisible
                ? l10n.mattersVisibleToPortalClients
                : l10n.mattersHiddenFromPortalClients,
          ),
          value: latest.portalVisible,
          onChanged: (value) => _togglePortal(latest, value),
        ),
        _bulletList(l10n.mattersFactorsFor, latest.factorsFor),
        _bulletList(l10n.mattersFactorsAgainst, latest.factorsAgainst),
        _bulletList(l10n.mattersMissingEvidence, latest.missingEvidence),
        if (latest.scenarios != null && latest.scenarios!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(l10n.mattersScenarios, style: Theme.of(context).textTheme.titleSmall),
          ...latest.scenarios!.map(
            (scenario) => Card(
              child: ListTile(
                title: Text(scenario.label),
                subtitle: Text(
                  '${scenario.description}\n${l10n.mattersLikelihood(scenario.likelihood)}',
                ),
                isThreeLine: true,
              ),
            ),
          ),
        ],
        if (latest.solutions != null && latest.solutions!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            l10n.mattersSuggestedNextSteps,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          ...latest.solutions!.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('• '),
                  Expanded(child: Text(item)),
                ],
              ),
            ),
          ),
        ],
        if (latest.disclaimers != null && latest.disclaimers!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            latest.disclaimers!.join(' '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 16),
        _buildGeneratePanel(l10n, empty: false),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final outcomeAsync = ref.watch(matterOutcomeProvider(widget.matterId));

    if (_freshAnalysis != null &&
        outcomeAsync.hasValue &&
        outcomeAsync.value!.any((item) => item.id == _freshAnalysis!.id)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _freshAnalysis != null) {
          setState(() => _freshAnalysis = null);
        }
      });
    }

    if (_generating && (_freshAnalysis != null || outcomeAsync.hasValue)) {
      final analyses = _mergeAnalyses(outcomeAsync.valueOrNull ?? const []);
      if (analyses.isNotEmpty) {
        return _buildAnalysisView(l10n, analyses.first);
      }
    }

    return outcomeAsync.when(
      loading: () {
        if (_freshAnalysis != null) {
          return _buildAnalysisView(l10n, _freshAnalysis!);
        }
        if (_generating) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [_buildGeneratePanel(l10n, empty: true)],
          );
        }
        return const Center(child: CircularProgressIndicator());
      },
      error: (error, _) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_freshAnalysis != null)
            _buildAnalysisView(l10n, _freshAnalysis!)
          else ...[
            Text(error.toString()),
            const SizedBox(height: 12),
            _buildGeneratePanel(l10n, empty: true),
          ],
        ],
      ),
      data: (analyses) {
        final merged = _mergeAnalyses(analyses);
        if (merged.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [_buildGeneratePanel(l10n, empty: true)],
          );
        }
        return _buildAnalysisView(l10n, merged.first);
      },
    );
  }
}

class _TasksTab extends ConsumerWidget {
  const _TasksTab({required this.matterId});

  final String matterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final tasksAsync = ref.watch(matterTasksProvider(matterId));
    return tasksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text(error.toString())),
      data: (tasks) {
        if (tasks.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(l10n.mattersNoTasksForMatter),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => context.go('/lawyer/tasks'),
                icon: const Icon(Icons.add_task_outlined),
                label: Text(l10n.mattersOpenTasks),
              ),
            ],
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: tasks.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final task = tasks[index];
            return Card(
              child: ListTile(
                title: Text(task.title),
                subtitle: Text(
                  [
                    task.priority,
                    if (task.dueDate != null)
                      l10n.mattersDue(
                        task.dueDate!.toLocal().toString().split(' ').first,
                      ),
                  ].join(' · '),
                ),
                trailing: Chip(label: Text(task.status)),
              ),
            );
          },
        );
      },
    );
  }
}

class _MatterBillingTab extends ConsumerStatefulWidget {
  const _MatterBillingTab({required this.matterId, this.clientId});

  final String matterId;
  final String? clientId;

  @override
  ConsumerState<_MatterBillingTab> createState() => _MatterBillingTabState();
}

class _MatterBillingTabState extends ConsumerState<_MatterBillingTab> {
  bool _addingTimeEntry = false;
  bool _creatingInvoice = false;
  final _narrativeCtrl = TextEditingController();
  int _minutes = 60;

  @override
  void dispose() {
    _narrativeCtrl.dispose();
    super.dispose();
  }

  Future<void> _addTimeEntry() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() => _addingTimeEntry = true);
    try {
      await ref.read(mattersApiProvider).createTimeEntry(
            tenantId: tenantId,
            matterId: widget.matterId,
            minutes: _minutes,
            narrative: _narrativeCtrl.text.trim(),
          );
      _narrativeCtrl.clear();
      setState(() => _minutes = 60);
      ref.invalidate(firmInvoicesProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).mattersTimeEntryAdded),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _addingTimeEntry = false);
    }
  }

  Future<void> _createInvoice() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    setState(() => _creatingInvoice = true);
    try {
      await ref.read(mattersApiProvider).createInvoice(
            tenantId: tenantId,
            matterId: widget.matterId,
            clientId: widget.clientId,
          );
      ref.invalidate(firmInvoicesProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).mattersInvoiceCreated),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _creatingInvoice = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final invoicesAsync = ref.watch(firmInvoicesProvider(widget.matterId));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.mattersLogTime,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text('${l10n.mattersMinutesLabel} '),
                    const SizedBox(width: 8),
                    DropdownButton<int>(
                      value: _minutes,
                      items: [15, 30, 60, 90, 120, 180, 240]
                          .map((m) => DropdownMenuItem(
                                value: m,
                                child: Text('${m}m'),
                              ))
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _minutes = v);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _narrativeCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    border: const OutlineInputBorder(),
                    hintText: l10n.mattersWorkDescriptionHint,
                    contentPadding: const EdgeInsets.all(10),
                  ),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _addingTimeEntry ? null : _addTimeEntry,
                  icon: _addingTimeEntry
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.add, size: 16),
                  label: Text(
                    _addingTimeEntry
                        ? l10n.mattersAdding
                        : l10n.mattersAddTimeEntry,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ─── Create Invoice ─────────────────────────────────────
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.secondary,
          ),
          onPressed: _creatingInvoice ? null : _createInvoice,
          icon: _creatingInvoice
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child:
                      CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.receipt_outlined, size: 16),
          label: Text(
            _creatingInvoice ? l10n.mattersCreating : l10n.mattersCreateInvoice,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l10n.mattersInvoices, style: Theme.of(context).textTheme.titleSmall),
            TextButton.icon(
              onPressed: () => context.go('/lawyer/billing'),
              icon: const Icon(Icons.receipt_long_outlined, size: 16),
              label: Text(l10n.mattersAllInvoices),
            ),
          ],
        ),
        const SizedBox(height: 8),
        invoicesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Text(error.toString()),
          data: (invoices) {
            if (invoices.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  l10n.mattersNoInvoicesForMatter,
                  style: const TextStyle(color: Colors.grey),
                ),
              );
            }
            return Column(
              children: invoices
                  .map((invoice) => Card(
                        child: ListTile(
                          title: Text(invoice.invoiceNumber ?? l10n.mattersInvoice),
                          subtitle: Text(
                            '${invoice.currency} ${invoice.amount.toStringAsFixed(2)}',
                          ),
                          trailing: Chip(label: Text(invoice.status)),
                        ),
                      ))
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

// ── Strategy Tab ─────────────────────────────────────────────────────────────

class _StrategyTab extends ConsumerStatefulWidget {
  const _StrategyTab({required this.matterId});
  final String matterId;

  @override
  ConsumerState<_StrategyTab> createState() => _StrategyTabState();
}

class _StrategyTabState extends ConsumerState<_StrategyTab> {
  bool _generating = false;
  final _focusCtrl = TextEditingController();

  Future<void> _autoGenerate() async {
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    if (tenantId.isEmpty || _generating) return;

    setState(() => _generating = true);
    try {
      await ref.read(matterAnalysisApiProvider).autoGenerateStrategy(
            tenantId: tenantId,
            matterId: widget.matterId,
            focusPrompt: _focusCtrl.text.trim(),
          );
      ref.invalidate(matterStrategyProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Strategy memo generated')),
        );
        _focusCtrl.clear();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Strategy generation failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  void dispose() {
    _focusCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strategyAsync = ref.watch(matterStrategyProvider(widget.matterId));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  children: [
                    Icon(Icons.auto_awesome, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Auto-Generate Strategy',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _focusCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Optional focus (risks, arguments, procedure…)',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _generating ? null : _autoGenerate,
                  icon: _generating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.psychology_outlined, size: 16),
                  label:
                      Text(_generating ? 'Generating…' : 'Generate from Matter Context'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        strategyAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text(e.toString()),
          data: (memos) {
            if (memos.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No strategy memos yet.\nTap "Generate" above to create one.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              );
            }
            return Column(
              children: memos
                  .map(
                    (memo) => Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ExpansionTile(
                        leading: const Icon(Icons.description_outlined, size: 18),
                        title: Text(
                          memo.title.isNotEmpty ? memo.title : 'Strategy memo',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        subtitle: Text(
                          memo.createdAt != null
                              ? '${memo.createdAt!.day}/${memo.createdAt!.month}/${memo.createdAt!.year}'
                              : '',
                          style: const TextStyle(fontSize: 12),
                        ),
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: SelectableText(
                              memo.content,
                              style: const TextStyle(fontSize: 13, height: 1.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

// ── Similar Cases Tab ─────────────────────────────────────────────────────────

class _SimilarCasesTab extends ConsumerStatefulWidget {
  const _SimilarCasesTab({required this.matterId});
  final String matterId;

  @override
  ConsumerState<_SimilarCasesTab> createState() => _SimilarCasesTabState();
}

class _SimilarCasesTabState extends ConsumerState<_SimilarCasesTab> {
  bool _running = false;
  final _focusCtrl = TextEditingController();

  Future<void> _run() async {
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    setState(() => _running = true);
    try {
      await ref.read(matterAnalysisApiProvider).runSimilarCases(
            tenantId: tenantId,
            matterId: widget.matterId,
            focusPrompt: _focusCtrl.text.trim(),
          );
      ref.invalidate(matterSimilarCasesProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Similar cases analysis complete')),
        );
        _focusCtrl.clear();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  void dispose() {
    _focusCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final casesAsync = ref.watch(matterSimilarCasesProvider(widget.matterId));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  children: [
                    Icon(Icons.balance, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Find Similar Cases',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _focusCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Optional: specific sections, arguments…',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _running ? null : _run,
                  icon: _running
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.search, size: 16),
                  label: Text(_running ? 'Analyzing…' : 'Run Analysis'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        casesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text(e.toString()),
          data: (runs) {
            if (runs.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No similar cases analyses yet.\nRun one above.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              );
            }
            return Column(
              children:
                  runs.map((run) => _AnalysisRunCard(run: run)).toList(),
            );
          },
        ),
      ],
    );
  }
}

// ── Opponent Analysis Tab ─────────────────────────────────────────────────────

class _OpponentTab extends ConsumerStatefulWidget {
  const _OpponentTab({required this.matterId});
  final String matterId;

  @override
  ConsumerState<_OpponentTab> createState() => _OpponentTabState();
}

class _OpponentTabState extends ConsumerState<_OpponentTab> {
  bool _running = false;
  final _focusCtrl = TextEditingController();

  Future<void> _run() async {
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId ?? '';
    setState(() => _running = true);
    try {
      await ref.read(matterAnalysisApiProvider).runOpponentAnalysis(
            tenantId: tenantId,
            matterId: widget.matterId,
            focusPrompt: _focusCtrl.text.trim(),
          );
      ref.invalidate(matterOpponentProvider(widget.matterId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Opponent analysis complete')),
        );
        _focusCtrl.clear();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  void dispose() {
    _focusCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final opponentAsync = ref.watch(matterOpponentProvider(widget.matterId));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Opponent Analysis',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'AI analysis of opposing party strategy and counter-arguments.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _focusCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Optional: focus on motions, arguments, evidence…',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _running ? null : _run,
                  icon: _running
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.gavel, size: 16),
                  label: Text(_running ? 'Analyzing…' : 'Analyze Opponent'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        opponentAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text(e.toString()),
          data: (runs) {
            if (runs.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No opponent analyses yet.\nRun one above.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              );
            }
            return Column(
              children:
                  runs.map((run) => _AnalysisRunCard(run: run)).toList(),
            );
          },
        ),
      ],
    );
  }
}

// ── Shared analysis run card ──────────────────────────────────────────────────

class _AnalysisRunCard extends StatelessWidget {
  const _AnalysisRunCard({required this.run});
  final MatterAnalysisRun run;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
        leading: run.trigger == 'auto'
            ? const Icon(Icons.auto_awesome, size: 18, color: Colors.deepPurple)
            : const Icon(Icons.article_outlined, size: 18),
        title: Text(
          run.title ?? 'Analysis',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        subtitle: Row(
          children: [
            if (run.trigger == 'auto')
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: Colors.deepPurple.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Auto',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.deepPurple,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            Text(
              run.createdAt != null
                  ? '${run.createdAt!.day}/${run.createdAt!.month}/${run.createdAt!.year}'
                  : '',
              style: const TextStyle(fontSize: 12),
            ),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SelectableText(
              run.contentMarkdown ?? '',
              style: const TextStyle(fontSize: 13, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
