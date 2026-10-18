import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/models/draft_intent.dart';
import 'package:umbrella/core/models/matter_intelligence.dart';
import 'package:umbrella/features/lawyer/docu_draft/providers/docu_draft_controller.dart';
import 'package:umbrella/features/lawyer/docu_draft/widgets/draft_intent_steps.dart';
import 'package:umbrella/l10n/app_localizations.dart';

class _TestDocuDraftController extends DocuDraftController {
  _TestDocuDraftController(super.ref, DocuDraftState initial) : super() {
    state = initial;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final ramRiaAnalysis = DraftAnalyzeResult(
    context: const DraftContext(
      statute: 'dv_act',
      court: 'family_court',
      orderType: 'interim',
    ),
    questions: const [],
    extractedFacts: const ExtractedMatterFacts(
      parties: {},
      summaryLines: [
        'Parties: Ram vs Ria',
        'Proceeding: Domestic Violence case',
        'Interim order: ₹100000/month',
      ],
    ),
    matterProfile: const MatterProfile(
      country: 'IN',
      practiceArea: 'family_matrimonial',
      subPracticeArea: 'maintenance',
      nature: 'dispute',
      forum: 'family_court',
      confidence: 0.71,
      issues: ['marriage validity', 'earning capacity'],
    ),
    taskGraph: const MatterTaskGraph(
      recommendedActions: [
        'Review case facts and documents',
        'Identify legal issues and forum',
      ],
    ),
    recommendedActions: const [
      'Review case facts and documents',
      'Identify legal issues and forum',
    ],
    nextBestAction: 'Obtain: Impugned Order',
  );

  testWidgets('context review renders MI panel with next best action', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          docuDraftControllerProvider.overrideWith(
            (ref) => _TestDocuDraftController(
              ref,
              DocuDraftState(
                step: DocuDraftStep.contextReview,
                analysisResult: ramRiaAnalysis,
              ),
            ),
          ),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: SingleChildScrollView(child: DraftContextReviewStep()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Matter intelligence'), findsOneWidget);
    expect(find.text('Obtain: Impugned Order'), findsWidgets);
    expect(find.text('Review case facts and documents'), findsWidgets);
    expect(find.text('What we understood'), findsOneWidget);
    expect(find.text('Domestic Violence Act'), findsOneWidget);
  });
}
