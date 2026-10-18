import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../l10n/app_localizations.dart';
import '../network/api_client.dart';
import 'social_auth_provider.dart';

String mapFirebaseAuthError(FirebaseAuthException error, AppLocalizations l10n) {
  switch (error.code) {
    case 'email-already-in-use':
      return l10n.authEmailAlreadyInUse;
    case 'invalid-email':
      return l10n.authInvalidEmail;
    case 'user-disabled':
      return l10n.authAccountDisabled;
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
      return l10n.authInvalidCredentials;
    case 'too-many-requests':
      return l10n.authTooManyAttempts;
    case 'network-request-failed':
      return l10n.authNetworkError;
    case 'popup-closed-by-user':
    case 'cancelled-popup-request':
      return l10n.authSocialSignInCancelled;
    default:
      final message = error.message?.trim();
      if (message != null && message.isNotEmpty) return message;
      return l10n.authSocialSignInFailed;
  }
}

bool isFirebaseAuthCancelled(Object error) {
  if (error is FirebaseAuthException) {
    return error.code == 'popup-closed-by-user' ||
        error.code == 'cancelled-popup-request';
  }
  if (error is SignInWithAppleAuthorizationException) {
    return error.code == AuthorizationErrorCode.canceled;
  }
  if (error is PlatformException && error.code == 'sign_in_canceled') {
    return true;
  }
  final message = error.toString().toLowerCase();
  return message.contains('sign_in_canceled') ||
      message.contains('canceled') ||
      message.contains('cancelled');
}

/// Maps Firebase auth errors during Google/Apple sign-in.
/// Avoids showing email/password copy for credential failures on social flows.
String mapSocialFirebaseAuthError(
  FirebaseAuthException error,
  AppLocalizations l10n, {
  SocialAuthProvider? provider,
}) {
  switch (error.code) {
    case 'invalid-credential':
    case 'account-exists-with-different-credential':
    case 'missing-apple-id-token':
      if (provider == SocialAuthProvider.apple) {
        return l10n.authSocialSignInFailed;
      }
      return l10n.authSocialSignInFailed;
    default:
      return mapFirebaseAuthError(error, l10n);
  }
}

String mapSocialAuthError(
  Object error,
  AppLocalizations l10n, {
  SocialAuthProvider? provider,
}) {
  if (error is FirebaseAuthException) {
    return mapSocialFirebaseAuthError(error, l10n, provider: provider);
  }
  if (error is SignInWithAppleAuthorizationException) {
    if (error.code == AuthorizationErrorCode.canceled) {
      return l10n.authSocialSignInCancelled;
    }
    final message = error.message.trim();
    if (message.isNotEmpty) return message;
    return l10n.authSocialSignInFailed;
  }
  if (error is PlatformException) {
    if (error.code == 'sign_in_canceled') {
      return l10n.authSocialSignInCancelled;
    }
    final message = error.message?.trim();
    if (message != null && message.isNotEmpty) return message;
  }
  if (error is ApiException) {
    return error.message;
  }
  if (error is StateError) {
    final message = error.message.trim();
    if (message.isNotEmpty) return message;
  }
  return l10n.authSocialSignInFailed;
}

bool isFirebaseCredentialMismatch(FirebaseAuthException error) {
  return error.code == 'invalid-credential' ||
      error.code == 'wrong-password' ||
      error.code == 'user-not-found';
}

bool isFirebaseUserNotFound(FirebaseAuthException error) {
  return error.code == 'user-not-found' ||
      error.code == 'invalid-credential';
}

bool isFirebaseAuthUnavailable(Object error) {
  if (error is FirebaseAuthException) {
    final msg = error.message ?? '';
    return msg.contains('CONFIGURATION_NOT_FOUND') ||
        error.code == 'internal-error' ||
        error.code == 'operation-not-allowed';
  }
  return false;
}
