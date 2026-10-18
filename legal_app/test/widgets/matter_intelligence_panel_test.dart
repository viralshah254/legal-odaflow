import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/models/matter_intelligence.dart';
import 'package:umbrella/core/widgets/matter_intelligence_summary_card.dart';

void main() {
  testWidgets('MatterIntelligenceSummaryCard renders profile chips and actions', (tester) async {
    const profile = MatterProfile(
      country: 'IN',
      practiceArea: 'employment_labour',
      subPracticeArea: 'wrongful_termination',
      nature: 'dispute',
      forum: 'labour_court',
      remedies: ['reinstatement'],
      issues: ['Illegal termination without inquiry'],
      documentTypes: ['labour_court_petition'],
      curatedKinds: [],
      confidence: 0.88,
    );

    const taskGraph = MatterTaskGraph(
      recommendedActions: ['File labour court petition'],
      missingDocuments: ['Termination letter'],
      nextBestAction: 'Send legal notice first',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MatterIntelligenceSummaryCard(
            profile: profile,
            taskGraph: taskGraph,
          ),
        ),
      ),
    );

    expect(find.textContaining('Employment'), findsOneWidget);
    expect(find.text('File labour court petition'), findsOneWidget);
    expect(find.text('Send legal notice first'), findsOneWidget);
  });
}
