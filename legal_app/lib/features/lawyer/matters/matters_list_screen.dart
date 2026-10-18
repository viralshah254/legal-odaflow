import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/lawyer_shell_scope.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/tutorials/tutorial_flow.dart';
import '../../../core/tutorials/tutorial_progress_store.dart';
import '../../../core/tutorials/tutorial_strings.dart';
import '../../../core/tutorials/tutorial_theme.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../l10n/app_localizations.dart';
import 'matters_list_widgets.dart';

// ─── Status colors ──────────────────────────────────────────────────────────

Color matterStatusColor(String status) {
  switch (status.toUpperCase()) {
    case 'OPEN':
      return const Color(0xFF10B981);
    case 'CLOSED':
      return const Color(0xFF94A3B8);
    case 'PENDING':
      return const Color(0xFFF59E0B);
    case 'ARCHIVED':
      return const Color(0xFF64748B);
    default:
      return AppColors.logoAccent;
  }
}

IconData _practiceAreaIcon(String pa) {
  switch (pa.toLowerCase()) {
    case 'litigation_disputes':
    case 'litigation':
      return Icons.balance_outlined;
    case 'corporate_commercial':
      return Icons.business_center_outlined;
    case 'family_matrimonial':
      return Icons.favorite_outline;
    case 'real_estate_property':
      return Icons.home_work_outlined;
    case 'criminal_defense':
    case 'criminal':
      return Icons.gavel_outlined;
    case 'employment_labour':
      return Icons.work_outline;
    case 'immigration':
      return Icons.flight_outlined;
    case 'intellectual_property':
      return Icons.lightbulb_outline;
    case 'tax':
      return Icons.receipt_long_outlined;
    case 'wills_estates_probate':
      return Icons.account_balance_outlined;
    default:
      return Icons.folder_outlined;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

final mattersListProvider = FutureProvider<List<FirmMatter>>((ref) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException(
      'Tenant ID is required. Sign in again or use the web app.',
    );
  }
  return ref.watch(mattersApiProvider).listMatters(tenantId: tenantId);
});

enum _MatterDateFilter { all, today, week, month, custom }

// ─── Screen ─────────────────────────────────────────────────────────────────

class MattersListScreen extends ConsumerStatefulWidget {
  const MattersListScreen({super.key});

  @override
  ConsumerState<MattersListScreen> createState() => _MattersListScreenState();
}

class _MattersListScreenState extends ConsumerState<MattersListScreen> {
  static const _pageSize = 20;

  final _listKey = GlobalKey();
  final _fabKey = GlobalKey();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _searchFocusNode = FocusNode();
  Timer? _searchDebounce;
  bool _tourStarted = false;

  List<FirmMatter> _matters = [];
  bool _hasLoadedOnce = false;
  bool _initialLoading = true;
  bool _refreshing = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  int _total = 0;
  String? _error;
  String _searchQuery = '';
  String? _statusFilter;
  _MatterDateFilter _dateFilter = _MatterDateFilter.all;
  DateTimeRange? _customDateRange;
  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _scrollController.addListener(_onScroll);
    _fetchMatters(initial: true, reset: true);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  String? get _tenantId =>
      ref.read(authControllerProvider).session?.user.tenantId;

  String _formatDateParam(DateTime date) =>
      DateFormat('yyyy-MM-dd').format(date);

