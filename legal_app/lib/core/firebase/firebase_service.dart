import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'firebase_options.dart';

/// Channel ID must match the value declared in AndroidManifest.xml
/// `com.google.firebase.messaging.default_notification_channel_id`.
const _kAndroidChannelId = 'umbrella_notifications';

class FirebaseService {
  FirebaseService._();

  static bool _initialized = false;

  static bool get isConfigured =>
      DefaultFirebaseOptions.currentPlatform.projectId.isNotEmpty &&
      DefaultFirebaseOptions.currentPlatform.apiKey.isNotEmpty;

  static bool get isInitialized => _initialized;

  static Future<void> initialize() async {
    if (_initialized) return;
    if (!isConfigured) return;

    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } on FirebaseException catch (e) {
      if (e.code != 'duplicate-app') rethrow;
      // On hot restart the Dart VM resets statics but the native Firebase
      // plugin keeps the default app alive — swallow duplicate-app and continue.
    }

    if (!kIsWeb) {
      await _setupMessaging();
      if (defaultTargetPlatform == TargetPlatform.android) {
        await _createAndroidNotificationChannel();
      }
    }

    _initialized = true;
  }

  static Future<void> _setupMessaging() async {
    final messaging = FirebaseMessaging.instance;

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  /// Creates the default notification channel on Android 8+ so notifications
  /// are grouped under "Umbrella Notifications" rather than "Miscellaneous".
  static Future<void> _createAndroidNotificationChannel() async {
    // Use a MethodChannel to call the native Android channel creation API.
    // The `flutter_local_notifications` plugin is not required — we call the
    // platform channel directly via the standard method.
    const channel = MethodChannel('com.umbrella.app/notifications');
    try {
      await channel.invokeMethod<void>('createNotificationChannel', {
        'id': _kAndroidChannelId,
        'name': 'Umbrella Notifications',
        'description': 'Task reminders, case updates, and alerts',
        'importance': 4, // IMPORTANCE_HIGH
      });
    } on MissingPluginException {
      // Native side not yet wired — safe to ignore; FCM still shows
      // notifications on its own default channel.
    } catch (_) {
      // Best-effort.
    }
  }

  static FirebaseAuth? get auth {
    if (!isConfigured || !_initialized) return null;
    return FirebaseAuth.instance;
  }

  static Future<String?> getIdToken() async {
    final user = auth?.currentUser;
    if (user == null) return null;
    return user.getIdToken();
  }

  /// Returns Firebase sign-in methods for [email], e.g. `password`, `google.com`.
  /// Empty when Firebase is unavailable or the lookup fails.
  ///
  /// Uses deprecated Firebase email-method lookup intentionally for unified auth
  /// branching until a non-enumerating replacement is available.
  static Future<List<String>> fetchSignInMethodsForEmail(String email) async {
    final firebaseAuth = auth;
    if (firebaseAuth == null) return const [];
    try {
      // ignore: deprecated_member_use
      return await firebaseAuth.fetchSignInMethodsForEmail(email.trim());
    } catch (_) {
      return const [];
    }
  }

  static Future<void> sendPasswordResetEmail(String email) async {
    final firebaseAuth = auth;
    if (firebaseAuth == null) {
      throw StateError('Firebase is not configured');
    }
    await firebaseAuth.sendPasswordResetEmail(email: email.trim());
  }

  static Future<String?> getFcmToken() async {
    if (!isConfigured || !_initialized || kIsWeb) return null;
    try {
      return FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }
}
