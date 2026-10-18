import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/drafting/action_context_prompts.dart';
import 'package:umbrella/core/drafting/draft_navigation.dart';
import 'package:umbrella/core/models/draft_intent.dart';

void main() {
  group('buildSupplementalFromActionNotes', () {
    test('formats per-action lines', () {
      final block = buildSupplementalFromActionNotes({
        'Obtain: Impugned Order': 'Family Court, 15 Feb 2025',
        'Draft: Written Statement': '',
      });
      expect(
        block,
        'Regarding "Obtain: Impugned Order": Family Court, 15 Feb 2025',
      );
    });
  });

  group('getActionContextPrompt', () {
    test('returns impugned order template', () {
      final prompt = getActionContextPrompt('Obtain: Impugned Order');
      expect(prompt?.actionKey, 'obtain_impugned_order');
    });
  });

  group('parseDraftUrl', () {
    test('maps india web draft url to params', () {
      final params = parseDraftUrl(
        '/app/india-drafting/draft?kind=india_regular_bail_bnss_480&label=Bail&details=Test',
      );
      expect(params.kind, 'india_regular_bail_bnss_480');
      expect(params.countryCode, 'IN');
      expect(params.details, 'Test');
    });

    test('maps us web draft url to params', () {
      final params = parseDraftUrl(
        '/app/us-drafting/draft?kind=us_motion_to_dismiss&details=Case',
      );
      expect(params.countryCode, 'US');
    });
  });

  group('DraftAnalyzeResult.fromJson', () {
    test('parses questions and context', () {
      final result = DraftAnalyzeResult.fromJson({
        'context': {'statuteConfidence': 'high', 'court': 'family_court'},
        'questions': [
          {
            'id': 'relief_sought',
            'prompt': 'What do you need?',
            'options': [
              {'value': 'challenge', 'label': 'Challenge order'},
            ],
          },
        ],
      });
      expect(result.questions.length, 1);
      expect(result.context.court, 'family_court');
    });
  });

  group('buildDocuDraftWorkspacePath', () {
    test('builds workspace route with query params', () {
      final path = buildDocuDraftWorkspacePath(
        const DocuDraftRouteParams(
          kind: 'india_regular_bail_bnss_480',
          label: 'Bail',
          countryCode: 'IN',
        ),
      );
      expect(path, contains('/lawyer/docu-draft/draft'));
      expect(path, contains('kind=india_regular_bail_bnss_480'));
    });
  });
}
