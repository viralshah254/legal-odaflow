import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'firebase_service.dart';

enum SocialAuthProvider { google, apple }

class SocialAuthService {
  SocialAuthService._();

  static bool get isAvailable =>
      FirebaseService.isConfigured && FirebaseService.auth != null;

  static bool get supportsApple =>
      !kIsWeb && (defaultTargetPlatform == TargetPlatform.iOS || Platform.isIOS);

  static Future<String> signIn(SocialAuthProvider provider) async {
    final auth = FirebaseService.auth;
    if (auth == null) {
      throw FirebaseAuthException(
        code: 'firebase-not-configured',
        message: 'Firebase is not configured for this build.',
      );
    }

    final UserCredential credential;
    switch (provider) {
      case SocialAuthProvider.google:
        credential = await _signInWithGoogle(auth);
      case SocialAuthProvider.apple:
        credential = await _signInWithApple(auth);
    }

    final idToken = await credential.user?.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw FirebaseAuthException(
        code: 'missing-id-token',
        message: 'Missing Firebase ID token.',
      );
    }
    return idToken;
  }

  static Future<UserCredential> _signInWithGoogle(FirebaseAuth auth) async {
    final googleSignIn = GoogleSignIn(scopes: const ['email', 'profile']);
    final googleUser = await googleSignIn.signIn();
    if (googleUser == null) {
      throw FirebaseAuthException(
        code: 'sign-in-cancelled',
        message: 'Google sign-in was cancelled.',
      );
    }

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    return auth.signInWithCredential(credential);
  }

  static Future<UserCredential> _signInWithApple(FirebaseAuth auth) async {
    final appleCredential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );

    final idToken = appleCredential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw FirebaseAuthException(
        code: 'missing-apple-id-token',
        message: 'Apple did not return an identity token.',
      );
    }

    final oauthCredential = OAuthProvider('apple.com').credential(
      idToken: idToken,
      accessToken: appleCredential.authorizationCode,
    );
    return auth.signInWithCredential(oauthCredential);
  }
}
