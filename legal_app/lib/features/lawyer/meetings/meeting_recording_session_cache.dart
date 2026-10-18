import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

/// Locally cached in-progress meeting recording (survives app restart).
class PendingMeetingRecording {
  const PendingMeetingRecording({
    required this.meetingId,
    required this.tenantId,
    required this.recordingPath,
    required this.elapsedMs,
    required this.draftTranscript,
    this.clientId,
    this.matterId,
    required this.updatedAt,
  });

  final String meetingId;
  final String tenantId;
  final String recordingPath;
  final int elapsedMs;
  final String draftTranscript;
  final String? clientId;
  final String? matterId;
  final String updatedAt;

  Map<String, dynamic> toJson() => {
        'meetingId': meetingId,
        'tenantId': tenantId,
        'recordingPath': recordingPath,
        'elapsedMs': elapsedMs,
        'draftTranscript': draftTranscript,
        if (clientId != null) 'clientId': clientId,
        if (matterId != null) 'matterId': matterId,
        'updatedAt': updatedAt,
      };

  factory PendingMeetingRecording.fromJson(Map<String, dynamic> json) =>
      PendingMeetingRecording(
        meetingId: json['meetingId'] as String,
        tenantId: json['tenantId'] as String,
        recordingPath: json['recordingPath'] as String,
        elapsedMs: (json['elapsedMs'] as num?)?.toInt() ?? 0,
        draftTranscript: json['draftTranscript'] as String? ?? '',
        clientId: json['clientId'] as String?,
        matterId: json['matterId'] as String?,
        updatedAt: json['updatedAt'] as String? ?? '',
      );

  bool get recordingFileExists {
    try {
      return File(recordingPath).existsSync();
    } catch (_) {
      return false;
    }
  }
}

/// Persists one active mobile recording session at a time.
class MeetingRecordingSessionCache {
  MeetingRecordingSessionCache._();

  static const _storageKey = 'pending_meeting_recording_v1';

  static Future<PendingMeetingRecording?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final session = PendingMeetingRecording.fromJson(
        jsonDecode(raw) as Map<String, dynamic>,
      );
      if (!session.recordingFileExists) {
        await clear();
        return null;
      }
      return session;
    } catch (_) {
      await clear();
      return null;
    }
  }

  static Future<PendingMeetingRecording?> loadForMeeting(String meetingId) async {
    final session = await load();
    if (session == null || session.meetingId != meetingId) return null;
    return session;
  }

  static Future<bool> hasResumable(String meetingId) async {
    final session = await loadForMeeting(meetingId);
    return session != null;
  }

  static Future<void> save(PendingMeetingRecording session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(session.toJson()));
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }

  static Future<void> clearAndDeleteFile() async {
    final session = await load();
    if (session != null) {
      try {
        final file = File(session.recordingPath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
    await clear();
  }
}