  (String?, String?) _dateRangeParams() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    switch (_dateFilter) {
      case _MatterDateFilter.today:
        final d = _formatDateParam(today);
        return (d, d);
      case _MatterDateFilter.week:
        return (
          _formatDateParam(today.subtract(const Duration(days: 7))),
          _formatDateParam(today),
        );
      case _MatterDateFilter.month:
        return (
          _formatDateParam(today.subtract(const Duration(days: 30))),
          _formatDateParam(today),
        );
      case _MatterDateFilter.custom:
        if (_customDateRange == null) return (null, null);
        return (
          _formatDateParam(_customDateRange!.start),
          _formatDateParam(_customDateRange!.end),
        );
      case _MatterDateFilter.all:
        return (null, null);
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients || !_hasMore || _loadingMore || _refreshing) {
      return;
    }
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 280) {
      unawaited(_fetchMatters(reset: false));
    }
  }

  void _onSearchChanged() {
    _searchDebounce?.cancel();
    if (!_initialLoading && _matters.isNotEmpty) {
      setState(() => _refreshing = true);
    }
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      final next = _searchController.text.trim();
      if (next == _searchQuery) {
        if (mounted) setState(() => _refreshing = false);
        return;
      }
      _searchQuery = next;
      unawaited(_fetchMatters(reset: true));
    });
  }

  Future<void> _fetchMatters({
    required bool reset,
    bool initial = false,
  }) async {
    final tenantId = _tenantId ?? '';
    if (tenantId.isEmpty) return;
    if (!reset && (!_hasMore || _loadingMore)) return;

    if (!_hasLoadedOnce && (initial || reset)) {
      setState(() {
        _initialLoading = true;
        _error = null;
      });
    } else if (reset) {
      setState(() {
        _refreshing = true;
        _error = null;
        _page = 1;
        _hasMore = true;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    final page = reset ? 1 : _page + 1;
    final (dateFrom, dateTo) = _dateRangeParams();

    try {
      final result = await ref.read(mattersApiProvider).listMattersPage(
            tenantId: tenantId,
            search: _searchQuery.isEmpty ? null : _searchQuery,
            status: _statusFilter,
            dateFrom: dateFrom,
            dateTo: dateTo,
            page: page,
            limit: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        if (reset) {
          _matters = result.items;
        } else {
          _matters = [..._matters, ...result.items];
        }
        _page = result.page;
        _total = result.total;
        _hasMore = result.hasMore;
        _hasLoadedOnce = true;
        _initialLoading = false;
        _refreshing = false;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : e.toString();
        _initialLoading = false;
        _refreshing = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _maybeStartTour() async {
    if (_tourStarted || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null) return;
    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey('mobile.lawyer.matters')) return;
    if (!mounted) return;
    _tourStarted = true;
    await runTutorialWithWelcome(
      context: context,
      showcaseKeys: [_listKey, _fabKey],
      onSkip: () => store.markSkipped(userId, 'mobile.lawyer.matters'),
      onComplete: () => store.markCompleted(userId, 'mobile.lawyer.matters'),
      onDismiss: () => _tourStarted = false,
      welcomeBody: TutorialStrings.mattersWelcomeBody,
      welcomeBullets: const [
        TutorialStrings.mattersWelcomeBullet1,
        TutorialStrings.mattersWelcomeBullet2,
        TutorialStrings.mattersWelcomeBullet3,
      ],
    );
  }

  Future<void> _confirmDelete(FirmMatter matter) async {
    final tenantId = _tenantId;
    if (tenantId == null || _deletingId != null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: const Text('Delete matter?'),
        content: Text(
          '"${matter.title}" will be permanently deleted. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red.shade700,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _deletingId = matter.id);
    try {
      await ref.read(mattersApiProvider).deleteMatter(
            tenantId: tenantId,
            matterId: matter.id,
          );
      if (!mounted) return;
      setState(() {
        _matters = _matters.where((m) => m.id != matter.id).toList();
        _total = math.max(0, _total - 1);
      });
      ref.invalidate(mattersListProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            content: Text(
              e is ApiException ? e.message : 'Failed to delete matter',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  Future<void> _pickCustomDateRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _customDateRange,
    );
    if (range == null || !mounted) return;
    setState(() {
      _customDateRange = range;
      _dateFilter = _MatterDateFilter.custom;
    });
    unawaited(_fetchMatters(reset: true));
  }

  void _setStatusFilter(String? status) {
    if (_statusFilter == status) return;
    setState(() => _statusFilter = status);
    unawaited(_fetchMatters(reset: true));
  }

  void _setDateFilter(_MatterDateFilter filter) {
    if (filter == _MatterDateFilter.custom) {
      unawaited(_pickCustomDateRange());
      return;
    }
    if (_dateFilter == filter) return;
    setState(() => _dateFilter = filter);
    unawaited(_fetchMatters(reset: true));
  }

  bool get _hasActiveFilters =>
      _searchQuery.isNotEmpty ||
      _searchController.text.trim().isNotEmpty ||
      _statusFilter != null ||
      _dateFilter != _MatterDateFilter.all;

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    _searchFocusNode.unfocus();
    setState(() {
      _searchQuery = '';
      _statusFilter = null;
      _dateFilter = _MatterDateFilter.all;
      _customDateRange = null;
    });
    unawaited(_fetchMatters(reset: true));
  }

  String _dateFilterLabel() {
    switch (_dateFilter) {
      case _MatterDateFilter.today:
        return 'Today';
      case _MatterDateFilter.week:
        return '7 days';
      case _MatterDateFilter.month:
        return '30 days';
      case _MatterDateFilter.custom:
        if (_customDateRange == null) return 'Custom';
        final fmt = DateFormat('MMM d');
        return '${fmt.format(_customDateRange!.start)} – ${fmt.format(_customDateRange!.end)}';
      case _MatterDateFilter.all:
        return 'All time';
    }
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader(AppLocalizations l10n) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final openCount = _matters.where((m) => m.status.toUpperCase() == 'OPEN').length;
    final pendingCount = _matters.where((m) => m.status.toUpperCase() == 'PENDING').length;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.06)
                : Colors.black.withValues(alpha: 0.06),
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Title row
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 16, 0),
              child: Row(
                children: [
                  const LawyerMenuButton(),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.mattersTitle,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : Colors.black87,
                            letterSpacing: -0.3,
                          ),
                        ),
                        if (_hasLoadedOnce && _total > 0)
                          Text(
                            '$_total matter${_total == 1 ? '' : 's'}',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.4)
                                  : Colors.black.withValues(alpha: 0.4),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (_hasLoadedOnce && _total > 0) ...[
                    _StatPill(
                      label: 'Open',
                      count: openCount,
                      color: const Color(0xFF10B981),
                    ),
                    const SizedBox(width: 6),
                    _StatPill(
                      label: 'Pending',
                      count: pendingCount,
                      color: const Color(0xFFF59E0B),
                    ),
                    const SizedBox(width: 6),
                  ],
                  IconButton(
                    tooltip: 'Help',
                    onPressed: () => ShowCaseWidget.of(context)
                        .startShowCase([_listKey, _fabKey]),
                    icon: Icon(
                      Icons.help_outline_rounded,
                      size: 20,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.45)
                          : Colors.black38,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Search bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: ValueListenableBuilder<TextEditingValue>(
                valueListenable: _searchController,
                builder: (context, value, _) {
                  return Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.06)
                          : Colors.black.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      decoration: InputDecoration(
                        hintText: l10n.mattersSearchByTitleRefOrClient,
                        hintStyle: TextStyle(
                          fontSize: 14,
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.35)
                              : Colors.black38,
                        ),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          size: 18,
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.4)
                              : Colors.black38,
                        ),
                        suffixIcon: value.text.isNotEmpty
                            ? GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  _searchQuery = '';
                                  unawaited(_fetchMatters(reset: true));
                                },
                                child: Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.4)
                                      : Colors.black38,
                                ),
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 12,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            // Filter row
            _buildFilterRow(isDark),
            // Loading bar
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: (_refreshing || _loadingMore)
                  ? LinearProgressIndicator(
                      key: const ValueKey('p'),
                      minHeight: 2,
                      backgroundColor: Colors.transparent,
                      color: AppColors.logoAccent.withValues(alpha: 0.7),
                    )
                  : const SizedBox(key: ValueKey('s'), height: 2),
            ),
          ],
        ),
      ),
    );
  }

  // ── Filter row ────────────────────────────────────────────────────────────

  Widget _buildFilterRow(bool isDark) {
    final statusOptions = <(String?, String, Color)>[
      (null, 'All', AppColors.logoAccent),
      ('OPEN', 'Open', const Color(0xFF10B981)),
      ('PENDING', 'Pending', const Color(0xFFF59E0B)),
      ('CLOSED', 'Closed', const Color(0xFF94A3B8)),
      ('ARCHIVED', 'Archived', const Color(0xFF64748B)),
    ];

    final dateActive = _dateFilter != _MatterDateFilter.all;

    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          ...statusOptions.map((opt) {
            final selected = _statusFilter == opt.$1;
            final color = opt.$3;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => _setStatusFilter(opt.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 0,
                  ),
                  decoration: BoxDecoration(
                    color: selected
                        ? color.withValues(alpha: isDark ? 0.2 : 0.12)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: selected
                          ? color.withValues(alpha: 0.6)
                          : (isDark
                              ? Colors.white.withValues(alpha: 0.12)
                              : Colors.black.withValues(alpha: 0.1)),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (selected) ...[
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                      ],
                      Text(
                        opt.$2,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: selected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: selected
                              ? color
                              : (isDark
                                  ? Colors.white.withValues(alpha: 0.55)
                                  : Colors.black54),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
          // Divider
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: VerticalDivider(
              width: 1,
              thickness: 1,
              indent: 6,
              endIndent: 6,
              color: isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.black.withValues(alpha: 0.08),
            ),
          ),
          // Date filter chip
          GestureDetector(
            onTap: () => _showDateMenu(context),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: dateActive
                    ? AppColors.logoAccent.withValues(alpha: isDark ? 0.18 : 0.1)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: dateActive
                      ? AppColors.logoAccent.withValues(alpha: 0.5)
                      : (isDark
                          ? Colors.white.withValues(alpha: 0.12)
                          : Colors.black.withValues(alpha: 0.1)),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.calendar_today_outlined,
                    size: 13,
                    color: dateActive
                        ? AppColors.logoAccent
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.5)
                            : Colors.black45),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    _dateFilterLabel(),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: dateActive ? FontWeight.w700 : FontWeight.w500,
                      color: dateActive
                          ? AppColors.logoAccent
                          : (isDark
                              ? Colors.white.withValues(alpha: 0.55)
                              : Colors.black54),
                    ),
                  ),
                  const SizedBox(width: 3),
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 14,
                    color: dateActive
                        ? AppColors.logoAccent
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.35)
                            : Colors.black38),
                  ),
                ],
              ),
            ),
          ),
          // Clear filters
          if (_hasActiveFilters) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _clearFilters,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.red.withValues(alpha: 0.3),
                  ),
                  color: Colors.red.withValues(alpha: isDark ? 0.1 : 0.06),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.filter_alt_off_outlined,
                      size: 13,
                      color: Colors.red.shade400,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Clear',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.red.shade400,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showDateMenu(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final options = <(_MatterDateFilter, String, IconData)>[
      (_MatterDateFilter.all, 'All time', Icons.all_inclusive_rounded),
      (_MatterDateFilter.today, 'Today', Icons.today_outlined),
      (_MatterDateFilter.week, 'Last 7 days', Icons.date_range_outlined),
      (_MatterDateFilter.month, 'Last 30 days', Icons.calendar_month_outlined),
      (_MatterDateFilter.custom, 'Custom range…', Icons.tune_outlined),
    ];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.logoBlueSurface : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.15)
                    : Colors.black.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              'Filter by date',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 16),
            ...options.map((opt) {
              final selected = _dateFilter == opt.$1;
              return ListTile(
                dense: true,
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.logoAccent.withValues(alpha: 0.15)
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.05)
                            : Colors.black.withValues(alpha: 0.04)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    opt.$3,
                    size: 18,
                    color: selected
                        ? AppColors.logoAccent
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.5)
                            : Colors.black45),
                  ),
                ),
                title: Text(
                  opt.$2,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected
                        ? AppColors.logoAccent
                        : (isDark ? Colors.white : Colors.black87),
                  ),
                ),
                trailing: selected
                    ? Icon(
                        Icons.check_circle_rounded,
                        size: 18,
                        color: AppColors.logoAccent,
                      )
                    : null,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _setDateFilter(opt.$1);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  // ── Matter card ───────────────────────────────────────────────────────────

  Widget _buildMatterCard(FirmMatter matter, bool isDark) {
    final statusColor = matterStatusColor(matter.status);
    final deleting = _deletingId == matter.id;
    final paIcon = _practiceAreaIcon(matter.practiceArea);
    final paLabel = matter.practiceArea
        .split('_')
        .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.07);

    return AnimatedOpacity(
      opacity: deleting ? 0.4 : 1,
      duration: const Duration(milliseconds: 150),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: deleting
              ? null
              : () => context.go('/lawyer/matters/${matter.id}'),
          onLongPress: deleting ? null : () => _confirmDelete(matter),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
              boxShadow: isDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Practice area icon
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: isDark ? 0.15 : 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          paIcon,
                          size: 19,
                          color: statusColor,
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    matter.title,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: isDark
                                          ? Colors.white
                                          : Colors.black87,
                                      height: 1.3,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                // Status badge
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    matter.status,
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: statusColor,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              paLabel.isNotEmpty ? paLabel : 'General',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.4)
                                    : Colors.black45,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Footer with client + date
                Container(
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.03)
                        : Colors.black.withValues(alpha: 0.02),
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 9),
                  child: Row(
                    children: [
                      if (matter.clientName != null) ...[
                        Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            color: AppColors.logoAccent.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              matter.clientName![0].toUpperCase(),
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: AppColors.logoAccent,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            matter.clientName!,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.logoAccent.withValues(alpha: 0.9),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ] else
                        const Expanded(child: SizedBox.shrink()),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (deleting)
                            SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.5,
                                color: AppColors.logoAccent,
                              ),
                            )
                          else
                            GestureDetector(
                              onTap: () => _confirmDelete(matter),
                              child: Icon(
                                Icons.delete_outline_rounded,
                                size: 15,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.2)
                                    : Colors.black.withValues(alpha: 0.2),
                              ),
                            ),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.chevron_right_rounded,
                            size: 16,
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.25)
                                : Colors.black26,
                          ),
                        ],
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

  // ── List ──────────────────────────────────────────────────────────────────

  Widget _buildMattersList(AppLocalizations l10n) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_matters.isEmpty && !_refreshing) {
      return ListView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 96),
        children: [
          if (!_hasActiveFilters)
            _MattersEmptyState(
              onCreateTap: () => context.go('/lawyer/matters/new'),
            )
          else
            AppEmptyState(
              icon: Icons.search_off_rounded,
              label: 'No matters match your filters',
              sublabel: 'Try adjusting the status or date filter.',
            ),
        ],
      );
    }

    return ListView.separated(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: _matters.length + (_hasMore || _loadingMore ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (index >= _matters.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        return _buildMatterCard(_matters[index], isDark);
      },
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<int>(mattersListRefreshProvider, (previous, next) {
      if (previous != null && next > previous) {
        unawaited(_fetchMatters(reset: true));
      }
    });

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : const Color(0xFFF8FAFC),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(l10n),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.logoAccent,
              onRefresh: () => _fetchMatters(reset: true),
              child: _initialLoading && !_hasLoadedOnce
                  ? const MattersListSkeleton()
                  : _error != null && _matters.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            AppErrorView(
                              message: _error!,
                              onRetry: () =>
                                  _fetchMatters(initial: true, reset: true),
                            ),
                          ],
                        )
                      : UmbrellaShowcase(
                          showcaseKey: _listKey,
                          title: TutorialStrings.lawyerMattersListTitle,
                          description: TutorialStrings.lawyerMattersListBody,
                          child: AnimatedOpacity(
                            opacity: _refreshing ? 0.72 : 1,
                            duration: const Duration(milliseconds: 180),
                            curve: Curves.easeOut,
                            child: _buildMattersList(l10n),
                          ),
                        ),
            ),
          ),
        ],
      ),
      floatingActionButton: UmbrellaShowcase(
        showcaseKey: _fabKey,
        title: TutorialStrings.lawyerMattersCreateTitle,
        description: TutorialStrings.lawyerMattersCreateBody,
        child: FloatingActionButton.extended(
          onPressed: () => context.go('/lawyer/matters/new'),
          backgroundColor: AppColors.logoAccent,
          foregroundColor: Colors.white,
          elevation: 4,
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(
            l10n.mattersNewMatter,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          ),
        ),
      ),
    );
  }
}

