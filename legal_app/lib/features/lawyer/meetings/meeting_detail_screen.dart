import 'dart:async';

import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/meetings_api.dart';
import '../../../core/network/realtime_client.dart';
import '../../../core/providers/app_providers.dart';
import 'meeting_audio_player.dart';
import 'meeting_recording_session_cache.dart';
import 'meetings_list_widgets.dart';
import 'meetings_utils.dart';
import 'record_meeting_screen.dart';

class MeetingDetailScreen extends ConsumerStatefulWidget {
  const MeetingDetailScreen({super.key, required this.meetingId});

  final String meetingId;

  @override
  ConsumerState<MeetingDetailScreen> createState() =>
      _MeetingDetailScreenState();
}

class _MeetingDetailScreenState extends ConsumerState<MeetingDetailScreen>
    with SingleTickerProviderStateMixin {
  MeetingModel? _meeting;
  MeetingTranscriptModel? _transcript;
  List<MeetingNoteModel> _notes = [];
  String? _recordingUrl;
  bool _loading = true;
  String? _error;
  bool _retrying = false;
  bool _regenerating = false;
  bool _canContinueRecording = false;
  bool _discarding = false;
  bool _deleting = false;
  Timer? _pollTimer;
  RealtimeClient? _realtime;
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
    unawaited(_connectRealtime());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _realtime?.dispose();
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _connectRealtime() async {
    final tenantId = _tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    final client = RealtimeClient(
      tokenStorage: ref.read(tokenStorageProvider),
      tenantId: tenantId,
    );
    _realtime = client;

    try {
      await client.connect();
      client.on(RealtimeClient.meetingStatusUpdated, (payload) {
        final entityId = payload['entityId'] as String?;
        final data = payload['data'];
        final eventMeetingId =
            data is Map ? data['meetingId'] as String? : null;
        if (entityId == widget.meetingId ||
            eventMeetingId == widget.meetingId) {
          unawaited(_load(silent: true));
        }
      });
    } catch (_) {
      // Polling remains the fallback when realtime is unavailable.
    }
  }

  String? get _tenantId =>
      ref.read(authControllerProvider).session?.user.tenantId;

  Future<void> _load({bool silent = false}) async {
    final tenantId = _tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final api = ref.read(meetingsApiProvider);
      final meeting = await api.getMeeting(
        tenantId: tenantId,
        meetingId: widget.meetingId,
      );
      MeetingTranscriptModel? transcript;
      List<MeetingNoteModel> notes = [];
      String? recordingUrl;

      if (meeting.hasRecording &&
          normalizeMeetingStatus(meeting.status) == 'ready') {
        try {
          final access = await api.getRecordingAccess(
            tenantId: tenantId,
            meetingId: widget.meetingId,
          );
          recordingUrl = resolveMeetingRecordingUrl(
            meetingId: widget.meetingId,
            access: access,
          );
        } catch (_) {}
      }

      if (normalizeMeetingStatus(meeting.status) != 'recording') {
        transcript = await api.getTranscript(
          tenantId: tenantId,
          meetingId: widget.meetingId,
        );
        notes = await api.getNotes(
          tenantId: tenantId,
          meetingId: widget.meetingId,
        );
      }

      if (!mounted) return;
      final canContinue = normalizeMeetingStatus(meeting.status) == 'recording' &&
          await MeetingRecordingSessionCache.hasResumable(widget.meetingId);
      setState(() {
        _meeting = meeting;
        _transcript = transcript;
        _notes = notes;
        _recordingUrl = recordingUrl;
        _canContinueRecording = canContinue;
        _loading = false;
      });
      _configurePolling(meeting.status);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : e.toString();
        _loading = false;
      });
    }
  }

  void _configurePolling(String status) {
    _pollTimer?.cancel();
    final normalized = normalizeMeetingStatus(status);
    if (normalized == 'processing' || normalized == 'recording') {
      unawaited(_load(silent: true));
      _pollTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
        _load(silent: true);
      });
    }
  }

  String _processingStatusLabel() {
    final transcript = _transcript?.rawText?.trim();
    if (transcript != null && transcript.isNotEmpty) {
      return 'Generating AI notes…';
    }
    return 'Transcribing and generating notes…';
  }

  Future<void> _continueRecording() async {
    final meetingId = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => RecordMeetingScreen(
          args: RecordMeetingArgs(resumeMeetingId: widget.meetingId),
        ),
      ),
    );
    if (!mounted) return;
    await _load(silent: meetingId == null);
    if (meetingId != null && mounted) {
      setState(() => _canContinueRecording = false);
    }
  }

  Future<void> _discardInterruptedRecording() async {
    final tenantId = _tenantId;
    if (tenantId == null || _discarding) return;
    setState(() => _discarding = true);
    try {
      await MeetingRecordingSessionCache.clearAndDeleteFile();
      await ref.read(meetingsApiProvider).updateMeetingStatus(
            tenantId: tenantId,
            meetingId: widget.meetingId,
            status: 'failed',
          );
      await _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Could not discard'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _discarding = false);
    }
  }

  Future<void> _retryProcessing() async {
    final tenantId = _tenantId;
    if (tenantId == null) return;
    setState(() => _retrying = true);
    try {
      await ref.read(meetingsApiProvider).retryProcessing(
            tenantId: tenantId,
            meetingId: widget.meetingId,
          );
      await _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Retry failed'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  Future<void> _regenerateNotes() async {
    final tenantId = _tenantId;
    if (tenantId == null) return;
    setState(() => _regenerating = true);
    try {
      await ref.read(meetingsApiProvider).regenerateNotes(
            tenantId: tenantId,
            meetingId: widget.meetingId,
          );
      await _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Could not regenerate'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _regenerating = false);
    }
  }

  Future<void> _deleteMeeting() async {
    final tenantId = _tenantId;
    if (tenantId == null || _deleting) return;

    final confirmed = await confirmDeleteMeeting(context);
    if (confirmed != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      final cached =
          await MeetingRecordingSessionCache.loadForMeeting(widget.meetingId);
      if (cached != null) {
        await MeetingRecordingSessionCache.clearAndDeleteFile();
      }
      await ref.read(meetingsApiProvider).deleteMeeting(
            tenantId: tenantId,
            meetingId: widget.meetingId,
          );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Delete failed'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  String _durationText(int? durationMs) {
    if (durationMs == null || durationMs <= 0) return '';
    final totalSec = durationMs ~/ 1000;
    final m = totalSec ~/ 60;
    final s = totalSec % 60;
    return m > 0 ? '${m}m ${s}s' : '${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(_meeting?.title ?? l10n.clientsStatsMeetings),
        actions: [
          if (_meeting != null)
            IconButton(
              icon: _deleting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.delete_outline),
              tooltip: 'Delete meeting',
              onPressed: _deleting ? null : _deleteMeeting,
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(),
          ),
        ],
        bottom: _meeting == null
            ? null
            : TabBar(
                controller: _tabs,
                tabs: const [
                  Tab(text: 'Overview'),
                  Tab(text: 'Transcript'),
                  Tab(text: 'Notes'),
                ],
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, textAlign: TextAlign.center))
              : _meeting == null
                  ? const SizedBox.shrink()
                  : TabBarView(
                      controller: _tabs,
                      children: [
                        _buildOverview(l10n),
                        _buildTranscript(l10n),
                        _buildNotes(l10n),
                      ],
                    ),
    );
  }

  Widget _buildOverview(AppLocalizations l10n) {
    final meeting = _meeting!;
    final status = normalizeMeetingStatus(meeting.status);
    final color = meetingStatusColor(meeting.status);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Wrap(
          spacing: 8,
          children: [
            Chip(
              label: Text(status.toUpperCase()),
              backgroundColor: color.withValues(alpha: 0.12),
              labelStyle: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
            if (meeting.source != null)
              Chip(label: Text(meeting.source!.replaceAll('_', ' '))),
          ],
        ),
        const SizedBox(height: 12),
        if (meeting.createdAt.isNotEmpty)
          Text(
            DateFormat('MMM d, yyyy · HH:mm')
                .format(DateTime.parse(meeting.createdAt)),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        if (meeting.durationMs != null && meeting.durationMs! > 0) ...[
          const SizedBox(height: 8),
          Text('Duration: ${_durationText(meeting.durationMs)}'),
        ],
        if (status == 'recording' && _canContinueRecording) ...[
          const SizedBox(height: 24),
          Card(
            color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.35),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.mic,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Recording in progress',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You have unsaved audio on this device. Continue where you left off, or discard this meeting.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _continueRecording,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Continue recording'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _discarding ? null : _discardInterruptedRecording,
                    child: Text(_discarding ? 'Discarding…' : 'Discard'),
                  ),
                ],
              ),
            ),
          ),
        ] else if (status == 'recording') ...[
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Recording not found on this device',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'The saved audio for this meeting is missing. Discard it or start a new recording.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _discarding ? null : _discardInterruptedRecording,
                    child: Text(_discarding ? 'Discarding…' : 'Discard'),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (meeting.matterTitle != null) ...[
          const SizedBox(height: 8),
          Text('Matter: ${meeting.matterTitle}'),
        ],
        if (status == 'processing') ...[
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _processingStatusLabel(),
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _retrying ? null : _retryProcessing,
                    child: Text(_retrying ? 'Retrying…' : 'Retry processing'),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (_recordingUrl != null) ...[
          const SizedBox(height: 24),
          Text('Recording', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: MeetingAudioPlayer(url: _recordingUrl!),
            ),
          ),
        ],
        if (status == 'failed') ...[
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _retrying ? null : _retryProcessing,
            child: Text(_retrying ? 'Retrying…' : 'Retry processing'),
          ),
        ],
      ],
    );
  }

  Widget _buildTranscript(AppLocalizations l10n) {
    final meeting = _meeting!;
    final status = normalizeMeetingStatus(meeting.status);

    if (status == 'processing') {
      final text = _transcript?.rawText;
      if (text == null || text.trim().isEmpty) {
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text('Transcript will appear when processing completes.'),
          ),
        );
      }
    }

    final text = _transcript?.rawText;
    if (text == null || text.trim().isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('No transcript yet.'),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: SelectableText(text),
    );
  }

  Widget _buildNotes(AppLocalizations l10n) {
    final meeting = _meeting!;
    final status = normalizeMeetingStatus(meeting.status);

    if (_notes.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                status == 'processing'
                    ? (_transcript?.rawText?.trim().isNotEmpty == true
                        ? 'AI notes will appear shortly.'
                        : 'Notes will appear when processing completes.')
                    : 'No AI notes yet.',
                textAlign: TextAlign.center,
              ),
              if (status == 'ready' && _transcript?.rawText != null) ...[
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _regenerating ? null : _regenerateNotes,
                  child: Text(_regenerating ? 'Generating…' : 'Generate notes'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _regenerating ? null : _regenerateNotes,
            icon: _regenerating
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.auto_awesome, size: 18),
            label: const Text('Regenerate'),
          ),
        ),
        ..._notes.map(
          (note) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: MarkdownBody(data: note.content),
            ),
          ),
        ),
      ],
    );
  }
}
