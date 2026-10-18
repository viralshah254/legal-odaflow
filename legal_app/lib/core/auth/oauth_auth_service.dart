import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../config/app_config.dart';
import '../firebase/firebase_service.dart';
import '../models/models.dart';
import '../network/auth_api.dart';
import 'profile_completion.dart';
import 'social_auth_provider.dart';

/// Web client ID from Firebase console — pass via --dart-define=GOOGLE_WEB_CLIENT_ID=...
/// Required for Android Google Sign-In to obtain a valid Firebase ID token.

sealed class OAuthSignInOutcome {}

class OAuthAuthenticated extends OAuthSignInOutcome {
  OAuthAuthenticated(this.session);

  final AuthSession session;
}

class OAuthProfileCompletionNeeded extends OAuthSignInOutcome {
  OAuthProfileCompletionNeeded(this.profile);

  final OAuthProfileCompletionState profile;
}

class OAuthAuthService {
  OAuthAuthService(this._authApi);

  final AuthApi _authApi;
  String? _cachedOAuthName;

  Future<OAuthSignInOutcome> signInWithProvider(
    SocialAuthProvider provider, {
    String? deviceFingerprint,
    String? referralCode,
  }) async {
    final auth = FirebaseService.auth;
    if (auth == null) {
      throw StateError('Firebase is not configured');
    }

    final credential = switch (provider) {
      SocialAuthProvider.google => await _signInWithGoogle(auth),
      SocialAuthProvider.apple => await _signInWithApple(auth),
    };

    _rememberOAuthProfile(credential);

    final idToken = await credential.user?.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw FirebaseAuthException(
        code: 'missing-id-token',
        message: 'Missing Firebase ID token.',
      );
    }

    return _attemptBackendLogin(
      idToken: idToken,
      provider: provider,
      deviceFingerprint: deviceFingerprint,
      referralCode: referralCode,
    );
  }

  Future<OAuthSignInOutcome> completeProfile({
    required String idToken,
    required SocialAuthProvider provider,
    required String userType,
    required String countryCode,
    String? jurisdiction,
    String? name,
    String? firmName,
    String? phone,
    String? deviceFingerprint,
    String? referralCode,
  }) async {
    try {
      final session = await _authApi.loginWithFirebase(
        idToken: idToken,
        userType: userType,
        countryCode: countryCode,
        jurisdiction: jurisdiction,
        name: name,
        firmName: firmName,
        phone: phone,
        deviceFingerprint: deviceFingerprint,
        referralCode: referralCode,
      );
      return OAuthAuthenticated(session);
    } on ProfileCompletionRequiredException catch (error) {
      return OAuthProfileCompletionNeeded(
        OAuthProfileCompletionState(
          email: error.profile.email,
          name: error.profile.name ?? _cachedOAuthName,
          provider: provider,
        ),
      );
    }
  }

  Future<OAuthSignInOutcome> _attemptBackendLogin({
    required String idToken,
    required SocialAuthProvider provider,
    String? deviceFingerprint,
    String? referralCode,
  }) async {
    try {
      final session = await _authApi.loginWithFirebase(
        idToken: idToken,
        deviceFingerprint: deviceFingerprint,
        referralCode: referralCode,
      );
      return OAuthAuthenticated(session);
    } on ProfileCompletionRequiredException catch (error) {
      final firebaseUser = FirebaseService.auth?.currentUser;
      return OAuthProfileCompletionNeeded(
        OAuthProfileCompletionState(
          email: error.profile.email,
          name: error.profile.name ??
              _cachedOAuthName ??
              firebaseUser?.displayName,
          provider: provider,
        ),
      );
    }
  }

  Future<UserCredential> _signInWithGoogle(FirebaseAuth auth) async {
    final googleSignIn = _createGoogleSignIn();
    await googleSignIn.signOut();

    final account = await googleSignIn.signIn();
    if (account == null) {
      throw FirebaseAuthException(
        code: 'popup-closed-by-user',
        message: 'Sign in cancelled',
      );
    }

    final googleAuth = await account.authentication;
    if (googleAuth.idToken == null || googleAuth.idToken!.isEmpty) {
      throw FirebaseAuthException(
        code: 'invalid-credential',
        message: 'Google did not return an ID token.',
      );
    }

    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    return auth.signInWithCredential(credential);
  }

  GoogleSignIn _createGoogleSignIn() {
    final webClientId = AppConfig.googleWebClientId.trim();
    final iosClientId = AppConfig.googleIosClientId.trim();
    final useIosClientId = !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.iOS ||
            defaultTargetPlatform == TargetPlatform.macOS);

    return GoogleSignIn(
      scopes: const ['email', 'profile'],
      clientId: useIosClientId && iosClientId.isNotEmpty ? iosClientId : null,
      serverClientId: webClientId.isNotEmpty ? webClientId : null,
    );
  }

  Future<UserCredential> _signInWithApple(FirebaseAuth auth) async {
    await auth.signOut();

    final rawNonce = _generateNonce();
    final nonce = sha256.convert(utf8.encode(rawNonce)).toString();

    final appleCredential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: nonce,
    );

    final identityToken = appleCredential.identityToken;
    if (identityToken == null || identityToken.isEmpty) {
      throw FirebaseAuthException(
        code: 'missing-apple-id-token',
        message: 'Apple did not return an identity token.',
      );
    }

    final authorizationCode = appleCredential.authorizationCode.trim();
    final oauthCredential = OAuthProvider('apple.com').credential(
      idToken: identityToken,
      rawNonce: rawNonce,
      accessToken:
          authorizationCode.isNotEmpty ? authorizationCode : null,
    );

    final result = await auth.signInWithCredential(oauthCredential);

    // Apple only returns the name on first authorization.
    final given = appleCredential.givenName;
    final family = appleCredential.familyName;
    if (given != null || family != null) {
      _cachedOAuthName = [given, family].whereType<String>().join(' ').trim();
    }

    return result;
  }

  void _rememberOAuthProfile(UserCredential credential) {
    final displayName = credential.user?.displayName?.trim();
    if (displayName != null && displayName.isNotEmpty) {
      _cachedOAuthName = displayName;
    }
  }

  String? get cachedOAuthName => _cachedOAuthName;

  static String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }
}
