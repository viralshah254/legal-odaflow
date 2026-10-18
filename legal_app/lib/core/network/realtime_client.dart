import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../storage/token_storage.dart';

typedef RealtimeEventHandler = void Function(Map<String, dynamic> payload);

/// Tenant-scoped Socket.IO client for backend realtime events.
class RealtimeClient {
  RealtimeClient({
    required TokenStorage tokenStorage,
    required this.tenantId,
  }) : _tokenStorage = tokenStorage;

  final TokenStorage _tokenStorage;
  final String tenantId;

  io.Socket? _socket;
  var _disposed = false;

  static const meetingStatusUpdated = 'meeting.status.updated';

  Future<void> connect() async {
    if (_disposed) return;
    if (_socket?.connected == true) return;

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

    final completer = Completer<void>();

    socket.on('connected', (_) {
      if (!completer.isCompleted) completer.complete();
    });

    socket.onConnectError((_) {
      if (!completer.isCompleted) {
        completer.completeError(
          StateError('Could not connect to realtime service'),
        );
      }
    });

    if (!socket.connected) {
      socket.connect();
    }

    await completer.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () {
        throw StateError('Could not connect to realtime service');
      },
    );
  }

  void on(String event, RealtimeEventHandler handler) {
    if (_disposed) return;
    final socket = _socket;
    if (socket == null) return;

    socket.on(event, (dynamic data) {
      if (data is! Map) return;
      handler(Map<String, dynamic>.from(data));
    });
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _socket?.dispose();
    _socket = null;
  }
}
