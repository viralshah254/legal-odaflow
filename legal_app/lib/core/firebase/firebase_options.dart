import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for `umbrella-95da1`.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return ios;
      default:
        return web;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBPdkszLSMowG1AyqMiranS9N6w6fPAtkg',
    appId: '1:1034275934580:web:157abba3fcd6869f809c21',
    messagingSenderId: '1034275934580',
    projectId: 'umbrella-95da1',
    authDomain: 'umbrella-95da1.firebaseapp.com',
    storageBucket: 'umbrella-95da1.firebasestorage.app',
    measurementId: 'G-J9C1K9SFBZ',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAGcWqTQKWtdp1_FJtsgwpe7H3b3cpAX2I',
    appId: '1:1034275934580:android:3666a91b7cad3c99809c21',
    messagingSenderId: '1034275934580',
    projectId: 'umbrella-95da1',
    storageBucket: 'umbrella-95da1.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBepRr4yidIjg3q0jwoaF7ILDH92ji4zzU',
    appId: '1:1034275934580:ios:db7806aec20e6139809c21',
    messagingSenderId: '1034275934580',
    projectId: 'umbrella-95da1',
    storageBucket: 'umbrella-95da1.firebasestorage.app',
    iosBundleId: 'com.dvtechventures.umbrella',
  );
}
