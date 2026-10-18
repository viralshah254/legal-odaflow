import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

import '../firebase/firebase_service.dart';

class PhoneAuthException implements Exception {
  PhoneAuthException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

/// Native Firebase phone auth (no reCAPTCHA on iOS/Android).
class PhoneAuthService {
  String? _verificationId;
  int? _resendToken;

  bool get hasPendingVerification => _verificationId != null;

  Future<void> sendOtp(String phoneNumber, {bool resend = false}) async {
    final auth = FirebaseService.auth;
    if (auth == null) {
      throw PhoneAuthException('Firebase is not configured');
    }

    final normalized = phoneNumber.trim();
    if (normalized.length < 10) {
      throw PhoneAuthException('Enter a valid phone number with country code');
    }

    final completer = Completer<void>();
    FirebaseAuthException? failure;

    await auth.verifyPhoneNumber(
      phoneNumber: normalized,
      timeout: const Duration(seconds: 60),
      forceResendingToken: resend ? _resendToken : null,
      verificationCompleted: (PhoneAuthCredential credential) async {
        try {
          await auth.signInWithCredential(credential);
          if (!completer.isCompleted) completer.complete();
        } catch (error) {
          if (!completer.isCompleted) completer.completeError(error);
        }
      },
      verificationFailed: (FirebaseAuthException error) {
        failure = error;
        if (!completer.isCompleted) completer.completeError(error);
      },
      codeSent: (verificationId, forceResendingToken) {
        _verificationId = verificationId;
        _resendToken = forceResendingToken;
        if (!completer.isCompleted) completer.complete();
      },
      codeAutoRetrievalTimeout: (verificationId) {
        _verificationId = verificationId;
      },
    );

    try {
      await completer.future;
    } on FirebaseAuthException catch (error) {
      throw PhoneAuthException(
        error.message ?? 'Could not send verification code',
        code: error.code,
      );
    } catch (error) {
      if (failure != null) {
        throw PhoneAuthException(
          failure!.message ?? 'Could not send verification code',
          code: failure!.code,
        );
      }
      rethrow;
    }
  }

  /// Returns true when Firebase auto-verified the number (Android).
  bool get wasAutoVerified => FirebaseService.auth?.currentUser != null;

  Future<void> verifyOtp(String smsCode) async {
    final auth = FirebaseService.auth;
    final verificationId = _verificationId;
    if (auth == null) {
      throw PhoneAuthException('Firebase is not configured');
    }
    if (verificationId == null) {
      throw PhoneAuthException('Request a verification code first');
    }

    final code = smsCode.trim();
    if (code.length < 6) {
      throw PhoneAuthException('Enter the 6-digit code');
    }

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: code,
      );
      await auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (error) {
      throw PhoneAuthException(
        error.message ?? 'Invalid verification code',
        code: error.code,
      );
    }
  }

  void reset() {
    _verificationId = null;
    _resendToken = null;
  }
}
