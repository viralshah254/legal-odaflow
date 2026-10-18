import 'package:shared_preferences/shared_preferences.dart';

const _refStorageKey = 'umbrella_ref_code';
const _refStorageExpiryKey = 'umbrella_ref_code_expiry';
const _refTtlMs = 30 * 24 * 60 * 60 * 1000;

/// Read referral code from URL or local storage (survives OAuth redirects).
Future<String?> resolveReferralCode(String? urlRef) async {
  if (urlRef != null && urlRef.trim().isNotEmpty) {
    return urlRef.trim().toUpperCase();
  }
  final prefs = await SharedPreferences.getInstance();
  final stored = prefs.getString(_refStorageKey);
  final expiry = prefs.getInt(_refStorageExpiryKey);
  if (stored != null && expiry != null && DateTime.now().millisecondsSinceEpoch < expiry) {
    return stored;
  }
  return null;
}

/// Persist ?ref= from URL so OAuth redirects keep attribution.
Future<void> persistReferralCode(String? refCode) async {
  if (refCode == null || refCode.trim().isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_refStorageKey, refCode.trim().toUpperCase());
  await prefs.setInt(
    _refStorageExpiryKey,
    DateTime.now().millisecondsSinceEpoch + _refTtlMs,
  );
}

Future<void> clearPersistedReferralCode() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_refStorageKey);
  await prefs.remove(_refStorageExpiryKey);
}
