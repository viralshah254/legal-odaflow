import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../../core/network/meeting_streaming_transcription.dart';
import '../../../core/network/meetings_api.dart';
import '../../../core/permissions/microphone_permission.dart';
import '../../../core/providers/app_providers.dart';
import 'meeting_recording_session_cache.dart';
import 'meetings_utils.dart';
import 'pcm_wav_writer.dart';

// ---------------------------------------------------------------------------
// Route args
// ---------------------------------------------------------------------------
class RecordMeetingArgs {
  final String? clientId;
  final String? clientName;
  final String? matterId;
  /// Resume a locally cached in-progress recording for this meeting.
  final String? resumeMeetingId;

  const RecordMeetingArgs({
    this.clientId,
    this.clientName,
    this.matterId,
    this.resumeMeetingId,
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
class RecordMeetingScreen extends ConsumerStatefulWidget {
  final RecordMeetingArgs args;
  const RecordMeetingScreen({super.key, this.args = const RecordMeetingArgs()});

  @override
  ConsumerState<RecordMeetingScreen> createState() => _RecordMeetingScreenState();
}

class _RecordMeetingScreenState extends ConsumerState<RecordMeetingScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  static const _pcmFrameBytes = 8000; // ~250ms @ 16 kHz mono linear16

  static const _streamConfig = RecordConfig(
    encoder: AudioEncoder.pcm16bits,
    sampleRate: 16000,
    numChannels: 1,
    bitRate: 256000,
    streamBufferSize: 4096,
    iosConfig: IosRecordConfig(
      categoryOptions: [
        IosAudioCategoryOption.defaultToSpeaker,
        IosAudioCategoryOption.allowBluetooth,
      ],
    ),
  );

  // ── State machine ──────────────────────────────────────────────────────────
  _Phase _phase = _Phase.requesting;
  String? _error;
  var _micPermanentlyDenied = false;
  var _liveCaptionsEnabled = false;
  var _captionsActive = false;
  String? _captionsHint;

  // ── Recording ─────────────────────────────────────────────────────────────
  final _recorder = AudioRecorder();
  bool _isPaused = false;
  String? _recordingPath;
  Duration _elapsed = Duration.zero;
  Timer? _timer;
  Timer? _progressTimer;
  Timer? _persistTimer;
  StreamSubscription<Uint8List>? _pcmSubscription;
  var _isResuming = false;
  PcmWavWriter? _wavWriter;
  final _pcmSendBuffer = BytesBuilder(copy: false);

  // ── Live transcription (Deepgram via Socket.IO, same as web) ────────────────
  MeetingStreamingTranscriptionClient? _streamingClient;
  String _finalTranscript = '';
  String _interimWords = '';
  final _captionsController = ScrollController();

  // ── Meeting ───────────────────────────────────────────────────────────────
  MeetingModel? _meeting;

  // ── Animations ────────────────────────────────────────────────────────────
  late final AnimationController _pulseCtrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  // ── Waveform history ──────────────────────────────────────────────────────
  final _wave = <double>[];
  static const _waveLen = 40;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final resumeId = widget.args.resumeMeetingId;
    if (resumeId != null && resumeId.isNotEmpty) {
      unawaited(_resumeFromMeetingId(resumeId));
    } else {
      _requestPermissions();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cancelTimers();
    _pulseCtrl.dispose();
    if (_phase == _Phase.recording) {
      unawaited(_persistSession());
      unawaited(_teardownRecordingResources());
    } else {
      unawaited(_teardownRecordingResources());
    }
    _captionsController.dispose();
    super.dispose();
  }

  void _cancelTimers() {
    _timer?.cancel();
    _timer = null;
    _progressTimer?.cancel();
    _progressTimer = null;
    _persistTimer?.cancel();
    _persistTimer = null;
  }

  void _startPulse() {
    if (!_pulseCtrl.isAnimating) {
      _pulseCtrl.repeat(reverse: true);
    }
  }

  void _stopPulse() {
    if (_pulseCtrl.isAnimating) {
      _pulseCtrl.stop();
    }
  }

  Future<void> _teardownRecordingResources() async {
    _cancelTimers();
    _stopPulse();
    await _pcmSubscription?.cancel();
    _pcmSubscription = null;
    await _stopStreaming();
    await _stopRecorder();
    if (_wavWriter != null) {
      try {
        await _wavWriter!.finalize();
      } catch (_) {}
      _wavWriter = null;
    }
  }

  Future<void> _stopStreaming() async {
    final client = _streamingClient;
    _streamingClient = null;
    if (client != null) {
      await client.stopSession();
      await client.dispose();
    }
    if (mounted) setState(() => _captionsActive = false);
  }

  Future<void> _stopRecorder() async {
    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}
  }

  Future<void> _persistSession() async {
    final meeting = _meeting;
    final path = _recordingPath;
    if (meeting == null || path == null || _phase != _Phase.recording) return;

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null) return;

    await MeetingRecordingSessionCache.save(
      PendingMeetingRecording(
        meetingId: meeting.id,
        tenantId: tenantId,
        recordingPath: path,
        elapsedMs: _elapsed.inMilliseconds,
        draftTranscript: _finalTranscript.trim(),
        clientId: widget.args.clientId,
        matterId: widget.args.matterId,
        updatedAt: DateTime.now().toIso8601String(),
      ),
    );
  }