// ─── Stat pill widget ────────────────────────────────────────────────────────

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$count $label',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ─── Empty state ─────────────────────────────────────────────────────────────

class _MattersEmptyState extends StatelessWidget {
  const _MattersEmptyState({required this.onCreateTap});

  final VoidCallback onCreateTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.black.withValues(alpha: 0.06),
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.logoAccent.withValues(alpha: 0.2),
                  AppColors.logoAccent.withValues(alpha: 0.06),
                ],
              ),
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.logoAccent.withValues(alpha: 0.25),
              ),
            ),
            child: const Icon(
              Icons.folder_open_rounded,
              color: AppColors.logoAccent,
              size: 30,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'No matters yet',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: isDark ? Colors.white : Colors.black87,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Create your first matter to start tracking\nclient work, documents, and billing.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.55,
              color: isDark
                  ? Colors.white.withValues(alpha: 0.4)
                  : Colors.black.withValues(alpha: 0.45),
            ),
          ),
          const SizedBox(height: 28),
          GestureDetector(
            onTap: onCreateTap,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 28,
                vertical: 13,
              ),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2E7AF0), AppColors.logoAccent],
                ),
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.logoAccent.withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add_rounded, size: 17, color: Colors.white),
                  SizedBox(width: 8),
                  Text(
                    'New matter',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
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
