import 'dart:io';

import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

enum MicrophoneAccessStatus {
  granted,
  denied,
  permanentlyDenied,
}

enum SpeechRecognitionAccessStatus {
  granted,
  denied,
  permanentlyDenied,
  unavailable,
}

/// Microphone permission flow for meeting recordings (iOS + Android).
class MicrophonePermission {
  const MicrophonePermission._();

  static Future<bool> get isGranted async =>
      (await Permission.microphone.status).isGranted;

  /// Requests microphone access and returns the resolved status.
  ///
  /// Triggers the native system permission sheet when the OS allows it.
  /// Falls back to [AudioRecorder.hasPermission] on iOS, which uses
  /// AVAudioSession and can surface the dialog when permission_handler does not.
  static Future<MicrophoneAccessStatus> request({
    AudioRecorder? recorder,
  }) async {
    var status = await Permission.microphone.status;
    if (status.isGranted) {
      return MicrophoneAccessStatus.granted;
    }

    if (status.isPermanentlyDenied || status.isRestricted) {
      return MicrophoneAccessStatus.permanentlyDenied;
    }

    status = await Permission.microphone.request();
    if (status.isGranted) {
      return MicrophoneAccessStatus.granted;
    }

    if (recorder != null) {
      try {
        if (await recorder.hasPermission()) {
          return MicrophoneAccessStatus.granted;
        }
      } catch (_) {}
    }

    status = await Permission.microphone.status;
    if (status.isGranted) {
      return MicrophoneAccessStatus.granted;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      return MicrophoneAccessStatus.permanentlyDenied;
    }
    return MicrophoneAccessStatus.denied;
  }

  /// Opens this app's page in system Settings (Microphone toggle lives there).
  static Future<bool> openSettings() => openAppSettings();

  static String settingsHint() {
    if (Platform.isIOS) {
      return 'Open Settings, tap Umbrella, then enable Microphone.';
    }
    return 'Open Settings, tap Permissions, then allow Microphone.';
  }
}

/// Speech recognition permission for live captions during recording (iOS).
class SpeechRecognitionPermission {
  const SpeechRecognitionPermission._();

  static Future<bool> get isGranted async {
    if (!Platform.isIOS) return true;
    return (await Permission.speech.status).isGranted;
  }

  /// Shows the native Speech Recognition permission sheet on iOS.
  static Future<SpeechRecognitionAccessStatus> request() async {
    if (Platform.isAndroid) {
      return SpeechRecognitionAccessStatus.granted;
    }
    if (!Platform.isIOS) {
      return SpeechRecognitionAccessStatus.unavailable;
    }

    var status = await Permission.speech.status;
    if (status.isGranted) {
      return SpeechRecognitionAccessStatus.granted;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      return SpeechRecognitionAccessStatus.permanentlyDenied;
    }

    status = await Permission.speech.request();
    if (status.isGranted) {
      return SpeechRecognitionAccessStatus.granted;
    }

    status = await Permission.speech.status;
    if (status.isGranted) {
      return SpeechRecognitionAccessStatus.granted;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      return SpeechRecognitionAccessStatus.permanentlyDenied;
    }
    return SpeechRecognitionAccessStatus.denied;
  }

  static Future<bool> openSettings() => openAppSettings();

  static String settingsHint() {
    if (Platform.isIOS) {
      return 'Open Settings, tap Umbrella, then enable Speech Recognition.';
    }
    return 'Open Settings and allow microphone access for speech recognition.';
  }
}
