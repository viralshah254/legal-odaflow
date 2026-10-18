import 'dart:async';
import 'dart:math' as math;

import '../../../l10n/app_localizations.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/meetings_api.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_error_view.dart';
import 'meeting_recording_session_cache.dart';
import 'meetings_list_widgets.dart';
import 'meetings_utils.dart';
import 'record_meeting_screen.dart';

enum _MeetingDateFilter { all, today, week, month, custom }

class MeetingsScreen extends ConsumerStatefulWidget {
  const MeetingsScreen({super.key, this.matterId, this.clientId});

  final String? matterId;
  final String? clientId;

  @override
  ConsumerState<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends ConsumerState<MeetingsScreen> {
  static const _pageSize = 20;

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _searchDebounce;

  List<MeetingModel> _meetings = [];
  bool _hasLoadedOnce = false;
  bool _initialLoading = true;
  bool _refreshing = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  int _total = 0;
  String? _error;
  bool _uploading = false;
  String _searchQuery = '';
  String? _statusFilter;
  _MeetingDateFilter _dateFilter = _MeetingDateFilter.all;
  DateTimeRange? _customDateRange;
  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _scrollController.addListener(_onScroll);
    _fetchMeetings(initial: true, reset: true);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
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
      case _MeetingDateFilter.today:
        final d = _formatDateParam(today);
        return (d, d);
      case _MeetingDateFilter.week:
        return (
          _formatDateParam(today.subtract(const Duration(days: 7))),
          _formatDateParam(today),
        );
      case _MeetingDateFilter.month:
        return (
          _formatDateParam(today.subtract(const Duration(days: 30))),
          _formatDateParam(today),
        );
      case _MeetingDateFilter.custom:
        if (_customDateRange == null) return (null, null);
        return (
          _formatDateParam(_customDateRange!.start),
          _formatDateParam(_customDateRange!.end),
        );
      case _MeetingDateFilter.all:
        return (null, null);
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients || !_hasMore || _loadingMore || _refreshing) {
      return;
    }
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 280) {
      unawaited(_fetchMeetings(reset: false));
    }
  }

  void _onSearchChanged() {
    _searchDebounce?.cancel();
    if (!_initialLoading && _meetings.isNotEmpty) {
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
      unawaited(_fetchMeetings(reset: true));
    });
  }

  Future<void> _fetchMeetings({
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
      final result = await ref.read(meetingsApiProvider).listMeetingsPage(
            tenantId: tenantId,
            matterId: widget.matterId,
            clientId: widget.clientId,
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
          _meetings = result.items;
        } else {
          _meetings = [..._meetings, ...result.items];
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

  Future<void> _deleteMeeting(MeetingModel meeting) async {
    final tenantId = _tenantId;
    if (tenantId == null || _deletingId != null) return;

    final confirmed = await confirmDeleteMeeting(context);
    if (confirmed != true || !mounted) return;

    setState(() => _deletingId = meeting.id);
    try {
      final cached = await MeetingRecordingSessionCache.loadForMeeting(meeting.id);
      if (cached != null) {
        await MeetingRecordingSessionCache.clearAndDeleteFile();
      }
      await ref.read(meetingsApiProvider).deleteMeeting(
            tenantId: tenantId,
            meetingId: meeting.id,
          );
      if (!mounted) return;
      setState(() {
        _meetings = _meetings.where((m) => m.id != meeting.id).toList();
        _total = math.max(0, _total - 1);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Meeting deleted')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Delete failed'),
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
      _dateFilter = _MeetingDateFilter.custom;
      if (_hasLoadedOnce) _refreshing = true;
    });
    unawaited(_fetchMeetings(reset: true));
  }

  void _setStatusFilter(String? status) {
    if (_statusFilter == status) return;
    setState(() {
      _statusFilter = status;
      if (_hasLoadedOnce) _refreshing = true;
    });
    unawaited(_fetchMeetings(reset: true));
  }

  void _setDateFilter(_MeetingDateFilter filter) {
    if (filter == _MeetingDateFilter.custom) {
      unawaited(_pickCustomDateRange());
      return;
    }
    if (_dateFilter == filter) return;
    setState(() {
      _dateFilter = filter;
      if (_hasLoadedOnce) _refreshing = true;
    });
    unawaited(_fetchMeetings(reset: true));
  }

  bool get _hasActiveFilters =>
      _searchQuery.isNotEmpty ||
      _searchController.text.trim().isNotEmpty ||
      _statusFilter != null ||
      _dateFilter != _MeetingDateFilter.all;

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _searchQuery = '';
      _statusFilter = null;
      _dateFilter = _MeetingDateFilter.all;
      _customDateRange = null;
      if (_hasLoadedOnce) _refreshing = true;
    });
    unawaited(_fetchMeetings(reset: true));
  }

  void _showNewMeetingDialog() {
    final l10n = AppLocalizations.of(context);
    final titleCtrl = TextEditingController();
    String source = 'manual';

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(l10n.commonNewMeeting),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  labelText: l10n.commonMeetingTitle2,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: source,
                decoration: InputDecoration(labelText: l10n.adminSource),
                items: const [
                  'manual',
                  'zoom',
                  'teams',
                  'google_meet',
                  'phone',
                  'in_person',
                ]
                    .map(
                      (s) => DropdownMenuItem(
                        value: s,
                        child: Text(s.replaceAll('_', ' ')),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setS(() => source = v ?? 'manual'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.commonCancel),
            ),
            FilledButton(
              onPressed: () async {
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;
                final tenantId = _tenantId;
                if (tenantId == null) return;
                Navigator.pop(ctx);
                try {
                  await ref.read(meetingsApiProvider).createMeeting(
                        tenantId: tenantId,
                        title: title,
                        matterId: widget.matterId,
                        clientId: widget.clientId,
                        source: source,
                        status: 'draft',
                      );
                  await _fetchMeetings(reset: true);
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          e is ApiException ? e.message : 'Error: $e',
                        ),
                      ),
                    );
                  }
                }
              },
              child: Text(l10n.commonCreate),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _uploadRecording() async {
    final tenantId = _tenantId;
    if (tenantId == null || _uploading) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['mp3', 'm4a', 'wav', 'mp4', 'webm'],
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.path == null) return;

    setState(() => _uploading = true);
    try {
      final ext = file.extension ?? 'm4a';
      final api = ref.read(meetingsApiProvider);
      final meeting = await api.createMeeting(
        tenantId: tenantId,
        title: file.name,
        matterId: widget.matterId,
        clientId: widget.clientId,
        source: 'upload',
        status: 'recording',
      );
      await api.uploadAudio(
        tenantId: tenantId,
        meetingId: meeting.id,
        filePath: file.path!,
        mimeType: meetingMimeTypeForExtension(ext),
        durationMs: 0,
      );
      if (!mounted) return;
      context.push('/lawyer/meetings/${meeting.id}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Upload failed'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openRecordScreen() async {
    final meetingId = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => RecordMeetingScreen(
          args: RecordMeetingArgs(
            matterId: widget.matterId,
            clientId: widget.clientId,
          ),
        ),
        fullscreenDialog: true,
      ),
    );
    if (!mounted) return;
    if (meetingId != null) {
      await _fetchMeetings(reset: true);
      if (!mounted) return;
      context.push('/lawyer/meetings/$meetingId');
    }
  }

  String _statusLabel(String status) =>
      normalizeMeetingStatus(status).toUpperCase();

  String _dateFilterLabel() {
    switch (_dateFilter) {
      case _MeetingDateFilter.today:
        return 'Today';
      case _MeetingDateFilter.week:
        return '7 days';
      case _MeetingDateFilter.month:
        return '30 days';
      case _MeetingDateFilter.custom:
        if (_customDateRange == null) return 'Custom';
        final fmt = DateFormat('MMM d');
        return '${fmt.format(_customDateRange!.start)} – ${fmt.format(_customDateRange!.end)}';
      case _MeetingDateFilter.all:
        return 'All dates';
    }
  }

  Widget _buildSearchAndFilters() {
    final theme = Theme.of(context);
    final statusOptions = <(String?, String)>[
      (null, 'All'),
      ('ready', 'Ready'),
      ('recording', 'Recording'),
      ('processing', 'Processing'),
      ('failed', 'Failed'),
      ('draft', 'Draft'),
    ];
    final dateOptions = <(_MeetingDateFilter, String)>[
      (_MeetingDateFilter.all, 'All dates'),
      (_MeetingDateFilter.today, 'Today'),
      (_MeetingDateFilter.week, '7 days'),
      (_MeetingDateFilter.month, '30 days'),
      (_MeetingDateFilter.custom, 'Custom'),
    ];

    Widget buildChipRow(List<Widget> chips) {
      return SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: chips,
        ),
      );
    }

    return Material(
      color: theme.colorScheme.surface,
      elevation: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: ValueListenableBuilder<TextEditingValue>(
              valueListenable: _searchController,
              builder: (context, value, _) {
                return SearchBar(
                  controller: _searchController,
                  hintText: 'Search by title, status, source…',
                  leading: const Icon(Icons.search, size: 20),
                  trailing: value.text.isNotEmpty
                      ? [
                          IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              _searchQuery = '';
                              unawaited(_fetchMeetings(reset: true));
                            },
                          ),
                        ]
                      : null,
                  padding: const WidgetStatePropertyAll(
                    EdgeInsets.symmetric(horizontal: 12),
                  ),
                );
              },
            ),
          ),
          buildChipRow([
            ...statusOptions.map(
              (opt) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(opt.$2),
                  selected: _statusFilter == opt.$1,
                  onSelected: (_) => _setStatusFilter(opt.$1),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 4),
          buildChipRow([
            Padding(
              padding: const EdgeInsets.only(right: 8, top: 8, bottom: 8),
              child: Text(
                'Date',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.outline,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ...dateOptions.map(
              (opt) {
                final isCustom = opt.$1 == _MeetingDateFilter.custom;
                final selected = _dateFilter == opt.$1;
                final label = isCustom && selected && _customDateRange != null
                    ? _dateFilterLabel()
                    : opt.$2;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(label),
                    selected: selected,
                    onSelected: (_) => _setDateFilter(opt.$1),
                  ),
                );
              },
            ),
          ]),
          if (_hasActiveFilters)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _clearFilters,
                  icon: const Icon(Icons.filter_alt_off_outlined, size: 18),
                  label: const Text('Clear filters'),
                ),
              ),
            ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: (_refreshing || _loadingMore)
                ? LinearProgressIndicator(
                    key: const ValueKey('progress'),
                    minHeight: 2,
                    backgroundColor:
                        theme.colorScheme.surfaceContainerHighest,
                  )
                : const SizedBox(key: ValueKey('spacer'), height: 2),
          ),
        ],
      ),
    );
  }

  Widget _buildMeetingsList(List<MeetingModel> meetings, AppLocalizations l10n) {
    final theme = Theme.of(context);
    if (meetings.isEmpty && !_refreshing) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(
                _total == 0 &&
                        _searchQuery.isEmpty &&
                        _statusFilter == null &&
                        _dateFilter == _MeetingDateFilter.all
                    ? l10n.commonNoMeetingsYet
                    : 'No meetings match your filters',
                style: const TextStyle(fontWeight: FontWeight.w500),
                textAlign: TextAlign.center,
              ),
              if (_total == 0 &&
                  _searchQuery.isEmpty &&
                  _statusFilter == null &&
                  _dateFilter == _MeetingDateFilter.all) ...[
                const SizedBox(height: 8),
                Text(
                  l10n.commonRecordOrImportMeetingTranscripts,
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 13,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _openRecordScreen,
                  icon: const Icon(Icons.mic),
                  label: const Text('Record'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      key: const ValueKey('meetings-list'),
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      itemCount: meetings.length + (_hasMore || _loadingMore ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) {
        if (i >= meetings.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        final meeting = meetings[i];
        final color = meetingStatusColor(meeting.status);
        final deleting = _deletingId == meeting.id;
        return AnimatedOpacity(
          opacity: deleting ? 0.45 : 1,
          duration: const Duration(milliseconds: 150),
          child: Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(
                  meeting.hasRecording ? Icons.description : Icons.mic,
                  color: color,
                  size: 20,
                ),
              ),
              title: Text(
                meeting.title,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${(meeting.source ?? 'manual').replaceAll('_', ' ')} · ${_statusLabel(meeting.status)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  if (meeting.createdAt.isNotEmpty)
                    Text(
                      DateFormat('MMM d, yyyy · HH:mm').format(
                        DateTime.parse(meeting.createdAt).toLocal(),
                      ),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade600,
                      ),
                    ),
                ],
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: deleting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            Icons.delete_outline,
                            size: 20,
                            color: theme.colorScheme.error,
                          ),
                    tooltip: 'Delete',
                    onPressed: deleting ? null : () => _deleteMeeting(meeting),
                  ),
                  const Icon(Icons.chevron_right, size: 18),
                ],
              ),
              onTap: deleting
                  ? null
                  : () => context.push('/lawyer/meetings/${meeting.id}'),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final showSoftOverlay = _refreshing;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.clientsStatsMeetings),
            if (_hasLoadedOnce && _total > 0)
              Text(
                '$_total meeting${_total == 1 ? '' : 's'}',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
          ],
        ),
        actions: [
          if (_uploading)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.upload_file_outlined),
              tooltip: 'Upload recording',
              onPressed: _uploadRecording,
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshing ? null : () => _fetchMeetings(reset: true),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_hasLoadedOnce) _buildSearchAndFilters(),
          Expanded(
            child: !_hasLoadedOnce && _initialLoading
                ? const MeetingsListSkeleton()
                : _error != null && _meetings.isEmpty
                    ? AppErrorView(
                        message: _error!,
                        onRetry: () => _fetchMeetings(initial: true, reset: true),
                      )
                    : AnimatedOpacity(
                        opacity: showSoftOverlay ? 0.72 : 1,
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOut,
                        child: _buildMeetingsList(_meetings, l10n),
                      ),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.extended(
            heroTag: 'record',
            onPressed: _openRecordScreen,
            icon: const Icon(Icons.mic),
            label: const Text('Record'),
            backgroundColor: theme.colorScheme.error,
            foregroundColor: Colors.white,
          ),
          const SizedBox(height: 10),
          FloatingActionButton.small(
            heroTag: 'create',
            onPressed: _showNewMeetingDialog,
            child: const Icon(Icons.add),
          ),
        ],
      ),
    );
  }
}
