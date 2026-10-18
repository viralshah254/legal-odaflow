import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/meetings_api.dart';

String normalizeMeetingStatus(String status) => status.toLowerCase();

Color meetingStatusColor(String status) {
  switch (normalizeMeetingStatus(status)) {
    case 'ready':
      return Colors.green;
    case 'processing':
      return Colors.orange;
    case 'recording':
      return Colors.red;
    case 'failed':
      return Colors.red.shade800;
    default:
      return Colors.blueGrey;
  }
}

String resolveMeetingRecordingUrl({
  required String meetingId,
  required MeetingRecordingAccess access,
}) {
  // Route through the API so WebM recordings are transcoded to M4A for iOS playback.
  final params = Uri(queryParameters: {
    'recording_token': access.recordingToken,
  });
  return '${AppConfig.apiBaseUrl}/meetings/$meetingId/audio${params.toString()}';
}
