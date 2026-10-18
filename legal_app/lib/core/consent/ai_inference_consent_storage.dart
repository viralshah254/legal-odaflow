import 'package:shared_preferences/shared_preferences.dart';

/// Persists whether the user has granted consent for their data to be sent to
/// third-party AI providers for inference (not training).
///
/// Required by Apple App Store guidelines 5.1.1(i) and 5.1.2(i).
class AiInferenceConsentStorage {
  static const _keyGranted = 'ai_inference_consent_granted';
  static const _keyTimestamp = 'ai_inference_consent_timestamp';

  /// Returns true if the user has previously granted AI inference consent.
  static Future<bool> hasGranted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyGranted) ?? false;
  }

  /// Returns true if the consent has been answered (either granted or denied).
  static Future<bool> hasAnswered() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_keyGranted);
  }

  /// Persists the user's consent decision.
  static Future<void> setGranted(bool granted) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyGranted, granted);
    await prefs.setString(
      _keyTimestamp,
      DateTime.now().toUtc().toIso8601String(),
    );
  }

  /// Clears the consent record so the dialog is shown again on next AI use.
  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyGranted);
    await prefs.remove(_keyTimestamp);
  }
}
