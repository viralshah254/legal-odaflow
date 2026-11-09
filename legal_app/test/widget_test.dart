import 'package:go_router/go_router.dart';
import 'package:umbrella/core/tutorials/tutorial_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:umbrella/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:umbrella/core/models/models.dart';
import 'package:umbrella/features/auth/sign_up_screen.dart';
import 'package:umbrella/features/auth/welcome_screen.dart';
import 'package:umbrella/features/lawyer/billing/billing_screen.dart';
import 'package:umbrella/features/lawyer/clients/clients_list_screen.dart';
import 'package:umbrella/features/lawyer/matters/create_matter_screen.dart';
import 'package:umbrella/features/settings/privacy_security_screen.dart';

Widget localizedApp(Widget home) {
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => UmbrellaShowcaseScope(builder: (_) => home)),
    GoRoute(path: '/auth', builder: (_, __) => const Scaffold(body: Text('Authentication entry'))),
  ]);
  addTearDown(router.dispose);
  return MaterialApp.router(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    routerConfig: router,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets('Welcome screen shows sign-in, sign-up, and preview actions', (
    tester,
  ) async {
    await tester.pumpWidget(localizedApp(const WelcomeScreen()));

    expect(find.text('Legal clarity'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
    expect(find.text('Try for free'), findsOneWidget);
    expect(find.text('no account needed'), findsOneWidget);
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('Authentication entry'), findsOneWidget);
  });

  testWidgets('Sign-up screen starts with account type choices', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(child: localizedApp(const SignUpScreen(initialEmail: 'test@example.invalid'))),
    );

    expect(find.text('How will you use Umbrella?'), findsOneWidget);
    expect(find.text('Individual'), findsOneWidget);
    expect(find.text('Law Firm'), findsOneWidget);
  });

  testWidgets('Privacy security screen shows mobile controls', (tester) async {
    await tester.pumpWidget(localizedApp(const PrivacySecurityScreen()));

    expect(find.text('Privacy & security'), findsOneWidget);
    expect(find.text('Secure token storage'), findsOneWidget);
    expect(find.text('Biometrics readiness'), findsOneWidget);
  });

  testWidgets('Billing screen shows invoice and payment tabs', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          firmInvoicesProvider(null).overrideWith(
            (ref) async => const [
              FirmInvoice(
                id: 'inv_1',
                invoiceNumber: 'INV-1',
                amount: 1200,
                currency: 'USD',
                status: 'SENT',
              ),
            ],
          ),
          firmPaymentsProvider.overrideWith(
            (ref) async => const [
              AppPayment(
                id: 'pay_1',
                amount: 500,
                currency: 'USD',
                status: 'PAID',
                purpose: 'Invoice payment',
              ),
            ],
          ),
        ],
        child: localizedApp(const BillingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Billing'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(find.text('INV-1'), findsOneWidget);
  });

  testWidgets('Create matter screen starts with classification and practice area', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clientsListProvider(null).overrideWith(
            (ref) async => const [FirmClient(id: 'client_1', name: 'Acme Ltd')],
          ),
        ],
        child: localizedApp(const CreateMatterScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New matter'), findsOneWidget);
    expect(find.text('Classification'), findsOneWidget);
    expect(find.text('Practice area'), findsOneWidget);
  });
}
