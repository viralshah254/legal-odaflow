import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_list_skeleton.dart';

class CourtScreen extends ConsumerStatefulWidget {
  const CourtScreen({super.key});

  @override
  ConsumerState<CourtScreen> createState() => _CourtScreenState();
}

class _CourtScreenState extends ConsumerState<CourtScreen> {
  List<Map<String, dynamic>> _matters = [];
  bool _loading = true;
  String? _error;

  // Cache per-matter deadline futures so FutureBuilder doesn't re-fetch on rebuild.
  final Map<String, Future<List<dynamic>>> _deadlineFutures = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _deadlineFutures.clear();
    });
    try {
      final api = ref.read(apiClientProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final resp = await api.dio.get<dynamic>(
        '/matters',
        queryParameters: {'limit': 20},
        options: tenantId != null
            ? Options(headers: {'X-Tenant-Id': tenantId})
            : null,
      );
      final list = (resp.data as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() => _matters = list);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _matters = [];
        _error = e.toString();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<List<dynamic>> _fetchDeadlines(String matterId) async {
    try {
      final api = ref.read(apiClientProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final resp = await api.dio.get<dynamic>(
        '/matters/$matterId/court-deadlines',
        options: tenantId != null
            ? Options(headers: {'X-Tenant-Id': tenantId})
            : null,
      );
      return resp.data as List<dynamic>? ?? [];
    } catch (_) {
      // Return empty list on 404 or any other error — not all matters have court deadlines.
      return [];
    }
  }

  Future<List<dynamic>> _deadlinesFor(String matterId) {
    return _deadlineFutures.putIfAbsent(matterId, () => _fetchDeadlines(matterId));
  }

  Color _deadlineColor(String? dueDate) {
    if (dueDate == null) return const Color(0xFF94A3B8);
    final due = DateTime.tryParse(dueDate);
    if (due == null) return const Color(0xFF94A3B8);
    final now = DateTime.now();
    final diff = due.difference(now).inDays;
    if (diff < 0) return const Color(0xFFEF4444);
    if (diff <= 7) return const Color(0xFFF59E0B);
    return const Color(0xFF10B981);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final fg = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
    final mutedFg = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Court & Deadlines'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: AppListSkeleton(itemCount: 6),
            )
          : _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : _matters.isEmpty
                  ? AppEmptyState(
                      icon: Icons.gavel_outlined,
                      label: 'No matters found',
                      sublabel: 'Create a matter to track court dates and deadlines.',
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                        itemCount: _matters.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final matter = _matters[index];
                          final matterId = matter['id'] as String;
                          final title = matter['title'] as String? ?? 'Matter';
                          final stage = matter['stage'] as String?;

                          return Container(
                            decoration: BoxDecoration(
                              color: surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: border),
                            ),
                            child: Theme(
                              data: Theme.of(context)
                                  .copyWith(dividerColor: Colors.transparent),
                              child: ExpansionTile(
                                tilePadding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 4),
                                childrenPadding: EdgeInsets.zero,
                                title: Text(
                                  title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: fg,
                                  ),
                                ),
                                subtitle: stage != null && stage.isNotEmpty
                                    ? Text(
                                        stage,
                                        style: TextStyle(
                                            fontSize: 11, color: mutedFg),
                                      )
                                    : null,
                                leading: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEF4444)
                                        .withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.gavel_outlined,
                                      color: Color(0xFFEF4444), size: 16),
                                ),
                                children: [
                                  Divider(height: 1, color: border),
                                  FutureBuilder<List<dynamic>>(
                                    future: _deadlinesFor(matterId),
                                    builder: (context, snapshot) {
                                      if (snapshot.connectionState !=
                                          ConnectionState.done) {
                                        return const Padding(
                                          padding: EdgeInsets.all(16),
                                          child: Center(
                                              child: SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                                strokeWidth: 2),
                                          )),
                                        );
                                      }
                                      if (snapshot.hasError) {
                                        return Padding(
                                          padding: const EdgeInsets.all(14),
                                          child: Text(
                                            'Could not load deadlines',
                                            style: TextStyle(
                                                fontSize: 12, color: mutedFg),
                                          ),
                                        );
                                      }
                                      final deadlines = snapshot.data ?? [];
                                      if (deadlines.isEmpty) {
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 14),
                                          child: Row(
                                            children: [
                                              Icon(Icons.check_circle_outline,
                                                  size: 14, color: mutedFg),
                                              const SizedBox(width: 8),
                                              Text(
                                                'No court deadlines',
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color: mutedFg),
                                              ),
                                            ],
                                          ),
                                        );
                                      }
                                      return Column(
                                        children: deadlines.map((d) {
                                          final row =
                                              d as Map<String, dynamic>;
                                          final due =
                                              row['dueDate'] as String?;
                                          final dColor = _deadlineColor(due);
                                          return Padding(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 14, vertical: 10),
                                            child: Row(
                                              children: [
                                                Container(
                                                  width: 8,
                                                  height: 8,
                                                  decoration: BoxDecoration(
                                                    color: dColor,
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Text(
                                                    row['title'] as String? ??
                                                        'Deadline',
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      color: fg,
                                                    ),
                                                  ),
                                                ),
                                                if (due != null)
                                                  Container(
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 8,
                                                        vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: dColor
                                                          .withValues(
                                                              alpha: 0.1),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              20),
                                                    ),
                                                    child: Text(
                                                      DateFormat.yMMMd()
                                                          .format(DateTime
                                                              .parse(due)),
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        color: dColor,
                                                      ),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          );
                                        }).toList(),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
