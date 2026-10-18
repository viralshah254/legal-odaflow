import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../../core/models/models.dart';
import '../../../core/tutorials/tutorial_progress_store.dart';
import '../../../core/tutorials/tutorial_strings.dart';
import '../../../core/tutorials/tutorial_theme.dart';
import '../../../core/tutorials/tutorial_flow.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/calendar_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/lawyer_shell_scope.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../calendar/calendar_helpers.dart';
import '../matters/matters_list_screen.dart';
import '../../../../widgets/ai_tools/ai_tool_widgets.dart';

final lawyerDashboardTasksProvider = FutureProvider<List<LawyerTask>>((ref) {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(tasksApiProvider).listTasks(tenantId: tenantId);
});

final lawyerDashboardLeadsProvider = FutureProvider<List<MarketplaceLead>>((
  ref,
) {
  return ref.watch(marketplaceApiProvider).listLeads();
});

final lawyerDashboardAlertsProvider = FutureProvider<List<AppAlert>>((ref) {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref.watch(alertsApiProvider).listAlerts(tenantId: tenantId);
});

/// Fetches the monitors hit summary (totalUnread, criticalCount, etc.).
final lawyerDashboardMonitorsSummaryProvider =
    FutureProvider<Map<String, int>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final tenantId =
      ref.watch(authControllerProvider).session?.user.tenantId ?? '';
  if (tenantId.isEmpty) return {};
  try {
    final resp = await api.dio.get<dynamic>(
      '/monitors',
      queryParameters: {'summary': 'true'},
      options: tenantId.isNotEmpty
          ? Options(headers: {'X-Tenant-Id': tenantId})
          : null,
    );
    final data = resp.data as Map<String, dynamic>? ?? {};
    return {
      'criticalCount': (data['criticalCount'] as num?)?.toInt() ?? 0,
      'warningCount': (data['warningCount'] as num?)?.toInt() ?? 0,
      'infoCount': (data['infoCount'] as num?)?.toInt() ?? 0,
      'totalUnread': (data['totalUnread'] as num?)?.toInt() ?? 0,
    };
  } catch (_) {
    return {};
  }
});

/// Fetches the count of calendar events scheduled for today.
final lawyerDashboardTodayEventsProvider = FutureProvider<int>((ref) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) return 0;

  final calendarApi = ref.watch(calendarApiProvider);
  final tasksApi = ref.watch(tasksApiProvider);
  final now = DateTime.now();
  final startOfDay = DateTime(now.year, now.month, now.day);
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);
  try {
    final results = await Future.wait([
      calendarApi.listEvents(
        tenantId: tenantId,
        from: startOfDay,
        to: endOfDay,
      ),
      tasksApi.listTasks(tenantId: tenantId),
    ]);
    final events = mergeCalendarEventsWithTasks(
      events: results[0] as List<CalendarEventItem>,
      tasks: results[1] as List<LawyerTask>,
      showTasks: true,
    );
    return events.where((event) {
      final start = event.startAt.toLocal();
      return start.year == now.year &&
          start.month == now.month &&
          start.day == now.day;
    }).length;
  } catch (_) {
    return 0;
  }
});

class LawyerDashboardScreen extends ConsumerStatefulWidget {
  const LawyerDashboardScreen({super.key});

  @override
  ConsumerState<LawyerDashboardScreen> createState() =>
      _LawyerDashboardScreenState();
}

