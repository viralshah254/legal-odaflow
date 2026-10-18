import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../storage/token_storage.dart';

typedef TranscriptResultHandler = void Function({
  required String text,
  required bool isFinal,
  required int startMs,
  required int endMs,
});

/// Deepgram live captions over Socket.IO — same protocol as the web recorder.
class MeetingStreamingTranscriptionClient {
  MeetingStreamingTranscriptionClient({
    required TokenStorage tokenStorage,
    required this.tenantId,
  }) : _tokenStorage = tokenStorage;

  final TokenStorage _tokenStorage;
  final String tenantId;

  io.Socket? _socket;
  String? _meetingId;
  var _active = false;
  var _disposed = false;

  TranscriptResultHandler? onResult;
  void Function(String message)? onError;
  void Function()? onStarted;
  void Function()? onUnavailable;

  bool get isActive => _active;

  Future<void> connect() async {
    if (_disposed) return;

    final token = await _tokenStorage.getAccessToken();
    if (token == null || token.isEmpty) {
      throw StateError('Not signed in');
    }

    final socket = io.io(
      '${AppConfig.realtimeSocketUrl}/realtime',
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableAutoConnect()
          .setAuth({'token': token, 'tenantId': tenantId})
          .build(),
    );
    _socket = socket;

    socket.on('meeting-transcribe:result', (dynamic data) {
      if (data is! Map) return;
      final text = data['text'] as String? ?? '';
      if (text.isEmpty) return;
      onResult?.call(
        text: text,
        isFinal: data['isFinal'] == true,
        startMs: (data['startMs'] as num?)?.toInt() ?? 0,
        endMs: (data['endMs'] as num?)?.toInt() ?? 0,
      );
    });

    socket.on('meeting-transcribe:error', (dynamic data) {
      final message = (data is Map ? data['message'] : null) as String? ??
          'Live captions paused. Audio is still recording.';
      onError?.call(message);
    });

    final completer = Completer<void>();

    socket.on('connected', (_) {
      if (!completer.isCompleted) completer.complete();
    });

    socket.on('error', (dynamic data) {
      final message = (data is Map ? data['message'] : null) as String? ??
          'Authentication failed';
      if (!completer.isCompleted) {
        completer.completeError(StateError(message));
      }
    });

    socket.onConnectError((_) {
      if (!completer.isCompleted) {
        completer.completeError(
          StateError('Could not connect to live captions service'),
        );
      }
    });

    if (!socket.connected) {
      socket.connect();
    }

    await completer.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () {
        throw StateError('Could not connect to live captions service');
      },
    );

    if (!socket.connected) {
      throw StateError('Could not connect to live captions service');
    }
  }

  Future<bool> startSession(String meetingId) async {
    if (_disposed) return false;
    final socket = _socket;
    if (socket == null || !socket.connected) return false;

    _meetingId = meetingId;
    final completer = Completer<bool>();

    void handleStarted(dynamic _) {
      _active = true;
      onStarted?.call();
      if (!completer.isCompleted) completer.complete(true);
    }

    void handleUnavailable(dynamic _) {
      _active = false;
      onUnavailable?.call();
      if (!completer.isCompleted) completer.complete(false);
    }

    socket.once('meeting-transcribe:started', handleStarted);
    socket.once('meeting-transcribe:unavailable', handleUnavailable);
    socket.emit('meeting-transcribe:start', {'meetingId': meetingId});

    return completer.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () {
        if (!completer.isCompleted) completer.complete(false);
        return false;
      },
    );
  }

  void sendPcm(Uint8List pcm) {
    if (!_active || _disposed) return;
    final socket = _socket;
    final meetingId = _meetingId;
    if (socket == null || meetingId == null) return;

    socket.emit('meeting-transcribe:audio', {
      'meetingId': meetingId,
      'chunk': base64Encode(pcm),
    });
  }

  Future<void> stopSession() async {
    if (_disposed) return;
    final socket = _socket;
    final meetingId = _meetingId;
    if (socket != null && meetingId != null && _active) {
      socket.emit('meeting-transcribe:stop', {'meetingId': meetingId});
    }
    _active = false;
    _meetingId = null;
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await stopSession();
    _socket?.dispose();
    _socket = null;
  }
}
