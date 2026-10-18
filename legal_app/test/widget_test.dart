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

void main() {
  testWidgets('Welcome screen shows sign-in, sign-up, and preview actions', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: WelcomeScreen()));

    expect(find.text('Your legal brain'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Create Account'), findsOneWidget);
    expect(find.text('Try for free - no account needed'), findsOneWidget);
  });

  testWidgets('Sign-up screen starts with account type choices', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: SignUpScreen())),
    );

    expect(find.text('How will you use Umbrella?'), findsOneWidget);
    expect(find.text('Individual'), findsOneWidget);
    expect(find.text('Law Firm'), findsOneWidget);
  });

  testWidgets('Privacy security screen shows mobile controls', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PrivacySecurityScreen()));

    expect(find.text('Privacy & Security'), findsOneWidget);
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
        child: const MaterialApp(home: BillingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Billing'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(find.text('INV-1'), findsOneWidget);
  });

  testWidgets('Create matter screen shows core fields', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clientsListProvider(null).overrideWith(
            (ref) async => const [FirmClient(id: 'client_1', name: 'Acme Ltd')],
          ),
        ],
        child: const MaterialApp(home: CreateMatterScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New matter'), findsOneWidget);
    expect(find.text('Matter title'), findsOneWidget);
    expect(find.text('Practice area'), findsOneWidget);
  });
}
