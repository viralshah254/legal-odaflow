import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:umbrella/core/geo/detect_country_service.dart';
import 'package:umbrella/core/providers/app_providers.dart';
import 'package:umbrella/core/storage/token_storage.dart';
import 'package:umbrella/features/splash/splash_screen.dart';
import 'package:umbrella/l10n/app_localizations.dart';

class DelayedStorage extends TokenStorage {
  DelayedStorage(this.access, {this.userJson});
  final Future<String?> access;
  final String? userJson;
  @override
  Future<String?> getAccessToken() => access;
  @override
  Future<String?> getRefreshToken() async => 'refresh';
  @override
  Future<String?> getUserJson() async => userJson;
}

Future<ProviderContainer> mount(
  WidgetTester tester,
  TokenStorage storage,
) async {
  final container = ProviderContainer(
    overrides: [
      tokenStorageProvider.overrideWithValue(storage),
      detectedLocationProvider.overrideWith(
        (_) async => const DetectedCountry(
          countryCode: 'IN',
          countryName: 'India',
          source: 'test',
        ),
      ),
    ],
  );
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (_, state) =>
        container.read(authControllerProvider).isBootstrapping &&
            state.matchedLocation != '/splash'
        ? '/splash'
        : null,
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(
        path: '/welcome',
        builder: (_, __) => const Scaffold(body: Text('Ready to sign in')),
      ),
    ],
  );
  addTearDown(() {
    router.dispose();
    container.dispose();
  });
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
      ),
    ),
  );
  return container;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'late session restoration does not strand splash after the old eight-second timer',
    (tester) async {
      final access = Completer<String?>();
      await mount(tester, DelayedStorage(access.future));
      await tester.pump(const Duration(seconds: 9));
      expect(find.text('Ready to sign in'), findsNothing);
      access.complete(null);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('Ready to sign in'), findsOneWidget);
    },
  );
  testWidgets(
    'corrupt session storage recovers to sign in without a partial session',
    (tester) async {
      final container = await mount(
        tester,
        DelayedStorage(Future.value('access'), userJson: '{bad-json'),
      );
      await tester.pump();
      await tester.pumpAndSettle();
      expect(container.read(authControllerProvider).session, isNull);
      expect(find.text('Ready to sign in'), findsOneWidget);
    },
  );
  testWidgets(
    'unresponsive secure storage is bounded and late completion cannot restore a session',
    (tester) async {
      final access = Completer<String?>();
      final container = await mount(tester, DelayedStorage(access.future));
      await tester.pump(const Duration(seconds: 11));
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('Ready to sign in'), findsOneWidget);
      access.complete('late-token');
      await tester.pump();
      expect(container.read(authControllerProvider).session, isNull);
      expect(container.read(authControllerProvider).isBootstrapping, isFalse);
    },
  );
}