  Future<void> _suspendRecording({bool popScreen = false}) async {
    await _persistSession();
    await _teardownRecordingResources();
    if (popScreen && mounted) {
      Navigator.pop(context, _meeting?.id);
    }
  }

  // ── Permission gate ───────────────────────────────────────────────────────
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_phase == _Phase.recording && state == AppLifecycleState.paused) {
      unawaited(_suspendRecording(popScreen: true));
      return;
    }
    if (state != AppLifecycleState.resumed) return;
    if (_phase == _Phase.denied || _phase == _Phase.requesting) {
      _retryMicrophoneAfterSettings();
    }
  }

  Future<void> _retryMicrophoneAfterSettings() async {
    if (!await MicrophonePermission.isGranted) return;
    if (!mounted) return;
    setState(() {
      _phase = _Phase.requesting;
      _micPermanentlyDenied = false;
    });
    if (_isResuming && widget.args.resumeMeetingId != null) {
      await _resumeFromMeetingId(widget.args.resumeMeetingId!);
    } else {
      await _createMeeting();
    }
  }

  Future<void> _resumeFromMeetingId(String meetingId) async {
    if (mounted) setState(() => _phase = _Phase.requesting);

    final session = await MeetingRecordingSessionCache.loadForMeeting(meetingId);
    if (session == null) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not find a saved recording on this device.';
        _phase = _Phase.error;
      });
      return;
    }

    final access = await MicrophonePermission.request(recorder: _recorder);
    if (!mounted) return;

    switch (access) {
      case MicrophoneAccessStatus.granted:
        break;
      case MicrophoneAccessStatus.permanentlyDenied:
        setState(() {
          _micPermanentlyDenied = true;
          _phase = _Phase.denied;
        });
        return;
      case MicrophoneAccessStatus.denied:
        setState(() => _phase = _Phase.denied);
        return;
    }

    try {
      final meeting = await ref.read(meetingsApiProvider).getMeeting(
            tenantId: session.tenantId,
            meetingId: meetingId,
          );
      if (normalizeMeetingStatus(meeting.status) != 'recording') {
        await MeetingRecordingSessionCache.clearAndDeleteFile();
        if (!mounted) return;
        setState(() {
          _error = 'This meeting is no longer recording.';
          _phase = _Phase.error;
        });
        return;
      }

      if (!mounted) return;
      setState(() {
        _meeting = meeting;
        _phase = _Phase.connectingCaptions;
        _isResuming = true;
      });
      await _startRecording(
        tenantId: session.tenantId,
        meetingId: meetingId,
        resumeSession: session,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not resume recording: $e';
        _phase = _Phase.error;
      });
    }
  }

  Future<void> _requestPermissions() async {
    if (mounted) {
      setState(() {
        _phase = _Phase.requesting;
        _micPermanentlyDenied = false;
      });
    }

    final access = await MicrophonePermission.request(recorder: _recorder);
    if (!mounted) return;

    switch (access) {
      case MicrophoneAccessStatus.granted:
        await _createMeeting();
      case MicrophoneAccessStatus.permanentlyDenied:
        setState(() {
          _micPermanentlyDenied = true;
          _phase = _Phase.denied;
        });
      case MicrophoneAccessStatus.denied:
        setState(() => _phase = _Phase.denied);
    }
  }

  Future<void> _openMicrophoneSettings() async {
    await MicrophonePermission.openSettings();
  }

  // ── Create meeting on backend ─────────────────────────────────────────────
  Future<void> _createMeeting() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      if (mounted) {
        setState(() {
          _error = 'No active workspace. Please sign in again.';
          _phase = _Phase.error;
        });
      }
      return;
    }

    final now = DateTime.now();
    final dateStr =
        '${now.day} ${_monthName(now.month)} ${now.year}, ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final clientPart = widget.args.clientName != null ? ' — ${widget.args.clientName}' : '';
    final title = 'Meeting$clientPart — $dateStr';

    try {
      final api = ref.read(meetingsApiProvider);
      final meeting = await api.createMeeting(
        tenantId: tenantId,
        title: title,
        clientId: widget.args.clientId,
        matterId: widget.args.matterId,
        confidentiality: 'standard',
      );
      if (!mounted) return;
      setState(() {
        _meeting = meeting;
        _phase = _Phase.connectingCaptions;
      });
      await _startRecording(tenantId: tenantId, meetingId: meeting.id);
      await _persistSession();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not start meeting: $e';
          _phase = _Phase.error;
        });
      }
    }
  }

  Future<bool> _startLiveCaptions({
    required String tenantId,
    required String meetingId,
  }) async {
    final client = MeetingStreamingTranscriptionClient(
      tokenStorage: ref.read(tokenStorageProvider),
      tenantId: tenantId,
    );
    _streamingClient = client;

    client.onStarted = () {
      if (!mounted) return;
      setState(() {
        _liveCaptionsEnabled = true;
        _captionsActive = true;
        _captionsHint = null;
      });
    };

    client.onUnavailable = () {
      if (!mounted) return;
      setState(() {
        _liveCaptionsEnabled = false;
        _captionsActive = false;
        _captionsHint =
            'Live captions are unavailable right now. A full transcript will be generated after you stop.';
      });
    };

    client.onResult = ({
      required String text,
      required bool isFinal,
      required int startMs,
      required int endMs,
    }) {
      if (!mounted) return;
      setState(() {
        _captionsActive = true;
        if (isFinal) {
          if (_finalTranscript.isNotEmpty) _finalTranscript += ' ';
          _finalTranscript += text;
          _interimWords = '';
        } else {
          _interimWords = text;
        }
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_captionsController.hasClients) {
          _captionsController.animateTo(
            _captionsController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeOut,
          );
        }
      });
    };

    client.onError = (message) {
      if (!mounted) return;
      setState(() => _captionsHint = message);
    };

    try {
      await client.connect();
      final started = await client.startSession(meetingId);
      if (!mounted) return false;
      if (!started) {
        setState(() {
          _liveCaptionsEnabled = false;
          _captionsHint ??=
              'Live captions are unavailable right now. A full transcript will be generated after you stop.';
        });
        return false;
      }
      return true;
    } catch (_) {
      if (!mounted) return false;
      setState(() {
        _liveCaptionsEnabled = false;
        _captionsHint =
            'Could not connect for live captions. Check your network — recording continues and a full transcript will be generated after you stop.';
      });
      return false;
    }
  }

  void _forwardPcmToDeepgram(Uint8List chunk) {
    if (!_liveCaptionsEnabled || _isPaused) return;
    _pcmSendBuffer.add(chunk);
    final bytes = _pcmSendBuffer.toBytes();
    _pcmSendBuffer.clear();
    for (var offset = 0; offset < bytes.length; offset += _pcmFrameBytes) {
      final end = math.min(offset + _pcmFrameBytes, bytes.length);
      _streamingClient?.sendPcm(Uint8List.sublistView(bytes, offset, end));
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  Future<void> _startRecording({
    required String tenantId,
    required String meetingId,
    PendingMeetingRecording? resumeSession,
  }) async {
    _cancelTimers();
    _liveCaptionsEnabled = false;
    _captionsActive = false;
    _captionsHint = null;
    _pcmSendBuffer.clear();

    if (resumeSession != null) {
      _recordingPath = resumeSession.recordingPath;
      _elapsed = Duration(milliseconds: resumeSession.elapsedMs);
      _finalTranscript = resumeSession.draftTranscript;
      _interimWords = '';
      _wavWriter = await PcmWavWriter.openForAppend(resumeSession.recordingPath);
    } else {
      _finalTranscript = '';
      _interimWords = '';
      _elapsed = Duration.zero;
      final dir = await getTemporaryDirectory();
      _recordingPath =
          '${dir.path}/recording_${DateTime.now().millisecondsSinceEpoch}.wav';
      _wavWriter = await PcmWavWriter.create(_recordingPath!);
    }

    if (!mounted) return;
    await _startLiveCaptions(tenantId: tenantId, meetingId: meetingId);

    if (!mounted) return;

    final pcmStream = await _recorder.startStream(_streamConfig);
    _pcmSubscription = pcmStream.listen(
      (chunk) {
        unawaited(_wavWriter?.writePcm(chunk));
        _forwardPcmToDeepgram(chunk);
      },
      onError: (_) {},
    );

    _startPulse();
    _timer = Timer.periodic(const Duration(milliseconds: 200), (timer) async {
      if (!mounted || _isPaused) return;
      setState(() => _elapsed += const Duration(milliseconds: 200));

      try {
        final amp = await _recorder.getAmplitude();
        if (!mounted || _isPaused) return;
        final norm = ((amp.current + 60) / 60).clamp(0.0, 1.0);
        setState(() {
          _wave.add(norm);
          if (_wave.length > _waveLen) _wave.removeAt(0);
        });
      } catch (_) {}
    });

    _progressTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) _syncRecordingProgress();
    });

    _persistTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(_persistSession());
    });

    if (mounted) setState(() => _phase = _Phase.recording);
  }

  Future<void> _syncRecordingProgress() async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    final meeting = _meeting;
    if (tenantId == null || meeting == null || _isPaused) return;
    try {
      await ref.read(meetingsApiProvider).syncRecordingProgress(
            tenantId: tenantId,
            meetingId: meeting.id,
            durationMs: _elapsed.inMilliseconds,
          );
    } catch (_) {}
  }

  Future<void> _togglePause() async {
    if (_isPaused) {
      await _recorder.resume();
      _startPulse();
      if (mounted) setState(() => _isPaused = false);
    } else {
      await _recorder.pause();
      _stopPulse();
      if (mounted) setState(() => _isPaused = true);
      await _persistSession();
    }
  }

  // ── Stop & upload ─────────────────────────────────────────────────────────
  Future<void> _stopAndSave() async {
    await _teardownRecordingResources();
    if (mounted) setState(() => _phase = _Phase.uploading);

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    final meeting = _meeting;
    if (tenantId == null || meeting == null || _recordingPath == null) {
      if (mounted) Navigator.pop(context);
      return;
    }

    try {
      final api = ref.read(meetingsApiProvider);
      await api.uploadAudio(
        tenantId: tenantId,
        meetingId: meeting.id,
        filePath: _recordingPath!,
        mimeType: 'audio/wav',
        durationMs: _elapsed.inMilliseconds,
        draftTranscript: _finalTranscript.trim().isEmpty
            ? null
            : _finalTranscript.trim(),
      );

      await MeetingRecordingSessionCache.clear();
      try {
        await File(_recordingPath!).delete();
      } catch (_) {}

      if (mounted) {
        Navigator.pop(context, meeting.id);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Upload failed: $e';
          _phase = _Phase.error;
        });
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  String _formatElapsed(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  String _monthName(int m) => const [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ][m];

  Color get _errorColor => Theme.of(context).colorScheme.error;

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: Text(
          _meeting?.title ?? 'New Recording',
          overflow: TextOverflow.ellipsis,
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _phase == _Phase.uploading
              ? null
              : () async {
                  final nav = Navigator.of(context);
                  if (_phase == _Phase.recording) {
                    final ok = await _confirmDiscard(context);
                    if (ok != true) return;
                    await _teardownRecordingResources();
                    await MeetingRecordingSessionCache.clearAndDeleteFile();
                    final tenantId =
                        ref.read(authControllerProvider).session?.user.tenantId;
                    if (tenantId != null && _meeting != null) {
                      try {
                        await ref.read(meetingsApiProvider).updateMeetingStatus(
                              tenantId: tenantId,
                              meetingId: _meeting!.id,
                              status: 'failed',
                            );
                      } catch (_) {}
                    }
                  }
                  if (mounted) nav.pop();
                },
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    return switch (_phase) {
      _Phase.requesting => _buildLoading('Setting up microphone…'),
      _Phase.connectingCaptions => _buildLoading('Connecting live captions…'),
      _Phase.denied => _buildMicDenied(),
      _Phase.error => _buildError(),
      _Phase.recording => _buildRecording(),
      _Phase.uploading => _buildLoading('Uploading and processing…'),
    };
  }

  Widget _buildLoading(String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }

  Widget _buildMicDenied() {
    final permanentlyDenied = _micPermanentlyDenied;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.mic_off, size: 64, color: _errorColor),
            const SizedBox(height: 16),
            Text(
              permanentlyDenied
                  ? 'Microphone access is turned off'
                  : 'Microphone access required',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              permanentlyDenied
                  ? MicrophonePermission.settingsHint()
                  : 'Allow microphone access when prompted so Umbrella can record your meeting and show live captions.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (!permanentlyDenied)
              FilledButton(
                onPressed: _requestPermissions,
                child: const Text('Allow microphone'),
              ),
            if (!permanentlyDenied) const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _openMicrophoneSettings,
              child: const Text('Open Settings'),
            ),
          ],
        ),
      ),
    );
  }

  String _captionsStatusLabel() {
    if (_captionsActive && _liveCaptionsEnabled) return 'Live captions';
    if (_liveCaptionsEnabled) return 'Starting live captions…';
    if (_captionsHint != null) return 'Live captions paused';
    return 'Live captions unavailable';
  }

  String _captionsPlaceholder() {
    if (_captionsHint != null) return _captionsHint!;
    if (_captionsActive || _liveCaptionsEnabled) {
      return 'Start speaking — captions will appear here';
    }
    if (!_liveCaptionsEnabled) {
      return 'Connecting live captions… A full transcript will still be generated after you stop.';
    }
    return 'Starting live captions…';
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 64, color: _errorColor),
            const SizedBox(height: 16),
            Text(_error ?? 'An error occurred', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Go back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecording() {
    final hasTranscript = _finalTranscript.isNotEmpty || _interimWords.isNotEmpty;
    return SafeArea(
      child: Column(
        children: [
          const SizedBox(height: 24),

          AnimatedBuilder(
            animation: _pulseCtrl,
            builder: (_, __) => Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isPaused
                    ? Colors.amber
                    : Color.lerp(
                        Colors.red.shade700,
                        Colors.red.shade400,
                        _pulseCtrl.value,
                      ),
                boxShadow: _isPaused
                    ? null
                    : [
                        BoxShadow(
                          color: Colors.red.withValues(
                              alpha: 0.3 + 0.2 * _pulseCtrl.value),
                          blurRadius: 8 + 6 * _pulseCtrl.value,
                          spreadRadius: 2,
                        ),
                      ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          Text(
            _formatElapsed(_elapsed),
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                  fontWeight: FontWeight.w300,
                ),
          ),

          Text(
            _isPaused ? 'Paused' : 'Recording',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: _isPaused
                      ? Colors.amber
                      : Theme.of(context).colorScheme.error,
                  letterSpacing: 1.2,
                ),
          ),

          const SizedBox(height: 32),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: SizedBox(
              height: 64,
              child: _WaveformPainter(bars: _wave, paused: _isPaused),
            ),
          ),

          const SizedBox(height: 32),

          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.closed_caption_outlined,
                        size: 14,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _captionsStatusLabel(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
                              letterSpacing: 0.8,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: hasTranscript
                          ? SingleChildScrollView(
                              controller: _captionsController,
                              child: RichText(
                                text: TextSpan(
                                  style: Theme.of(context).textTheme.bodyMedium,
                                  children: [
                                    TextSpan(text: _finalTranscript),
                                    if (_interimWords.isNotEmpty)
                                      TextSpan(
                                        text: _interimWords,
                                        style: TextStyle(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withValues(alpha: 0.45),
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                _captionsPlaceholder(),
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color:
                                          Theme.of(context).colorScheme.outline,
                                    ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _togglePause,
                    icon: Icon(_isPaused ? Icons.play_arrow : Icons.pause),
                    label: Text(_isPaused ? 'Resume' : 'Pause'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _stopAndSave,
                    icon: const Icon(Icons.stop_circle_outlined),
                    label: const Text('Stop & Save'),
                    style: FilledButton.styleFrom(
                      backgroundColor: _errorColor,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Future<bool?> _confirmDiscard(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard recording?'),
        content: const Text(
          'The current recording will be lost and not saved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep recording'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
  }
}

enum _Phase {
  requesting,
  connectingCaptions,
  denied,
  error,
  recording,
  uploading,
}

class _WaveformPainter extends StatelessWidget {
  final List<double> bars;
  final bool paused;
  const _WaveformPainter({required this.bars, required this.paused});

  @override
  Widget build(BuildContext context) {
    final color = paused
        ? Theme.of(context).colorScheme.outline
        : Theme.of(context).colorScheme.primary;
    return CustomPaint(
      size: Size.infinite,
      painter: _WavePainter(bars: bars, color: color),
    );
  }
}

class _WavePainter extends CustomPainter {
  final List<double> bars;
  final Color color;
  _WavePainter({required this.bars, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;

    final n = bars.isEmpty ? 40 : bars.length;
    final spacing = size.width / n;
    final midY = size.height / 2;

    for (var i = 0; i < n; i++) {
      final amplitude = bars.length > i ? bars[i] : 0.05;
      final x = spacing * i + spacing / 2;
      final h = math.max(4.0, amplitude * size.height * 0.9);
      canvas.drawLine(
        Offset(x, midY - h / 2),
        Offset(x, midY + h / 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) =>
      old.bars != bars || old.color != color;
}
