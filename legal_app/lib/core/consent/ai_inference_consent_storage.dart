import 'package:shared_preferences/shared_preferences.dart';

/// Versioned, account-scoped inference permission. Training consent is separate.
class AiInferenceConsentStorage {
  static const _prefix = 'ai_inference_v2_';
  static const _active = '${_prefix}active_scope';
  static const _defaultVersion = 'inference-v2';

  static Future<bool> hasGranted({String? scope, String? policyVersion}) async {
    final prefs = await SharedPreferences.getInstance();
    final current = scope ?? prefs.getString(_active) ?? 'device';
    final version = prefs.getString('$_prefix${current}_version');
    return version != null && (policyVersion == null || version == policyVersion) &&
        (prefs.getBool('$_prefix${current}_granted') ?? false);
  }

  static Future<bool> hasAnswered() async {
    final prefs = await SharedPreferences.getInstance();
    final scope = prefs.getString(_active) ?? 'device';
    return prefs.containsKey('$_prefix${scope}_granted');
  }

  static Future<void> setGranted(bool granted, {String scope = 'device', String policyVersion = _defaultVersion}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_active, scope);
    await prefs.setString('$_prefix${scope}_version', policyVersion);
    await prefs.setString('$_prefix${scope}_timestamp', DateTime.now().toUtc().toIso8601String());
    await prefs.setBool('$_prefix${scope}_granted', granted);
  }

  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in prefs.getKeys().where((key) => key.startsWith(_prefix) || key.startsWith('ai_inference_consent_')).toList()) {
      await prefs.remove(key);
    }
  }
}
