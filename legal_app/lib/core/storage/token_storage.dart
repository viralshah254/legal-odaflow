import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _countryCodeKey = 'country_code';
  static const _anonymousSessionIdKey = 'issue_checker_anonymous_session_id';
  static const _userJsonKey = 'auth_user';

  final FlutterSecureStorage _storage;

  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<String?> getCountryCode() => _storage.read(key: _countryCodeKey);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String? userJson,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    if (userJson != null) {
      await _storage.write(key: _userJsonKey, value: userJson);
    }
  }

  Future<String?> getUserJson() => _storage.read(key: _userJsonKey);

  Future<void> saveCountryCode(String countryCode) {
    return _storage.write(key: _countryCodeKey, value: countryCode);
  }

  Future<String?> getAnonymousSessionId() =>
      _storage.read(key: _anonymousSessionIdKey);

  Future<void> saveAnonymousSessionId(String sessionId) {
    return _storage.write(key: _anonymousSessionIdKey, value: sessionId);
  }

  Future<void> clearAnonymousSessionId() {
    return _storage.delete(key: _anonymousSessionIdKey);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _userJsonKey);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