class _LawyerDashboardScreenState extends ConsumerState<LawyerDashboardScreen> {
  final _searchKey = GlobalKey();
  final _statsKey = GlobalKey();
  final _actionsKey = GlobalKey();
  bool _tourStarted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
  }

  Future<void> _maybeStartTour() async {
    if (_tourStarted || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null) return;

    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey('mobile.lawyer.dashboard')) return;

    if (!mounted) return;
    _tourStarted = true;

    await runTutorialWithWelcome(
      context: context,
      showcaseKeys: [_searchKey, _statsKey, _actionsKey],
      onSkip: () => store.markSkipped(userId, 'mobile.lawyer.dashboard'),
      onComplete: () => store.markCompleted(userId, 'mobile.lawyer.dashboard'),
      onDismiss: () => _tourStarted = false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(authControllerProvider).session?.user;
    final mattersAsync = ref.watch(mattersListProvider);
    final tasksAsync = ref.watch(lawyerDashboardTasksProvider);
    final leadsAsync = ref.watch(lawyerDashboardLeadsProvider);
    final todayEventsAsync = ref.watch(lawyerDashboardTodayEventsProvider);
    final alertsAsync = ref.watch(lawyerDashboardAlertsProvider);
    final monitorsSummaryAsync =
        ref.watch(lawyerDashboardMonitorsSummaryProvider);

    final openMatters =
        mattersAsync.valueOrNull
            ?.where((matter) => matter.status != 'CLOSED')
            .length ??
        0;
    final overdueTasks =
        tasksAsync.valueOrNull
            ?.where(
              (task) =>
                  task.dueDate != null &&
                  task.dueDate!.isBefore(DateTime.now()) &&
                  task.status != 'DONE',
            )
            .length ??
        0;
    final newLeads =
        leadsAsync.valueOrNull
            ?.where((lead) => lead.status == 'OPEN' || lead.status == 'NEW')
            .length ??
        0;
    final todayEventCount = todayEventsAsync.valueOrNull ?? 0;
    final recentMatters = (mattersAsync.valueOrNull ?? const <FirmMatter>[])
        .take(3)
        .toList();
    final activeAlerts = (alertsAsync.valueOrNull ?? const <AppAlert>[])
        .where((alert) => alert.status == 'ACTIVE')
        .take(3)
        .toList();
    final monitorsTotalUnread =
        monitorsSummaryAsync.valueOrNull?['totalUnread'] ?? 0;
    final monitorsCritical =
        monitorsSummaryAsync.valueOrNull?['criticalCount'] ?? 0;

    final countryCode =
        ref
            .watch(authControllerProvider)
            .session
            ?.user
            .countryCode
            ?.toUpperCase() ??
        '';
    final isIndia = countryCode == 'IN';

    final now = DateTime.now();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final todayLabel =
        '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';

    return Scaffold(
      backgroundColor: AppColors.logoBlue,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: const LawyerMenuButton(),
        title: Text(
          l10n.dashboardFirmDashboard,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
        actions: [
          _AiUsageChip(
            onTap: () => context.go('/lawyer/settings/ai-usage'),
          ),
          IconButton(
            tooltip: l10n.commonSettings,
            onPressed: () => context.go('/lawyer/settings'),
            icon: Icon(
              Icons.settings_outlined,
              size: 20,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
          IconButton(
            tooltip: 'Help & tour',
            onPressed: () => ShowCaseWidget.of(context)
                .startShowCase([_searchKey, _statsKey, _actionsKey]),
            icon: Icon(
              Icons.help_outline,
              size: 20,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Atmospheric glow orbs ──────────────────────────────────────
          Positioned(
            top: -120,
            right: -100,
            child: IgnorePointer(
              child: Container(
                width: 380,
                height: 380,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.logoAccent.withValues(alpha: 0.14),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: 320,
            left: -120,
            child: IgnorePointer(
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF7C3AED).withValues(alpha: 0.09),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Main scroll content ────────────────────────────────────────
          RefreshIndicator(
            color: AppColors.logoAccent,
            backgroundColor: AppColors.logoBlueSurface,
            onRefresh: () async {
              ref
                ..invalidate(mattersListProvider)
                ..invalidate(lawyerDashboardTasksProvider)
                ..invalidate(lawyerDashboardLeadsProvider)
                ..invalidate(lawyerDashboardTodayEventsProvider)
                ..invalidate(lawyerDashboardAlertsProvider)
                ..invalidate(lawyerDashboardMonitorsSummaryProvider);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 48),
              children: [
                // ── Greeting ───────────────────────────────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.logoAccent.withValues(alpha: 0.22),
                            AppColors.logoAccent.withValues(alpha: 0.08),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppColors.logoAccent.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.auto_awesome,
                            size: 11,
                            color: AppColors.logoAccent,
                          ),
                          const SizedBox(width: 5),
                          const Text(
                            'AI Workspace',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.logoAccent,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      todayLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  _greetingShort(l10n),
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.45),
                    height: 1.4,
                  ),
                ),
                Text(
                  user?.name?.split(' ').first ??
                      l10n.dashboardDefaultCounselName,
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.1,
                    letterSpacing: -0.8,
                  ),
                ),
                const SizedBox(height: 22),

                // ── Search bar ─────────────────────────────────────────
                UmbrellaShowcase(
                  showcaseKey: _searchKey,
                  title: TutorialStrings.lawyerSearchTitle,
                  description: TutorialStrings.lawyerSearchBody,
                  child: _SearchActionBar(
                    l10n: l10n,
                    onTap: () => _showCommandSheet(context),
                  ),
                ),
                const SizedBox(height: 28),

                // ── Stats strip ────────────────────────────────────────
                UmbrellaShowcase(
                  showcaseKey: _statsKey,
                  title: TutorialStrings.lawyerStatsTitle,
                  description: TutorialStrings.lawyerStatsBody,
                  child: Row(
                    children: [
                      Expanded(
                        child: _StatPill(
                          label: l10n.dashboardOpenMatters,
                          value: openMatters.toString(),
                          icon: Icons.folder_open_outlined,
                          color: const Color(0xFF226FEF),
                          isLoading: mattersAsync.isLoading,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.go('/lawyer/matters');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatPill(
                          label: l10n.dashboardOverdueTasks,
                          value: overdueTasks.toString(),
                          icon: Icons.warning_amber_rounded,
                          color: const Color(0xFFF59E0B),
                          isLoading: tasksAsync.isLoading,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.go('/lawyer/tasks');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatPill(
                          label: l10n.dashboardNewLeads,
                          value: newLeads.toString(),
                          icon: Icons.inbox_outlined,
                          color: const Color(0xFF10B981),
                          isLoading: leadsAsync.isLoading,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.go('/lawyer/leads');
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatPill(
                          label: l10n.lawyerNavCalendar,
                          value: todayEventCount.toString(),
                          icon: Icons.calendar_today_outlined,
                          color: const Color(0xFF8B5CF6),
                          isLoading: todayEventsAsync.isLoading,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.go('/lawyer/calendar');
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // ── AI tools ───────────────────────────────────────────
                UmbrellaShowcase(
                  showcaseKey: _actionsKey,
                  title: TutorialStrings.lawyerActionsTitle,
                  description: TutorialStrings.lawyerActionsBody,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('AI tools'),
                      const SizedBox(height: 14),
                      // Docu Draft — hero featured card (most popular product)
                      _FeaturedActionCard(
                        icon: Icons.edit_document,
                        title: l10n.docuDraftTitle,
                        description:
                            'Draft contracts, NDAs, and legal documents with AI — precise, fast, and fully editable.',
                        accentColor: const Color(0xFF7C3AED),
                        badge: 'Most popular',
                        onTap: () {
                          HapticFeedback.lightImpact();
                          context.go('/lawyer/docu-draft');
                        },
                      ),
                      const SizedBox(height: 10),
                      // Secondary tools — 3-up compact row
                      SizedBox(
                        height: 108,
                        child: Row(
                          children: [
                            Expanded(
                              child: _MiniActionCard(
                                icon: Icons.person_add_alt_1,
                                title: l10n.dashboardClientIntake,
                                accentColor: const Color(0xFF059669),
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  context.go('/lawyer/intake');
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _MiniActionCard(
                                icon: Icons.travel_explore,
                                title: l10n.dashboardLegalResearch,
                                accentColor: const Color(0xFF6366F1),
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  context.go('/lawyer/research');
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _MiniActionCard(
                                icon: Icons.manage_search_outlined,
                                title: l10n.consumerDocumentReview,
                                accentColor: const Color(0xFF8B5CF6),
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  context.go('/lawyer/document-review');
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // ── Quick links ────────────────────────────────────────
                const _SectionLabel('Quick links'),
                const SizedBox(height: 14),
                _QuickLinksRow(
                  l10n: l10n,
                  isIndia: isIndia,
                  monitorsUnread: monitorsTotalUnread,
                ),
                const SizedBox(height: 28),

                // ── Recent matters ─────────────────────────────────────
                _SectionLabel(
                  l10n.dashboardRecentMatters,
                  trailing: GestureDetector(
                    onTap: () => context.go('/lawyer/matters'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.logoAccent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppColors.logoAccent.withValues(alpha: 0.22),
                        ),
                      ),
                      child: const Text(
                        'See all',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.logoAccent,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                if (mattersAsync.isLoading)
                  _MattersSkeleton()
                else if (recentMatters.isEmpty)
                  _MatterEmptyState(
                    onTap: () => context.go('/lawyer/matters/new'),
                  )
                else
                  ...recentMatters.map(
                    (matter) => _MatterRow(
                      matter: matter,
                      onTap: () =>
                          context.go('/lawyer/matters/${matter.id}'),
                    ),
                  ),
                const SizedBox(height: 28),

                // ── Active alerts + Regulatory updates ─────────────────
                if (activeAlerts.isNotEmpty || monitorsTotalUnread > 0) ...[
                  _SectionLabel(l10n.dashboardActiveAlerts),
                  const SizedBox(height: 12),
                  if (monitorsTotalUnread > 0) ...[
                    _MonitorHitRow(
                      totalUnread: monitorsTotalUnread,
                      hasCritical: monitorsCritical > 0,
                      onTap: () => context.go('/lawyer/monitors'),
                    ),
                    const SizedBox(height: 8),
                  ],
                  ...activeAlerts.map(
                    (alert) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0x22F59E0B),
                              Color(0x06F59E0B),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: const Color(0xFFF59E0B)
                                .withValues(alpha: 0.32),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B)
                                    .withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.warning_amber_rounded,
                                color: Color(0xFFF59E0B),
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                alert.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const Icon(
                              Icons.arrow_forward_ios_rounded,
                              color: Color(0xFFF59E0B),
                              size: 13,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _greetingShort(AppLocalizations l10n) {
  final hour = DateTime.now().hour;
  if (hour < 12) return l10n.dashboardGreetingMorningShort;
  if (hour < 17) return l10n.dashboardGreetingAfternoonShort;
  return l10n.dashboardGreetingEveningShort;
}

Color _avatarColor(String? name) {
  if (name == null || name.isEmpty) return AppColors.logoAccent;
  final hash = name.codeUnits.fold(0, (prev, el) => prev + el);
  const palette = [
    Color(0xFF226FEF),
    Color(0xFF059669),
    Color(0xFF7C3AED),
    Color(0xFFF59E0B),
    Color(0xFFEF4444),
    Color(0xFF6366F1),
    Color(0xFF8B5CF6),
    Color(0xFF10B981),
  ];
  return palette[hash % palette.length];
}

// ---------------------------------------------------------------------------
// Monitor hit row
// ---------------------------------------------------------------------------

class _MonitorHitRow extends StatelessWidget {
  const _MonitorHitRow({
    required this.totalUnread,
    required this.hasCritical,
    required this.onTap,
  });

  final int totalUnread;
  final bool hasCritical;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color =
        hasCritical ? const Color(0xFFE11D48) : const Color(0xFFF59E0B);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withValues(alpha: 0.16),
              color.withValues(alpha: 0.04),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(11),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.35),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Icon(Icons.radar_rounded, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$totalUnread new regulatory update${totalUnread == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tap to review',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.42),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(
                Icons.arrow_forward_ios_rounded,
                color: color,
                size: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section label with accent bar
// ---------------------------------------------------------------------------

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 15,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.logoAccent, Color(0x44226FEF)],
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
              color: Colors.white.withValues(alpha: 0.42),
            ),
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

void _showCommandSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.logoBlueSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _CommandSheet(),
  );
}

// ---------------------------------------------------------------------------
// Search / command bar
// ---------------------------------------------------------------------------

class _SearchActionBar extends StatelessWidget {
  const _SearchActionBar({required this.l10n, required this.onTap});

  final AppLocalizations l10n;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.logoBlueSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.logoAccent.withValues(alpha: 0.28),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.logoAccent.withValues(alpha: 0.07),
              blurRadius: 18,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: AppColors.logoAccent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(9),
              ),
              child: const Icon(
                Icons.search,
                color: AppColors.logoAccent,
                size: 17,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                l10n.dashboardSearchPrompt,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withValues(alpha: 0.4),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.logoAccent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(7),
                border: Border.all(
                  color: AppColors.logoAccent.withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                l10n.dashboardActionsShortcut,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.logoAccent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Command sheet
// ---------------------------------------------------------------------------

class _CommandSheet extends StatelessWidget {
  _CommandSheet();

  final _searchCtrl = TextEditingController();

  List<({IconData icon, String label, String route})> _actions(
    AppLocalizations l10n,
  ) =>
      [
        (
          icon: Icons.person_add_alt_1_outlined,
          label: l10n.lawyerNavNewIntake,
          route: '/lawyer/intake',
        ),
        (
          icon: Icons.travel_explore,
          label: l10n.lawyerNavAiLegalSearch,
          route: '/lawyer/research',
        ),
        (
          icon: Icons.manage_search_outlined,
          label: 'Document Review',
          route: '/lawyer/document-review',
        ),
        (
          icon: Icons.menu_book_outlined,
          label: 'Section Finder',
          route: '/lawyer/section-finder',
        ),
        (
          icon: Icons.edit_document,
          label: 'Docu Draft',
          route: '/lawyer/docu-draft',
        ),
        (
          icon: Icons.add_circle_outline,
          label: l10n.lawyerMattersNewMatter,
          route: '/lawyer/matters/new',
        ),
        (
          icon: Icons.timer_outlined,
          label: l10n.commonLogTime,
          route: '/lawyer/time',
        ),
        (
          icon: Icons.add_task_outlined,
          label: l10n.lawyerNavTasks,
          route: '/lawyer/tasks',
        ),
        (
          icon: Icons.inbox_outlined,
          label: l10n.dashboardViewLeads,
          route: '/lawyer/leads',
        ),
        (
          icon: Icons.folder_open_outlined,
          label: l10n.dashboardAllMatters,
          route: '/lawyer/matters',
        ),
        (
          icon: Icons.people_outline,
          label: l10n.lawyerNavClients,
          route: '/lawyer/clients',
        ),
        (
          icon: Icons.receipt_long_outlined,
          label: l10n.lawyerNavBilling,
          route: '/lawyer/billing',
        ),
        (
          icon: Icons.account_balance_wallet_outlined,
          label: l10n.lawyerNavTrust,
          route: '/lawyer/trust',
        ),
        (
          icon: Icons.calendar_month_outlined,
          label: l10n.lawyerNavCalendar,
          route: '/lawyer/calendar',
        ),
        (
          icon: Icons.mic_none,
          label: l10n.lawyerNavMeetings,
          route: '/lawyer/meetings',
        ),
        (
          icon: Icons.settings_outlined,
          label: l10n.lawyerNavSettings,
          route: '/lawyer/settings',
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final actions = _actions(l10n);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: StatefulBuilder(
        builder: (context, setState) {
          final query = _searchCtrl.text.toLowerCase();
          final filtered = actions
              .where((a) => a.label.toLowerCase().contains(query))
              .toList();
          final maxSheetHeight = MediaQuery.sizeOf(context).height * 0.75;

          return ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxSheetHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 14),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 18),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    controller: _searchCtrl,
                    autofocus: true,
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(
                        Icons.search,
                        size: 20,
                        color: AppColors.logoAccent,
                      ),
                      hintText: l10n.dashboardSearchActions,
                      hintStyle: TextStyle(
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                      filled: true,
                      fillColor: AppColors.logoBlue,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: AppColors.logoAccent.withValues(alpha: 0.25),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: AppColors.logoAccent.withValues(alpha: 0.2),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: AppColors.logoAccent,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final action = filtered[i];
                      return ListTile(
                        leading: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color:
                                AppColors.logoAccent.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            action.icon,
                            color: AppColors.logoAccent,
                            size: 18,
                          ),
                        ),
                        title: Text(
                          action.label,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                            fontSize: 14,
                          ),
                        ),
                        trailing: Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 14,
                          color: Colors.white.withValues(alpha: 0.28),
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.go(action.route);
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stat pill — gradient card with shimmer + animated value
// ---------------------------------------------------------------------------

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.isLoading = false,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool isLoading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 13, 10, 13),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withValues(alpha: 0.22),
              color.withValues(alpha: 0.06),
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.12),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(9),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.45),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Icon(icon, color: color, size: 15),
            ),
            const SizedBox(height: 10),
            if (isLoading)
              ShimmerBox(width: 36, height: 22, borderRadius: 6)
            else
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 450),
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.25),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
                child: Text(
                  value,
                  key: ValueKey(value),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 24,
                    color: Colors.white,
                    height: 1,
                  ),
                ),
              ),
            const SizedBox(height: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.52),
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Featured AI action card — full-width horizontal layout
// ---------------------------------------------------------------------------

class _FeaturedActionCard extends StatelessWidget {
  const _FeaturedActionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.accentColor,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String description;
  final Color accentColor;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        splashColor: accentColor.withValues(alpha: 0.08),
        highlightColor: accentColor.withValues(alpha: 0.04),
        child: Ink(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                accentColor.withValues(alpha: 0.30),
                accentColor.withValues(alpha: 0.10),
              ],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: accentColor.withValues(alpha: 0.40)),
            boxShadow: [
              BoxShadow(
                color: accentColor.withValues(alpha: 0.18),
                blurRadius: 28,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 62,
                  height: 62,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.30),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.55),
                        blurRadius: 22,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                  child: Icon(icon, color: Colors.white, size: 30),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (badge != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: accentColor.withValues(alpha: 0.55),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.local_fire_department_rounded,
                                size: 10,
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                badge!,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: Colors.white,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.60),
                          height: 1.4,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Open',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.white.withValues(alpha: 0.9),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Icon(
                              Icons.arrow_forward_rounded,
                              size: 13,
                              color: Colors.white.withValues(alpha: 0.9),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mini action card — compact square for secondary tools
// ---------------------------------------------------------------------------

class _MiniActionCard extends StatelessWidget {
  const _MiniActionCard({
    required this.icon,
    required this.title,
    required this.accentColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        splashColor: accentColor.withValues(alpha: 0.1),
        child: Ink(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                accentColor.withValues(alpha: 0.2),
                accentColor.withValues(alpha: 0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: accentColor.withValues(alpha: 0.3)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.24),
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.4),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Icon(icon, color: accentColor, size: 18),
                ),
                const Spacer(),
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: Colors.white,
                    height: 1.25,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick links — wrapping chip row
// ---------------------------------------------------------------------------

class _QuickLinksRow extends StatelessWidget {
  const _QuickLinksRow({
    required this.l10n,
    required this.isIndia,
    required this.monitorsUnread,
  });

  final AppLocalizations l10n;
  final bool isIndia;
  final int monitorsUnread;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[
      _QuickLinkChip(
        icon: Icons.add_circle_outline,
        label: l10n.lawyerMattersNewMatter,
        color: const Color(0xFF226FEF),
        onTap: () => context.go('/lawyer/matters/new'),
      ),
      _QuickLinkChip(
        icon: Icons.add_task_outlined,
        label: l10n.dashboardNewTask,
        color: const Color(0xFF10B981),
        onTap: () => context.go('/lawyer/tasks'),
      ),
      _QuickLinkChip(
        icon: Icons.mic_outlined,
        label: 'Record',
        color: const Color(0xFFEF4444),
        onTap: () => context.go('/lawyer/meetings'),
      ),
      _QuickLinkChip(
        icon: Icons.timer_outlined,
        label: l10n.commonLogTime,
        color: const Color(0xFFF59E0B),
        onTap: () => context.go('/lawyer/time'),
      ),
      if (isIndia)
        _QuickLinkChip(
          icon: Icons.menu_book_outlined,
          label: l10n.sectionFinderTitle,
          color: const Color(0xFF8B5CF6),
          onTap: () => context.go('/lawyer/section-finder'),
        ),
      if (monitorsUnread > 0)
        _QuickLinkChip(
          icon: Icons.radar_rounded,
          label: 'Monitors',
          color: const Color(0xFFE11D48),
          badge: monitorsUnread,
          onTap: () => context.go('/lawyer/monitors'),
        ),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: chips,
    );
  }
}

class _QuickLinkChip extends StatelessWidget {
  const _QuickLinkChip({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.color,
    this.badge,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withValues(alpha: 0.18),
                color.withValues(alpha: 0.07),
              ],
            ),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: color.withValues(alpha: 0.32)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 7),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: Colors.white,
                ),
              ),
              if (badge != null && badge! > 0) ...[
                const SizedBox(width: 7),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    badge! > 99 ? '99+' : '$badge',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// AI usage chip — gradient fill acts as progress bar
// ---------------------------------------------------------------------------

class _AiUsageChip extends ConsumerWidget {
  const _AiUsageChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(creditWalletProvider);

    return walletAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (wallet) {
        final pct = wallet.percentUsed.clamp(0, 100);
        final fill = (pct / 100).clamp(0.0, 1.0);
        final chipColor = pct >= 80
            ? const Color(0xFFDC2626)
            : pct >= 60
                ? const Color(0xFFD97706)
                : AppColors.logoAccent;

        return GestureDetector(
          onTap: onTap,
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              // Background gradient doubles as a progress fill
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  chipColor.withValues(alpha: 0.32),
                  chipColor.withValues(alpha: 0.32),
                  chipColor.withValues(alpha: 0.08),
                  chipColor.withValues(alpha: 0.08),
                ],
                stops: [0.0, fill, fill, 1.0],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: chipColor.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome, size: 12, color: chipColor),
                const SizedBox(width: 5),
                Text(
                  '$pct% used',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: chipColor,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Matter row — colored left bar + client avatar
// ---------------------------------------------------------------------------

class _MatterRow extends StatelessWidget {
  const _MatterRow({required this.matter, required this.onTap});
  final FirmMatter matter;
  final VoidCallback onTap;

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'OPEN':
      case 'ACTIVE':
        return const Color(0xFF10B981);
      case 'PENDING':
        return const Color(0xFFF59E0B);
      case 'CLOSED':
        return const Color(0xFF94A3B8);
      default:
        return const Color(0xFF226FEF);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(matter.status);
    final clientName = matter.clientName;
    final initials = clientName != null && clientName.isNotEmpty
        ? clientName
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((w) => w[0].toUpperCase())
            .join()
        : '?';
    final avatarColor = _avatarColor(clientName);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.logoBlueSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.07),
              ),
            ),
            child: Row(
              children: [
                // Colored left accent bar
                Container(
                  width: 4,
                  height: 60,
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Client avatar circle
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: avatarColor.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: avatarColor.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      initials,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: avatarColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          matter.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: Colors.white,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          [
                            matter.practiceArea
                                .replaceAll('_', ' ')
                                .toLowerCase(),
                            if (clientName != null) clientName,
                          ].join(' · '),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.42),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Text(
                    matter.status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: Colors.white.withValues(alpha: 0.25),
                ),
                const SizedBox(width: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Matters skeleton loading placeholder
// ---------------------------------------------------------------------------

class _MattersSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            height: 60,
            decoration: BoxDecoration(
              color: AppColors.logoBlueSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
            ),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ShimmerBox(width: 36, height: 36, borderRadius: 99),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ShimmerBox(
                        width: 140.0 + (i % 3) * 30,
                        height: 12,
                      ),
                      const SizedBox(height: 6),
                      ShimmerBox(width: 90.0 + (i % 2) * 20, height: 10),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                ShimmerBox(width: 48, height: 20, borderRadius: 7),
                const SizedBox(width: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Matter empty state
// ---------------------------------------------------------------------------

class _MatterEmptyState extends StatelessWidget {
  const _MatterEmptyState({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.logoBlueSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.07),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.logoAccent.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.folder_open_outlined,
              color: AppColors.logoAccent,
              size: 26,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'No open matters',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'Start a new matter to track client work',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withValues(alpha: 0.42),
            ),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: 9,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.logoAccent.withValues(alpha: 0.28),
                    AppColors.logoAccent.withValues(alpha: 0.12),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.logoAccent.withValues(alpha: 0.4),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 15, color: AppColors.logoAccent),
                  SizedBox(width: 6),
                  Text(
                    'New Matter',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.logoAccent,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
